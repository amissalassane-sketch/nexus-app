// ============================================================
// NEXUS ADMIN — AUDIT TRAIL
// ============================================================
// Two destinations, deliberately different:
//
//   * Server log  — best effort, always available, no database needed.
//                   Used for anything that must be visible even when the
//                   platform tables are unreachable.
//   * admin_audit_log — the durable, append-only record. Written through
//                   SECURITY DEFINER functions that re-check the caller.
//                   The table itself refuses UPDATE, DELETE and TRUNCATE,
//                   so no admin (including an owner) can rewrite history.
//
// A failing audit write must never break the screen that triggered it:
// the operator needs to see the page, and the failure is logged loudly on
// the server instead.
// ============================================================

import { withTimeout } from "@/lib/auth-flow";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Audit writes are fire-and-forget from the caller's point of view, but
 *  they are still bounded: a stalled insert must not hold a render. */
const AUDIT_TIMEOUT_MS = 5_000;

export type AdminAuditMeta = Record<string, string | number | boolean | null>;

/** Structured server-side log. Mirrors logBootstrapEvent()'s shape so the
 *  platform's operational events all look the same in the log stream. */
export function logAdminEvent(
  event: string,
  meta: AdminAuditMeta = {}
): void {
  const safe = Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined)
  );
  console.info(`[nexus-admin] ${event}`, safe);
}

export type AdminAuditResult =
  | { written: true; id: string }
  | { written: false; reason: string };

/** Records a privileged action in the durable trail. Call this from every
 *  admin action surface (PR 3 onwards) — before or after the action, but
 *  always on the server. */
export async function recordAdminAudit(
  action: string,
  options: {
    outcome?: "success" | "denied" | "failed";
    targetType?: string;
    targetId?: string;
    metadata?: AdminAuditMeta;
    ipAddress?: string | null;
    userAgent?: string | null;
  } = {}
): Promise<AdminAuditResult> {
  if (!isSupabaseConfigured()) {
    logAdminEvent("AUDIT_SKIPPED", { action, reason: "SUPABASE_NOT_CONFIGURED" });
    return { written: false, reason: "SUPABASE_NOT_CONFIGURED" };
  }

  const supabase = await createClient();
  const controller = new AbortController();

  try {
    const { data, error } = await withTimeout(
      Promise.resolve(
        supabase
          .rpc("admin_audit_record", {
            p_action: action,
            p_outcome: options.outcome ?? "success",
            p_target_type: options.targetType ?? null,
            p_target_id: options.targetId ?? null,
            p_metadata: options.metadata ?? {},
            p_ip_address: options.ipAddress ?? null,
            p_user_agent: options.userAgent ?? null,
          })
          .abortSignal(controller.signal)
      ),
      AUDIT_TIMEOUT_MS,
      "ADMIN_AUDIT_TIMEOUT",
      controller
    );

    if (error || !data) {
      logAdminEvent("AUDIT_WRITE_FAILED", {
        action,
        code: error?.code ?? null,
        message: error?.message ?? "no id returned",
      });
      return { written: false, reason: error?.code ?? "NO_ID" };
    }

    return { written: true, id: String(data) };
  } catch (cause) {
    logAdminEvent("AUDIT_WRITE_FAILED", {
      action,
      reason: cause instanceof Error ? cause.message : "unknown",
    });
    return { written: false, reason: "TIMEOUT" };
  }
}

/** Records that a signed-in user tried to reach the control plane and was
 *  refused. Narrow by construction: the action and outcome are fixed in
 *  SQL, the actor comes from the JWT, and the database keeps at most one
 *  such row per actor per 5 minutes. */
export async function recordAdminAccessDenied(options: {
  reason: string;
  path?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  logAdminEvent("ADMIN_ACCESS_DENIED", {
    reason: options.reason,
    path: options.path ?? null,
  });

  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const controller = new AbortController();

  try {
    await withTimeout(
      Promise.resolve(
        supabase
          .rpc("admin_audit_record_denied", {
            p_reason: options.reason,
            p_path: options.path ?? null,
            p_ip_address: options.ipAddress ?? null,
            p_user_agent: options.userAgent ?? null,
          })
          .abortSignal(controller.signal)
      ),
      AUDIT_TIMEOUT_MS,
      "ADMIN_AUDIT_DENIED_TIMEOUT",
      controller
    );
  } catch {
    // Already logged above; the durable write is best effort.
  }
}

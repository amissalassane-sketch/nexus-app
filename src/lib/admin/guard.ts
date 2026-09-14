// ============================================================
// NEXUS ADMIN — SERVER-SIDE ACCESS GATE
// ============================================================
// This is the only thing standing between a signed-in customer and the
// platform's internals. It is deliberately boring:
//
//   1. Resolve the user from the Supabase session (server-only, cookie
//      based — the same session the rest of the app uses).
//   2. Ask Postgres who that user is, through platform_admin_context().
//      The answer comes from public.platform_admins, a table with RLS
//      enabled and no policies: the row either exists or it does not.
//   3. Anything that goes wrong resolves to "not an admin".
//
// There is no client-side half to this. No cookie is read, no header is
// trusted, no localStorage is consulted, and no pathname is inspected.
// Knowing the URL /admin grants exactly nothing, because the layout that
// renders it calls requirePlatformAdminContext() on the server and the
// database says no.
//
// Fail closed, always:
//   * Supabase not configured      → unavailable
//   * migration 026 not applied    → unavailable
//   * RPC times out                → unavailable (and the request is
//                                    cancelled, not left running)
//   * RPC returns anything odd     → unavailable
// ============================================================

import { cache } from "react";
import { getAuthenticatedUser } from "@/lib/auth";
import { withTimeout } from "@/lib/auth-flow";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  isPlatformAdminRole,
  type AdminUnavailableReason,
  type PlatformAdminState,
} from "./types";

/** The gate must never hold a page open. Anything slower than this is
 *  treated as "we cannot verify you", which denies access. */
const ADMIN_GUARD_TIMEOUT_MS = 6_000;

type ContextRpcResponse = {
  is_admin?: unknown;
  role?: unknown;
  user_id?: unknown;
};

/**
 * Maps a failed identity lookup onto a reason the operator can act on.
 *
 * The distinction that matters: "the control plane is not installed here"
 * (migration 026 missing) and "the lookup broke" are both refusals, but
 * they send the operator to completely different places. PostgREST reports
 * an unknown function as 404 / PGRST202, so that is what identifies the
 * first case.
 *
 * Exported as a pure function because it is the one branch of the gate
 * that cannot be exercised through a stubbed PostgREST.
 */
export function classifyGuardError(error: {
  code?: string | null;
  message?: string | null;
}): AdminUnavailableReason {
  const code = String(error.code ?? "");
  const message = String(error.message ?? "").toLowerCase();

  const missingFunction =
    code === "404" ||
    code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("platform_admin_context");

  if (missingFunction) return "MIGRATION_NOT_APPLIED";
  return "QUERY_FAILED";
}

/** Resolves the caller's platform-admin identity once per request.
 *  `cache()` means the layout, the page and any nested component can all
 *  call this without paying for more than one round trip. */
export const getPlatformAdminState = cache(async (): Promise<PlatformAdminState> => {
  const user = await getAuthenticatedUser();
  if (!user) return { status: "unauthenticated" };

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", reason: "SUPABASE_NOT_CONFIGURED" };
  }

  const supabase = await createClient();
  const controller = new AbortController();

  try {
    const { data, error } = await withTimeout(
      Promise.resolve(
        supabase.rpc("platform_admin_context").abortSignal(controller.signal)
      ),
      ADMIN_GUARD_TIMEOUT_MS,
      "ADMIN_GUARD_TIMEOUT",
      controller
    );

    if (error) {
      return { status: "unavailable", reason: classifyGuardError(error) };
    }

    const payload = data as ContextRpcResponse | null;
    // A response that is not an object means the function exists but did
    // not return what this build expects. Treated as a failed check: the
    // caller is not granted access on the strength of a malformed answer.
    if (!payload || typeof payload !== "object") {
      return { status: "unavailable", reason: "QUERY_FAILED" };
    }

    if (payload.is_admin !== true || !isPlatformAdminRole(payload.role)) {
      return { status: "not_admin", userId: user.id };
    }

    return { status: "admin", userId: user.id, role: payload.role };
  } catch (cause) {
    const timedOut =
      cause instanceof Error && cause.message.includes("ADMIN_GUARD_TIMEOUT");
    return { status: "unavailable", reason: timedOut ? "TIMEOUT" : "QUERY_FAILED" };
  }
});

/** True only for a verified platform admin. */
export async function isPlatformAdmin(): Promise<boolean> {
  const state = await getPlatformAdminState();
  return state.status === "admin";
}

/** The admin identity, or null. The admin layout renders an explicit
 *  "platform access required" screen for null instead of redirecting, so
 *  a signed-in operator is never bounced through /login in a loop. */
export async function requirePlatformAdminContext(): Promise<
  Extract<PlatformAdminState, { status: "admin" }> | null
> {
  const state = await getPlatformAdminState();
  return state.status === "admin" ? state : null;
}

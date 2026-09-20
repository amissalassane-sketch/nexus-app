// ============================================================
// NEXUS ADMIN — DATA ACCESS
// ============================================================
// Every number on the Overview comes from admin_overview(), a SECURITY
// DEFINER function that re-checks the caller before returning anything.
// Two consequences worth keeping in mind when editing:
//
//   * The database, not this file, decides what an admin may see. If the
//     guard here were removed, the RPC would still refuse.
//   * NULL and 0 are different. NULL means "not measured" and the UI
//     renders "Not available"; 0 means "measured, and it is zero".
//     Never collapse one into the other.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { withTimeout } from "@/lib/auth-flow";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  AdminActivityEntry,
  AdminActivityResult,
  AdminDataError,
  AdminOverview,
  AdminOverviewResult,
} from "./types";

/** Hard bound on the aggregate read. The Overview degrades to an honest
 *  error panel rather than holding the shell open. */
const OVERVIEW_TIMEOUT_MS = 10_000;
const ACTIVITY_TIMEOUT_MS = 8_000;

const ACTIVITY_LIMIT = 12;

/**
 * The raw error shape captured from PostgREST. `hint` and `details` come
 * straight from the database (SQLSTATE error context); they are schema-level
 * strings, which is exactly what an operator needs to fix the problem.
 */
export type RawDataError = {
  code?: string | null;
  message?: string | null;
  hint?: string | null;
  details?: string | null;
};

/**
 * Bounded copy of the raw error kept for diagnosis. Truncation here is a
 * data-boundary decision, not a style one: these strings land in the admin
 * HTML (operators only) and in the runtime logs, and the contract is that
 * they contain codes and schema names — never row data, credentials or
 * account identifiers. Postgres error text for the reads in this surface
 * (column/permission/function errors) satisfies that by construction; the
 * slice is the backstop.
 */
function rawDetail(error: RawDataError): AdminDataError["detail"] {
  const code = String(error.code ?? "").trim();
  const message = String(error.message ?? "").trim();
  const hint = String(error.hint ?? "").trim();
  if (!code && !message) return undefined;
  return {
    code: code || "unknown",
    message: message.slice(0, 300),
    ...(hint ? { hint: hint.slice(0, 200) } : {}),
  };
}

/**
 * Server-side diagnostics for a failed admin read — lands in the Vercel
 * Runtime Logs. One structured line per failure: which RPC, and the real
 * code / message / hint the database answered with. This is what turns
 * "Platform data unavailable" from a mystery into a one-line diagnosis.
 * No request data, no headers, no tokens — only the error triple.
 */
export function logAdminReadFailure(fn: string, error: RawDataError): void {
  const detail = rawDetail(error);
  if (!detail) return;
  console.error(
    `[nexus-admin] read failed fn=${fn} code=${detail.code} message=${JSON.stringify(detail.message)}${detail.hint ? ` hint=${JSON.stringify(detail.hint)}` : ""}`
  );
}

/** Exported so the directory reads (027) classify failures with exactly the same
 *  rules as the Overview — one vocabulary of errors across the surface.
 *
 *  `source` names the RPC being read; it is used for the runtime log line
 *  and is never shown to the user. Every classified failure is logged
 *  server-side: the admin surface is low-traffic and an unlogged failure
 *  is the exact situation that cost this diagnostic round. */
export function classify(
  error: RawDataError,
  source = "admin-read"
): AdminDataError {
  const code = String(error.code ?? "");
  const message = String(error.message ?? "");
  const haystack = message.toLowerCase();

  if (message.includes("NEXUS_ADMIN_FORBIDDEN") || message.includes("NEXUS_ADMIN_INSUFFICIENT_ROLE")) {
    return {
      code: "FORBIDDEN",
      message: "This account is not a platform admin.",
      detail: rawDetail(error),
    };
  }
  if (
    code === "404" ||
    code === "PGRST202" ||
    haystack.includes("could not find the function")
  ) {
    return {
      code: "NOT_INSTALLED",
      message:
        "The admin control plane is not installed in this database. Apply supabase/migrations/026_admin_control_plane.sql.",
      detail: rawDetail(error),
    };
  }
  if (haystack.includes("timed out")) {
    return { code: "TIMEOUT", message: "The platform aggregate did not answer in time." };
  }
  logAdminReadFailure(source, error);
  return {
    code: "UNAVAILABLE",
    message: "The platform aggregate could not be read. No data is shown rather than guessed.",
    detail: rawDetail(error),
  };
}

/** A value coming out of JSONB is only trusted if it has the shape the
 *  migration promises. A malformed payload becomes an error state, never
 *  a dashboard full of undefined. */
function isOverview(value: unknown): value is AdminOverview {
  if (!value || typeof value !== "object") return false;
  const v = value as AdminOverview;
  return (
    typeof v.generated_at === "string" &&
    Boolean(v.users) &&
    typeof v.users === "object" &&
    Boolean(v.workspaces) &&
    Boolean(v.plans) &&
    Boolean(v.usage) &&
    Boolean(v.activity) &&
    Array.isArray(v.needs_attention)
  );
}

function isActivityList(value: unknown): value is AdminActivityEntry[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      typeof (entry as AdminActivityEntry).id === "string" &&
      typeof (entry as AdminActivityEntry).occurred_at === "string"
  );
}

/** The aggregate alone. The caller composes it with the activity read, so
 *  there is never a placeholder value sitting in a field that means
 *  something. */
type OverviewReadResult =
  | { ok: true; overview: AdminOverview }
  | { ok: false; error: AdminDataError };

async function readOverview(supabase: SupabaseClient): Promise<OverviewReadResult> {
  const controller = new AbortController();
  const overviewResult = await withTimeout(
    Promise.resolve(
      supabase.rpc("admin_overview").abortSignal(controller.signal)
    ),
    OVERVIEW_TIMEOUT_MS,
    "ADMIN_OVERVIEW_TIMEOUT",
    controller
  ).catch((cause) => ({
    data: null,
    error:
      cause instanceof Error && cause.message.includes("ADMIN_OVERVIEW_TIMEOUT")
        ? { code: null, message: "timed out" }
        : { code: null, message: cause instanceof Error ? cause.message : "unknown" },
  }));

  if (overviewResult.error) return { ok: false, error: classify(overviewResult.error, "admin_overview()") };
  if (!isOverview(overviewResult.data)) {
    return {
      ok: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "admin_overview() returned an unexpected shape.",
      },
    };
  }

  return { ok: true, overview: overviewResult.data };
}

/**
 * Reads the activity feed.
 *
 * A failure here must never become an empty list: "no recent activity" is
 * a statement about the platform, while "the read failed" is a statement
 * about our ability to observe it. The two are returned as distinct
 * states so the Overview can render them differently.
 */
// Exported for tests: SECURITY-ADMIN-06 asserts the failure path returns
// "unavailable" rather than an empty list, and that is only a meaningful
// test against this function rather than a reimplementation of it.
export async function readActivity(
  supabase: SupabaseClient
): Promise<AdminActivityResult> {
  const controller = new AbortController();
  const result = await withTimeout(
    Promise.resolve(
      supabase
        .rpc("admin_recent_activity", { p_limit: ACTIVITY_LIMIT })
        .abortSignal(controller.signal)
    ),
    ACTIVITY_TIMEOUT_MS,
    "ADMIN_ACTIVITY_TIMEOUT",
    controller
  ).catch((cause) => ({
    data: null,
    error: {
      code: null,
      message:
        cause instanceof Error && cause.message.includes("ADMIN_ACTIVITY_TIMEOUT")
          ? "timed out"
          : cause instanceof Error
            ? cause.message
            : "unknown",
    },
  }));

  if (result.error) return { state: "unavailable", error: classify(result.error, "admin_recent_activity()") };

  // The RPC answered, but not with the shape this build expects. That is a
  // failure to read, not an absence of activity.
  if (!isActivityList(result.data)) {
    return {
      state: "unavailable",
      error: {
        code: "INVALID_PAYLOAD",
        message: "admin_recent_activity() returned an unexpected shape.",
      },
    };
  }

  return { state: "ok", entries: result.data };
}

/** Everything the Overview page renders. Bounded, fail-closed, and never
 *  padded with placeholder numbers. */
export async function getAdminOverview(): Promise<AdminOverviewResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { ok: false, error: { code: "FORBIDDEN", message: "Not signed in." } };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: {
        code: "NOT_INSTALLED",
        message: "Supabase is not configured, so there is no platform data to show.",
      },
    };
  }

  const supabase = await createClient();
  const base = await readOverview(supabase);
  if (!base.ok) return base;

  const activity = await readActivity(supabase);
  return { ok: true, overview: base.overview, activity };
}

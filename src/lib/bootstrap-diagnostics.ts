// ============================================================
// NEXUS — WORKSPACE BOOTSTRAP DIAGNOSTICS
// Structured, server-side log events for the authentication →
// workspace bootstrap → dashboard path.
//
// These events are the single source of truth for diagnosing the
// "Preparing your workspace" state. They are logged server-side only;
// they never reach the browser and never contain credentials or
// tokens — at most an account id (uuid) and a bounded error summary.
//
// Event names are a stable contract (used by tests + on-call):
//   AUTH_SESSION_CREATED
//   WORKSPACE_BOOTSTRAP_STARTED
//   WORKSPACE_FOUND            (workspace row existed — no creation)
//   WORKSPACE_CREATED          (workspace row was created)
//   MEMBERSHIP_FOUND           (active owner membership existed)
//   MEMBERSHIP_CREATED         (membership row was created/repaired)
//   WORKSPACE_BOOTSTRAP_COMPLETED
//   WORKSPACE_BOOTSTRAP_FAILED (structured error attached, see below)
//   DASHBOARD_RENDER_STARTED
//
// The WORKSPACE_FOUND / WORKSPACE_CREATED / MEMBERSHIP_* distinctions
// are emitted from the database function itself (RAISE WARNING with
// these exact markers), so the truth comes from Postgres, not from
// client-side guesses.
// ============================================================

export type BootstrapErrorKind =
  | "WORKSPACE_CREATION_FAILED"
  | "WORKSPACE_MEMBERSHIP_FAILED"
  | "WORKSPACE_ACCESS_DENIED"
  | "WORKSPACE_BOOTSTRAP_TIMEOUT"
  | "SUBSCRIPTION_INITIALIZATION_FAILED"
  | "WORKSPACE_BOOTSTRAP_FAILED";

/**
 * Classifies a raw error (Supabase PostgREST error or thrown error) into
 * the structured bootstrap error kinds. The raw message is never shown to
 * users; this mapping is used for server-side logs and for choosing the
 * user-facing recovery state.
 */
export function classifyBootstrapError(
  error: { code?: string | null; message?: string | null } | null | undefined,
  timedOut: boolean
): BootstrapErrorKind {
  if (timedOut) return "WORKSPACE_BOOTSTRAP_TIMEOUT";
  const raw = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();

  // SQLSTATE 55P03 (lock_not_available) is raised by
  // bootstrap_personal_workspace when the bounded 8s advisory-lock wait
  // expires (021). 57014 (query_canceled) covers statement_timeout.
  // "lock still held" / "timed out" are the exact substrings those paths
  // produce, so they must win over the generic workspace/membership
  // heuristics below.
  if (
    raw.includes("55p03") ||
    raw.includes("57014") ||
    raw.includes("lock_not_available") ||
    raw.includes("query_canceled") ||
    raw.includes("lock still held") ||
    raw.includes("timed out") ||
    raw.includes("timeout")
  ) {
    return "WORKSPACE_BOOTSTRAP_TIMEOUT";
  }

  // PostgREST maps SQLSTATE 42501 (insufficient_privilege) to HTTP 403 and
  // carries the SQLSTATE as `code`; our functions raise errcode='42501' with
  // a WORKSPACE_ACCESS_DENIED prefix for authorization failures.
  if (
    raw.includes("workspace_access_denied") ||
    raw.includes("auth_required") ||
    raw.includes("42501") ||
    raw.includes("permission denied")
  ) {
    return "WORKSPACE_ACCESS_DENIED";
  }
  if (
    raw.includes("membership") ||
    raw.includes("workspace_members") ||
    raw.includes("p0001") && raw.includes("members")
  ) {
    return "WORKSPACE_MEMBERSHIP_FAILED";
  }
  if (
    raw.includes("subscription") ||
    raw.includes("workspace_subscriptions")
  ) {
    return "SUBSCRIPTION_INITIALIZATION_FAILED";
  }
  if (
    raw.includes("workspace") &&
    (raw.includes("create") || raw.includes("creation") || raw.includes("workspaces"))
  ) {
    return "WORKSPACE_CREATION_FAILED";
  }
  return "WORKSPACE_BOOTSTRAP_FAILED";
}

function safeMessage(message: string | null | undefined, max = 300): string {
  if (!message) return "";
  return message.slice(0, max);
}

/**
 * Logs a bootstrap diagnostic event. Bounded, structured, server-side.
 * `details` must never contain credentials; it may contain SQLSTATE
 * codes, table names, and bounded Postgres error text.
 */
export function logBootstrapEvent(
  event: string,
  fields: Record<string, unknown> = {}
): void {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    component: "workspace-bootstrap",
    event,
    ...fields,
  };
  // Server-side diagnostic stream (stderr): these events never reach the
  // browser; they are the on-call record of the bootstrap path.
  console.error("[nexus:bootstrap]", JSON.stringify(entry));
}

/** Extract a bounded, non-credential error summary for logs/events. */
export function summarizeError(
  error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | unknown
): Record<string, unknown> {
  if (!error || typeof error !== "object") {
    return { message: safeMessage(String(error)) };
  }
  const e = error as { code?: string | null; message?: string | null; details?: string | null; hint?: string | null };
  return {
    code: e.code ?? null,
    message: safeMessage(e.message),
    details: e.details ? safeMessage(e.details) : null,
    hint: e.hint ? safeMessage(e.hint) : null,
  };
}

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyBootstrapError,
  logBootstrapEvent,
  summarizeError,
} from "@/lib/bootstrap-diagnostics";

// ============================================================
// NEXUS — SHARED AUTH FLOW HELPERS (ACCESS FIRST)
// Single source of truth for the decisions every authentication
// entry point must agree on:
//
//   * where a verified/signed-in user lands: ALWAYS /app
//     (recovery flows are the single exception -> /reset-password)
//   * how to carry freshly-issued Supabase session cookies onto a
//     redirect without dropping them
//   * which email OTP flows are "recovery" flows
//   * how to classify a broken verification link
//   * workspace bootstrap (ensure workspace + membership exist)
//
// THE JOURNEY
//   SIGNUP/LOGIN -> EMAIL CONFIRMATION (if enabled) -> SESSION
//   -> ensurePersonalWorkspace() -> /app (DASHBOARD)
//   -> profile completion, OPTIONAL, from inside the product.
//
// There is no /onboarding destination anymore. Profile completeness
// never changes where a user is sent.
// ============================================================

/**
 * The canonical NEXUS post-authentication destinations.
 * No other values should appear in redirect logic.
 */
export type PostAuthDestination =
  | "/app"
  | "/reset-password"
  | "/auth/confirm-error";

/** True for password-recovery links (type=recovery or a next=/reset-password
 *  hint that older Supabase email links carried). */
export function isRecoveryType(
  type: string | null | undefined,
  next: string | null
): boolean {
  return next === "/reset-password" || type === "recovery";
}

export type ConfirmationErrorKind =
  | "expired"
  | "already-used"
  | "invalid"
  | "missing";

/**
 * Classifies a failed confirmation exchange into a category the NEXUS error
 * page can render. Never exposes the underlying Supabase message.
 */
export function classifyConfirmationError(
  errorMessage: string | null | undefined
): ConfirmationErrorKind {
  const key = (errorMessage ?? "").toLowerCase();

  if (key.includes("expired") || key.includes("expiration")) return "expired";
  if (
    key.includes("already used") ||
    key.includes("already been used")
  ) {
    return "already-used";
  }
  if (key.includes("invalid") || key.includes("not found")) return "invalid";
  return "invalid";
}

/**
 * Copies the accumulated session cookies from `response` onto a redirect.
 * Without this the session Supabase just issued would be lost because the
 * auth client accumulates cookies on the (neutral) response we start with.
 */
export function redirectWithCookies(
  response: NextResponse,
  destination: string
): NextResponse {
  const redirect = NextResponse.redirect(destination);
  response.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirect;
}

// ============================================================
// WORKSPACE BOOTSTRAP (server-side, idempotent)
// ============================================================

export type BootstrapMembership = {
  workspace_id: string;
  role: string;
  status: string;
};

export type BootstrapResult = {
  membership: BootstrapMembership | null;
  /**
   * Structured error kind when the bootstrap could not be verified.
   * Never raw database text — see classifyBootstrapError().
   */
  error: import("./bootstrap-diagnostics").BootstrapErrorKind | null;
};

/**
 * Hard bound on the bootstrap RPC. The workspace bootstrap must NEVER be
 * allowed to hold a page render open indefinitely — a wedged Postgres
 * connection, a lock wait or a PostgREST stall all collapse into this
 * timeout instead of an infinite "Preparing your workspace" screen.
 */
const WORKSPACE_BOOTSTRAP_TIMEOUT_MS = 10_000;

/**
 * Races `promise` against a bounded timer.
 *
 * CRITICAL: this alone does NOT stop the underlying work — a `setTimeout`
 * has no way to reach into a network call. If the caller has an
 * `AbortController` wired into the actual request (via Supabase's
 * `.abortSignal()`), pass it as `controller`: on timeout this function
 * calls `controller.abort()`, which propagates down to the real `fetch()`
 * and lets Postgres/PostgREST release the connection immediately instead
 * of finishing an orphaned request nobody is waiting for anymore.
 *
 * Every call site that wraps a real Supabase query MUST supply a
 * controller whose signal was attached to that query with
 * `.abortSignal(controller.signal)`. A `withTimeout()` call without a
 * controller only bounds how long THIS function waits — it does nothing
 * to bound the resource the promise represents.
 */
export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  label: string,
  controller?: AbortController
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      // Real cancellation: stop the in-flight request instead of just
      // giving up on waiting for it. Safe to call even if the request
      // already settled (abort() on a finished/aborted controller is a
      // documented no-op).
      controller?.abort();
      reject(new Error(`${label}: timed out after ${ms}ms`));
    }, ms);
    // Don't keep the event loop alive just for the timer.
    if (typeof timer.unref === "function") timer.unref();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Ensures the authenticated user has a personal workspace and an active
 * owner membership by calling the canonical security-definer RPC.
 *
 * This is idempotent — calling it 1, 5, or 50 times results in the same
 * final state. It never creates duplicate workspaces or memberships.
 *
 * The call is wrapped in a bounded timeout (WORKSPACE_BOOTSTRAP_TIMEOUT_MS)
 * so a stalled RPC can never hold a page open forever. All failures are
 * classified into a structured error kind and logged server-side; the raw
 * Supabase/Postgres message never reaches the browser.
 */
export async function ensurePersonalWorkspaceServer(
  supabase: SupabaseClient
): Promise<BootstrapResult> {
  logBootstrapEvent("WORKSPACE_BOOTSTRAP_STARTED");

  let timedOut = false;
  type RpcError = {
    code?: string | null;
    message?: string | null;
    details?: string | null;
    hint?: string | null;
  };
  let rpc:
    | {
        data:
          | BootstrapMembership
          | BootstrapMembership[]
          | null
          | undefined;
        error: RpcError | null;
      }
    | undefined;

  try {
    // Real cancellation: the signal is attached to the actual RPC request
    // below, and withTimeout() aborts it the moment the bound is hit —
    // the Postgres/PostgREST connection is released instead of finishing
    // an orphaned call nobody is waiting for.
    const controller = new AbortController();
    // `supabase.rpc()` returns a thenable; normalize to a real Promise so
    // the bounded timeout race below is well-typed and always settled.
    // supabase-js returns a thenable (PostgrestFilterBuilder); normalize
    // it to a real Promise<rpc result> for the bounded timeout race.
    const rpcPromise = Promise.resolve(
      supabase
        .rpc("get_or_create_personal_workspace")
        .abortSignal(controller.signal) as unknown as Promise<{
        data:
          | BootstrapMembership
          | BootstrapMembership[]
          | null
          | undefined;
        error: RpcError | null;
      }>
    );
    rpc = await withTimeout(
      rpcPromise,
      WORKSPACE_BOOTSTRAP_TIMEOUT_MS,
      "WORKSPACE_BOOTSTRAP_TIMEOUT",
      controller
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    timedOut = message.startsWith("WORKSPACE_BOOTSTRAP_TIMEOUT");
    logBootstrapEvent("WORKSPACE_BOOTSTRAP_FAILED", {
      kind: timedOut ? "WORKSPACE_BOOTSTRAP_TIMEOUT" : "WORKSPACE_BOOTSTRAP_FAILED",
      ...summarizeError(cause),
    });
    return {
      membership: null,
      error: timedOut ? "WORKSPACE_BOOTSTRAP_TIMEOUT" : "WORKSPACE_BOOTSTRAP_FAILED",
    };
  }

  if (rpc?.error) {
    const kind = classifyBootstrapError(rpc.error, false);
    logBootstrapEvent("WORKSPACE_BOOTSTRAP_FAILED", {
      kind,
      ...summarizeError(rpc.error),
    });
    return { membership: null, error: kind };
  }

  const row = Array.isArray(rpc?.data)
    ? (rpc?.data[0] as BootstrapMembership | undefined)
    : ((rpc?.data as BootstrapMembership | null) ?? null);

  if (row?.workspace_id && row.role === "owner" && row.status === "active") {
    logBootstrapEvent("WORKSPACE_BOOTSTRAP_COMPLETED", {
      workspaceId: row.workspace_id,
      role: row.role,
      status: row.status,
    });
    return { membership: row, error: null };
  }

  // RPC returned but without a usable owner membership row.
  logBootstrapEvent("WORKSPACE_BOOTSTRAP_FAILED", {
    kind: "WORKSPACE_MEMBERSHIP_FAILED",
    reason: "rpc returned no active owner membership",
    row: row ? { workspaceId: row.workspace_id, role: row.role, status: row.status } : null,
  });
  return { membership: null, error: "WORKSPACE_MEMBERSHIP_FAILED" };
}

/** Bounded wait for the orphan-repair path: a profile hiccup must not hold
 *  the page open — the product renders with fallback identity instead. */
const PROFILE_REPAIR_TIMEOUT_MS = 5_000;

/**
 * Ensures a profile row exists for the given user. Used for orphan repair
 * when the auth trigger didn't create the profile.
 *
 * Inserts the MINIMUM record (just the id). No display name or username is
 * invented: when the trigger had no provider metadata to pre-fill, the
 * profile stays incomplete and the UI shows a fallback instead of storing
 * fake identity data.
 *
 * Bounded: the check + repair run under PROFILE_REPAIR_TIMEOUT_MS so a
 * wedged connection can never keep a page render open.
 */
export async function ensureProfileServer(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    const readController = new AbortController();
    const { data: existing } = await withTimeout(
      Promise.resolve(
        supabase
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .abortSignal(readController.signal)
          .maybeSingle()
      ) as Promise<{ data: { id?: string } | null; error: unknown }>,
      PROFILE_REPAIR_TIMEOUT_MS,
      "PROFILE_REPAIR_TIMEOUT",
      readController
    );

    if (existing?.id) return;

    const insertController = new AbortController();
    await withTimeout(
      Promise.resolve(
        supabase
          .from("profiles")
          .insert({ id: userId })
          .abortSignal(insertController.signal)
      ) as Promise<unknown>,
      PROFILE_REPAIR_TIMEOUT_MS,
      "PROFILE_REPAIR_TIMEOUT",
      insertController
    );
  } catch {
    // Orphan repair must never break an otherwise valid session.
  }
}

// ============================================================
// POST-AUTH DESTINATION RESOLVER
// ============================================================

export type PostAuthResult = {
  destination: PostAuthDestination;
  workspaceReady: boolean;
};

/**
 * THE canonical post-authentication destination resolver.
 *
 * Every entry point (email confirmation, OAuth callback, login) MUST call
 * this function to determine where to send the user.
 *
 * It guarantees, in order:
 *   1. Profile exists (orphan repair, minimal record)
 *   2. Personal workspace exists (idempotent bootstrap)
 *   3. Owner membership exists (idempotent bootstrap)
 *
 * It then returns the single normal destination: /app.
 * Profile completeness does NOT influence the destination — the dashboard
 * is the first-value experience for everyone, complete or not.
 *
 * NOTE: the destination is ALWAYS /app and is never held up by the
 * bootstrap. `workspaceReady` is reported for observability; when it is
 * false the (app) layout renders the product with a graceful
 * "workspace is being prepared" state and keeps working. The user is
 * never parked on a dedicated waiting screen.
 *
 * For recovery flows, callers check isRecoveryType() first and redirect to
 * /reset-password directly (recovery users never pass through here).
 */
export async function getPostAuthDestination(
  supabase: SupabaseClient,
  userId: string
): Promise<PostAuthResult> {
  logBootstrapEvent("AUTH_SESSION_CREATED", { userId });

  // Step 1: ensure profile exists (orphan repair, minimal record)
  await ensureProfileServer(supabase, userId);

  // Step 2: ensure workspace + membership exist (idempotent, bounded).
  const { membership, error } = await ensurePersonalWorkspaceServer(supabase);
  if (error) {
    logBootstrapEvent("AUTH_POST_AUTH_BOOTSTRAP_NOT_READY", {
      userId,
      kind: error,
    });
  }
  const workspaceReady = membership !== null;

  // Step 3: the dashboard is the first destination for every account.
  // The bootstrap result never changes the destination: even when the
  // workspace could not be verified this request, the user enters the
  // product and the layout recovers from there.
  return { destination: "/app", workspaceReady };
}

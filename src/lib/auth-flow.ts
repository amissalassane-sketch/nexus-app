import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

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

type BootstrapMembership = {
  workspace_id: string;
  role: string;
  status: string;
};

/**
 * Ensures the authenticated user has a personal workspace and an active
 * owner membership by calling the canonical security-definer RPC.
 *
 * This is idempotent — calling it 1, 5, or 50 times results in the same
 * final state. It never creates duplicate workspaces or memberships.
 *
 * Returns the membership row on success, or null on failure.
 */
export async function ensurePersonalWorkspaceServer(
  supabase: SupabaseClient
): Promise<BootstrapMembership | null> {
  try {
    const { data, error } = await supabase.rpc(
      "get_or_create_personal_workspace"
    );

    if (error) return null;

    const row = Array.isArray(data)
      ? (data[0] as BootstrapMembership | undefined)
      : (data as BootstrapMembership | null);

    if (
      row?.workspace_id &&
      row.role === "owner" &&
      row.status === "active"
    ) {
      return row;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Ensures a profile row exists for the given user. Used for orphan repair
 * when the auth trigger didn't create the profile.
 *
 * Inserts the MINIMUM record (just the id). No display name or username is
 * invented: when the trigger had no provider metadata to pre-fill, the
 * profile stays incomplete and the UI shows a fallback instead of storing
 * fake identity data.
 */
export async function ensureProfileServer(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (existing?.id) return;

    await supabase.from("profiles").insert({ id: userId });
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
 * For recovery flows, callers check isRecoveryType() first and redirect to
 * /reset-password directly (recovery users never pass through here).
 */
export async function getPostAuthDestination(
  supabase: SupabaseClient,
  userId: string
): Promise<PostAuthResult> {
  // Step 1: ensure profile exists (orphan repair, minimal record)
  await ensureProfileServer(supabase, userId);

  // Step 2: ensure workspace + membership exist (idempotent bootstrap)
  const membership = await ensurePersonalWorkspaceServer(supabase);
  const workspaceReady = membership !== null;

  // Step 3: the dashboard is the first destination for every account.
  // If the bootstrap could not be verified (transient failure), the
  // (app) layout renders its "Preparing your workspace" state and
  // retries on the next load — it never bounces the user to a form.
  return { destination: "/app", workspaceReady };
}

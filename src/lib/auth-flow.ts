import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// NEXUS — SHARED AUTH FLOW HELPERS
// Single source of truth for the decisions every authentication
// entry point must agree on:
//
//   * where a verified/signed-in user lands (onboarding vs /app)
//   * how to carry freshly-issued Supabase session cookies onto a
//     redirect without dropping them
//   * which email OTP flows are "recovery" flows
//   * how to classify a broken verification link
//   * workspace bootstrap (ensure workspace + membership exist)
//
// Keeping this in one module prevents signup, confirmation,
// login, OAuth and password recovery from drifting apart.
// ============================================================

/**
 * The canonical NEXUS post-authentication destinations.
 * No other values should appear in redirect logic.
 */
export type PostAuthDestination =
  | "/onboarding"
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
 */
export async function ensureProfileServer(
  supabase: SupabaseClient,
  userId: string,
  email?: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existing?.id) return;

  // Generate a default display name from email
  const defaultName = email
    ? email.split("@")[0].replace(/[._-]/g, " ")
    : "User";

  await supabase.from("profiles").insert({
    id: userId,
    display_name: defaultName,
  });
}

/**
 * Generate a deterministic default username from the user's email.
 * Used when username is not collected during onboarding.
 */
export function generateDefaultUsername(
  email: string,
  userId: string
): string {
  const local = email.split("@")[0] || "user";
  // Strip non-alphanumeric, lowercase, truncate
  const clean = local.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
  const suffix = userId.replace(/-/g, "").slice(0, 6);
  const base = clean.length >= 3 ? clean : "user";
  return `${base}_${suffix}`.slice(0, 30);
}

// ============================================================
// POST-AUTH DESTINATION RESOLVER
// ============================================================

export type PostAuthResult = {
  destination: PostAuthDestination;
  onboardingCompleted: boolean;
  workspaceReady: boolean;
};

/**
 * THE canonical post-authentication destination resolver.
 *
 * Every entry point (email confirmation, OAuth callback, login, password
 * recovery) MUST call this function to determine where to send the user.
 *
 * It guarantees:
 *  1. Profile exists (orphan repair)
 *  2. Personal workspace exists (bootstrap)
 *  3. Owner membership exists (bootstrap)
 *  4. Onboarding state is checked
 *  5. Returns ONLY one of: /onboarding, /app
 *
 * For recovery flows, callers should check isRecoveryType() first and
 * redirect to /reset-password directly (recovery users never go through
 * onboarding).
 */
export async function getPostAuthDestination(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string
): Promise<PostAuthResult> {
  // Step 1: Ensure profile exists (orphan repair)
  await ensureProfileServer(supabase, userId, userEmail);

  // Step 2: Ensure workspace + membership exist (idempotent bootstrap)
  const membership = await ensurePersonalWorkspaceServer(supabase);
  const workspaceReady = membership !== null;

  // Step 3: If the user has a default username from email, set it
  // (only if username is null — never overwrite an existing one)
  if (workspaceReady && userEmail) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, onboarding_completed")
      .eq("id", userId)
      .maybeSingle();

    if (profile && !profile.username) {
      const defaultUsername = generateDefaultUsername(userEmail, userId);
      await supabase
        .from("profiles")
        .update({ username: defaultUsername })
        .eq("id", userId);
    }
  }

  // Step 4: Check onboarding state
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle();

  const onboardingCompleted = profile?.onboarding_completed === true;

  // Step 5: Determine destination
  const destination: PostAuthDestination = onboardingCompleted
    ? "/app"
    : "/onboarding";

  return { destination, onboardingCompleted, workspaceReady };
}

/**
 * Legacy-compatible wrapper. Prefer getPostAuthDestination() in new code.
 */
export async function resolveUserAuthDestination(
  supabase: SupabaseClient,
  userId: string
): Promise<{ destination: string; onboardingCompleted: boolean }> {
  const result = await getPostAuthDestination(supabase, userId);
  return {
    destination: result.destination,
    onboardingCompleted: result.onboardingCompleted,
  };
}

/**
 * Simple destination resolver that only checks onboarding state.
 * Used when workspace bootstrap is not appropriate (e.g. recovery flows).
 */
export function resolveAuthDestination(
  onboardingCompleted: boolean
): string {
  return onboardingCompleted ? "/app" : "/onboarding";
}

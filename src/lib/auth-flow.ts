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
//
// Keeping this in one module prevents signup, confirmation,
// login, OAuth and password recovery from drifting apart.
// ============================================================

/** Canonical authenticated entry point. Routes to /app when onboarding is
 *  complete, otherwise to /onboarding. */
export function resolveAuthDestination(onboardingCompleted: boolean): string {
  return onboardingCompleted ? "/app" : "/onboarding";
}

/** Reads the user's onboarding state and returns the destination NEXUS should
 *  send them to. Also returns the raw flag so callers can log/report it. */
export async function resolveUserAuthDestination(
  supabase: SupabaseClient,
  userId: string
): Promise<{ destination: string; onboardingCompleted: boolean }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle();

  const onboardingCompleted = profile?.onboarding_completed === true;
  return {
    destination: resolveAuthDestination(onboardingCompleted),
    onboardingCompleted,
  };
}

/** True for password-recovery links (type=recovery or a next=/reset-password
 *  hint that older Supabase email links carried). */
export function isRecoveryType(type: string | null | undefined, next: string | null): boolean {
  return next === "/reset-password" || type === "recovery";
}

export type ConfirmationErrorKind = "expired" | "already-used" | "invalid" | "missing";

/**
 * Classifies a failed confirmation exchange into a category the NEXUS error
 * page can render. Never exposes the underlying Supabase message.
 */
export function classifyConfirmationError(
  errorMessage: string | null | undefined
): ConfirmationErrorKind {
  const key = (errorMessage ?? "").toLowerCase();

  if (key.includes("expired") || key.includes("expiration")) return "expired";
  if (key.includes("already used") || key.includes("already been used")) {
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

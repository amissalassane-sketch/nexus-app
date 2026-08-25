import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { getRequestOrigin, safeNextPath } from "@/lib/request-origin";
import {
  classifyConfirmationError,
  isRecoveryType,
  redirectWithCookies,
  getPostAuthDestination,
} from "@/lib/auth-flow";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function asOtpType(value: string | null): EmailOtpType | null {
  if (!value) return null;
  return EMAIL_OTP_TYPES.has(value as EmailOtpType)
    ? (value as EmailOtpType)
    : null;
}

/**
 * Map a Google OAuth redirect error into a single, actionable NEXUS message.
 */
function describeOAuthFailure(
  code: string | null,
  description: string | null
): string {
  const key = `${code ?? ""} ${description ?? ""}`.toLowerCase();
  if (
    key.includes("access_denied") ||
    key.includes("user_denied") ||
    key.includes("user denied") ||
    key.includes("user_cancel") ||
    key.includes("cancelled") ||
    key.includes("canceled")
  ) {
    return "Google sign-in was cancelled.";
  }
  return "Google sign-in failed. Please try again.";
}

function confirmErrorUrl(origin: string, reason: string): string {
  return `${origin}/auth/confirm-error?reason=${encodeURIComponent(reason)}`;
}

/**
 * Return from a Supabase email link (signup confirmation or password recovery)
 * OR the return leg of an OAuth sign-in / sign-up.
 *
 * Three distinct outcomes:
 *
 *   1. Password recovery — keep the fresh session, continue to /reset-password
 *
 *   2. Email confirmation — exchange the token, write session cookies,
 *      bootstrap workspace, route by account state
 *
 *   3. OAuth — exchange the PKCE code, bootstrap workspace, route by state
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"), "/");
  const recovery = isRecoveryType(type, next);
  const isOAuth = url.searchParams.get("source") === "oauth";
  const oauthErrorCode = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");
  const authError = oauthErrorDescription ?? oauthErrorCode;

  const recoveryFailed = `${origin}/forgot-password?error=${encodeURIComponent(
    "This reset link is invalid or has expired. Request a new one."
  )}`;
  const oauthFailed = `${origin}/login?error=${encodeURIComponent(
    describeOAuthFailure(oauthErrorCode, oauthErrorDescription)
  )}`;

  if (authError) {
    if (recovery) return NextResponse.redirect(recoveryFailed);
    if (isOAuth) return NextResponse.redirect(oauthFailed);
    return NextResponse.redirect(confirmErrorUrl(origin, "invalid"));
  }

  const { config } = readSupabaseConfig();
  if (!config) {
    return NextResponse.redirect(
      recovery ? recoveryFailed : isOAuth ? oauthFailed : confirmErrorUrl(origin, "invalid")
    );
  }

  // Nothing to exchange
  if (!code && !tokenHash) {
    if (recovery) return NextResponse.redirect(recoveryFailed);
    if (isOAuth) return NextResponse.redirect(oauthFailed);
    return NextResponse.redirect(confirmErrorUrl(origin, "missing"));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let confirmError: string | null = null;
  let authUserId: string | null = null;
  let authUserEmail: string | null = null;
  const otpType = asOtpType(type);

  try {
    if (tokenHash && otpType) {
      const result = await supabase.auth.verifyOtp({
        type: otpType,
        token_hash: tokenHash,
      });
      confirmError = result.error?.message ?? null;
      authUserId =
        result.data.user?.id ?? result.data.session?.user?.id ?? null;
      authUserEmail =
        result.data.user?.email ??
        result.data.session?.user?.email ??
        null;
    } else if (code) {
      const result = await supabase.auth.exchangeCodeForSession(code);
      confirmError = result.error?.message ?? null;
      authUserId =
        result.data.user?.id ?? result.data.session?.user?.id ?? null;
      authUserEmail =
        result.data.user?.email ??
        result.data.session?.user?.email ??
        null;
    } else {
      confirmError = "Malformed confirmation link.";
    }
  } catch (cause) {
    confirmError =
      cause instanceof Error
        ? cause.message
        : "Authentication failed. Please try again.";
  }

  // --- Recovery: keep the session, continue to the password reset form. ----
  if (recovery) {
    if (confirmError || !authUserId) {
      return NextResponse.redirect(recoveryFailed);
    }
    return redirectWithCookies(response, `${origin}/reset-password`);
  }

  // --- OAuth: keep the session, bootstrap workspace, route by state. -------
  if (isOAuth) {
    if (confirmError || !authUserId) {
      // PKCE exchange failed — check if user already has a live session
      const {
        data: { user: existingUser },
      } = await supabase.auth.getUser();

      if (existingUser) {
        try {
          const { destination } = await getPostAuthDestination(
            supabase,
            existingUser.id,
            existingUser.email
          );
          return redirectWithCookies(response, `${origin}${destination}`);
        } catch {
          return redirectWithCookies(response, `${origin}/onboarding`);
        }
      }

      return NextResponse.redirect(oauthFailed);
    }

    // Bootstrap workspace + membership, then route
    try {
      const { destination } = await getPostAuthDestination(
        supabase,
        authUserId,
        authUserEmail ?? undefined
      );
      return redirectWithCookies(response, `${origin}${destination}`);
    } catch {
      return redirectWithCookies(response, `${origin}/onboarding`);
    }
  }

  // --- Email confirmation: verify, bootstrap, route by account state. ------
  if (confirmError || !authUserId) {
    const reason = classifyConfirmationError(confirmError);
    return NextResponse.redirect(confirmErrorUrl(origin, reason));
  }

  try {
    const { destination } = await getPostAuthDestination(
      supabase,
      authUserId,
      authUserEmail ?? undefined
    );
    return redirectWithCookies(response, `${origin}${destination}`);
  } catch {
    return redirectWithCookies(response, `${origin}/onboarding`);
  }
}

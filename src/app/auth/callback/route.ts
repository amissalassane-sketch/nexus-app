import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { getRequestOrigin, safeNextPath } from "@/lib/request-origin";
import {
  classifyConfirmationError,
  isRecoveryType,
  redirectWithCookies,
  resolveUserAuthDestination,
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
  return EMAIL_OTP_TYPES.has(value as EmailOtpType) ? (value as EmailOtpType) : null;
}

/**
 * Map a Google OAuth redirect error (`error` + `error_description`, returned on
 * the callback URL) into a single, actionable NEXUS message — never a raw
 * provider string. Google reports "the user closed the consent screen / picked
 * Cancel" as `error=access_denied`; that is a cancellation, not a failure, and
 * deserves its own message so the login screen shows a clear, correct state.
 */
function describeOAuthFailure(code: string | null, description: string | null): string {
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

function routeByAccountState(
  supabase: SupabaseClient,
  userId: string,
  origin: string,
  response: NextResponse
): Promise<NextResponse> {
  return resolveUserAuthDestination(supabase, userId).then(({ destination }) =>
    redirectWithCookies(response, `${origin}${destination}`)
  );
}

/**
 * Return from a Supabase email link (signup confirmation or password recovery)
 * OR the return leg of an OAuth sign-in / sign-up (e.g. "Continue with Google").
 *
 * Three distinct outcomes:
 *
 *   1. Password recovery — keep the fresh session, continue to /reset-password
 *      so the visitor can set a new password.
 *
 *   2. Email confirmation (signup / email change / magic link) — exchange the
 *      token, write the session cookies and route by account state:
 *      /onboarding until onboarding is complete, then /app.
 *
 *   3. OAuth — the visitor just proved their identity with a provider. Keep the
 *      session and route them to the same destination by account state.
 *      We tell this case apart from (2) with `source=oauth`, set when the
 *      OAuth flow was started; a bare PKCE `code` is not enough, because email
 *      confirmation uses the same PKCE flow.
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

  // Nothing to exchange: expired link, email-client preview, or a click in a
  // browser that never started PKCE. Never expose a raw error.
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
  const otpType = asOtpType(type);

  try {
    if (tokenHash && otpType) {
      const result = await supabase.auth.verifyOtp({
        type: otpType,
        token_hash: tokenHash,
      });
      confirmError = result.error?.message ?? null;
      authUserId = result.data.user?.id ?? result.data.session?.user?.id ?? null;
    } else if (code) {
      const result = await supabase.auth.exchangeCodeForSession(code);
      confirmError = result.error?.message ?? null;
      authUserId = result.data.user?.id ?? result.data.session?.user?.id ?? null;
    } else {
      confirmError = "Malformed confirmation link.";
    }
  } catch (cause) {
    confirmError =
      cause instanceof Error ? cause.message : "Authentication failed. Please try again.";
  }

  // --- Recovery: keep the session, continue to the password reset form. -----
  if (recovery) {
    if (confirmError || !authUserId) {
      return NextResponse.redirect(recoveryFailed);
    }
    return redirectWithCookies(response, `${origin}/reset-password`);
  }

  // --- OAuth: keep the session, route by account state. ---------------------
  if (isOAuth) {
    if (confirmError || !authUserId) {
      // The PKCE exchange failed — most often a replayed or stale code (a
      // duplicate callback, a refreshed tab, a back-button re-entry). If the
      // visitor already holds a live session from a successful sign-in, route
      // them by their real account state instead of bouncing an authenticated
      // user to /login. Only genuinely unauthenticated visitors see the error.
      const {
        data: { user: existingUser },
      } = await supabase.auth.getUser();

      if (existingUser) {
        return routeByAccountState(supabase, existingUser.id, origin, response);
      }

      return NextResponse.redirect(oauthFailed);
    }

    return routeByAccountState(supabase, authUserId, origin, response);
  }

  // --- Email confirmation: verify, keep the session, route by account state.
  if (confirmError || !authUserId) {
    const reason = classifyConfirmationError(confirmError);
    return NextResponse.redirect(confirmErrorUrl(origin, reason));
  }

  return routeByAccountState(supabase, authUserId, origin, response);
}

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
 * Server-side diagnostics for a failed auth return. Only the flow name and the
 * provider/Supabase error text are logged (never tokens or codes), so the real
 * cause shows up in the Vercel runtime logs instead of a generic "invalid link".
 */
function logAuthFailure(
  flow: "recovery" | "oauth" | "email",
  detail: {
    message: string | null;
    type: string | null;
    hasCode: boolean;
    hasTokenHash: boolean;
  }
): void {
  console.error("[auth/callback] failure", JSON.stringify({ flow, ...detail }));
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
 *      bootstrap workspace, enter /app
 *
 *   3. OAuth — exchange the PKCE code, bootstrap workspace, enter /app.
 *      When Google already provided identity metadata, the signup trigger
 *      pre-filled the profile name; the user is never asked for it again.
 *
 * Every successful outcome lands on /app. Profile completeness is never a
 * routing input; the dashboard is the first-value experience.
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
  const flow = recovery ? "recovery" : isOAuth ? "oauth" : "email";

  const recoveryFailed = `${origin}/forgot-password?error=${encodeURIComponent(
    "This reset link is invalid or has expired. Request a new one."
  )}`;
  const oauthFailed = `${origin}/login?error=${encodeURIComponent(
    describeOAuthFailure(oauthErrorCode, oauthErrorDescription)
  )}`;

  if (authError) {
    logAuthFailure(flow, {
      message: authError,
      type,
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
    });
    if (recovery) return NextResponse.redirect(recoveryFailed);
    if (isOAuth) return NextResponse.redirect(oauthFailed);
    return NextResponse.redirect(confirmErrorUrl(origin, "invalid"));
  }

  const { config } = readSupabaseConfig();
  if (!config) {
    logAuthFailure(flow, {
      message: "Supabase configuration is missing on the server",
      type,
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
    });
    return NextResponse.redirect(
      recovery ? recoveryFailed : isOAuth ? oauthFailed : confirmErrorUrl(origin, "invalid")
    );
  }

  // Nothing to exchange
  if (!code && !tokenHash) {
    logAuthFailure(flow, {
      message: "No code or token_hash in the return URL",
      type,
      hasCode: false,
      hasTokenHash: false,
    });
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
      authUserId =
        result.data.user?.id ?? result.data.session?.user?.id ?? null;
    } else if (code) {
      const result = await supabase.auth.exchangeCodeForSession(code);
      confirmError = result.error?.message ?? null;
      authUserId =
        result.data.user?.id ?? result.data.session?.user?.id ?? null;
    } else {
      confirmError = "Malformed confirmation link.";
    }
  } catch (cause) {
    confirmError =
      cause instanceof Error
        ? cause.message
        : "Authentication failed. Please try again.";
  }

  if (confirmError) {
    logAuthFailure(flow, {
      message: confirmError,
      type,
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
    });
  }

  // --- Recovery: keep the session, continue to the password reset form. ----
  if (recovery) {
    if (confirmError || !authUserId) {
      return NextResponse.redirect(recoveryFailed);
    }
    return redirectWithCookies(response, `${origin}/reset-password`);
  }

  // --- OAuth: keep the session, bootstrap workspace, enter NEXUS. ----------
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
            existingUser.id
          );
          return redirectWithCookies(response, `${origin}${destination}`);
        } catch {
          return redirectWithCookies(response, `${origin}/app`);
        }
      }

      return NextResponse.redirect(oauthFailed);
    }

    // Bootstrap workspace + membership, then enter NEXUS
    try {
      const { destination } = await getPostAuthDestination(
        supabase,
        authUserId
      );
      return redirectWithCookies(response, `${origin}${destination}`);
    } catch {
      return redirectWithCookies(response, `${origin}/app`);
    }
  }

  // --- Email confirmation: verify, bootstrap, enter the product. -----------
  if (confirmError || !authUserId) {
    const reason = classifyConfirmationError(confirmError);
    return NextResponse.redirect(confirmErrorUrl(origin, reason));
  }

  try {
    const { destination } = await getPostAuthDestination(
      supabase,
      authUserId
    );
    return redirectWithCookies(response, `${origin}${destination}`);
  } catch {
    return redirectWithCookies(response, `${origin}/app`);
  }
}

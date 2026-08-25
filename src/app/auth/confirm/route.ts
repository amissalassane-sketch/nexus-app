import { type EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { getRequestOrigin } from "@/lib/request-origin";
import {
  classifyConfirmationError,
  isRecoveryType,
  redirectWithCookies,
  getPostAuthDestination,
} from "@/lib/auth-flow";
import { safeNextPath } from "@/lib/request-origin";

// ============================================================
// NEXUS — EMAIL CONFIRMATION ENDPOINT (/auth/confirm)
//
// This is the route the Supabase "Confirm signup" email template points
// to (and the route password-recovery links may use as well):
//
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
//
// Lifecycle:
//   1. Read token_hash + type from URL
//   2. Validate the token server-side through Supabase
//   3. Establish the authenticated session (set cookies)
//   4. For recovery: redirect to /reset-password
//   5. For signup: ensure workspace, ensure membership, check onboarding
//   6. Redirect deterministically to /onboarding or /app
//
// Never exposes raw Supabase errors or JSON to the browser.
// ============================================================

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

function confirmErrorUrl(
  origin: string,
  reason: "expired" | "already-used" | "invalid" | "missing"
): string {
  return `${origin}/auth/confirm-error?reason=${reason}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const source = url.searchParams.get("source");
  const next = safeNextPath(url.searchParams.get("next"), "/");
  const recovery = isRecoveryType(type, next);

  const recoveryFailed = `${origin}/forgot-password?error=${encodeURIComponent(
    "This reset link is invalid or has expired. Request a new one."
  )}`;

  // A Google OAuth callback should never land here, but if it does, redirect
  // to the OAuth callback handler.
  if (source === "oauth") {
    return NextResponse.redirect(
      `${origin}/auth/callback${request.nextUrl.search}`
    );
  }

  const { config } = readSupabaseConfig();
  if (!config) {
    return NextResponse.redirect(
      recovery ? recoveryFailed : confirmErrorUrl(origin, "invalid")
    );
  }

  // Missing or malformed link — never a raw error page.
  if (!tokenHash && !code) {
    return NextResponse.redirect(
      recovery ? recoveryFailed : confirmErrorUrl(origin, "missing")
    );
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

  // --- Recovery: keep the fresh session, continue to the reset form. -------
  if (recovery) {
    if (confirmError || !authUserId) {
      return NextResponse.redirect(recoveryFailed);
    }
    return redirectWithCookies(response, `${origin}/reset-password`);
  }

  // --- Email confirmation: verify, bootstrap, then route by account state. -
  if (confirmError || !authUserId) {
    const reason = classifyConfirmationError(confirmError);
    return NextResponse.redirect(confirmErrorUrl(origin, reason));
  }

  // Bootstrap workspace + membership, then determine destination
  try {
    const { destination } = await getPostAuthDestination(
      supabase,
      authUserId,
      authUserEmail ?? undefined
    );
    return redirectWithCookies(response, `${origin}${destination}`);
  } catch {
    // If bootstrap fails, send to onboarding which will retry
    return redirectWithCookies(response, `${origin}/onboarding`);
  }
}

import { type EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { getRequestOrigin, safeNextPath } from "@/lib/request-origin";
import {
  classifyConfirmationError,
  isRecoveryType,
  redirectWithCookies,
  resolveUserAuthDestination,
} from "@/lib/auth-flow";

// ============================================================
// NEXUS — EMAIL CONFIRMATION ENDPOINT (/auth/confirm)
//
// This is the route the Supabase "Confirm signup" email template must point
// to (and the route password-recovery links may use as well):
//
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
//
// It exchanges the token_hash for a real Supabase session on the server,
// persists that session into the SSR cookies and sends the visitor to the
// correct NEXUS destination:
//
//   recovery          -> /reset-password
//   signup (verified) -> /onboarding  (onboarding incomplete)
//                     -> /app         (onboarding complete)
//   bad link          -> /auth/confirm-error (professional NEXUS error state)
//
// It never exposes a raw GoTrue error or a JSON blob to the browser.
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

  // A Google OAuth callback should never land here, but if it does (old link
  // or a manual URL), keep OAuth in its own well-tested route.
  if (source === "oauth") {
    return NextResponse.redirect(`${origin}/auth/callback${request.nextUrl.search}`);
  }

  const { config } = readSupabaseConfig();
  if (!config) {
    return NextResponse.redirect(recovery ? recoveryFailed : confirmErrorUrl(origin, "invalid"));
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

  // --- Recovery: keep the fresh session, continue to the reset form. -------
  if (recovery) {
    if (confirmError || !authUserId) {
      return NextResponse.redirect(recoveryFailed);
    }
    return redirectWithCookies(response, `${origin}/reset-password`);
  }

  // --- Email confirmation: verify, then route by account state. ------------
  if (confirmError || !authUserId) {
    const reason = classifyConfirmationError(confirmError);
    return NextResponse.redirect(confirmErrorUrl(origin, reason));
  }

  const { destination } = await resolveUserAuthDestination(supabase, authUserId);
  return redirectWithCookies(response, `${origin}${destination}`);
}

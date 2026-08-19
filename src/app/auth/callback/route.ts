import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { getRequestOrigin, safeNextPath } from "@/lib/request-origin";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function isRecoveryFlow(next: string, type: string | null): boolean {
  return next === "/reset-password" || type === "recovery";
}

function asOtpType(value: string | null): EmailOtpType | null {
  if (!value) return null;
  return EMAIL_OTP_TYPES.has(value as EmailOtpType) ? (value as EmailOtpType) : null;
}

/**
 * Return from a Supabase email link (signup confirmation or password recovery).
 *
 * Signup confirmation, in ANY browser:
 *   1. Confirm the address (PKCE `code` or `token_hash`).
 *   2. Drop the session so the visitor is not dumped into /onboarding.
 *   3. Send them to the public landing page, where they choose Sign in
 *      or Create account.
 *
 * Recovery keeps the session and continues to /reset-password.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"), "/");
  const recovery = isRecoveryFlow(next, type);
  const authError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const landing = `${origin}/?confirmed=1`;
  const recoveryPage = `${origin}/reset-password`;
  const recoveryFailed = `${origin}/forgot-password?error=${encodeURIComponent(
    "This reset link is invalid or has expired. Request a new one."
  )}`;

  if (authError) {
    return NextResponse.redirect(recovery ? recoveryFailed : `${origin}/`);
  }

  const { config } = readSupabaseConfig();
  if (!config) {
    return NextResponse.redirect(recovery ? recoveryFailed : `${origin}/`);
  }

  // Nothing to exchange: expired link, email-client preview, or a click in a
  // browser that never started PKCE. Never send these visitors to /onboarding
  // or a raw login error — the landing page is the public front door.
  if (!code && !tokenHash) {
    return NextResponse.redirect(recovery ? recoveryFailed : `${origin}/`);
  }

  const destination = recovery ? recoveryPage : landing;
  const response = NextResponse.redirect(destination);

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let confirmError: string | null = null;
  const otpType = asOtpType(type);

  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });
    confirmError = error?.message ?? null;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    confirmError = error?.message ?? null;
  }

  if (recovery) {
    if (confirmError) {
      return NextResponse.redirect(recoveryFailed);
    }
    return response;
  }

  // Signup (and any other non-recovery) confirmation: the address is now
  // verified. Clear the local session so `/` renders the marketing page
  // instead of bouncing a half-created account into /onboarding.
  await supabase.auth.signOut({ scope: "local" });
  return response;
}

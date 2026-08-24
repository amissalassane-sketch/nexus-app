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
 * Return from a Supabase email link (signup confirmation or password recovery)
 * OR the return leg of an OAuth sign-in / sign-up (e.g. "Continue with Google").
 *
 * Three distinct outcomes:
 *
 *   1. Password recovery — keep the fresh session, continue to /reset-password
 *      so the visitor can set a new password.
 *
 *   2. Email confirmation (signup / email change / magic link) — the address is
 *      now verified. We DROP the local session on purpose: the link may be
 *      opened in another browser or on another device, and silently logging the
 *      visitor in there would be surprising. The public landing page is the
 *      front door, where they choose Sign in or Create account.
 *
 *   3. OAuth — the visitor just proved their identity with a provider. Keep the
 *      session and route them to the right place for their account state:
 *      /onboarding for a brand-new workspace, /dashboard once onboarding is done.
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
  const recovery = isRecoveryFlow(next, type);
  const isOAuth = url.searchParams.get("source") === "oauth";
  const authError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const landing = `${origin}/?confirmed=1`;
  const recoveryPage = `${origin}/reset-password`;
  const recoveryFailed = `${origin}/forgot-password?error=${encodeURIComponent(
    "This reset link is invalid or has expired. Request a new one."
  )}`;
  const oauthFailed = `${origin}/login?error=${encodeURIComponent(
    "Google sign-in failed. Please try again."
  )}`;

  if (authError) {
    if (recovery) return NextResponse.redirect(recoveryFailed);
    if (isOAuth) return NextResponse.redirect(oauthFailed);
    return NextResponse.redirect(`${origin}/`);
  }

  const { config } = readSupabaseConfig();
  if (!config) {
    return NextResponse.redirect(recovery ? recoveryFailed : isOAuth ? oauthFailed : `${origin}/`);
  }

  // Nothing to exchange: expired link, email-client preview, or a click in a
  // browser that never started PKCE. Never send these visitors to /onboarding
  // or a raw login error — the landing page is the public front door.
  if (!code && !tokenHash) {
    if (recovery) return NextResponse.redirect(recoveryFailed);
    if (isOAuth) return NextResponse.redirect(oauthFailed);
    return NextResponse.redirect(landing);
  }

  // We do not know the final destination until we have exchanged the token and,
  // for OAuth, read the account state. Start from a neutral response and let the
  // Supabase client accumulate session cookies onto it via `setAll`; we turn it
  // into the real redirect at the very end. Keeping `response` reassignable is
  // the standard Supabase SSR pattern.
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

  if (tokenHash && otpType) {
    const result = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });
    confirmError = result.error?.message ?? null;
    authUserId = result.data?.user?.id ?? null;
  } else if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    confirmError = result.error?.message ?? null;
    authUserId = result.data?.user?.id ?? null;
  }

  // --- Recovery: keep the session, continue to the password reset form. -----
  if (recovery) {
    if (confirmError) {
      return NextResponse.redirect(recoveryFailed);
    }
    return redirectTo(response, recoveryPage);
  }

  // --- OAuth: keep the session, route by account state. ---------------------
  if (isOAuth) {
    if (confirmError || !authUserId) {
      return NextResponse.redirect(oauthFailed);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", authUserId)
      .maybeSingle();

    const destination =
      profile?.onboarding_completed === true ? `${origin}/dashboard` : `${origin}/onboarding`;

    return redirectTo(response, destination);
  }

  // --- Email confirmation: verify the address, then drop the local session.
  //     The landing page is the public front door. ---------------------------
  // Email confirmation (and any other non-recovery flow): the address is now
  // verified. We ALWAYS send the visitor to the public landing page, whether
  // the exchange itself succeeded or not — a failed exchange (expired link,
  // click in another browser) must never open onboarding or a raw error, and
  // a successful one must not silently log the visitor in. We drop the local
  // session either way.
  await supabase.auth.signOut({ scope: "local" });
  return redirectTo(response, landing);
}

/**
 * Turn the accumulated `NextResponse` (which carries the session cookies) into
 * a redirect to `destination` without losing any of those cookies.
 */
function redirectTo(response: NextResponse, destination: string): NextResponse {
  const redirect = NextResponse.redirect(destination);
  response.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirect;
}

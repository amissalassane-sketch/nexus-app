import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { getRequestOrigin } from "@/lib/request-origin";
import { humanizeAuthError, validateCredentials } from "@/lib/auth-errors";

/**
 * Account creation, performed ON THE SERVER.
 *
 * Signup collects ONLY what is required to create the account: the email
 * and password. Nothing else — no name, username, workspace, goals.
 * Profile identity is completed later, from inside the product, and is
 * never a gate to it.
 *
 * Three legitimate outcomes are handled explicitly:
 *   1. email confirmation disabled -> Supabase returns a session, the SSR
 *      cookies are written here and the user goes straight to /app;
 *   2. email confirmation enabled  -> a user is returned WITHOUT a session,
 *      and the UI must say so instead of pretending nothing happened;
 *   3. the address is already registered -> Supabase returns an obfuscated
 *      user with NO identities and sends NO email. That is reported as such,
 *      instead of sending the person to a code screen that can never
 *      receive anything.
 */
export async function POST(request: Request) {
  const { error: configError } = readSupabaseConfig();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  let body: {
    email?: unknown;
    password?: unknown;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const credentialsError = validateCredentials(body.email, body.password);
  if (credentialsError) {
    return NextResponse.json({ error: credentialsError }, { status: 400 });
  }

  const email = (body.email as string).trim().toLowerCase();
  const password = body.password as string;

  const supabase = await createClient();

  let result;
  try {
    result = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Confirmation lands on the dedicated NEXUS /auth/confirm endpoint.
        // The server exchanges the token_hash, establishes the session,
        // ensures the personal workspace and routes to /app — the
        // confirmation process ends at the product, never at a form.
        emailRedirectTo: `${getRequestOrigin(request)}/auth/confirm`,
      },
      // ^ The Supabase "Confirm signup" email template should be set to
      //   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
      //   (see supabase/email-templates/).
    });
  } catch (cause) {
    return NextResponse.json(
      {
        error: humanizeAuthError({
          message: cause instanceof Error ? cause.message : "fetch failed",
        }),
      },
      { status: 502 }
    );
  }

  if (result.error) {
    return NextResponse.json(
      { error: humanizeAuthError(result.error) },
      { status: result.error.status && result.error.status < 500 ? 400 : 502 }
    );
  }

  if (result.data.session) {
    return NextResponse.json({ ok: true, requiresConfirmation: false, redirectTo: "/app" });
  }

  // Already-registered address (for example an account created with Google):
  // Supabase hides it by returning a user with an empty identities list and
  // sends no email. Tell the person, do not pretend a code was sent.
  const identities = result.data.user?.identities;
  if (Array.isArray(identities) && identities.length === 0) {
    return NextResponse.json(
      {
        error:
          "An account with this email already exists. Sign in instead, or continue with Google.",
        errorCode: "ACCOUNT_EXISTS",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    requiresConfirmation: true,
    redirectTo: "/verify-email",
    message:
      "Account created. We sent a verification code to your email. Enter it to continue.",
  });
}

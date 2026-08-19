import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { getRequestOrigin } from "@/lib/request-origin";
import {
  humanizeAuthError,
  validateCredentials,
  validateUsername,
} from "@/lib/auth-errors";

/**
 * Account creation, performed ON THE SERVER.
 *
 * Two legitimate outcomes are handled explicitly:
 *   1. email confirmation disabled -> Supabase returns a session, the SSR
 *      cookies are written here and the user goes straight to /onboarding;
 *   2. email confirmation enabled  -> a user is returned WITHOUT a session,
 *      and the UI must say so instead of pretending nothing happened.
 */
export async function POST(request: Request) {
  const { error: configError } = readSupabaseConfig();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  let body: {
    email?: unknown;
    password?: unknown;
    fullName?: unknown;
    username?: unknown;
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

  const usernameError = validateUsername(body.username);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  if (!fullName) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }

  const email = (body.email as string).trim().toLowerCase();
  const password = body.password as string;
  const username = (body.username as string).trim().toLowerCase();

  const supabase = await createClient();

  let result;
  try {
    result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username },
        // Confirmation must land on /auth/callback with NO next=/onboarding.
        // The callback verifies the address, drops the session and sends
        // the visitor to the public landing page — in any browser.
        emailRedirectTo: `${getRequestOrigin(request)}/auth/callback`,
      },
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
    return NextResponse.json({ ok: true, requiresConfirmation: false, redirectTo: "/onboarding" });
  }

  return NextResponse.json({
    ok: true,
    requiresConfirmation: true,
    message:
      "Account created. Confirm your email address, then sign in to access your workspace.",
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { humanizeAuthError, validateCredentials } from "@/lib/auth-errors";

/**
 * Email + password sign-in, performed ON THE SERVER.
 *
 * Doing it here (instead of in the browser then relaying tokens) means the
 * SSR cookies are written by the same client that creates the session:
 * one source of truth, no handshake that can silently fail or be redirected.
 * The cookies remain readable by the browser Supabase client, so client-side
 * CRUD keeps working under RLS.
 */
export async function POST(request: Request) {
  const { error: configError } = readSupabaseConfig();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const validationError = validateCredentials(body.email, body.password);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const email = (body.email as string).trim().toLowerCase();
  const password = body.password as string;

  const supabase = await createClient();

  let result;
  try {
    result = await supabase.auth.signInWithPassword({ email, password });
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
      { status: result.error.status && result.error.status < 500 ? 401 : 502 }
    );
  }

  if (!result.data.session) {
    return NextResponse.json(
      {
        error:
          "Sign in succeeded but no session was returned. If email confirmation is enabled, confirm your address first.",
      },
      { status: 401 }
    );
  }

  // Where to send the user next: onboarding until the profile is completed.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", result.data.user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    redirectTo: profile?.onboarding_completed === true ? "/dashboard" : "/onboarding",
  });
}

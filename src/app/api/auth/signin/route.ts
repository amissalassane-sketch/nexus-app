import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { humanizeAuthError, validateCredentials } from "@/lib/auth-errors";
import { getPostAuthDestination } from "@/lib/auth-flow";

/**
 * Email + password sign-in, performed ON THE SERVER.
 *
 * After successful authentication:
 *   1. Session cookies are written server-side
 *   2. Workspace + membership are ensured (idempotent bootstrap)
 *   3. Onboarding state is checked
 *   4. User is routed to /onboarding or /app
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
    const emailNotConfirmed = /email not confirmed|email_not_confirmed|not confirmed/i.test(
      `${result.error.code ?? ""} ${result.error.message ?? ""}`
    );
    return NextResponse.json(
      {
        error: humanizeAuthError(result.error),
        ...(emailNotConfirmed ? { errorCode: "EMAIL_NOT_CONFIRMED" } : {}),
      },
      { status: result.error.status && result.error.status < 500 ? 401 : 502 }
    );
  }

  if (!result.data.session) {
    return NextResponse.json(
      {
        error: "Sign in succeeded but no session was returned.",
        errorCode: "NO_SESSION",
      },
      { status: 401 }
    );
  }

  // Ensure workspace + membership, then determine destination
  try {
    const { destination } = await getPostAuthDestination(
      supabase,
      result.data.user.id,
      result.data.user.email
    );
    return NextResponse.json({
      ok: true,
      redirectTo: destination,
    });
  } catch {
    // If bootstrap fails, send to onboarding which will retry
    return NextResponse.json({
      ok: true,
      redirectTo: "/onboarding",
    });
  }
}

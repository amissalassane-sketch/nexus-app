import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { humanizeAuthError } from "@/lib/auth-errors";
import { resolveUserAuthDestination } from "@/lib/auth-flow";

/**
 * Completes a password recovery. The user must already have a session
 * established by /auth/callback after clicking the email link.
 */
export async function POST(request: Request) {
  const { error: configError } = readSupabaseConfig();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  let body: { password?: unknown };
  try {
    body = (await request.json()) as { password?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (typeof body.password !== "string" || body.password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 401 }
    );
  }

  let result;
  try {
    result = await supabase.auth.updateUser({ password: body.password });
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

  const { destination } = await resolveUserAuthDestination(supabase, user.id);

  return NextResponse.json({
    ok: true,
    redirectTo: destination,
  });
}

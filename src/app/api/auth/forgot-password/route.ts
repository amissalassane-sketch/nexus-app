import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { getRequestOrigin } from "@/lib/request-origin";
import { humanizeAuthError } from "@/lib/auth-errors";

/**
 * Starts a password recovery. Always returns the same success copy so
 * the response does not reveal whether the email is registered.
 */
export async function POST(request: Request) {
  const { error: configError } = readSupabaseConfig();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return NextResponse.json({ error: "This email address is not valid." }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  const supabase = await createClient();

  let result;
  try {
    result = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getRequestOrigin(request)}/auth/callback?next=/reset-password`,
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

  return NextResponse.json({
    ok: true,
    message: "If an account exists for this address, a reset link is on its way.",
  });
}

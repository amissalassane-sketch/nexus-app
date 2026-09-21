import { readJsonObject } from "@/lib/request-json";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { getRequestOrigin } from "@/lib/request-origin";
import { humanizeAuthError } from "@/lib/auth-errors";

/**
 * Resends the sign-up confirmation email (code + fallback link) for an
 * address that is already registered but not yet verified. Used from the
 * /verify-email "Resend Code" link.
 *
 * Always returns the same generic success copy so the response never reveals
 * whether the address is registered — the same stance as password recovery.
 */
export async function POST(request: Request) {
  const { error: configError } = readSupabaseConfig();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  let body: { email?: unknown };
  try {
    body = (await readJsonObject(request)) as { email?: unknown };
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
    result = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${getRequestOrigin(request)}/auth/confirm`,
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

  return NextResponse.json({
    ok: true,
    message: "If an account exists for this address, a confirmation link is on its way.",
  });
}

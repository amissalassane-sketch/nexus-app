import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin, safeNextPath } from "@/lib/request-origin";

/**
 * Handles the return from a Supabase email link:
 *   - signup confirmation
 *   - password recovery
 *
 * The confirmation email must point here (`emailRedirectTo`).
 * We exchange the PKCE `code` for an SSR session, then send the user on.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), "/onboarding");
  const authError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(authError)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("This confirmation link is missing its code. Request a new email.")}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        error.message || "This confirmation link is invalid or has expired."
      )}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}

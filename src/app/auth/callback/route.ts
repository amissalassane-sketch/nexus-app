// ============================================================
// NEXUS — AUTH CALLBACK (P5: change-email confirmation)
// PKCE flow: the email confirmation link carries a `code` that
// MUST be exchanged for a session — pitfall #3.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // Keep only a safe local path (never an absolute/external URL).
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Relative redirect: proxy-proof (no origin guessing).
      return NextResponse.redirect(next);
    }
  }

  return NextResponse.redirect("/login?error=auth_callback_failed");
}

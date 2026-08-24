import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { humanizeAuthError } from "@/lib/auth-errors";

/** Ends the session server-side and clears the SSR auth cookies. */
export async function POST() {
  const { error: configError } = readSupabaseConfig();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json({ error: humanizeAuthError(error) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

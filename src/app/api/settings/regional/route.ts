import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEFAULT_USER_CONTEXT, parseUserContext } from "@/lib/global/context";
import { readSmallJson, requireSameOrigin } from "@/lib/privacy/request";
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503, headers });
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
    const { data, error } = await db.from("user_regional_preferences").select("context").eq("user_id", user.id).maybeSingle();
    if (error) return NextResponse.json({ error: "REGIONAL_SETTINGS_UNAVAILABLE" }, { status: 503, headers });
    return NextResponse.json({ context: data ? parseUserContext(data.context) : DEFAULT_USER_CONTEXT, persisted: Boolean(data) }, { headers });
  } catch { return NextResponse.json({ error: "REGIONAL_SETTINGS_UNAVAILABLE" }, { status: 503, headers }); }
}
export async function PUT(request: Request) {
  try { requireSameOrigin(request); } catch { return NextResponse.json({ error: "ORIGIN_NOT_ALLOWED" }, { status: 403, headers }); }
  let context;
  try { context = parseUserContext(await readSmallJson(request)); } catch { return NextResponse.json({ error: "INVALID_REGIONAL_CONTEXT" }, { status: 400, headers }); }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503, headers });
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
    const { error } = await db.from("user_regional_preferences").upsert({ user_id: user.id, context, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: "SAVE_FAILED", message: "Your preferences were not saved." }, { status: 503, headers });
    return NextResponse.json({ context, persisted: true, workspaceLegalCountryChanged: false }, { headers });
  } catch { return NextResponse.json({ error: "SAVE_FAILED" }, { status: 503, headers }); }
}

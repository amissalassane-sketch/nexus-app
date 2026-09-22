import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { readSmallJson, requireSameOrigin } from "@/lib/privacy/request";
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
async function context() {
  if (!isSupabaseConfigured()) return { response: NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503, headers }) };
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers }) };
  const workspaceId = await getActiveWorkspaceId(db, user.id);
  if (!workspaceId) return { response: NextResponse.json({ error: "NO_ACTIVE_WORKSPACE" }, { status: 403, headers }) };
  return { db, user, workspaceId };
}
export async function GET() {
  try {
    const c = await context();
    if (c.response) return c.response;
    const { db, user, workspaceId } = c;
    const { data, error } = await db.from("intelligence_memory").select("state, preferences, updated_at").eq("user_id", user.id).eq("workspace_id", workspaceId).maybeSingle();
    if (error) return NextResponse.json({ error: "MEMORY_UNAVAILABLE", message: "Memory could not be read. No export has been produced." }, { status: 503, headers });
    return NextResponse.json({ scope: "own_ai_memory_in_active_workspace_only", workspaceId, exportedAt: new Date().toISOString(), memory: data, excluded: ["account data", "other workspaces", "documents", "provider-side data", "billing", "logs", "backups"] }, { headers });
  } catch { return NextResponse.json({ error: "PRIVACY_UNAVAILABLE" }, { status: 503, headers }); }
}
export async function DELETE(request: Request) {
  try { requireSameOrigin(request); } catch { return NextResponse.json({ error: "ORIGIN_NOT_ALLOWED" }, { status: 403, headers }); }
  let body: Record<string, unknown>;
  try { body = await readSmallJson(request); } catch { return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400, headers }); }
  if (body.confirm !== "DELETE_MY_MEMORY") return NextResponse.json({ error: "CONFIRMATION_REQUIRED" }, { status: 409, headers });
  try {
    const c = await context();
    if (c.response) return c.response;
    const { db, user, workspaceId } = c;
    // Binds the confirmed preview to the selected workspace, not an arbitrary client scope.
    if (body.workspaceId !== workspaceId) return NextResponse.json({ error: "WORKSPACE_CHANGED", message: "Reload the memory preview before confirming." }, { status: 409, headers });
    const { error } = await db.from("intelligence_memory").delete().eq("user_id", user.id).eq("workspace_id", workspaceId);
    if (error) return NextResponse.json({ error: "DELETE_FAILED", message: "Deletion was not confirmed. Please retry." }, { status: 503, headers });
    return NextResponse.json({ deleted: true, scope: "own_ai_memory_in_active_workspace_only", note: "New or in-flight AI requests can create memory again. Close other AI tabs before deleting." }, { headers });
  } catch { return NextResponse.json({ error: "DELETE_FAILED" }, { status: 503, headers }); }
}

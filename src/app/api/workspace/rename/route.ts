// ============================================================
// NEXUS — WORKSPACE RENAME (P5)
// POST /api/workspace/rename { name }
// Owner/admin only — role is VERIFIED SERVER-SIDE before the
// update, independently of what the client claims.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: unknown };
  try {
    body = (await request.json()) as { name?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "Workspace name must be 2-80 characters" }, { status: 400 });
  }

  // Resolve workspace + role (ordered + limited — pitfall #2).
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ error: "No active workspace found" }, { status: 403 });
  }

  // SERVER-SIDE role verification — never trust the client.
  if (!["owner", "admin"].includes(membership.role)) {
    return NextResponse.json(
      { error: "Only workspace owners and admins can rename the workspace" },
      { status: 403 }
    );
  }

  const { error: updateError } = await supabase
    .from("workspaces")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", membership.workspace_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, name });
}

import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import {
  executeIntelligenceAction,
  ActionError,
  riskForIntelligenceAction,
} from "@/lib/intelligence/actions";
import type { IntelligenceActionType } from "@/lib/intelligence/types";

// ============================================================
// NEXUS INTELLIGENCE — SECURE ACTION EXECUTION API
// POST /api/intelligence/action
//
// LLM → Tool call → Server validation → Authorization → Supabase
// mutation → Verification → Result. This route re-validates the
// session, the active workspace membership, the payload schema and
// every mutated id before touching a row. It never trusts a client
// id without a workspace-scoped read, and it reads the resource back
// before reporting success.
// ============================================================

const EXECUTABLE_ACTIONS = new Set<IntelligenceActionType>([
  "create_task",
  "create_project",
  "create_goal",
  "update_task",
  "update_project",
  "update_goal",
  "complete_task",
  "move_task",
  "delete_task",
  "delete_project",
  "delete_goal",
]);

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Supabase is not configured in this environment" },
        { status: 503 }
      );
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const { membership } = await getActiveMembership(supabase, user.id);
    const workspaceId = membership?.workspaceId ?? null;

    if (!workspaceId) {
      return NextResponse.json(
        { error: "No active workspace associated with user" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const actionType = body.type as IntelligenceActionType | undefined;
    const payload = body.payload && typeof body.payload === "object" ? { ...body.payload } : {};

    if (!actionType) {
      return NextResponse.json({ error: "Action type is required" }, { status: 400 });
    }

    if (!EXECUTABLE_ACTIONS.has(actionType)) {
      const risk = riskForIntelligenceAction(actionType);
      if (risk === "none" && (actionType === "navigate" || actionType.startsWith("open_") || actionType.startsWith("view_"))) {
        // UI-only navigation actions are resolved by the client; nothing to execute.
        return NextResponse.json(
          { error: `Action type "${actionType}" does not require server execution` },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: `Unsupported action type "${actionType}"` }, { status: 400 });
    }

    try {
      const result = await executeIntelligenceAction(
        supabase,
        workspaceId,
        user.id,
        actionType,
        payload
      );

      return NextResponse.json({
        success: true,
        actionType: result.actionType,
        entityId: result.entityId,
        message: result.message,
        entity: result.entity,
        verification: result.verified,
        risk: riskForIntelligenceAction(actionType),
      });
    } catch (err) {
      if (err instanceof ActionError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  } catch (error) {
    console.error("Intelligence action execution error:", error);
    return NextResponse.json(
      { error: "Failed to execute intelligence action" },
      { status: 500 }
    );
  }
}

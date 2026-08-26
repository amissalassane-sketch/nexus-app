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
import {
  applyActionFailure,
  applyActionSuccess,
  readMemory,
  saveMemory,
} from "@/lib/intelligence/memory";

import type { WorkspaceSnapshot } from "@/lib/intelligence/engine";
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

    // ---- Phase 2: load the working memory to update ---------------
    const stored = await readMemory(supabase, workspaceId, user.id);
    const memoryState = stored?.state;

    try {
      const result = await executeIntelligenceAction(
        supabase,
        workspaceId,
        user.id,
        actionType,
        payload
      );

      // ---- MEMORY UPDATE (only after server verification) ---------
      // A verified mutation is recorded as executed with the REAL id;
      // deletions invalidate the reference for future turns.
      const entityLabel =
        result.entity?.title ?? result.entity?.name ?? payload.title ?? payload.name ?? "Item";
      const entityType: "task" | "project" | "goal" =
        actionType.includes("project") ? "project" : actionType.includes("goal") ? "goal" : "task";

      const updatedMemory = memoryState
        ? applyActionSuccess(
            memoryState,
            result.actionType,
            result.entityId,
            String(entityLabel),
            result.verified.verified,
            entityType
          )
        : undefined;

      if (updatedMemory) {
        await saveMemory(supabase, workspaceId, user.id, updatedMemory, stored?.preferences ?? []);
      }

      return NextResponse.json({
        success: true,
        actionType: result.actionType,
        entityId: result.entityId,
        message: result.message,
        entity: result.entity,
        verification: result.verified,
        risk: riskForIntelligenceAction(actionType),
        memory: updatedMemory
          ? { state: updatedMemory, preferences: stored?.preferences ?? [], persisted: true }
          : undefined,
      });
    } catch (err) {
      // ---- MEMORY UPDATE (failure) --------------------------------
      // A failed/rejected action is recorded as FAILED — never as
      // executed, never as verified.
      if (err instanceof ActionError) {
        if (memoryState) {
          const failed = applyActionFailure(memoryState, actionType, String(payload.title ?? payload.name ?? "Item"));
          await saveMemory(supabase, workspaceId, user.id, failed, stored?.preferences ?? []);
        }
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

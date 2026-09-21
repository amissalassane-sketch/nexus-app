import { IntelligenceDataError, assertIntelligenceData } from "@/lib/intelligence/data-error";
import { readJsonObject } from "@/lib/request-json";
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
import { markSignalActed } from "@/lib/intelligence/signal-store";
import { applyVerifiedActionToStep, readMission, runMissionLoop, saveMission } from "@/lib/intelligence/mission";
import { readSignals } from "@/lib/intelligence/signal-store";
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
    const { membership, error: membershipError } = await getActiveMembership(supabase, user.id);
    if (membershipError) throw new IntelligenceDataError();
    const workspaceId = membership?.workspaceId ?? null;

    if (!workspaceId) {
      return NextResponse.json(
        { error: "No active workspace associated with user" },
        { status: 400 }
      );
    }

    const body = await readJsonObject(request).catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    const actionType = body.type as IntelligenceActionType | undefined;
    const payload: Record<string, unknown> = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? { ...body.payload as Record<string, unknown> } : {};
    // Optional: when the action came from a proactive signal, mark the
    // signal as "acted" after the VERIFIED mutation (observability).
    const signalId = typeof body.signalId === "string" ? body.signalId : null;
    // Phase 4: when the action belongs to a mission step, the step is
    // updated only after the verified read-back (completed/failed).
    const missionId = typeof body.missionId === "string" ? body.missionId : null;
    const missionStepId = typeof body.missionStepId === "string" ? body.missionStepId : null;

    if (typeof actionType !== "string" || !actionType) {
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

      // Signal observability: a verified mutation marks the source
      // signal as "acted" (the problem itself resolves on next refresh
      // when the fingerprint disappears).
      if (signalId) {
        await markSignalActed(supabase, workspaceId, user.id, signalId);
      }

      // Phase 4 — mission step update (verified read-back only).
      let mission = null;
      if (missionId && missionStepId) {
        const storedMission = await readMission(supabase, workspaceId, user.id, missionId);
        if (storedMission) {
          mission = applyVerifiedActionToStep(storedMission, missionStepId, {
            verified: result.verified.verified,
            matched: result.verified.matched,
            summary: result.verified.summary,
          });
          const signals = (await readSignals(supabase, workspaceId, user.id)).filter(
            (signal) => signal.status !== "resolved"
          );
          const { tasks, projects, goals } = await loadMissionSnapshot(supabase, workspaceId);
          mission = runMissionLoop(mission, { tasks, projects, goals }, signals);
          await saveMission(supabase, mission);
        }
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
        mission,
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
        // Phase 4 — a failed mutation marks the mission step failed.
        if (missionId && missionStepId) {
          const storedMission = await readMission(supabase, workspaceId, user.id, missionId);
          if (storedMission) {
            const failedMission = applyVerifiedActionToStep(storedMission, missionStepId, {
              verified: false,
              matched: [],
              summary: err.message,
            });
            await saveMission(supabase, failedMission);
          }
        }
        return NextResponse.json({ error: err.message, mission: missionId && missionStepId ? await readMission(supabase, workspaceId, user.id, missionId) : undefined }, { status: err.status });
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof IntelligenceDataError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message, error: error.message }, { status: error.status });
    }
    console.error("Intelligence action execution error:", error);
    return NextResponse.json(
      { error: "Failed to execute intelligence action" },
      { status: 500 }
    );
  }
}

/** Minimal snapshot loader for mission re-evaluation (one read pass,
 *  no activities/dependencies needed for step statuses). */
async function loadMissionSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<WorkspaceSnapshot> {
  const [tasksRes, projectsRes, goalsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_at, completed_at, project_id, updated_at, created_at")
      .eq("workspace_id", workspaceId)
      .limit(500),
    supabase
      .from("projects")
      .select("id, name, status, due_date, progress, goal_id, updated_at, created_at")
      .eq("workspace_id", workspaceId),
    supabase
      .from("goals")
      .select("id, title, status, progress, target_date, updated_at")
      .eq("workspace_id", workspaceId),
  ]);
  assertIntelligenceData(tasksRes, projectsRes, goalsRes);
  return {
    tasks: (tasksRes.data ?? []) as WorkspaceSnapshot["tasks"],
    projects: (projectsRes.data ?? []) as WorkspaceSnapshot["projects"],
    goals: (goalsRes.data ?? []) as WorkspaceSnapshot["goals"],
  };
}

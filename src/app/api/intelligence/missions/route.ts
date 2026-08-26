import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import { executeIntelligenceAction, ActionError } from "@/lib/intelligence/actions";
import {
  applyVerifiedActionToStep,
  cancelMission,
  createMissionObject,
  detectMissionRequest,
  findRelatedEntities,
  readActiveMissions,
  readMission,
  runMissionLoop,
  saveMission,
} from "@/lib/intelligence/mission";
import { readMemory, saveMemory } from "@/lib/intelligence/memory";
import { readSignals } from "@/lib/intelligence/signal-store";
import type { WorkspaceSnapshot } from "@/lib/intelligence/engine";
import type { ActivityContextItem, TaskDependencyContextItem } from "@/lib/intelligence/types";

// ============================================================
// NEXUS INTELLIGENCE — MISSIONS API
// ============================================================
// GET  /api/intelligence/missions → active missions of the workspace
// POST /api/intelligence/missions
//   { action: "create", query }        → detect + create + evaluate
//   { action: "status", id }           → re-evaluate (bounded) + return
//   { action: "continue", id }         → propose the next best action
//   { action: "confirmStep", id, stepId } → execute the step's action
//     (secure mutation + read-back) → completed/failed
//   { action: "cancel", id }           → cancel the mission
//   { action: "recompute" }            → re-evaluate all active
//
// Rules:
//   - session + active membership re-validated here;
//   - every row is scoped to (workspace_id, user_id);
//   - the LLM never declares a step completed — only a verified
//     read-back (or a real "done" state in the snapshot) does;
//   - destructive actions require explicit confirmation.
// ============================================================

async function loadWorkspace(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string) {
  const [tasksRes, projectsRes, goalsRes, activitiesRes, dependenciesRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_at, completed_at, project_id, updated_at, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("projects")
      .select("id, name, status, due_date, progress, goal_id, updated_at, created_at")
      .eq("workspace_id", workspaceId),
    supabase
      .from("goals")
      .select("id, title, status, progress, target_date, updated_at")
      .eq("workspace_id", workspaceId),
    supabase
      .from("activities")
      .select("id, entity_type, action, metadata, created_at, actor_id")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("task_dependencies")
      .select("task_id, depends_on_task_id")
      .eq("workspace_id", workspaceId),
  ]);

  const snapshot: WorkspaceSnapshot = {
    tasks: (tasksRes.data ?? []) as WorkspaceSnapshot["tasks"],
    projects: (projectsRes.data ?? []) as WorkspaceSnapshot["projects"],
    goals: (goalsRes.data ?? []) as WorkspaceSnapshot["goals"],
  };

  const recentActivities: ActivityContextItem[] = (activitiesRes.data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    entityType: String(row.entity_type ?? "item"),
    action: String(row.action ?? "updated"),
    title: typeof (row.metadata as Record<string, unknown> | null)?.title === "string" ? ((row.metadata as Record<string, unknown>).title as string) : "Item",
    actorName: null,
    createdAt: String(row.created_at),
  }));

  const taskMap = new Map<string, string>();
  for (const t of snapshot.tasks) taskMap.set(t.id, t.title);
  const dependencies: TaskDependencyContextItem[] = (dependenciesRes.data ?? []).map((dep: Record<string, unknown>) => ({
    taskId: String(dep.task_id),
    taskTitle: taskMap.get(String(dep.task_id)) ?? "Task",
    dependsOnTaskId: String(dep.depends_on_task_id),
    dependsOnTitle: taskMap.get(String(dep.depends_on_task_id)) ?? "Prerequisite",
  }));

  return { snapshot, activities: recentActivities, dependencies };
}

export async function GET() {
  return route("GET", {});
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return route("POST", body);
}

async function route(method: "GET" | "POST", body: Record<string, unknown>) {
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

    if (method === "GET") {
      const missions = await readActiveMissions(supabase, workspaceId, user.id);
      return NextResponse.json({ success: true, missions });
    }

    const action = typeof body.action === "string" ? body.action : "status";
    const missionId = typeof body.id === "string" ? body.id : null;
    const signals = (await readSignals(supabase, workspaceId, user.id)).filter(
      (signal) => signal.status !== "resolved"
    );

    if (action === "create") {
      const query = typeof body.query === "string" ? body.query : "";
      const request = detectMissionRequest(query);
      if (!request) {
        return NextResponse.json(
          { error: "Cette demande ne correspond pas à une mission décomposable" },
          { status: 422 }
        );
      }
      const { snapshot } = await loadWorkspace(supabase, workspaceId);
      const related = findRelatedEntities(snapshot, request.keyword);
      const mission = createMissionObject(request, workspaceId, user.id, snapshot, related);
      const evaluated = runMissionLoop(mission, snapshot, signals);
      await saveMission(supabase, evaluated);

      // Link the mission in the Phase 2 memory.
      const stored = await readMemory(supabase, workspaceId, user.id);
      const memory = stored?.state;
      if (memory) {
        const updated = { ...memory, lastMissionId: evaluated.id, lastQuery: query, updatedAt: new Date().toISOString() };
        await saveMemory(supabase, workspaceId, user.id, updated, stored?.preferences ?? []);
      }

      return NextResponse.json({ success: true, mission: evaluated, created: true });
    }

    if (!missionId) {
      return NextResponse.json({ error: "Mission id is required" }, { status: 400 });
    }

    const mission = await readMission(supabase, workspaceId, user.id, missionId);
    if (!mission) {
      return NextResponse.json({ error: "Mission not found in this workspace" }, { status: 404 });
    }

    if (action === "cancel") {
      const cancelled = await cancelMission(supabase, workspaceId, user.id, missionId);
      return NextResponse.json({ success: true, cancelled });
    }

    if (action === "status" || action === "continue") {
      const { snapshot } = await loadWorkspace(supabase, workspaceId);
      const evaluated = runMissionLoop(mission, snapshot, signals);
      await saveMission(supabase, evaluated);
      return NextResponse.json({ success: true, mission: evaluated });
    }

    if (action === "confirmStep") {
      const stepId = typeof body.stepId === "string" ? body.stepId : null;
      if (!stepId) {
        return NextResponse.json({ error: "stepId is required" }, { status: 400 });
      }
      const step = mission.steps.find((s) => s.id === stepId);
      if (!step) {
        return NextResponse.json({ error: "Step not found in this mission" }, { status: 404 });
      }
      if (!step.action) {
        return NextResponse.json({ error: "Cette étape n'a pas d'action exécutable" }, { status: 422 });
      }

      try {
        const result = await executeIntelligenceAction(
          supabase,
          workspaceId,
          user.id,
          step.action.type,
          {
            ...step.action.payload,
            confirmed: true,
            confirmDeletion: step.action.risk === "high" ? true : undefined,
          }
        );
        // VERIFIED → step completed; failed → step failed. Never in between.
        const updated = applyVerifiedActionToStep(mission, stepId, {
          verified: result.verified.verified,
          matched: result.verified.matched,
          summary: result.verified.summary,
        });
        const { snapshot } = await loadWorkspace(supabase, workspaceId);
        const evaluated = runMissionLoop(updated, snapshot, signals);
        await saveMission(supabase, evaluated);
        return NextResponse.json({
          success: true,
          mission: evaluated,
          actionResult: { message: result.message, verified: result.verified },
        });
      } catch (err) {
        if (err instanceof ActionError) {
          const failed = applyVerifiedActionToStep(mission, stepId, {
            verified: false,
            matched: [],
            summary: err.message,
          });
          await saveMission(supabase, failed);
          return NextResponse.json({ error: err.message, mission: failed }, { status: err.status });
        }
        throw err;
      }
    }

    if (action === "recompute") {
      const { snapshot } = await loadWorkspace(supabase, workspaceId);
      const missions = await readActiveMissions(supabase, workspaceId, user.id);
      const evaluated = [];
      for (const m of missions) {
        const next = runMissionLoop(m, snapshot, signals);
        await saveMission(supabase, next);
        evaluated.push(next);
      }
      return NextResponse.json({ success: true, missions: evaluated });
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  } catch (error) {
    console.error("Intelligence missions error:", error);
    return NextResponse.json(
      { error: "Failed to process intelligence missions" },
      { status: 500 }
    );
  }
}

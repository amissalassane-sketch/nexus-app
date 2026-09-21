import { assertIntelligenceData } from "@/lib/intelligence/data-error";
// ============================================================
// NEXUS INTELLIGENCE — SIGNALS API CORE (injectable)
// ============================================================
// Pure request handling for the proactive signals API, decoupled from
// Next.js so the contract (session absente → 401, workspace absent →
// 400, réponse structurée, isolation cross-workspace) is unit-testable.
// The route is a thin wrapper that supplies the real Supabase client,
// the authenticated user and the active membership.
// ============================================================

import { getProactiveIntelligence, readSignals, updateSignalStatus } from "./signal-store";
import { emptyMemoryState, focusMemoryOnEntity, readMemory, saveMemory } from "./memory";
import { computeInsights, type WorkspaceSnapshot } from "./engine";
import type { ActivityContextItem, TaskDependencyContextItem } from "./types";

export interface SignalsApiDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

async function loadWorkspace(db: SignalsApiDb, workspaceId: string) {
  const [tasksRes, projectsRes, goalsRes, activitiesRes, dependenciesRes] = await Promise.all([
    db
      .from("tasks")
      .select("id, title, status, priority, due_at, completed_at, project_id, updated_at, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("projects")
      .select("id, name, status, due_date, progress, goal_id, updated_at, created_at")
      .eq("workspace_id", workspaceId),
    db
      .from("goals")
      .select("id, title, status, progress, target_date, updated_at")
      .eq("workspace_id", workspaceId),
    db
      .from("activities")
      .select("id, entity_type, action, metadata, created_at, actor_id")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("task_dependencies")
      .select("task_id, depends_on_task_id")
      .eq("workspace_id", workspaceId),
  ]);

  assertIntelligenceData(tasksRes, projectsRes, goalsRes, activitiesRes, dependenciesRes);

  const snapshot: WorkspaceSnapshot = {
    tasks: (tasksRes.data ?? []) as WorkspaceSnapshot["tasks"],
    projects: (projectsRes.data ?? []) as WorkspaceSnapshot["projects"],
    goals: (goalsRes.data ?? []) as WorkspaceSnapshot["goals"],
  };

  const recentActivities: ActivityContextItem[] = (activitiesRes.data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    entityType: String(row.entity_type ?? "item"),
    action: String(row.action ?? "updated"),
    title: typeof (row.metadata as Record<string, unknown> | null | undefined)?.title === "string" ? (row.metadata as Record<string, unknown>).title as string : "Item",
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

export interface SignalsApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function handleSignalsRequest(deps: {
  db: SignalsApiDb;
  userId: string | null;
  workspaceId: string | null;
  method: "GET" | "POST";
  body: Record<string, unknown>;
  enrich?: boolean;
}): Promise<SignalsApiResult> {
  const { db, userId, workspaceId, method } = deps;

  if (!userId) {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  if (!workspaceId) {
    return { status: 400, body: { error: "No active workspace associated with user" } };
  }

  const body = deps.body ?? {};
  const action = method === "GET" ? "refresh" : typeof body.action === "string" ? body.action : "refresh";
  const signalId = typeof body.id === "string" ? body.id : null;

  if (action === "markSeen" || action === "dismiss" || action === "resolve") {
    if (!signalId) {
      return { status: 400, body: { error: "Signal id is required" } };
    }
    const status = action === "markSeen" ? "seen" : action === "dismiss" ? "dismissed" : "resolved";
    const updated = await updateSignalStatus(db, workspaceId, userId, signalId, status);
    if (!updated) {
      return { status: 404, body: { error: "Signal not found in this workspace" } };
    }
    return { status: 200, body: { success: true, status } };
  }

  if (action === "focus") {
    if (!signalId) {
      return { status: 400, body: { error: "Signal id is required" } };
    }
    const signals = await readSignals(db, workspaceId, userId);
    const signal = signals.find((s) => s.id === signalId);
    if (!signal) {
      return { status: 404, body: { error: "Signal not found in this workspace" } };
    }
    // Point the Phase 2 working memory at the signalled entity so
    // « Pourquoi ? » / « Débloque-la » resolve to it. The memory is
    // created on first focus when the user never asked a question yet.
    const stored = await readMemory(db, workspaceId, userId);
    const memory = stored?.state ?? emptyMemoryState();
    const focused = focusMemoryOnEntity(
      memory,
      { type: signal.entityType, id: signal.entityId, label: signal.entityLabel },
      signal.title
    );
    await saveMemory(db, workspaceId, userId, focused, stored?.preferences ?? []);
    return {
      status: 200,
      body: {
        success: true,
        signal: {
          id: signal.id,
          fingerprint: signal.fingerprint,
          type: signal.type,
          severity: signal.severity,
          title: signal.title,
          summary: signal.summary,
          evidence: signal.evidence,
          score: signal.score,
          scoreBreakdown: signal.scoreBreakdown,
          entity: { type: signal.entityType, id: signal.entityId, label: signal.entityLabel },
          suggestedActions: signal.suggestedActions,
        },
      },
    };
  }

  // refresh (GET or POST action "refresh")
  const { snapshot, activities, dependencies } = await loadWorkspace(db, workspaceId);
  const result = await getProactiveIntelligence(db, workspaceId, userId, snapshot, {
    activities,
    dependencies,
    enrich: deps.enrich === true || body.enrich === true,
  });

  // Proactive context for the request pipeline (kept lightweight).
  const insights = computeInsights(snapshot);
  const proactive = insights
    .filter((insight) => insight.severity !== "positive")
    .slice(0, 3)
    .map((insight) => ({
      id: insight.id,
      title: insight.title,
      reason: insight.reason,
      severity: insight.severity,
      href: insight.href,
    }));

  return {
    status: 200,
    body: {
      success: true,
      signals: result.signals,
      attentionCount: result.attentionCount,
      criticalCount: result.criticalCount,
      refreshedAt: result.refreshedAt,
      llmEnriched: result.llmEnriched,
      proactive,
    },
  };
}

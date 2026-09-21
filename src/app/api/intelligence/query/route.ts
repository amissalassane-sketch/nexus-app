import { IntelligenceDataError, assertIntelligenceData } from "@/lib/intelligence/data-error";
import { readJsonObject } from "@/lib/request-json";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import { buildWorkspaceContext } from "@/lib/intelligence/context-builder";
import { askWorkspace } from "@/lib/intelligence/advanced";
import { runAgent } from "@/lib/intelligence/agent";
import { classifyIntent } from "@/lib/intelligence/intent";
import { resolveReference } from "@/lib/intelligence/references";
import {
  emptyMemoryState,
  extractPreference,
  readMemory,
  saveMemory,
  scrubDeletedIds,
  updateMemoryAfterTurn,
  upsertPreference,
} from "@/lib/intelligence/memory";
import { readSignals } from "@/lib/intelligence/signal-store";
import {
  createMissionObject,
  detectMissionRequest,
  findRelatedEntities,
  readActiveMissions,
  runMissionLoop,
  saveMission,
} from "@/lib/intelligence/mission";
import { computeInsights, type WorkspaceSnapshot } from "@/lib/intelligence/engine";
import type {
  ActivityContextItem,
  IntelligenceMemoryState,
  IntelligenceMission,
  IntelligencePreference,
  SessionHistoryItem,
  TaskDependencyContextItem,
} from "@/lib/intelligence/types";

// ============================================================
// NEXUS INTELLIGENCE — AGENTIC QUERY API
// POST /api/intelligence/query
//
// Pipeline:
// User -> Intelligence UI -> API Route -> Scoped Context Builder ->
// Agent loop (intent -> tool selection -> real read tools ->
//   [AI proposes extra tools -> server validates -> executes] ->
//   plan -> response) -> Verified Response -> UI
//
// Security: session + active membership re-validated here; every read
// is scoped to the authenticated user's active workspace; the agent
// never touches Supabase directly (it consumes the scoped snapshot).
// ============================================================

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
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const rawHistory = Array.isArray(body.sessionHistory) ? body.sessionHistory : [];
    const sessionHistory: SessionHistoryItem[] = rawHistory.filter(
      (h: unknown): h is SessionHistoryItem => Boolean(h && typeof h === "object" && "query" in h && typeof (h as Record<string, unknown>).query === "string")
    );

    // ---- Phase 2: structured working memory ----------------------
    // Server-persisted memory is the source of truth. When the user
    // never used Intelligence in this workspace before, the client's
    // cached state (same workspace) is restored as a starting point.
    const stored = await readMemory(supabase, workspaceId, user.id);
    const clientMemoryRaw =
      body.memory && typeof body.memory === "object"
        ? (body.memory as { state?: unknown; preferences?: unknown })
        : undefined;
    const clientMemory: IntelligenceMemoryState | undefined =
      clientMemoryRaw?.state && typeof clientMemoryRaw.state === "object"
        ? (clientMemoryRaw.state as IntelligenceMemoryState)
        : undefined;

    const memoryState: IntelligenceMemoryState = stored
      ? scrubDeletedIds(stored.state, stored.state.deletedEntityIds)
      : clientMemory
        ? clientMemory
        : emptyMemoryState();

    const preferences: IntelligencePreference[] = stored?.preferences ?? [];

    // Explicit durable preference? ("souviens-toi que…") — only then.
    const explicitPreference = extractPreference(query);
    if (explicitPreference) {
      preferences.splice(
        0,
        preferences.length,
        ...upsertPreference(preferences, explicitPreference)
      );
    }

    // Scoped queries strictly isolated by workspace_id
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

    assertIntelligenceData(tasksRes, projectsRes, goalsRes, activitiesRes, dependenciesRes);

    const snapshot: WorkspaceSnapshot = {
      tasks: (tasksRes.data ?? []) as WorkspaceSnapshot["tasks"],
      projects: (projectsRes.data ?? []) as WorkspaceSnapshot["projects"],
      goals: (goalsRes.data ?? []) as WorkspaceSnapshot["goals"],
    };

    const recentActivities: ActivityContextItem[] = (activitiesRes.data ?? []).map((row) => ({
      id: row.id,
      entityType: row.entity_type ?? "item",
      action: row.action ?? "updated",
      title: typeof row.metadata?.title === "string" ? row.metadata.title : "Item",
      actorName: null,
      createdAt: row.created_at,
    }));

    const taskMap = new Map<string, string>();
    for (const t of snapshot.tasks) {
      taskMap.set(t.id, t.title);
    }

    const dependencies: TaskDependencyContextItem[] = (dependenciesRes.data ?? []).map((dep) => ({
      taskId: dep.task_id,
      taskTitle: taskMap.get(dep.task_id) ?? "Task",
      dependsOnTaskId: dep.depends_on_task_id,
      dependsOnTitle: taskMap.get(dep.depends_on_task_id) ?? "Prerequisite",
    }));

    const context = buildWorkspaceContext(workspaceId, snapshot, {
      activities: recentActivities,
      dependencies,
    });

    const classified = classifyIntent(query, { snapshot, sessionHistory });

    // Reference resolution against the persisted memory, verified
    // against the FRESH server snapshot (stale ids → "deleted").
    const resolution = resolveReference(query, memoryState, snapshot, { verify: true });

    // Phase 3 — active proactive signals as derived context. Read from
    // the persisted store (cheap, no recalculation per request); the
    // full recalculation happens on GET /api/intelligence/signals and
    // after verified mutations.
    const activeSignals = (await readSignals(supabase, workspaceId, user.id))
      .filter((signal) => signal.status !== "dismissed" && signal.status !== "resolved")
      .slice(0, 5);

    // ---- PHASE 4 — MISSION -------------------------------------------------
    // "Prépare-moi pour ma présentation de vendredi" → create a mission.
    // "Où en est ma présentation ?" / "Et maintenant ?" → resume the last
    // active mission (memory.lastMissionId, else most recent active).
    let mission: IntelligenceMission | null = null;
    const missionRequest = detectMissionRequest(query);
    if (missionRequest) {
      const related = findRelatedEntities(snapshot, missionRequest.keyword);
      const created = createMissionObject(missionRequest, workspaceId, user.id, snapshot, related);
      mission = runMissionLoop(created, snapshot, activeSignals);
      await saveMission(supabase, mission);
      memoryState.lastMissionId = mission.id;
      memoryState.lastQuery = query;
    } else {
      const resumeQuery =
        /où en est|ou en est|et maintenant|et maintenant\?|et après|et apres|where (is|are)|how is.*going|what now/.test(query.toLowerCase());
      const candidates = await readActiveMissions(supabase, workspaceId, user.id);
      const target =
        (memoryState.lastMissionId
          ? candidates.find((m) => m.id === memoryState.lastMissionId)
          : undefined) ??
        candidates[0] ??
        null;
      if (target && (resumeQuery || candidates.length > 0)) {
        mission = runMissionLoop(target, snapshot, activeSignals);
        if (JSON.stringify(mission.steps.map((s) => [s.id, s.status])) !== JSON.stringify(target.steps.map((s) => [s.id, s.status]))) {
          await saveMission(supabase, mission);
        }
        memoryState.lastMissionId = mission.id;
      }
    }

    // ---- AGENT LOOP ------------------------------------------------
    // Memory retrieval -> reference resolution -> intent -> read tools
    // -> (model proposes extra tools -> server validates -> executes)
    // -> plan -> response. Proactive signals feed the context.
    const { response: structuredResponse, agent } = await runAgent({
      workspaceId,
      query,
      snapshot,
      context,
      sessionHistory,
      activities: recentActivities,
      dependencies,
      memory: memoryState,
      preferences,
      resolution,
      signals: activeSignals,
      mission: mission ?? undefined,
    });

    // ---- MEMORY UPDATE ---------------------------------------------
    // Reflect the real state of this turn (proposed actions stay
    // proposed; executed actions only via the verified action route).
    const updatedMemory = updateMemoryAfterTurn(memoryState, structuredResponse, snapshot);
    await saveMemory(supabase, workspaceId, user.id, updatedMemory, preferences);

    const legacyAnswer = askWorkspace(snapshot, query, sessionHistory);
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
        evidence: insight.evidence,
      }));

    return NextResponse.json({
      success: true,
      query,
      answer: legacyAnswer,
      response: structuredResponse,
      agent,
      intent: classified,
      mission,
      // The client caches this to survive refresh and other tabs while
      // the server row remains the source of truth.
      memory: {
        state: updatedMemory,
        preferences,
        persisted: true,
      },
      context: {
        totals: context.totals,
        healthScore: context.healthScore,
        healthBand: context.healthBand,
        openTasks: context.totals.openTasks,
        attentionCount: proactive.length,
        proactive,
      },
    });
  } catch (error) {
    if (error instanceof IntelligenceDataError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message, error: error.message }, { status: error.status });
    }
    console.error("Intelligence query error:", error);
    return NextResponse.json(
      { error: "Failed to process intelligence query" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import { buildWorkspaceContext } from "@/lib/intelligence/context-builder";
import { askWorkspace } from "@/lib/intelligence/advanced";
import { runAgent } from "@/lib/intelligence/agent";
import { classifyIntent } from "@/lib/intelligence/intent";
import { computeInsights, type WorkspaceSnapshot } from "@/lib/intelligence/engine";
import type {
  ActivityContextItem,
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
    const { membership } = await getActiveMembership(supabase, user.id);
    const workspaceId = membership?.workspaceId ?? null;

    if (!workspaceId) {
      return NextResponse.json(
        { error: "No active workspace associated with user" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
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
        .select("id, name, status, due_date, progress, updated_at, created_at")
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

    // ---- AGENT LOOP ------------------------------------------------
    // Intent -> server-selected read tools -> (model proposes extra
    // tools -> server validates -> executes) -> plan -> response.
    const { response: structuredResponse, agent } = await runAgent({
      workspaceId,
      query,
      snapshot,
      context,
      sessionHistory,
      activities: recentActivities,
      dependencies,
    });

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
    console.error("Intelligence query error:", error);
    return NextResponse.json(
      { error: "Failed to process intelligence query" },
      { status: 500 }
    );
  }
}

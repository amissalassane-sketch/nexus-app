import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import { buildWorkspaceContext } from "@/lib/intelligence/context-builder";
import { askWorkspace, reasonWorkspace } from "@/lib/intelligence/advanced";
import { callAIProvider } from "@/lib/intelligence/ai-provider";
import type { WorkspaceSnapshot } from "@/lib/intelligence/engine";
import type { ActivityContextItem } from "@/lib/intelligence/types";

// ============================================================
// NEXUS INTELLIGENCE — STRUCTURED QUERY API
// POST /api/intelligence/query
//
// Pipeline:
// User -> Intelligence UI -> API Route -> Scoped Context Builder ->
// Authorized Nexus Data -> AI Provider / Structured Reasoning ->
// Validated Response -> UI
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

    // Scoped queries strictly isolated by workspace_id
    const [tasksRes, projectsRes, goalsRes, activitiesRes] = await Promise.all([
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

    const context = buildWorkspaceContext(workspaceId, snapshot, { activities: recentActivities });

    // 1. Try real AI provider if configured (OpenAI or Anthropic)
    let structuredResponse = await callAIProvider(query, context);

    // 2. Fallback to deterministic reasoning engine
    if (!structuredResponse) {
      structuredResponse = reasonWorkspace(snapshot, query, context);
    }

    const legacyAnswer = askWorkspace(snapshot, query);

    return NextResponse.json({
      success: true,
      query,
      answer: legacyAnswer,
      response: structuredResponse,
      context: {
        totals: context.totals,
        healthScore: context.healthScore,
        healthBand: context.healthBand,
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

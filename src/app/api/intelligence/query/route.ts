import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import { buildWorkspaceContext } from "@/lib/intelligence/context-builder";
import { askWorkspace, type AskAnswer } from "@/lib/intelligence/advanced";
import type { WorkspaceSnapshot } from "@/lib/intelligence/engine";

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
    const [tasksRes, projectsRes, goalsRes] = await Promise.all([
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
    ]);

    const snapshot: WorkspaceSnapshot = {
      tasks: (tasksRes.data ?? []) as WorkspaceSnapshot["tasks"],
      projects: (projectsRes.data ?? []) as WorkspaceSnapshot["projects"],
      goals: (goalsRes.data ?? []) as WorkspaceSnapshot["goals"],
    };

    const context = buildWorkspaceContext(workspaceId, snapshot);

    // AI Provider optional integration:
    // If an external LLM key is configured (OPENAI_API_KEY or ANTHROPIC_API_KEY),
    // it can be leveraged with system prompts injecting this minimal, verified context.
    // Otherwise, the deterministic NEXUS Context Reasoning Engine delivers
    // complete, zero-hallucination structured answers directly.
    const answer: AskAnswer = askWorkspace(snapshot, query);

    return NextResponse.json({
      success: true,
      query,
      answer,
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

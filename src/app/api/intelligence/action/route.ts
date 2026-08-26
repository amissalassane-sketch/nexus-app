import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import type { IntelligenceActionType } from "@/lib/intelligence/types";

// ============================================================
// NEXUS INTELLIGENCE — SECURE ACTION EXECUTION API
// POST /api/intelligence/action
//
// Strictly executes confirmed user actions in the active workspace.
// Never trusts client parameters blindly. Validates session, membership,
// and parameters before executing real database mutations.
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
    const actionType = body.type as IntelligenceActionType | undefined;
    const payload = (body.payload && typeof body.payload === "object") ? body.payload : {};

    if (!actionType) {
      return NextResponse.json(
        { error: "Action type is required" },
        { status: 400 }
      );
    }

    // 1. CREATE TASK
    if (actionType === "create_task") {
      const rawTitle = typeof payload.title === "string" ? payload.title.trim() : "";
      if (!rawTitle) {
        return NextResponse.json(
          { error: "Task title is required" },
          { status: 400 }
        );
      }
      const title = rawTitle.slice(0, 200);

      const validPriorities = ["low", "medium", "high", "urgent"];
      const priority = typeof payload.priority === "string" && validPriorities.includes(payload.priority)
        ? payload.priority
        : "medium";

      let dueAt: string | null = null;
      const rawDue = payload.dueDate ?? payload.due_at;
      if (typeof rawDue === "string" && rawDue.trim()) {
        const parsedDate = new Date(rawDue.trim());
        if (!Number.isNaN(parsedDate.getTime())) {
          dueAt = parsedDate.toISOString();
        }
      }

      let projectId: string | null = null;
      const rawProjectId = payload.projectId ?? payload.project_id;
      if (typeof rawProjectId === "string" && rawProjectId.trim()) {
        // Validate that this project belongs to the user's workspace
        const { data: projectCheck } = await supabase
          .from("projects")
          .select("id")
          .eq("id", rawProjectId.trim())
          .eq("workspace_id", workspaceId)
          .single();

        if (projectCheck) {
          projectId = projectCheck.id;
        }
      }

      const description = typeof payload.description === "string" && payload.description.trim()
        ? payload.description.trim().slice(0, 1000)
        : null;

      const { data: newTask, error: insertError } = await supabase
        .from("tasks")
        .insert({
          workspace_id: workspaceId,
          title,
          description,
          priority,
          status: "todo",
          due_at: dueAt,
          project_id: projectId,
          created_by: user.id,
        })
        .select("id, title, priority, status, due_at")
        .single();

      if (insertError || !newTask) {
        return NextResponse.json(
          { error: insertError?.message ?? "Failed to create task" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        actionType: "create_task",
        entityId: newTask.id,
        task: newTask,
        message: `Task “${title}” created successfully`,
      });
    }

    // 2. CREATE PROJECT
    if (actionType === "create_project") {
      const rawName = typeof payload.name === "string" ? payload.name.trim() : (typeof payload.title === "string" ? payload.title.trim() : "");
      if (!rawName) {
        return NextResponse.json(
          { error: "Project name is required" },
          { status: 400 }
        );
      }
      const name = rawName.slice(0, 100);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);

      let dueDate: string | null = null;
      const rawDue = payload.dueDate ?? payload.due_date;
      if (typeof rawDue === "string" && rawDue.trim()) {
        const parsedDate = new Date(rawDue.trim());
        if (!Number.isNaN(parsedDate.getTime())) {
          dueDate = parsedDate.toISOString().slice(0, 10);
        }
      }

      const description = typeof payload.description === "string" && payload.description.trim()
        ? payload.description.trim().slice(0, 1000)
        : null;

      const { data: newProject, error: insertError } = await supabase
        .from("projects")
        .insert({
          workspace_id: workspaceId,
          name,
          slug,
          description,
          status: "planning",
          progress: 0,
          due_date: dueDate,
          owner_id: user.id,
        })
        .select("id, name, status, progress, due_date")
        .single();

      if (insertError || !newProject) {
        return NextResponse.json(
          { error: insertError?.message ?? "Failed to create project" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        actionType: "create_project",
        entityId: newProject.id,
        project: newProject,
        message: `Project “${name}” created successfully`,
      });
    }

    return NextResponse.json(
      { error: `Action type "${actionType}" does not require server execution` },
      { status: 400 }
    );
  } catch (error) {
    console.error("Intelligence action execution error:", error);
    return NextResponse.json(
      { error: "Failed to execute intelligence action" },
      { status: 500 }
    );
  }
}

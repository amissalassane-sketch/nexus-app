// ============================================================
// NEXUS INTELLIGENCE — SERVER COLLECTOR
// Loads real workspace data and feeds the pure engine.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import {
  computeInsights,
  deterministicBrief,
  type IntelGoal,
  type IntelProject,
  type IntelResult,
  type IntelTask,
} from "@/lib/intelligence/engine";

export async function collectWorkspaceIntel(workspaceId: string): Promise<{
  result: IntelResult;
  brief: string;
  error: string | null;
}> {
  const supabase = await createClient();

  const [tasksResult, projectsResult, goalsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_at, project_id, completed_at")
      .eq("workspace_id", workspaceId),
    supabase
      .from("projects")
      .select("id, name, status, progress, due_date")
      .eq("workspace_id", workspaceId),
    supabase
      .from("goals")
      .select("id, title, status, progress, target_date")
      .eq("workspace_id", workspaceId),
  ]);

  const firstError =
    tasksResult.error?.message ?? projectsResult.error?.message ?? goalsResult.error?.message ?? null;

  const tasks = (tasksResult.data as IntelTask[] | null) ?? [];
  const projects = (projectsResult.data as IntelProject[] | null) ?? [];
  const goals = (goalsResult.data as IntelGoal[] | null) ?? [];

  const result = computeInsights({ now: new Date(), tasks, projects, goals });
  const brief = deterministicBrief(result, { now: new Date(), tasks, projects, goals });

  return { result, brief, error: firstError };
}

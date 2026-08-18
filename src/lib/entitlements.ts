// ============================================================
// NEXUS — CLIENT ENTITLEMENTS
// UX convenience layer ONLY. Never used as a security boundary.
// Real enforcement is done server-side via Supabase RPCs/triggers.
// ============================================================

import { createClient } from "@/lib/supabase/client";
import {
  type PlanName,
  type LimitCheckResult,
  PLAN_LIMITS,
  DEFAULT_PLAN,
} from "@/lib/plan-limits";

// -- Workspace plan lookup -------------------------------------
// The workspace plan is stored in workspace_subscriptions.
// If no record exists, the workspace is on FREE.
export async function getWorkspacePlan(workspaceId: string): Promise<PlanName> {
  const supabase = createClient();
  const { data } = await supabase
    .from("workspace_subscriptions")
    .select("plan")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .maybeSingle();
  return (data?.plan as PlanName) ?? DEFAULT_PLAN;
}

// -- Generic count helper --------------------------------------
async function countRows(
  table: string,
  workspaceId: string
): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  return count ?? 0;
}

// -- Individual limit checks -----------------------------------
export async function checkProjectLimit(
  workspaceId: string
): Promise<LimitCheckResult> {
  const plan = await getWorkspacePlan(workspaceId);
  const limit = PLAN_LIMITS[plan].projects;
  const current = await countRows("projects", workspaceId);
  return { allowed: current < limit, current, limit, plan, resource: "projects" };
}

export async function checkTaskLimit(
  workspaceId: string
): Promise<LimitCheckResult> {
  const supabase = createClient();
  const plan = await getWorkspacePlan(workspaceId);
  const limit = PLAN_LIMITS[plan].activeTasks;
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .not("status", "in", '("done","cancelled")');
  const current = count ?? 0;
  return { allowed: current < limit, current, limit, plan, resource: "activeTasks" };
}

export async function checkGoalLimit(
  workspaceId: string
): Promise<LimitCheckResult> {
  const plan = await getWorkspacePlan(workspaceId);
  const limit = PLAN_LIMITS[plan].goals;
  const current = await countRows("goals", workspaceId);
  return { allowed: current < limit, current, limit, plan, resource: "goals" };
}

export async function checkMemberLimit(
  workspaceId: string
): Promise<LimitCheckResult> {
  const plan = await getWorkspacePlan(workspaceId);
  const limit = PLAN_LIMITS[plan].members;
  const current = await countRows("workspace_members", workspaceId);
  return { allowed: current < limit, current, limit, plan, resource: "members" };
}


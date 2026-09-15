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
  highestPlan,
} from "@/lib/plan-limits";
import {
  effectivePlanOf,
  isSubscriptionCurrent,
} from "@/lib/billing/subscription-state";

// -- Workspace plan lookup -------------------------------------
// The workspace plan is stored in workspace_subscriptions. The
// resolution below mirrors public.get_workspace_plan() exactly: only
// an 'active' row whose billing period has not lapsed grants its
// plan; anything else (absent, cancelled, expired, past_due,
// trialing, lapsed period, unknown plan value) is FREE. The unique
// partial index guarantees at most one 'active' row per workspace,
// so maybeSingle() can never face an ambiguous choice.
export async function getWorkspacePlan(workspaceId: string): Promise<PlanName> {
  const supabase = createClient();
  const { data } = await supabase
    .from("workspace_subscriptions")
    .select("plan, status, current_period_end")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .maybeSingle();
  return effectivePlanOf(data);
}

/**
 * The workspace creation trigger uses the highest active plan owned by the
 * user. Resolve the same scope in the client before opening a create flow;
 * a missing subscription is deliberately FREE, just like PostgreSQL. Rows
 * whose billing period lapsed are filtered out before the highest-plan
 * reduction, mirroring public.get_owner_plan().
 */
export async function getOwnerPlan(ownerId: string): Promise<PlanName> {
  const supabase = createClient();
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", ownerId);

  const workspaceIds = (workspaces ?? [])
    .map((workspace) => workspace.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (workspaceIds.length === 0) return DEFAULT_PLAN;

  const { data: subscriptions } = await supabase
    .from("workspace_subscriptions")
    .select("plan, status, current_period_end")
    .in("workspace_id", workspaceIds)
    .eq("status", "active");

  return highestPlan(
    (subscriptions ?? [])
      .filter((subscription) => isSubscriptionCurrent(subscription))
      .map((subscription) => subscription.plan)
  );
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
export async function checkWorkspaceLimit(
  ownerId: string
): Promise<LimitCheckResult> {
  const supabase = createClient();
  const { count } = await supabase
    .from("workspaces")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  const current = count ?? 0;
  const plan = await getOwnerPlan(ownerId);
  const limit = PLAN_LIMITS[plan].workspaces;
  return { allowed: current < limit, current, limit, plan, resource: "workspaces" };
}

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


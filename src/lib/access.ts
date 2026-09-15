// ============================================================
// NEXUS — ACCESS CHECKS
// Plan → Entitlements → Limits → Access checks
// Server enforcement lives in Supabase triggers; these are the app layer.
// ============================================================

import {
  checkWorkspaceLimit,
  checkProjectLimit,
  checkTaskLimit,
  checkGoalLimit,
  checkMemberLimit,
  getWorkspacePlan,
} from "@/lib/entitlements";
import { getFeatures, type PlanName, type LimitCheckResult } from "@/lib/plan-limits";

/**
 * Workspace creation is owner-scoped, so this argument is the authenticated
 * owner's user id rather than an existing workspace id.
 */
export async function canCreateWorkspace(ownerId: string): Promise<LimitCheckResult> {
  return checkWorkspaceLimit(ownerId);
}

export async function canCreateProject(workspaceId: string): Promise<LimitCheckResult> {
  return checkProjectLimit(workspaceId);
}

export async function canCreateTask(workspaceId: string): Promise<LimitCheckResult> {
  return checkTaskLimit(workspaceId);
}

export async function canCreateGoal(workspaceId: string): Promise<LimitCheckResult> {
  return checkGoalLimit(workspaceId);
}

export async function canInviteMember(workspaceId: string): Promise<LimitCheckResult> {
  return checkMemberLimit(workspaceId);
}

export async function canUseAdvancedAnalytics(workspaceId: string): Promise<boolean> {
  const plan = await getWorkspacePlan(workspaceId);
  return getFeatures(plan).advancedAnalytics;
}

export async function canUseAdvancedCollaboration(workspaceId: string): Promise<boolean> {
  const plan = await getWorkspacePlan(workspaceId);
  return getFeatures(plan).advancedCollaboration;
}

export async function canUseAdvancedPermissions(workspaceId: string): Promise<boolean> {
  const plan = await getWorkspacePlan(workspaceId);
  return getFeatures(plan).advancedPermissions;
}

export function isAllowed(result: LimitCheckResult): boolean {
  return result.allowed;
}

export function nextPlanForUpgrade(currentPlan: PlanName): PlanName | null {
  if (currentPlan === "FREE") return "PRO";
  if (currentPlan === "PRO") return "TEAM";
  return null;
}

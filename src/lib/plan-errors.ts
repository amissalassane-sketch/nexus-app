// ============================================================
// NEXUS — PLAN LIMIT ERROR PARSING
// Normalizes Supabase trigger errors into structured results.
// ============================================================

import type { LimitCheckResult, PlanName } from "@/lib/plan-limits";

const PLAN_LIMIT_PATTERN =
  /PLAN_LIMIT_EXCEEDED:\s*(\w+)\s*\((\d+)\s*\/\s*(\d+)\)/;

export function isPlanLimitError(message: string | undefined | null): boolean {
  return Boolean(message?.includes("PLAN_LIMIT_EXCEEDED"));
}

/** Map DB resource names to app LimitCheckResult resource keys */
const DB_RESOURCE_MAP: Record<string, LimitCheckResult["resource"]> = {
  projects: "projects",
  active_tasks: "activeTasks",
  goals: "goals",
  members: "members",
  workspaces: "workspaces",
};

export function parsePlanLimitError(
  message: string,
  plan: PlanName = "FREE"
): LimitCheckResult | null {
  const match = message.match(PLAN_LIMIT_PATTERN);
  if (!match) return null;

  const [, dbResource, currentStr, limitStr] = match;
  const resource = DB_RESOURCE_MAP[dbResource] ?? "projects";

  return {
    allowed: false,
    current: Number(currentStr),
    limit: Number(limitStr),
    plan,
    resource,
  };
}

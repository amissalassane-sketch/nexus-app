// ============================================================
// NEXUS — PLAN LIMITS
// Single source of truth for all workspace-scoped entitlements.
// Change only here to propagate everywhere (app + SQL migration).
// ============================================================

export const PLAN_NAMES = ["FREE", "PRO", "TEAM"] as const;
export type PlanName = (typeof PLAN_NAMES)[number];

export interface PlanLimits {
  workspaces: number;
  projects: number;
  /** active tasks (status != 'done' and != 'cancelled') */
  activeTasks: number;
  goals: number;
  members: number;
  /** file metadata rows per workspace (enforced by trigger, migration 20260922130000) */
  files: number;
}

export interface PlanFeatures {
  advancedAnalytics: boolean;
  advancedCollaboration: boolean;
  advancedPermissions: boolean;
}

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  FREE: {
    workspaces: 1,
    projects: 2,
    activeTasks: 100,
    goals: 3,
    members: 1,
    files: 20,
  },
  PRO: {
    workspaces: 5,
    projects: 10,
    activeTasks: 1000,
    goals: 20,
    members: 5,
    files: 200,
  },
  TEAM: {
    workspaces: 20,
    projects: 50,
    activeTasks: 5000,
    goals: 100,
    members: 20,
    files: 1000,
  },
};

export const PLAN_FEATURES: Record<PlanName, PlanFeatures> = {
  FREE: {
    advancedAnalytics: false,
    advancedCollaboration: false,
    advancedPermissions: false,
  },
  PRO: {
    advancedAnalytics: true,
    advancedCollaboration: false,
    advancedPermissions: false,
  },
  TEAM: {
    advancedAnalytics: true,
    advancedCollaboration: true,
    advancedPermissions: true,
  },
};

export const DEFAULT_PLAN: PlanName = "FREE";

export function isPlanName(value: unknown): value is PlanName {
  return typeof value === "string" && PLAN_NAMES.includes(value as PlanName);
}

/** Resolve the highest valid plan without ever trusting an unknown DB value. */
export function highestPlan(values: readonly unknown[]): PlanName {
  let result = DEFAULT_PLAN;
  for (const value of values) {
    if (!isPlanName(value)) continue;
    if (PLAN_NAMES.indexOf(value) > PLAN_NAMES.indexOf(result)) {
      result = value;
    }
  }
  return result;
}

export function getLimits(plan: PlanName): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function getFeatures(plan: PlanName): PlanFeatures {
  return PLAN_FEATURES[plan];
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  plan: PlanName;
  resource: keyof PlanLimits;
}

/** Maps app resource keys to DB RPC usage keys */
export const RESOURCE_DB_KEYS: Record<keyof PlanLimits, string> = {
  workspaces: "workspaces",
  projects: "projects",
  activeTasks: "active_tasks",
  goals: "goals",
  members: "members",
  files: "files",
};


import { DEFAULT_PLAN, type PlanName } from "@/lib/plan-limits";

export type WorkspaceUsage = {
  plan: PlanName | string;
  usage: {
    projects: number;
    active_tasks: number;
    goals: number;
    members: number;
  };
  limits: {
    projects: number;
    active_tasks: number;
    goals: number;
    members: number;
  };
};

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/**
 * Supabase may return a `json` RPC as an object or as a JSON string.
 * A malformed payload used to crash /settings/billing when the page
 * read `usage.usage[key]` on a truthy but incomplete value.
 */
export function parseWorkspaceUsage(raw: unknown): WorkspaceUsage | null {
  const root = asRecord(raw);
  if (!root) return null;

  const usage = asRecord(root.usage);
  const limits = asRecord(root.limits);
  if (!usage || !limits) return null;

  return {
    plan: typeof root.plan === "string" && root.plan ? root.plan : DEFAULT_PLAN,
    usage: {
      projects: asNumber(usage.projects),
      active_tasks: asNumber(usage.active_tasks),
      goals: asNumber(usage.goals),
      members: asNumber(usage.members),
    },
    limits: {
      projects: asNumber(limits.projects),
      active_tasks: asNumber(limits.active_tasks),
      goals: asNumber(limits.goals),
      members: asNumber(limits.members),
    },
  };
}

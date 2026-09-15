// ============================================================
// NEXUS — SUBSCRIPTION STATE RESOLUTION
// Client-side mirror of the PostgreSQL contract established by
// supabase/migrations/20260915220000_nexus_subscription_contract.sql.
//
// UX convenience layer ONLY — the database (get_workspace_plan /
// get_owner_plan + the write-guard triggers) remains the security
// boundary and the authority for every mutation. These pure helpers
// exist so the interface never displays a plan the database would
// not grant, using the exact same resolution rules:
//
//   current subscription = status 'active'
//                          AND plan in FREE|PRO|TEAM
//                          AND (current_period_end IS NULL
//                               OR current_period_end >= now)
//   anything else fails closed to FREE.
// ============================================================

import { DEFAULT_PLAN, isPlanName, type PlanName } from "@/lib/plan-limits";

/**
 * The exact status vocabulary allowed by the workspace_subscriptions
 * check constraint (007 + the subscription contract migration).
 * 'expired' is materialized by expire_workspace_subscription() /
 * expire_lapsed_subscriptions(); 'past_due' and 'trialing' are
 * provider dunning states kept from 007.
 */
export const SUBSCRIPTION_STATUSES = [
  "active",
  "cancelled",
  "expired",
  "past_due",
  "trialing",
] as const;

export type SubscriptionStatusName = (typeof SUBSCRIPTION_STATUSES)[number];

/** The columns this resolver needs; any superset (full row) works. */
export interface SubscriptionStateRow {
  plan?: unknown;
  status?: unknown;
  current_period_end?: string | null;
}

/**
 * Mirrors the SQL predicate
 *   (current_period_end IS NULL OR current_period_end >= now()).
 * A missing period end is indefinite — every legacy row and every
 * FREE subscription carries NULL and never lapses. An unparseable
 * value fails closed (treated as not current), never open.
 */
export function isPeriodCurrent(
  currentPeriodEnd: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (currentPeriodEnd == null || currentPeriodEnd === "") return true;
  const end = new Date(currentPeriodEnd);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() >= now.getTime();
}

/**
 * True when the database would treat this row as THE current
 * subscription of its workspace. cancelled, expired, past_due and
 * trialing are never current, and an 'active' row whose billing
 * period lapsed is not current either — it resolves to FREE until a
 * new record (or the expiry sweep) states otherwise. The unique
 * partial index on (workspace_id) WHERE status = 'active' guarantees
 * at most one row can satisfy this per workspace, so no "latest row"
 * heuristic is ever needed.
 */
export function isSubscriptionCurrent(
  row: SubscriptionStateRow | null | undefined,
  now: Date = new Date()
): boolean {
  if (!row || row.status !== "active") return false;
  return isPeriodCurrent(row.current_period_end ?? null, now);
}

/**
 * The plan a subscription row grants, fail-closed exactly like
 * public.get_workspace_plan(): absent row, non-active status, lapsed
 * period or unknown plan value all resolve to FREE.
 */
export function effectivePlanOf(
  row: SubscriptionStateRow | null | undefined,
  now: Date = new Date()
): PlanName {
  if (!isSubscriptionCurrent(row, now)) return DEFAULT_PLAN;
  return isPlanName(row?.plan) ? row!.plan : DEFAULT_PLAN;
}

/**
 * Status to display on billing screens. An 'active' row whose period
 * lapsed is shown as 'expired' so the UI never claims a plan the
 * database no longer grants. Unknown values map to null (the pages
 * then render their "no subscription record" state).
 */
export function displayStatusOf(
  row: SubscriptionStateRow | null | undefined,
  now: Date = new Date()
): SubscriptionStatusName | null {
  if (!row || typeof row.status !== "string") return null;
  if (
    row.status === "active" &&
    !isPeriodCurrent(row.current_period_end ?? null, now)
  ) {
    return "expired";
  }
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(row.status)
    ? (row.status as SubscriptionStatusName)
    : null;
}

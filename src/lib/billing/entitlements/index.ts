import { PLAN_LIMITS } from "../../plan-limits";
import { effectivePlanOf, type SubscriptionStateRow } from "../subscription-state";
export type Entitlement = "advanced_ai" | "document_analysis" | "gmail_integration" | "calendar_integration" | "advanced_memory" | "automations";
/** Existing products are not arbitrarily re-gated by this addition. Future gates fail closed until approved. */
export function entitlementSnapshot(subscription: SubscriptionStateRow | null) {
  const plan = effectivePlanOf(subscription);
  return { plan, limits: { storage_limit: PLAN_LIMITS[plan].files, workspace_limit: PLAN_LIMITS[plan].workspaces },
    limitsUnit: { storage_limit: "file_count", workspace_limit: "workspace_count" },
    features: { advanced_ai: false, document_analysis: false, gmail_integration: false, calendar_integration: false, advanced_memory: false, automations: false } satisfies Record<Entitlement, boolean>,
    featurePolicyStatus: "COMMERCIAL_POLICY_NOT_APPROVED" as const };
}

// ============================================================
// NEXUS — BILLING TYPES
// Subscription model stubs — FedaPay integration will plug in here.
// Never expose API secrets in the frontend.
// ============================================================

import type { PlanName } from "@/lib/plan-limits";

/**
 * Mirrors the workspace_subscriptions status check constraint
 * (007 + 20260915220000). 'expired' is materialized by the backend
 * expiry helpers; only 'active' rows with a current period ever grant
 * a plan — see src/lib/billing/subscription-state.ts.
 */
export type SubscriptionStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "past_due"
  | "trialing";

export interface WorkspaceSubscription {
  id: string;
  workspace_id: string;
  plan: PlanName;
  status: SubscriptionStatus;
  billing_customer_id: string | null;
  billing_subscription_id: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

/** Payload shape for a future FedaPay checkout session (server-side only) */
export interface UpgradeCheckoutRequest {
  workspaceId: string;
  targetPlan: PlanName;
  successUrl: string;
  cancelUrl: string;
}

export interface UpgradeCheckoutResult {
  checkoutUrl: string;
  sessionId: string;
}

/** Describes a pending plan change before payment confirms */
export type PlanChangeState = "none" | "upgrade_pending" | "downgrade_pending";

export interface BillingState {
  subscription: WorkspaceSubscription | null;
  planChangeState: PlanChangeState;
  isTrialing: boolean;
}

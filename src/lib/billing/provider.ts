import type { PlanName } from "@/lib/plan-limits";

/** Payment transport only. This interface never grants entitlements.
 * Adapters belong on the server; secrets must never enter these DTOs. */
export interface BillingProvider {
  readonly id: string;
  createCheckout(input: {
    workspaceId: string;
    actorId: string;
    targetPlan: Exclude<PlanName, "FREE">;
    priceId: string;
    idempotencyKey: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ checkoutUrl: string; transactionId: string }>;
  /** Verify the signature over raw bytes BEFORE parsing or returning an event. */
  verifyWebhook(rawBody: Uint8Array, headers: Headers): Promise<VerifiedBillingEvent>;
  cancelRenewal(subscriptionId: string, idempotencyKey: string): Promise<void>;
  getInvoice(invoiceId: string): Promise<BillingInvoice>;
}

export interface BillingInvoice {
  id: string;
  transactionId: string;
  currency: string;
  amountMinor: number;
  status: "open" | "paid" | "void";
}

export interface VerifiedBillingEvent {
  provider: string;
  eventId: string;
  transactionId: string;
  subscriptionId: string | null;
  kind: "payment_succeeded" | "payment_failed" | "renewed" | "cancelled" | "refunded";
  occurredAt: string;
  /** Correlate against a server-created transaction, never trust a client workspace. */
  periodEnd: string | null;
}

/** No adapter, price catalog or webhook ledger is installed yet.
 * Deliberately does not select a provider merely because an env var is set. */
export function getBillingProviderStatus() {
  return {
    available: false as const,
    provider: null,
    code: "PAYMENT_PROVIDER_NOT_CONFIGURED" as const,
    message: "Payment checkout is not available. No payment has been initiated.",
  };
}

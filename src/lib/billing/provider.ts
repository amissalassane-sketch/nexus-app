/** Server-only provider-neutral payment contract. Never grants entitlements. */
export type { InternationalPaymentProvider as BillingProvider } from "./payment-contract";

/** Stripe transport exists, but checkout remains off without approved prices,
 * merchant eligibility and a durable verified-event processor. */
export function getBillingProviderStatus() {
  return {
    available: false as const,
    provider: null,
    code: "PAYMENT_PROVIDER_NOT_CONFIGURED" as const,
    message: "Payment checkout is not available. No payment has been initiated.",
  };
}

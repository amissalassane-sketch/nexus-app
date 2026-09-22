/** Honest placeholders, NOT mock payment adapters. No methods fabricate a charge or event. */
export const PAYMENT_ADAPTERS = {
  stripe: { implementation: "IMPLEMENTED", checkoutEnabled: false, blocker: "MERCHANT_REVIEW_AND_DURABLE_WEBHOOK_PROCESSOR_REQUIRED" },
  kkiapay: { implementation: "NOT_IMPLEMENTED", checkoutEnabled: false, blocker: "PROVIDER_CONTRACT_AND_ADAPTER_REQUIRED" },
  fedapay: { implementation: "NOT_IMPLEMENTED", checkoutEnabled: false, blocker: "PROVIDER_CONTRACT_AND_ADAPTER_REQUIRED" },
} as const;

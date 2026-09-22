/** Transaction lifecycle; does not replace authoritative SQL subscription/entitlement rules. */
export type BillingState = "FREE" | "TRIALING" | "CHECKOUT" | "PAYMENT_PENDING" | "ACTIVE" | "PAST_DUE" | "PAYMENT_FAILED" | "CANCELLED" | "EXPIRED";
export type BillingTransition = "start_checkout" | "checkout_created" | "payment_confirmed" | "payment_failed" | "renewal_failed" | "cancel_confirmed" | "period_expired" | "trial_confirmed";
const transitions: Record<BillingTransition, { from: BillingState[]; to: BillingState; providerProof: boolean }> = {
  start_checkout: { from: ["FREE", "EXPIRED", "PAYMENT_FAILED", "CANCELLED"], to: "CHECKOUT", providerProof: false },
  checkout_created: { from: ["CHECKOUT"], to: "PAYMENT_PENDING", providerProof: true },
  payment_confirmed: { from: ["PAYMENT_PENDING", "TRIALING", "PAYMENT_FAILED", "PAST_DUE", "ACTIVE"], to: "ACTIVE", providerProof: true },
  payment_failed: { from: ["PAYMENT_PENDING", "CHECKOUT"], to: "PAYMENT_FAILED", providerProof: true },
  renewal_failed: { from: ["ACTIVE", "TRIALING"], to: "PAST_DUE", providerProof: true },
  cancel_confirmed: { from: ["ACTIVE", "TRIALING", "PAST_DUE", "PAYMENT_PENDING"], to: "CANCELLED", providerProof: true },
  period_expired: { from: ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELLED"], to: "EXPIRED", providerProof: false },
  trial_confirmed: { from: ["FREE", "CHECKOUT"], to: "TRIALING", providerProof: true },
};
/** Call only inside a trusted service after signature + ledger correlation. A boolean from HTTP is never proof. */
export function transitionBilling(current: BillingState, event: BillingTransition, proof: "server_verified_provider" | "internal" | "browser") {
  const rule = transitions[event];
  if (!rule || !rule.from.includes(current) || proof === "browser" || (rule.providerProof && proof !== "server_verified_provider")) throw new Error("BILLING_TRANSITION_REFUSED");
  return rule.to;
}

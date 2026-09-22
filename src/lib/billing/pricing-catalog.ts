import type { Currency } from "../global/currency";
import type { PlanName } from "../plan-limits";
import type { PaymentProviderId } from "../global/payment-availability";
export type CatalogPrice = {
  id: string; plan: PlanName; amountMinor: number; currency: Currency;
  kind: "base" | "regional"; country: string | null;
  tax: "inclusive" | "exclusive" | "not_reviewed";
  interval: "month" | "year"; provider: PaymentProviderId | null; providerPriceId: string | null;
  effectiveFrom: string; effectiveUntil: string | null; approved: boolean;
};
/** Existing advertised USD prices, explicitly NOT approved checkout offers. No FX conversion. */
export const PRICING_CATALOG: readonly CatalogPrice[] = [
  { id: "pro-usd-draft", plan: "PRO", amountMinor: 1900, currency: "USD", kind: "base", country: null, tax: "not_reviewed", interval: "month", provider: null, providerPriceId: null, effectiveFrom: "2026-09-22T00:00:00Z", effectiveUntil: null, approved: false },
  { id: "team-usd-draft", plan: "TEAM", amountMinor: 4900, currency: "USD", kind: "base", country: null, tax: "not_reviewed", interval: "month", provider: null, providerPriceId: null, effectiveFrom: "2026-09-22T00:00:00Z", effectiveUntil: null, approved: false },
];
export function commercialPrice(plan: PlanName, currency: Currency, provider: PaymentProviderId, now = new Date(), country: string | null = null, catalog = PRICING_CATALOG, interval: "month" | "year" = "month"): CatalogPrice | null {
  const eligible = catalog.filter(p => p.interval === interval && p.plan === plan && p.currency === currency && p.provider === provider && p.approved && p.tax !== "not_reviewed" && p.providerPriceId && Date.parse(p.effectiveFrom) <= now.getTime() && (!p.effectiveUntil || Date.parse(p.effectiveUntil) > now.getTime()) && (p.country === null || p.country === country));
  const regional = eligible.filter(p => p.country !== null && p.country === country);
  const candidates = regional.length ? regional : eligible.filter(p => p.country === null);
  // Ambiguous prices fail closed instead of selecting a random commercial offer.
  return candidates.length === 1 ? candidates[0] : null;
}
export function draftMonthlyMajor(plan: PlanName): number {
  if (plan === "FREE") return 0;
  const p = PRICING_CATALOG.find(p => p.plan === plan && p.currency === "USD" && p.interval === "month");
  if (!p) throw new Error("PRICE_NOT_DEFINED");
  return p.amountMinor / 100;
}

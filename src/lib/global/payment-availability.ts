export type PaymentProviderId = "stripe" | "kkiapay" | "fedapay";
export type MerchantContext = { merchantCountry: string | null; merchantEntity: string | null; customerCountry: string | null; currency: string; taxReview: boolean; paymentMethod: string; eligibilityReviewedAt: string | null };
/** Country/locale is never used to manufacture a merchant authorization. */
export function paymentAvailability(provider: PaymentProviderId, context: MerchantContext) {
  return { provider, enabled: false, status: "HUMAN_ACTION_REQUIRED" as const,
    reason: !context.merchantCountry || !context.merchantEntity ? "MERCHANT_ENTITY_REQUIRED" : "PROVIDER_ACCOUNT_AND_COUNTRY_ELIGIBILITY_MUST_BE_VERIFIED",
    customerCountryIsNotMerchantCountry: true };
}

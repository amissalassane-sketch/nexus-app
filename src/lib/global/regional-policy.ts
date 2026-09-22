import type { Country } from "./country";
export function regionalReview(country: Country | null) {
  return { status: "LEGAL_REVIEW_REQUIRED" as const, country,
    topics: country === "BJ" ? ["Code du numérique", "APDP formalities", "international transfers", "retention", "consumer and payment rules"] : ["privacy territorial scope", "consumer rights", "tax", "AI territorial scope"],
    automaticLegalConclusion: false };
}

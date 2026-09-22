/** Supported preference inputs, not merchant eligibility or a list of permitted markets. */
export const COUNTRIES = ["BJ", "FR", "US", "GB", "NG", "GH", "JP", "DE", "CA", "CI", "TG", "SN"] as const;
export type Country = typeof COUNTRIES[number];
export function isCountry(value: unknown): value is Country {
  return typeof value === "string" && (COUNTRIES as readonly string[]).includes(value);
}

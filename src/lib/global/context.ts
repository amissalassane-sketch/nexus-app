import { isCountry, type Country } from "./country";
import { isLocale, type Locale } from "./locale";
import { isCurrency, type Currency } from "./currency";
import { isTimezone } from "./timezone";
export type UserRegionalContext = {
  country: Country | null; locale: Locale; timezone: string; currency: Currency;
  dateFormat: "locale" | "iso"; numberFormat: "locale" | "latin";
  weekStart: 0 | 1; measurementSystem: "metric" | "us";
};
export type WorkspaceRegionalContext = {
  workspaceCountry: Country | null; workspaceLocale: Locale;
  workspaceTimezone: string; workspaceCurrency: Currency;
};
export const DEFAULT_USER_CONTEXT: UserRegionalContext = { country: null, locale: "en-US", timezone: "UTC", currency: "USD", dateFormat: "locale", numberFormat: "locale", weekStart: 1, measurementSystem: "metric" };
export function parseUserContext(input: unknown): UserRegionalContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_REGIONAL_CONTEXT");
  const v = input as Record<string, unknown>;
  if (!(v.country === null || isCountry(v.country)) || !isLocale(v.locale) || !isTimezone(v.timezone) || !isCurrency(v.currency) || !["locale", "iso"].includes(String(v.dateFormat)) || !["locale", "latin"].includes(String(v.numberFormat)) || ![0, 1].includes(v.weekStart as number) || !["metric", "us"].includes(String(v.measurementSystem))) throw new Error("INVALID_REGIONAL_CONTEXT");
  return { country: v.country, locale: v.locale, timezone: v.timezone, currency: v.currency, dateFormat: v.dateFormat, numberFormat: v.numberFormat, weekStart: v.weekStart, measurementSystem: v.measurementSystem } as UserRegionalContext;
}
/** Travel affects the display context ONLY. This function cannot rewrite legal workspace fields. */
export function displayContext(user: UserRegionalContext, workspace: WorkspaceRegionalContext, travelTimezone?: string) {
  if (travelTimezone && !isTimezone(travelTimezone)) throw new Error("INVALID_TIMEZONE");
  return { user: { ...user, timezone: travelTimezone ?? user.timezone }, workspace: { ...workspace } };
}

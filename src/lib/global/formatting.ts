import type { UserRegionalContext } from "./context";
import { dateOnly, utcInstant } from "./timezone";
export function formatInstant(value: string, context: Pick<UserRegionalContext, "locale" | "timezone">) {
  return new Intl.DateTimeFormat(context.locale, { dateStyle: "medium", timeStyle: "short", timeZone: context.timezone }).format(new Date(utcInstant(value)));
}
export function formatDateOnly(value: string, context: Pick<UserRegionalContext, "locale" | "dateFormat">) {
  const date = dateOnly(value);
  if (context.dateFormat === "iso") return date;
  // Never shift a civil date because the viewer travelled across midnight.
  return new Intl.DateTimeFormat(context.locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
export function formatNumber(value: number, context: Pick<UserRegionalContext, "locale" | "numberFormat">) {
  if (!Number.isFinite(value)) throw new Error("INVALID_NUMBER");
  return new Intl.NumberFormat(context.locale, { ...(context.numberFormat === "latin" ? { numberingSystem: "latn" } : {}) }).format(value);
}

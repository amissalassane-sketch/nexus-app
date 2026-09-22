import { Temporal } from "@js-temporal/polyfill";
export function isTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 100 || /^[+-]/.test(value)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(0); return true; } catch { return false; }
}
/** Offset/Z mandatory. A date-only value is not an instant. */
export function utcInstant(value: string): string {
  return Temporal.Instant.from(value).toString();
}
/** Reject DST gaps AND overlaps unless the caller explicitly disambiguates. */
export function localDateTimeToUtc(value: string, timezone: string, disambiguation: "reject" | "earlier" | "later" = "reject"): string {
  if (!isTimezone(timezone) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) throw new Error("INVALID_LOCAL_DATETIME");
  return Temporal.PlainDateTime.from(value).toZonedDateTime(timezone, { disambiguation }).toInstant().toString();
}
export function dateOnly(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_DATE_ONLY");
  return Temporal.PlainDate.from(value).toString();
}
export function dayBoundsUtc(date: string, timezone: string) {
  if (!isTimezone(timezone)) throw new Error("INVALID_TIMEZONE");
  const day = Temporal.PlainDate.from(dateOnly(date));
  return { start: day.toZonedDateTime(timezone).toInstant().toString(), end: day.add({ days: 1 }).toZonedDateTime(timezone).toInstant().toString() };
}

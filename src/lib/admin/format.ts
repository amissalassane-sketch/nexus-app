// ============================================================
// NEXUS ADMIN — FORMATTING
// ============================================================
// The rule this module exists to enforce: a null is never rendered as a
// number. `formatCount(null)` returns the "not available" marker, so a
// missing measurement cannot be mistaken for a measurement of zero.
// ============================================================

/** Shown wherever a real value is missing. Deliberately not "0". */
export const NOT_AVAILABLE = "Not available";

export function hasValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 1234 → "1,234". null/undefined/NaN → "Not available". */
export function formatCount(value: number | null | undefined): string {
  if (!hasValue(value)) return NOT_AVAILABLE;
  return new Intl.NumberFormat("en-US").format(value);
}

/** Compact form for dense KPI tiles: 12345 → "12.3k". */
export function formatCompact(value: number | null | undefined): string {
  if (!hasValue(value)) return NOT_AVAILABLE;
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatLatency(ms: number | null | undefined): string {
  if (!hasValue(ms)) return NOT_AVAILABLE;
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

/** "3h ago" / "12m ago" / "just now". Returns the marker for a null or an
 *  unparseable date rather than "Invalid Date" on screen. */
export function formatRelativeTime(
  iso: string | null | undefined,
  now: number = Date.now()
): string {
  if (!iso) return NOT_AVAILABLE;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return NOT_AVAILABLE;

  const seconds = Math.round((now - time) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 90) return "1m ago";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.round(months / 12)}y ago`;
}

/** Absolute timestamp for tables and inspectors, where relative wording
 *  would hide the actual moment. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return NOT_AVAILABLE;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return NOT_AVAILABLE;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(time));
}

/** Percentage of a total, or null when the total is unknown — again, an
 *  unknown denominator must not become 0%. */
export function formatShare(
  part: number | null | undefined,
  total: number | null | undefined
): string | null {
  if (!hasValue(part) || !hasValue(total) || total === 0) return null;
  return `${Math.round((part / total) * 100)}%`;
}

/** Milliseconds with unit, or the explicit not-available marker. */
export function formatMs(value: number | null | undefined): string {
  return typeof value === "number" ? `${formatCount(value)} ms` : NOT_AVAILABLE;
}

/** "N succeeded · N failed" — NOT_AVAILABLE only when neither side was
 *  measured. Zero is a real value and must never become "not available". */
export function formatSucceededFailed(
  succeeded: number | null | undefined,
  failed: number | null | undefined
): string {
  if (
    (succeeded === null || succeeded === undefined) &&
    (failed === null || failed === undefined)
  ) {
    return NOT_AVAILABLE;
  }
  return `${formatCount(succeeded ?? 0)} succeeded · ${formatCount(failed ?? 0)} failed`;
}

/** Relative time with an explicit "nothing yet" label — an absence of
 *  events reads differently from an absence of measurement. */
export function formatRelativeOr(
  value: string | null | undefined,
  nothingYet: string
): string {
  return value ? formatRelativeTime(value) : nothingYet;
}

/** Boolean with named labels, or not-available when unmeasured. */
export function formatBoolean(
  value: boolean | null | undefined,
  labels: { yes: string; no: string }
): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  return value ? labels.yes : labels.no;
}

/** "N in · N out" token pair, or not-available when unmeasured. */
export function formatTokens(
  input: number | null | undefined,
  output: number | null | undefined
): string {
  if (
    (input === null || input === undefined) &&
    (output === null || output === undefined)
  ) {
    return NOT_AVAILABLE;
  }
  return `${formatCompact(input ?? 0)} in · ${formatCompact(output ?? 0)} out`;
}

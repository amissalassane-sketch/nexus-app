// ============================================================
// NEXUS — PREFERENCES (P5)
// profiles.preferences jsonb — with graceful degradation when
// the column is absent (FUTURE DATABASE CHANGE tolerated).
// ============================================================

export type Density = "comfortable" | "compact";
export type DateFormat = "dmy" | "mdy" | "iso";

export type Preferences = {
  density: Density;
  weekStartsMonday: boolean;
  dateFormat: DateFormat;
};

export const DEFAULT_PREFERENCES: Preferences = {
  density: "comfortable",
  weekStartsMonday: true,
  dateFormat: "dmy",
};

export function parsePreferences(raw: unknown): Preferences {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFERENCES;
  const value = raw as Record<string, unknown>;
  return {
    density: value.density === "compact" ? "compact" : "comfortable",
    weekStartsMonday: typeof value.weekStartsMonday === "boolean" ? value.weekStartsMonday : true,
    dateFormat:
      value.dateFormat === "mdy" || value.dateFormat === "iso" ? value.dateFormat : "dmy",
  };
}

/** Date formatting that honors the user's preference. */
export function formatDateWithPrefs(
  value: string | Date,
  prefs: Preferences,
  opts: { withYear?: boolean } = {}
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  const withYear = opts.withYear ?? true;

  switch (prefs.dateFormat) {
    case "iso": {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    case "mdy":
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        ...(withYear ? { year: "numeric" as const } : {}),
      }).format(date);
    case "dmy":
    default:
      return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        ...(withYear ? { year: "numeric" as const } : {}),
      }).format(date);
  }
}

// ============================================================
// NEXUS — UNIVERSAL CAPTURE
// ============================================================
// Capture turns one sentence ("il faut que je fasse ça demain",
// "call the bank friday 3pm") into a structured intention:
// what to do, when it is due, how urgent it reads.
//
// Rules:
//   * Deterministic parsing — no model required, no network call.
//   * Dates resolve to real ISO timestamps in the user's day.
//   * Anything unparsed stays in the title; capture never invents
//     content the user did not type.
//   * Both French and English expressions are understood, because
//     the product is used in both.
// ============================================================

export type CaptureIntent = {
  /** Cleaned action title, date expression removed. */
  title: string;
  /** Resolved due date (start of day, local) or null. */
  dueAt: string | null;
  /** Raw text that produced the due date, for user confirmation. */
  dueExpression: string | null;
  /** Best-effort priority read from urgency words. */
  priority: "low" | "medium" | "high" | "urgent";
  /** True when the input looked like a note rather than an action. */
  looksLikeNote: boolean;
};

const DAY_MS = 86_400_000;

// ------------------------------------------------------------------
// Vocabulary — French + English
// ------------------------------------------------------------------

const URGENT_WORDS = ["urgent", "asap", "immédiatement", "aujourd'hui", "today", "maintenant", "now", "tout de suite"];
const HIGH_WORDS = ["important", "prioritaire", "critical", "critique", "must", "il faut", "ne pas oublier", "don't forget"];
const LOW_WORDS = ["peut-être", "eventually", "un jour", "someday", "si possible", "when possible", "plus tard", "later"];

const WEEKDAYS: Record<string, number> = {
  // English
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
  // French
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6,
};

const NOTE_MARKERS = [
  "note that",
  "remember that",
  "souviens-toi que",
  "à propos",
  "idée",
  "idea:",
  "référence",
  "reference:",
  "info:",
];

/** Month names and abbreviations (FR + EN) → month index 0–11. */
const MONTH_NAMES: Record<string, number> = {
  // French
  janvier: 0, janv: 0, "février": 1, "févr": 1, mars: 2, avril: 3, avr: 3,
  mai: 4, juin: 5, juillet: 6, juil: 6, "août": 7, septembre: 8, sept: 8,
  octobre: 9, oct: 9, novembre: 10, nov: 10, "décembre": 11, "déc": 11,
  // English (sept/oct/nov already declared above — same months)
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, sep: 8, october: 9, november: 10,
  december: 11,
};

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(9, 0, 0, 0); // default capture time: 09:00 local
  return copy;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type DateMatch = { date: Date; expression: string; pattern: RegExp };

/** Build the ordered list of date patterns (most specific first). */
function buildPatterns(now: Date): DateMatch[] {
  const patterns: DateMatch[] = [];
  const today = startOfDay(now);
  const add = (date: Date, expression: string, source: string) =>
    patterns.push({ date, expression, pattern: new RegExp(source, "iu") });

  // Explicit relative days
  add(today, "today", "\\b(today|aujourd'hui)\\b");
  add(new Date(today.getTime() + DAY_MS), "tomorrow", "\\b(tomorrow|demain)\\b");
  add(new Date(today.getTime() + 2 * DAY_MS), "in 2 days", "\\b(apr[èe]s[- ]demain|day after tomorrow)\\b");
  add(new Date(today.getTime() - DAY_MS), "yesterday", "\\b(yesterday|hier)\\b");

  // "in N days / dans N jours / N days from now"
  patterns.push({
    date: today, // resolved in resolveInDays
    expression: "in N days",
    pattern: /\b(?:in|dans)\s+(\d{1,3})\s+(?:days?|jours?|semaines?|weeks?)\b/iu,
  });

  // "next week / la semaine prochaine" (same weekday next week)
  const nextWeek = new Date(today.getTime() + 7 * DAY_MS);
  add(nextWeek, "next week", "\\b(next week|semaine prochaine|la semaine prochaine)\\b");

  // Weekdays — "friday", "vendredi", "next monday", "lundi prochain"
  for (const [name, target] of Object.entries(WEEKDAYS)) {
    const date = nextWeekday(today, target, now);
    add(date, name, `\\b(next\\s+)?${escapeRegExp(name)}(\\s+prochain)?\\b`);
  }

  // "end of week / fin de semaine" → Friday
  const friday = nextWeekday(today, 5, now);
  add(friday, "end of week", "\\b(end of (the )?week|fin de (la )?semaine)\\b");

  // "end of month / fin du mois"
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  endOfMonth.setHours(9, 0, 0, 0);
  add(endOfMonth, "end of month", "\\b(end of (the )?month|fin du mois)\\b");

  // "next month / le mois prochain"
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(today.getDate(), 28));
  nextMonth.setHours(9, 0, 0, 0);
  add(nextMonth, "next month", "\\b(next month|mois prochain|le mois prochain)\\b");

  // Explicit dates: "12/05", "2026-09-24", "24 sept", "sept 24"
  patterns.push({
    date: today,
    expression: "date",
    pattern: /\b(\d{4})-(\d{2})-(\d{2})\b/iu,
  });
  patterns.push({
    date: today,
    expression: "date",
    pattern: /\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/u,
  });

  return patterns;
}

function nextWeekday(today: Date, target: number, now: Date): Date {
  const base = new Date(today);
  base.setHours(9, 0, 0, 0);
  const currentDay = now.getDay();
  let delta = (target - currentDay + 7) % 7;
  if (delta === 0) delta = 7; // "monday" on a monday means next monday
  return new Date(base.getTime() + delta * DAY_MS);
}

/** Parse the full capture intent from one sentence. */
export function parseCapture(input: string, now: Date = new Date()): CaptureIntent {
  const raw = input.trim();
  let text = raw;

  // ---- date resolution (first match wins, patterns are ordered) ----
  let dueAt: string | null = null;
  let dueExpression: string | null = null;

  // "in N days" / "dans N jours" (also weeks)
  const inDays = text.match(/\b(?:in|dans)\s+(\d{1,3})\s+(days?|jours?|semaines?|weeks?)\b/iu);
  if (inDays) {
    const count = Number.parseInt(inDays[1], 10);
    const isWeek = /semaines?|weeks?/iu.test(inDays[2]);
    const days = isWeek ? count * 7 : count;
    const date = startOfDay(now);
    dueAt = new Date(date.getTime() + days * DAY_MS).toISOString();
    dueExpression = inDays[0];
    text = text.replace(inDays[0], " ");
  }

  if (!dueAt) {
    for (const { date, pattern } of buildPatterns(now)) {
      const match = text.match(pattern);
      if (!match) continue;

      if (pattern.source.startsWith("\\b(\\d{4})-")) {
        const explicit = new Date(`${match[1]}-${match[2]}-${match[3]}T09:00:00`);
        if (!Number.isNaN(explicit.getTime())) {
          dueAt = explicit.toISOString();
          dueExpression = match[0];
          text = text.replace(match[0], " ");
          break;
        }
        continue;
      }
      if (pattern.source.startsWith("\\b(\\d{1,2})[/.]")) {
        const day = Number.parseInt(match[1], 10);
        const month = Number.parseInt(match[2], 10) - 1;
        const yearRaw = match[3] ? Number.parseInt(match[3], 10) : now.getFullYear();
        const year = match[3] && yearRaw < 100 ? 2000 + yearRaw : yearRaw;
        if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          const explicit = new Date(year, month, day, 9, 0, 0);
          if (!Number.isNaN(explicit.getTime())) {
            dueAt = explicit.toISOString();
            dueExpression = match[0];
            text = text.replace(match[0], " ");
            break;
          }
        }
        continue;
      }

      dueAt = date.toISOString();
      dueExpression = match[0];
      text = text.replace(match[0], " ");
      break;
    }
  }

  // ---- month-name dates: "24 sept", "sept 24", "24 septembre" -------
  if (!dueAt) {
    for (const [month, monthIndex] of Object.entries(MONTH_NAMES)) {
      const pattern = new RegExp(
        `\\b(\\d{1,2})(?:er)?\\s+${escapeRegExp(month)}\\b|\\b${escapeRegExp(month)}\\s+(\\d{1,2})\\b`,
        "iu"
      );
      const match = text.match(pattern);
      if (match) {
        const day = Number.parseInt(match[1] ?? match[2], 10);
        const date = new Date(now.getFullYear(), monthIndex, day, 9, 0, 0);
        // A date already past rolls to next year ("24 sept" said in
        // December means next September).
        if (date.getTime() < now.getTime() - DAY_MS) date.setFullYear(date.getFullYear() + 1);
        dueAt = date.toISOString();
        dueExpression = match[0];
        text = text.replace(match[0], " ");
        break;
      }
    }
  }

  // ---- priority ------------------------------------------------------
  const lower = raw.toLowerCase();
  let priority: CaptureIntent["priority"] = "medium";
  if (URGENT_WORDS.some((word) => lower.includes(word))) priority = "urgent";
  else if (HIGH_WORDS.some((word) => lower.includes(word))) priority = "high";
  else if (LOW_WORDS.some((word) => lower.includes(word))) priority = "low";

  // ---- title cleanup ---------------------------------------------------
  let title = text
    .replace(/\b(il faut que je|il faut que|je dois|j'ai besoin de|i need to|i have to|remind me to|rappelle[- ]moi de|rappelle[- ]moi que|n'oublie pas de|don't forget to)\b/giu, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Strip a leading connector left by the date/priority cleanup.
  title = title.replace(/^[,;:\-–—\s]+/, "").replace(/[,;:\-–—\s]+$/, "");
  if (!title) title = raw; // never lose the user's words entirely

  // ---- note detection ---------------------------------------------------
  const looksLikeNote =
    NOTE_MARKERS.some((marker) => lower.startsWith(marker)) ||
    (!dueAt && /\b(c'est|that|le fait que|info|note)\b/iu.test(raw) && raw.split(" ").length > 8);

  return { title, dueAt, dueExpression, priority, looksLikeNote };
}

/** Human summary of what capture understood — for confirmation. */
export function describeCapture(intent: CaptureIntent): string {
  if (!intent.dueAt) return `“${intent.title}”`;
  const date = new Date(intent.dueAt);
  const label = new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(date);
  return `“${intent.title}” · due ${label}`;
}

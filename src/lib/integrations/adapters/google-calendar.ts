// ============================================================
// NEXUS INTEGRATIONS — GOOGLE CALENDAR ADAPTER (reference)
// ============================================================
// The reference server-side adapter. It proves the platform pattern
// end to end: a connected provider's data flows through the unified
// context model with source attribution, permission awareness and
// honest error states.
//
// Contract (tested with a fake transport in
// supabase/tests/integrations-contract.test.mjs):
//   * Only calendar.readonly capabilities — this adapter never
//     mutates the provider.
//   * Events are normalized to ExternalEventRef (canonical context
//     model), never dumped raw.
//   * Provider errors degrade to typed errors, never to fake data.
// ============================================================

export type ExternalEventRef = {
  provider: "google-calendar";
  providerId: string;
  externalId: string;
  title: string;
  startAt: string;
  endAt: string | null;
  location: string | null;
  url: string | null;
  /** All-day events have no clock time. */
  isAllDay: boolean;
};

export type CalendarRange = {
  fromIso: string;
  toIso: string;
};

export type AdapterOk = {
  ok: true;
  events: ExternalEventRef[];
};

export type AdapterFailure = {
  ok: false;
  errorCode:
    | "NETWORK"
    | "UNAUTHORIZED"
    | "RATE_LIMITED"
    | "PROVIDER_ERROR"
    | "INVALID_RESPONSE";
  message: string;
  retryable: boolean;
};

export type AdapterResult = AdapterOk | AdapterFailure;

const LIST_TIMEOUT_MS = 8_000;
const MAX_RESULTS = 50;

/** One calendar event as the Google API returns it (subset we use). */
type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  htmlLink?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
};

export function normalizeEvent(
  raw: GoogleCalendarEvent
): ExternalEventRef | null {
  if (!raw.id || !raw.start) return null;
  if (raw.status && raw.status !== "confirmed") return null;

  const isAllDay = Boolean(raw.start.date) && !raw.start.dateTime;
  const startAt = raw.start.dateTime ?? raw.start.date;
  if (!startAt) return null;

  const endAt = raw.end?.dateTime ?? raw.end?.date ?? null;

  return {
    provider: "google-calendar",
    providerId: "google-calendar",
    externalId: raw.id,
    title: raw.summary?.trim() || "(untitled event)",
    startAt,
    endAt,
    location: raw.location ?? null,
    url: raw.htmlLink ?? null,
    isAllDay,
  };
}

/**
 * List confirmed events in a time range on the primary calendar.
 * `fetchImpl` is injectable so tests run hermetically.
 */
export async function listEventsInRange(options: {
  accessToken: string;
  range: CalendarRange;
  calendarId?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<AdapterResult> {
  const doFetch = options.fetchImpl ?? fetch;
  const calendarId = encodeURIComponent(options.calendarId ?? "primary");

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`
  );
  url.searchParams.set("timeMin", options.range.fromIso);
  url.searchParams.set("timeMax", options.range.toIso);
  url.searchParams.set("maxResults", String(MAX_RESULTS));
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("fields", "items(id,summary,htmlLink,location,start,end,status)");

  const startedAt = (options.now ?? Date.now)();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIST_TIMEOUT_MS);

  try {
    const response = await doFetch(url.toString(), {
      headers: { authorization: `Bearer ${options.accessToken}` },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        errorCode: "UNAUTHORIZED",
        message:
          "Google rejected the stored token. The connection must be re-established before calendar context can be read.",
        retryable: false,
      };
    }

    if (response.status === 429) {
      return {
        ok: false,
        errorCode: "RATE_LIMITED",
        message: "Google Calendar rate limit reached. Retry later.",
        retryable: true,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        errorCode: "PROVIDER_ERROR",
        message: `Google Calendar answered HTTP ${response.status}.`,
        retryable: response.status >= 500,
      };
    }

    const payload = (await response.json()) as { items?: GoogleCalendarEvent[] };
    if (!Array.isArray(payload.items)) {
      return {
        ok: false,
        errorCode: "INVALID_RESPONSE",
        message: "Google Calendar returned a payload without an items array.",
        retryable: false,
      };
    }

    const events = payload.items
      .map(normalizeEvent)
      .filter((event): event is ExternalEventRef => event !== null)
      .sort((a, b) => a.startAt.localeCompare(b.startAt));

    return { ok: true, events };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      errorCode: aborted ? "RATE_LIMITED" : "NETWORK",
      message: aborted
        ? `Google Calendar did not answer within ${LIST_TIMEOUT_MS}ms.`
        : error instanceof Error
          ? error.message
          : "Network failure while calling Google Calendar.",
      retryable: true,
    };
  } finally {
    clearTimeout(timer);
    // `startedAt` kept for future latency instrumentation.
    void startedAt;
  }
}

/**
 * Find free windows inside working hours for a day range. Pure
 * function over normalized events — unit-testable without any
 * transport.
 */
export function findFreeWindows(options: {
  events: ExternalEventRef[];
  fromIso: string;
  toIso: string;
  dayStartHour: number;
  dayEndHour: number;
  minWindowMinutes: number;
}): { startIso: string; endIso: string; minutes: number }[] {
  const windows: { startIso: string; endIso: string; minutes: number }[] = [];
  const from = new Date(options.fromIso);
  const to = new Date(options.toIso);

  for (let day = new Date(from); day <= to; day.setUTCDate(day.getUTCDate() + 1)) {
    const dayStart = new Date(day);
    dayStart.setUTCHours(options.dayStartHour, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setUTCHours(options.dayEndHour, 0, 0, 0);

    // Busy intervals for this day (clipped to working hours).
    const busy = options.events
      .filter((event) => {
        const start = new Date(event.startAt);
        return start >= dayStart && start < dayEnd && !event.isAllDay;
      })
      .map((event) => ({
        start: new Date(event.startAt),
        end: event.endAt ? new Date(event.endAt) : new Date(event.startAt),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let cursor = new Date(dayStart);
    for (const interval of busy) {
      if (interval.start > cursor) {
        pushWindow(windows, cursor, interval.start, options.minWindowMinutes);
      }
      if (interval.end > cursor) cursor = interval.end;
    }
    pushWindow(windows, cursor, dayEnd, options.minWindowMinutes);
  }

  return windows;
}

function pushWindow(
  windows: { startIso: string; endIso: string; minutes: number }[],
  start: Date,
  end: Date,
  minMinutes: number
): void {
  const minutes = (end.getTime() - start.getTime()) / 60_000;
  if (minutes >= minMinutes) {
    windows.push({
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      minutes: Math.round(minutes),
    });
  }
}

/**
 * Detect conflicts: overlapping busy events. Pure and deterministic.
 */
export function detectConflicts(events: ExternalEventRef[]): {
  a: ExternalEventRef;
  b: ExternalEventRef;
  overlapMinutes: number;
}[] {
  const busy = events
    .filter((event) => !event.isAllDay && event.endAt)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const conflicts: { a: ExternalEventRef; b: ExternalEventRef; overlapMinutes: number }[] = [];
  for (let i = 0; i < busy.length; i += 1) {
    for (let j = i + 1; j < busy.length; j += 1) {
      const a = busy[i];
      const b = busy[j];
      const aEnd = new Date(a.endAt as string).getTime();
      const bStart = new Date(b.startAt).getTime();
      if (bStart >= aEnd) break;
      const bEnd = new Date(b.endAt as string).getTime();
      const overlap = Math.round(
        (Math.min(aEnd, bEnd) - bStart) / 60_000
      );
      if (overlap > 0) {
        conflicts.push({ a, b, overlapMinutes: overlap });
      }
    }
  }
  return conflicts;
}

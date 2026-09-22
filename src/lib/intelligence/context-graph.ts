// ============================================================
// NEXUS INTELLIGENCE — UNIFIED CONTEXT MODEL
// ============================================================
// The canonical cross-application context layer. Every piece of
// context Intelligence reasons about — wherever it comes from — is
// described as a normalized entity with source attribution:
//
//   * provider    — where it lives (NEXUS, Gmail, Calendar, …)
//   * provider_id — the provider's own id
//   * url         — how a human inspects the original
//   * timestamp   — when it happened / was last touched
//   * freshness   — how trustworthy the age is
//   * confidence  — how sure NEXUS is of the inference
//
// External objects are REFERENCED, never copied wholesale: NEXUS
// keeps normalized metadata and reads details through adapters at
// query time, so provider permissions are respected (a user who
// loses access to a resource stops seeing it — the adapter fails
// closed and the source is reported as unavailable).
// ============================================================

// ------------------------------------------------------------
// Providers
// ------------------------------------------------------------

export type ContextProvider =
  | "nexus"
  | "gmail"
  | "google-calendar"
  | "slack"
  | "notion"
  | "github"
  | "linear"
  | "google-drive"
  | "outlook"
  | "teams"
  | "jira";

export const PROVIDER_LABEL: Record<ContextProvider, string> = {
  nexus: "NEXUS",
  gmail: "Gmail",
  "google-calendar": "Calendar",
  slack: "Slack",
  notion: "Notion",
  github: "GitHub",
  linear: "Linear",
  "google-drive": "Drive",
  outlook: "Outlook",
  teams: "Teams",
  jira: "Jira",
};

// ------------------------------------------------------------
// Canonical entity kinds
// ------------------------------------------------------------

export type ContextEntityKind =
  | "person"
  | "message"
  | "conversation"
  | "task"
  | "project"
  | "goal"
  | "event"
  | "deadline"
  | "document"
  | "file"
  | "issue"
  | "comment"
  | "meeting"
  | "commitment"
  | "signal"
  | "mission"
  | "note";

export const ENTITY_KIND_LABEL: Record<ContextEntityKind, string> = {
  person: "Person",
  message: "Message",
  conversation: "Conversation",
  task: "Task",
  project: "Project",
  goal: "Goal",
  event: "Event",
  deadline: "Deadline",
  document: "Document",
  file: "File",
  issue: "Issue",
  comment: "Comment",
  meeting: "Meeting",
  commitment: "Commitment",
  signal: "Signal",
  mission: "Mission",
  note: "Note",
};

// ------------------------------------------------------------
// Freshness
// ------------------------------------------------------------

export type Freshness = "fresh" | "recent" | "stale" | "unknown";

export const FRESHNESS_THRESHOLDS = {
  /** Less than this → fresh. */
  FRESH_MS: 6 * 60 * 60 * 1000, // 6 hours
  /** Less than this → recent. */
  RECENT_MS: 72 * 60 * 60 * 1000, // 3 days
} as const;

export const FRESHNESS_LABEL: Record<Freshness, string> = {
  fresh: "Fresh",
  recent: "Recent",
  stale: "Stale",
  unknown: "Freshness unknown",
};

/** Classify the age of a timestamp. Null-safe: no timestamp → unknown. */
export function freshnessOf(
  timestamp: string | null | undefined,
  now: Date = new Date()
): Freshness {
  if (!timestamp) return "unknown";
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return "unknown";
  const age = now.getTime() - time;
  if (age < 0) return "fresh"; // future-dated: meetings ahead are fresh context
  if (age <= FRESHNESS_THRESHOLDS.FRESH_MS) return "fresh";
  if (age <= FRESHNESS_THRESHOLDS.RECENT_MS) return "recent";
  return "stale";
}

// ------------------------------------------------------------
// Confidence (for inferred links between sources)
// ------------------------------------------------------------

export type Confidence = "high" | "medium" | "low";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "Certain",
  medium: "Likely",
  low: "Possible",
};

// ------------------------------------------------------------
// Source references — the attribution every answer carries
// ------------------------------------------------------------

export type SourceFetchStatus = "ok" | "unavailable" | "not_configured";

export type SourceRef = {
  provider: ContextProvider;
  kind: ContextEntityKind;
  /** How many items this source contributed. */
  count: number;
  /** Newest item timestamp, when known. */
  latestAt: string | null;
  freshness: Freshness;
  status: SourceFetchStatus;
  /** Why a source is missing, in one honest sentence. */
  detail?: string;
};

export function sourceRef(options: {
  provider: ContextProvider;
  kind: ContextEntityKind;
  count: number;
  latestAt?: string | null;
  status?: SourceFetchStatus;
  detail?: string;
  now?: Date;
}): SourceRef {
  return {
    provider: options.provider,
    kind: options.kind,
    count: options.count,
    latestAt: options.latestAt ?? null,
    freshness: freshnessOf(options.latestAt, options.now),
    status: options.status ?? "ok",
    detail: options.detail,
  };
}

/**
 * Render sources as human-readable citation lines:
 *   "NEXUS · 17 tasks", "Calendar · 3 events · stale",
 *   "Gmail · unavailable — not connected".
 * The UI never invents a citation; every line is derived from a
 * SourceRef that was actually fetched.
 */
export function describeSources(refs: SourceRef[]): string[] {
  const usable = refs.filter(
    (ref) => ref.status !== "not_configured" || ref.count > 0
  );
  return usable.map((ref) => {
    const label = PROVIDER_LABEL[ref.provider];
    const kind = ENTITY_KIND_LABEL[ref.kind].toLowerCase();
    const plural = ref.count === 1 ? kind : `${kind}s`;
    const base = `${label} · ${ref.count} ${plural}`;
    if (ref.status === "unavailable") {
      return `${base} — unavailable${ref.detail ? ` (${ref.detail})` : ""}`;
    }
    if (ref.freshness === "stale") {
      return `${base} · ${FRESHNESS_LABEL.stale.toLowerCase()} data`;
    }
    return base;
  });
}

/** One sentence for partial answers: what worked, what did not. */
export function describePartialAvailability(refs: SourceRef[]): string | null {
  const unavailable = refs.filter((ref) => ref.status === "unavailable");
  if (unavailable.length === 0) return null;
  const names = unavailable.map((ref) => PROVIDER_LABEL[ref.provider]);
  const ok = refs.filter((ref) => ref.status === "ok");
  const okNames = ok.map((ref) => PROVIDER_LABEL[ref.provider]);
  const okPart = okNames.length > 0 ? `J'ai analysé ${okNames.join(", ")}. ` : "";
  return `${okPart}${names.join(" et ")} ${
    unavailable.length === 1 ? "n'a pas répondu" : "n'ont pas répondu"
  }, donc ${
    unavailable.length === 1 ? "cette source" : "ces sources"
  } ${
    unavailable.length === 1 ? "n'est pas incluse" : "ne sont pas incluses"
  }.`;
}

// ------------------------------------------------------------
// Canonical external object reference
// ------------------------------------------------------------

export type ExternalObjectRef = {
  provider: ContextProvider;
  providerId: string;
  /** Provider's own id for this object. */
  externalId: string;
  kind: ContextEntityKind;
  title: string;
  url: string | null;
  timestamp: string | null;
  /** Scopes the connection had when this was read. */
  permissions: string[];
  freshness: Freshness;
  /** Sync provenance. */
  syncState: "live" | "synced" | "stale";
  /** How certain NEXUS is about linking this to a NEXUS entity. */
  confidence: Confidence;
  /** Related NEXUS entities, when a link was established. */
  relatedNexusIds: string[];
};

// ------------------------------------------------------------
// NEXUS-core canonical shapes (internal sources)
// ------------------------------------------------------------

export type NexusNoteRef = {
  id: string;
  title: string;
  noteType: string;
  projectId: string | null;
  updatedAt: string;
};

export type NexusEventRef = {
  id: string;
  title: string;
  startAt: string;
  endAt: string | null;
  location: string | null;
  projectId: string | null;
};

export type NexusFileRef = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  projectId: string | null;
  createdAt: string;
};

/** Build SourceRefs for the internal domains actually loaded. */
export function nexusSourceRefs(options: {
  tasks: number;
  projects: number;
  goals: number;
  notes: number;
  events: number;
  latestNoteAt?: string | null;
  latestEventAt?: string | null;
  latestTaskAt?: string | null;
  now?: Date;
}): SourceRef[] {
  const refs: SourceRef[] = [
    sourceRef({
      provider: "nexus",
      kind: "task",
      count: options.tasks,
      latestAt: options.latestTaskAt,
      now: options.now,
    }),
    sourceRef({
      provider: "nexus",
      kind: "project",
      count: options.projects,
      now: options.now,
    }),
    sourceRef({
      provider: "nexus",
      kind: "goal",
      count: options.goals,
      now: options.now,
    }),
    sourceRef({
      provider: "nexus",
      kind: "note",
      count: options.notes,
      latestAt: options.latestNoteAt,
      now: options.now,
    }),
    sourceRef({
      provider: "nexus",
      kind: "event",
      count: options.events,
      latestAt: options.latestEventAt,
      now: options.now,
    }),
  ];
  return refs;
}

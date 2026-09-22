// ============================================================
// NEXUS INTELLIGENCE — WORK RECOVERY
// ============================================================
// The mandatory product acceptance scenario: the user was away, a
// month of work accumulated everywhere, and they ask:
//
//   "J'ai quoi à faire ?" / "What do I have to do?"
//   "Rattrape mon retard." / "Catch me up."
//
// The recovery view is deterministic (no model needed to be useful):
//   1. COLLECT    — overdue, blocked, due-soon, upcoming events,
//                   recent notes, from the workspace snapshot.
//   2. DEDUPE     — one work item per underlying entity.
//   3. DETECT     — commitments, deadlines, blocked work.
//   4. PRIORITIZE — urgency × importance, every reason stated.
//   5. EXPLAIN    — each item says WHY it ranks where it ranks.
//   6. PROPOSE    — a recovery plan; mutations only after
//                   confirmation (never auto-executed).
//
// Sources: today this reasons over NEXUS core (tasks, projects,
// goals, notes, events). When a provider is connected, its adapter
// contributes ExternalObjectRefs with the same attribution; a
// failing source degrades the answer honestly instead of failing it.
// ============================================================

import {
  isActiveTask,
  type EventLike,
  type NoteLike,
  type WorkspaceSnapshot,
} from "./engine";
import type { SourceRef } from "./context-graph";
import { sourceRef } from "./context-graph";

export type RecoveryItemReason = {
  kind: "overdue" | "blocked" | "due_soon" | "meeting_soon" | "high_priority" | "stale_project" | "no_date";
  label: string;
};

export type RecoveryItem = {
  /** Stable id: entity type + row id (dedupe key). */
  key: string;
  source: "nexus" | "google-calendar";
  sourceLabel: string;
  kind: "task" | "event";
  id: string;
  title: string;
  dueAt: string | null;
  priority: string;
  status: string;
  project: string | null;
  /** Ranked reasons — empty means the item should not be here. */
  reasons: RecoveryItemReason[];
  /** 0–100 composite score, explainable from the reasons. */
  score: number;
  href: string;
  /** The single most useful next action, in user words. */
  suggestedAction: string;
};

export type RecoveryView = {
  generatedAt: string;
  items: RecoveryItem[];
  counts: {
    overdue: number;
    blocked: number;
    dueSoon: number;
    meetingsSoon: number;
    highPriority: number;
  };
  sources: SourceRef[];
  /** Proposed order of attack — a plan, not an execution. */
  proposal: string[];
  headline: string;
};

// Weights: every point is attributable to a stated reason.
const WEIGHTS = {
  overdue: 40,
  overdue_urgent_bonus: 15,
  blocked: 30,
  due_soon: 22,
  due_today: 10,
  meeting_soon: 18,
  meeting_today: 12,
  high_priority: 18,
  urgent_priority: 12,
  stale_project: 8,
  no_date: 4,
} as const;

const DAY_MS = 86_400_000;

export const RECOVERY_TRIGGERS = {
  /** Regex for "what do I have to do / j'ai quoi à faire". */
  DETECT: /quoi a faire|qu'est[- ]ce que j'ai a faire|qu'est[- ]ce que j'ai à faire|j'ai quoi|what do i have to do|what should i (do|work on)|rattrape|rattraper mon retard|catch me up|catch up|where do i start|par quoi commencer/iu,
  /** "while I was away" flavour. */
  AWAY: /vacances|vacation|away|absent|congé|conge|was out/iu,
} as const;

export function detectRecoveryRequest(query: string): boolean {
  return RECOVERY_TRIGGERS.DETECT.test(query);
}

export function isVacationFlavour(query: string): boolean {
  return RECOVERY_TRIGGERS.AWAY.test(query);
}

/**
 * Build the recovery view from the snapshot. Deterministic and pure:
 * same snapshot + same clock → same view. Nothing is invented: an
 * item exists only if a real row backs it.
 */
export function buildRecoveryView(options: {
  snapshot: WorkspaceSnapshot;
  notes?: NoteLike[];
  events?: EventLike[];
  externalEvents?: { title: string; startAt: string; url: string | null }[];
  now?: Date;
}): RecoveryView {
  const now = options.now ?? new Date();
  const { snapshot } = options;
  const nowTime = now.getTime();
  const projectNames = new Map(snapshot.projects.map((p) => [p.id, p.name]));

  const items: RecoveryItem[] = [];
  const seen = new Set<string>();

  const push = (item: RecoveryItem) => {
    if (item.reasons.length === 0) return; // no reason → not on the list
    if (seen.has(item.key)) return; // dedupe by entity
    seen.add(item.key);
    items.push(item);
  };

  // ---- 1. COLLECT: open NEXUS tasks --------------------------------
  for (const task of snapshot.tasks.filter(isActiveTask)) {
    const reasons: RecoveryItemReason[] = [];
    let score = 0;

    const dueTime = task.due_at ? new Date(task.due_at).getTime() : null;
    if (dueTime !== null && !Number.isNaN(dueTime)) {
      if (dueTime < nowTime) {
        reasons.push({ kind: "overdue", label: "En retard" });
        score += WEIGHTS.overdue;
      } else if (dueTime < nowTime + 3 * DAY_MS) {
        reasons.push({ kind: "due_soon", label: "Échéance proche" });
        score += WEIGHTS.due_soon;
        if (dueTime < nowTime + DAY_MS) {
          reasons.push({ kind: "due_soon", label: "Dû aujourd'hui" });
          score += WEIGHTS.due_today;
        }
      }
    } else if (task.priority === "urgent" || task.priority === "high") {
      reasons.push({ kind: "no_date", label: "Priorité sans date — planifie-la" });
      score += WEIGHTS.no_date;
    }

    if (task.status === "blocked") {
      reasons.push({ kind: "blocked", label: "Bloquée — débloque d'abord l'amont" });
      score += WEIGHTS.blocked;
    }

    if (task.priority === "urgent") {
      reasons.push({ kind: "high_priority", label: "Urgente" });
      score += WEIGHTS.high_priority + WEIGHTS.urgent_priority;
    } else if (task.priority === "high") {
      reasons.push({ kind: "high_priority", label: "Priorité haute" });
      score += WEIGHTS.high_priority;
    }

    push({
      key: `task:${task.id}`,
      source: "nexus",
      sourceLabel: "NEXUS",
      kind: "task",
      id: task.id,
      title: task.title,
      dueAt: task.due_at ?? null,
      priority: task.priority ?? "medium",
      status: task.status ?? "todo",
      project: task.project_id ? projectNames.get(task.project_id) ?? null : null,
      reasons,
      score: Math.min(score, 100),
      href: "/tasks",
      suggestedAction:
        task.status === "blocked"
          ? "Débloque la tâche en amont"
          : dueTime !== null && dueTime < nowTime
            ? "Replanifie ou traite-la aujourd'hui"
            : "Bloque du temps pour la traiter",
    });
  }

  // ---- 2. COLLECT: upcoming events (internal + external) ----------
  const internalEvents: EventLike[] = options.events ?? [];
  const eventRows: { id: string; title: string; startAt: string; source: "nexus" | "google-calendar"; sourceLabel: string; url: string | null }[] = [
    ...internalEvents.map((event) => ({
      id: event.id,
      title: event.title,
      startAt: event.start_at,
      source: "nexus" as const,
      sourceLabel: "NEXUS Calendar",
      url: null as string | null,
    })),
    ...(options.externalEvents ?? []).map((event, index) => ({
      id: `gcal-${index}`,
      title: event.title,
      startAt: event.startAt,
      source: "google-calendar" as const,
      sourceLabel: "Calendar",
      url: event.url,
    })),
  ];

  for (const event of eventRows) {
    const start = new Date(event.startAt).getTime();
    if (Number.isNaN(start) || start < nowTime - DAY_MS) continue; // past events don't need recovery

    const reasons: RecoveryItemReason[] = [];
    let score = 0;
    if (start < nowTime + DAY_MS) {
      reasons.push({ kind: "meeting_soon", label: "Aujourd'hui" });
      score += WEIGHTS.meeting_soon + WEIGHTS.meeting_today;
    } else if (start < nowTime + 3 * DAY_MS) {
      reasons.push({ kind: "meeting_soon", label: "Dans les 3 prochains jours" });
      score += WEIGHTS.meeting_soon;
    }

    push({
      key: `event:${event.source}:${event.id}`,
      source: event.source,
      sourceLabel: event.sourceLabel,
      kind: "event",
      id: event.id,
      title: event.title,
      dueAt: event.startAt,
      priority: "medium",
      status: "scheduled",
      project: null,
      reasons,
      score: Math.min(score, 100),
      href: event.url ?? "/calendar",
      suggestedAction: "Vérifie que tu es prêt·e",
    });
  }

  // ---- 3. PRIORITIZE + counts --------------------------------------
  items.sort((a, b) => b.score - a.score || (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

  const counts = {
    overdue: items.filter((item) => item.reasons.some((r) => r.kind === "overdue")).length,
    blocked: items.filter((item) => item.reasons.some((r) => r.kind === "blocked")).length,
    dueSoon: items.filter((item) => item.reasons.some((r) => r.kind === "due_soon")).length,
    meetingsSoon: items.filter((item) => item.reasons.some((r) => r.kind === "meeting_soon")).length,
    highPriority: items.filter((item) => item.reasons.some((r) => r.kind === "high_priority")).length,
  };

  // ---- 4. Sources (attribution, honestly) ---------------------------
  const notes = options.notes ?? [];
  const latestNoteAt = notes[0]?.updated_at ?? null;
  const upcomingEvents = eventRows.filter((row) => new Date(row.startAt).getTime() > nowTime - DAY_MS);
  const sources: SourceRef[] = [
    sourceRef({ provider: "nexus", kind: "task", count: snapshot.tasks.filter(isActiveTask).length, now }),
    sourceRef({ provider: "nexus", kind: "project", count: snapshot.projects.length, now }),
    sourceRef({ provider: "nexus", kind: "note", count: notes.length, latestAt: latestNoteAt, now }),
    sourceRef({
      provider: "nexus",
      kind: "event",
      count: internalEvents.length,
      latestAt: upcomingEvents[0]?.startAt ?? null,
      now,
    }),
    ...(options.externalEvents && options.externalEvents.length > 0
      ? [
          sourceRef({
            provider: "google-calendar",
            kind: "event",
            count: options.externalEvents.length,
            latestAt: options.externalEvents[0]?.startAt ?? null,
            now,
          }),
        ]
      : []),
  ];

  // ---- 5. Proposal (plan, never an execution) ------------------------
  const proposal: string[] = [];
  const top = items.slice(0, 3);
  if (top.length > 0) {
    proposal.push(
      `Traite d'abord : ${top.map((item, index) => `${index + 1}. ${item.title}`).join(", ")}.`
    );
  }
  if (counts.blocked > 0) {
    proposal.push(`${counts.blocked} tâche(s) bloquée(s) : commence par débloquer l'amont.`);
  }
  if (counts.overdue > 0) {
    proposal.push(`${counts.overdue} tâche(s) en retard : replanifie ce qui ne peut pas être traité aujourd'hui.`);
  }
  if (counts.meetingsSoon > 0) {
    proposal.push(`${counts.meetingsSoon} réunion(s) à venir : vérifie ta préparation.`);
  }
  if (proposal.length === 0) {
    proposal.push("Rien d'urgent détecté — bon moment pour avancer les projets longs.");
  }
  proposal.push(
    "Dis-moi « planifie ma journée » et je propose des créneaux — confirmation requise avant tout changement."
  );

  const headline =
    items.length === 0
      ? "Rien ne demande ton attention immédiate."
      : `${items.length} élément(s) nécessitent ton attention : ${counts.overdue} en retard, ${counts.blocked} bloqué(s), ${counts.meetingsSoon} réunion(s) à venir.`;

  return {
    generatedAt: now.toISOString(),
    items,
    counts,
    sources,
    proposal,
    headline,
  };
}

/**
 * Render the recovery view as an Intelligence narrative. Every item
 * exposes its source and its reasons — the user can always check
 * where a claim comes from.
 */
export function renderRecoveryNarrative(view: RecoveryView): string {
  const lines: string[] = [];
  lines.push(view.headline);
  lines.push("");

  if (view.items.length > 0) {
    view.items.slice(0, 8).forEach((item, index) => {
      const due = item.dueAt ? new Date(item.dueAt) : null;
      const dueLabel = due
        ? ` — ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(due)}`
        : "";
      lines.push(
        `${index + 1}. ${item.title}${dueLabel} · ${item.sourceLabel}`
      );
      lines.push(`   Pourquoi : ${item.reasons.map((r) => r.label).join(" · ")}`);
    });
    if (view.items.length > 8) {
      lines.push(`…et ${view.items.length - 8} autre(s).`);
    }
    lines.push("");
    lines.push("Je te propose de traiter d'abord :");
    view.proposal.forEach((line) => lines.push(`• ${line}`));
  }

  return lines.join("\n");
}

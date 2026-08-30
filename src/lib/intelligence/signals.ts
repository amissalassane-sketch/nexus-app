// ============================================================
// NEXUS INTELLIGENCE — PROACTIVE SIGNAL ENGINE (Phase 3)
// ============================================================
// Turns the REAL workspace snapshot into structured, scored,
// deduplicated signals. Deterministic by design: the engine decides
// whether a signal exists and how urgent it is. An optional LLM may
// only reformulate the explanation — it never creates signals,
// entities, dates or statistics.
//
// Pipeline (per request, one snapshot):
//   snapshot + activities + dependencies
//     → detect (8 categories) → score (explainable) → fingerprint
//     → dedup + cooldown (against persisted state) → active signals
//     → optional LLM explanation → suggested actions
//
// Hard rules:
//   - No signal without real evidence rows.
//   - Every fingerprint is type + entity id (changes only when the
//     situation really changes).
//   - Mutations are only PROPOSED here (confirmation-gated); they are
//     executed exclusively through /api/intelligence/action.
// ============================================================

import type { WorkspaceSnapshot } from "./engine";
import { isActiveTask, type ProjectLike, type TaskLike } from "./engine";
import type { ActivityContextItem, IntelligenceAction, IntelligenceActionType, TaskDependencyContextItem } from "./types";

// ============================================================
// CENTRALIZED CONSTANTS — no magic numbers anywhere else
// ============================================================

export const SIGNAL_CONSTANTS = {
  // Detection thresholds
  DUE_SOON_HOURS: 48, // tasks due within 48h → TASK_DUE_SOON
  STALE_PROJECT_DAYS: 7, // no activity for 7 days → PROJECT_STALE
  AT_RISK_MIN_FACTORS: 2, // ≥2 risk factors → PROJECT_AT_RISK
  DEADLINE_RISK_DAYS: 3, // deadline ≤ 3 days → DEADLINE_RISK
  URGENT_CONFLICT_MIN: 3, // ≥3 urgent tasks → PRIORITY_CONFLICT (warning)
  URGENT_CONFLICT_CRITICAL: 5, // ≥5 urgent tasks → critical
  URGENT_NO_DATE_MIN: 2, // ≥2 urgent tasks without due date → conflict
  TODAY_CONFLICT_MIN: 4, // ≥4 tasks due today → conflict
  TODAY_CONFLICT_CRITICAL: 6,
  POSITIVE_COMPLETED_MIN: 5, // ≥5 completed this week → progress signal
  POSITIVE_VELOCITY_FACTOR: 1.5, // > 1.5x previous week → momentum

  // Cooldowns (re-spam prevention)
  COOLDOWN_SEEN_MS: 4 * 60 * 60 * 1000, // seen, unchanged → not re-alerted for 4h
  COOLDOWN_DISMISSED_MS: 24 * 60 * 60 * 1000, // dismissed → reappears after 24h
  MIN_SIGNAL_LIFETIME_MS: 60 * 60 * 1000, // don't resolve a fresh signal within 1h

  // Display / persistence
  DISPLAY_MIN_SCORE: 18, // below this → not surfaced in "Needs your attention"
  DISPLAY_LIMIT: 6, // max cards shown (the rest are counted)
  PERSIST_MIN_SCORE: 5, // below this → not persisted at all
} as const;

// ============================================================
// TYPES — adapted to the existing system (no parallel contracts)
// ============================================================

export type ProactiveSignalType =
  | "TASK_OVERDUE"
  | "TASK_DUE_SOON"
  | "PROJECT_AT_RISK"
  | "PROJECT_STALE"
  | "BLOCKED_WORK"
  | "PRIORITY_CONFLICT"
  | "DEADLINE_RISK"
  | "GOAL_AT_RISK"
  | "POSITIVE_PROGRESS";

export type ProactiveSeverity = "info" | "attention" | "warning" | "critical";

export type SignalLifecycleStatus = "new" | "seen" | "dismissed" | "acted" | "resolved";

export interface SignalEvidence {
  label: string;
  value: string;
  detail?: string;
}

export interface SignalScoreBreakdown {
  factor: string;
  points: number;
  detail: string;
}

export interface SignalEntityRef {
  type: "task" | "project" | "goal" | "workspace";
  id: string;
  label: string;
}

export interface SuggestedSignalAction {
  label: string;
  kind: "navigate" | "mutate";
  /** Navigation deep link (kind === "navigate"). */
  href?: string;
  /** Confirmation-gated mutation, executed via /api/intelligence/action
   *  only (kind === "mutate"). */
  action?: IntelligenceAction;
}

/** A signal detected by the engine (before persistence). */
export interface DetectedSignal {
  fingerprint: string;
  type: ProactiveSignalType;
  severity: ProactiveSeverity;
  score: number;
  scoreBreakdown: SignalScoreBreakdown[];
  title: string;
  summary: string;
  evidence: SignalEvidence[];
  entity: SignalEntityRef | null;
  affectedCount: number;
  suggestedActions: SuggestedSignalAction[];
  confidence: number;
  detectedFrom?: string | null;
}

/** A signal row persisted for (user, workspace). */
export interface StoredSignalRow {
  id: string;
  fingerprint: string;
  type: ProactiveSignalType;
  severity: ProactiveSeverity;
  title: string;
  summary: string;
  evidence: SignalEvidence[];
  scoreBreakdown: SignalScoreBreakdown[];
  suggestedActions: SuggestedSignalAction[];
  entityType: SignalEntityRef["type"] | null;
  entityId: string | null;
  entityLabel: string | null;
  score: number;
  confidence: number;
  affectedCount: number;
  status: SignalLifecycleStatus;
  createdAt: string;
  seenAt: string | null;
  dismissedAt: string | null;
  resolvedAt: string | null;
}

/** The result of one proactive pass. */
export interface ProactiveResult {
  signals: StoredSignalRow[];
  attentionCount: number;
  criticalCount: number;
  refreshedAt: string;
  /** True when every summary is the deterministic one (no LLM). */
  llmEnriched: boolean;
}

// ============================================================
// SEVERITY HELPERS
// ============================================================

export const SEVERITY_ORDER: Record<ProactiveSeverity, number> = {
  info: 0,
  attention: 1,
  warning: 2,
  critical: 3,
};

export function severityRank(severity: ProactiveSeverity): number {
  return SEVERITY_ORDER[severity];
}

export const SIGNAL_TYPE_LABEL: Record<ProactiveSignalType, string> = {
  TASK_OVERDUE: "Task overdue",
  TASK_DUE_SOON: "Due soon",
  PROJECT_AT_RISK: "Project at risk",
  PROJECT_STALE: "Project stale",
  BLOCKED_WORK: "Blocked work",
  PRIORITY_CONFLICT: "Priority conflict",
  DEADLINE_RISK: "Deadline risk",
  GOAL_AT_RISK: "Goal at risk",
  POSITIVE_PROGRESS: "Progress",
};

// ============================================================
// SCORING — deterministic and explainable
// ============================================================

const SEVERITY_BASE: Record<ProactiveSeverity, number> = {
  info: 10,
  attention: 25,
  warning: 45,
  critical: 65,
};

const SCORE_FACTORS = {
  DEADLINE_TODAY: 25,
  DEADLINE_TOMORROW: 18,
  DEADLINE_2DAYS: 12,
  DEADLINE_3DAYS: 8,
  OVERDUE_PER_DAY: 3,
  OVERDUE_CAP: 20,
  IMPACT_PER_ENTITY: 8,
  IMPACT_CAP: 25,
  BLOCKING_EFFECT: 15,
  STALENESS_WEEK: 8,
  STALENESS_TWO_WEEKS: 14,
  CONFLICT_OVERFLOW: 4,
} as const;

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

function hoursUntil(date: Date, now: Date): number {
  return (date.getTime() - now.getTime()) / 3_600_000;
}

/** Builds a scored signal with an explainable breakdown. */
function scored(
  type: ProactiveSignalType,
  severity: ProactiveSeverity,
  fingerprint: string,
  title: string,
  summary: string,
  evidence: SignalEvidence[],
  entity: SignalEntityRef | null,
  affectedCount: number,
  suggestedActions: SuggestedSignalAction[],
  _now: Date,
  extra: { breakdown: SignalScoreBreakdown[]; confidence?: number; detectedFrom?: string | null }
): DetectedSignal {
  const points = extra.breakdown.reduce((sum, factor) => sum + factor.points, 0);
  const score = Math.min(100, Math.max(0, points));
  return {
    fingerprint,
    type,
    severity,
    score,
    scoreBreakdown: extra.breakdown,
    title,
    summary,
    evidence,
    entity,
    affectedCount,
    suggestedActions,
    confidence: extra.confidence ?? 0.9,
    detectedFrom: extra.detectedFrom ?? null,
  };
}

// ============================================================
// SUGGESTED ACTIONS (navigation + confirmation-gated mutations)
// ============================================================

/** Navigation action — resolved by the client, no server execution. */
export function navigateSignalAction(label: string, url: string, type: IntelligenceActionType = "navigate"): SuggestedSignalAction {
  return {
    label,
    kind: "navigate",
    href: url,
    action: {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      label,
      confirmationRequired: false,
      risk: "none",
      payload: { url },
    },
  };
}

/** Mutation action — proposal only; executed via /api/intelligence/action. */
export function mutateSignalAction(
  label: string,
  actionType: IntelligenceActionType,
  payload: Record<string, unknown>
): SuggestedSignalAction {
  const action: IntelligenceAction = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: actionType,
    label,
    confirmationRequired: true,
    payload: payload as IntelligenceAction["payload"],
  };
  return { label, kind: "mutate", action };
}

// ============================================================
// DETECTION — 8 categories, all evidence-grounded
// ============================================================

export interface SignalDetectionOptions {
  workspaceId: string;
  activities?: ActivityContextItem[];
  dependencies?: TaskDependencyContextItem[];
  now?: Date;
}

function lastTouchOfProject(project: ProjectLike, tasks: TaskLike[]): Date | null {
  const dates = [
    asDate(project.updated_at),
    asDate(project.created_at),
    ...tasks.filter((t) => t.project_id === project.id).map((t) => asDate(t.updated_at) ?? asDate(t.created_at)),
  ].filter((d): d is Date => d !== null);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

export function computeSignals(snapshot: WorkspaceSnapshot, options: SignalDetectionOptions): DetectedSignal[] {
  const now = options.now ?? new Date();
  const signals: DetectedSignal[] = [];
  const openTasks = snapshot.tasks.filter(isActiveTask);
  const projectMap = new Map(snapshot.projects.map((p) => [p.id, p]));
  const projectName = (projectId: string | null | undefined) =>
    projectId ? projectMap.get(projectId)?.name ?? null : null;

  // Dependencies: which tasks block which (real rows only).
  const blockedByMap = new Map<string, string[]>(); // taskId → dependsOn titles
  const blocksMap = new Map<string, string[]>(); // dependsOnTaskId → taskIds that depend on it
  for (const dep of options.dependencies ?? []) {
    const blockedBy = blockedByMap.get(dep.taskId) ?? [];
    blockedBy.push(dep.dependsOnTitle);
    blockedByMap.set(dep.taskId, blockedBy);
    const blocks = blocksMap.get(dep.dependsOnTaskId) ?? [];
    blocks.push(dep.taskTitle);
    blocksMap.set(dep.dependsOnTaskId, blocks);
  }

  // ----------------------------------------------------------
  // A. TASK_OVERDUE — open task, due date passed
  // ----------------------------------------------------------
  for (const task of openTasks) {
    const due = asDate(task.due_at);
    if (!due || due.getTime() >= now.getTime()) continue;
    const lateDays = Math.abs(daysUntil(due, now));
    const pName = projectName(task.project_id);
    const breakdown: SignalScoreBreakdown[] = [
      { factor: "severity", points: SEVERITY_BASE.critical, detail: "tâche en retard" },
      { factor: "overdue", points: Math.min(lateDays * SCORE_FACTORS.OVERDUE_PER_DAY, SCORE_FACTORS.OVERDUE_CAP), detail: `${lateDays} jour(s) de retard` },
    ];
    if (task.priority === "urgent" || task.priority === "high") {
      breakdown.push({ factor: "priority", points: 5, detail: `priorité ${task.priority}` });
    }
    signals.push(
      scored(
        "TASK_OVERDUE",
        "critical",
        `TASK_OVERDUE:${task.id}`,
        `“${task.title}” est en retard`,
        `Cette tâche devait être terminée ${lateDays === 0 ? "aujourd'hui" : `il y a ${lateDays} jour${lateDays > 1 ? "s" : ""}`} et est toujours ouverte.`,
        [
          { label: "En retard de", value: `${lateDays} jour${lateDays > 1 ? "s" : ""}` },
          { label: "Priorité", value: task.priority ?? "medium" },
          ...(pName ? [{ label: "Projet", value: pName }] : []),
        ],
        { type: "task", id: task.id, label: task.title },
        1,
        [
          navigateSignalAction("Ouvrir la tâche", `/tasks?focus=${task.id}`, "open_task"),
          mutateSignalAction("Marquer comme terminée", "complete_task", { taskId: task.id }),
          mutateSignalAction("Reporter", "move_task", { taskId: task.id }),
        ],
        now,
        { breakdown, detectedFrom: task.due_at }
      )
    );
  }

  // ----------------------------------------------------------
  // B. TASK_DUE_SOON — open task due within 48h (deterministic)
  // ----------------------------------------------------------
  for (const task of openTasks) {
    const due = asDate(task.due_at);
    if (!due || due.getTime() < now.getTime()) continue;
    const hours = hoursUntil(due, now);
    if (hours > SIGNAL_CONSTANTS.DUE_SOON_HOURS) continue;
    const severity: ProactiveSeverity = hours <= 24 ? "warning" : "attention";
    const pName = projectName(task.project_id);
    const breakdown: SignalScoreBreakdown[] = [
      { factor: "severity", points: SEVERITY_BASE[severity], detail: `échéance dans ${Math.max(0, Math.ceil(hours))}h` },
      { factor: "deadline", points: hours <= 24 ? SCORE_FACTORS.DEADLINE_TODAY : SCORE_FACTORS.DEADLINE_TOMORROW, detail: hours <= 24 ? "échéance aujourd'hui" : "échéance demain" },
    ];
    signals.push(
      scored(
        "TASK_DUE_SOON",
        severity,
        `TASK_DUE_SOON:${task.id}`,
        `“${task.title}” est due ${hours <= 24 ? "aujourd'hui" : "demain"}`,
        `L'échéance arrive dans ${Math.max(0, Math.ceil(hours))} heure(s) et la tâche est toujours ouverte.`,
        [
          { label: "Échéance", value: hours <= 24 ? "aujourd'hui" : "demain" },
          { label: "Priorité", value: task.priority ?? "medium" },
          ...(pName ? [{ label: "Projet", value: pName }] : []),
        ],
        { type: "task", id: task.id, label: task.title },
        1,
        [
          navigateSignalAction("Ouvrir la tâche", `/tasks?focus=${task.id}`, "open_task"),
          mutateSignalAction("Marquer comme terminée", "complete_task", { taskId: task.id }),
        ],
        now,
        { breakdown, detectedFrom: task.due_at }
      )
    );
  }

  // ----------------------------------------------------------
  // C. PROJECT_AT_RISK — ≥2 structural risk factors, with proof
  // ----------------------------------------------------------
  for (const project of snapshot.projects) {
    const pTasks = snapshot.tasks.filter((t) => t.project_id === project.id);
    const pOpen = pTasks.filter(isActiveTask);
    if (pOpen.length === 0) continue;
    const pOverdue = pOpen.filter((t) => {
      const due = asDate(t.due_at);
      return due !== null && due.getTime() < now.getTime();
    });
    const pBlocked = pOpen.filter((t) => t.status === "blocked");
    const pDue = asDate(project.due_date);
    const lastTouch = lastTouchOfProject(project, snapshot.tasks);
    const staleDays = lastTouch ? Math.floor((now.getTime() - lastTouch.getTime()) / 86_400_000) : null;
    const progress = Math.round(project.progress ?? 0);

    const factors: { label: string; value: string; points: number }[] = [];
    if (pOverdue.length > 0) factors.push({ label: "Tâches en retard", value: String(pOverdue.length), points: 10 });
    if (pBlocked.length > 0) factors.push({ label: "Tâches bloquées", value: String(pBlocked.length), points: 10 });
    if (pDue && daysUntil(pDue, now) >= 0 && daysUntil(pDue, now) <= 7) {
      factors.push({ label: "Échéance dans", value: `${daysUntil(pDue, now)}j`, points: 8 });
    }
    if (staleDays !== null && staleDays >= 7) factors.push({ label: "Sans activité depuis", value: `${staleDays}j`, points: 6 });
    if (pDue && progress < 30 && daysUntil(pDue, now) <= 14) {
      factors.push({ label: "Progression", value: `${progress}%`, points: 6 });
    }

    if (factors.length < SIGNAL_CONSTANTS.AT_RISK_MIN_FACTORS) continue;

    const severity: ProactiveSeverity =
      factors.length >= 4 || pOverdue.length + pBlocked.length >= 3 ? "critical" : factors.length === 3 ? "warning" : "attention";
    const breakdown: SignalScoreBreakdown[] = [
      { factor: "severity", points: SEVERITY_BASE[severity], detail: `${factors.length} facteurs de risque` },
      ...factors.map((factor) => ({ factor: factor.label, points: factor.points, detail: factor.value })),
    ];
    signals.push(
      scored(
        "PROJECT_AT_RISK",
        severity,
        `PROJECT_AT_RISK:${project.id}`,
        `« ${project.name} » a besoin d'attention`,
        `${factors.length} signaux de risque détectés sur ce projet.`,
        factors.map((factor) => ({ label: factor.label, value: factor.value })),
        { type: "project", id: project.id, label: project.name },
        pOpen.length,
        [
          navigateSignalAction("Ouvrir le projet", `/projects?focus=${project.id}`, "open_project"),
          navigateSignalAction("Voir les tâches bloquées", "/tasks?filter=blocked", "view_blocked_tasks"),
        ],
        now,
        { breakdown, detectedFrom: lastTouch?.toISOString() ?? project.updated_at ?? null }
      )
    );
  }

  // ----------------------------------------------------------
  // D. PROJECT_STALE — no activity for a significant period
  // ----------------------------------------------------------
  for (const project of snapshot.projects) {
    const pTasks = snapshot.tasks.filter((t) => t.project_id === project.id);
    const hasOpen = pTasks.some(isActiveTask);
    if (!hasOpen) continue; // stale ≠ empty — empty projects are already covered
    const lastTouch = lastTouchOfProject(project, snapshot.tasks);
    if (!lastTouch) continue;
    const staleDays = Math.floor((now.getTime() - lastTouch.getTime()) / 86_400_000);
    if (staleDays < SIGNAL_CONSTANTS.STALE_PROJECT_DAYS) continue;

    const breakdown: SignalScoreBreakdown[] = [
      { factor: "severity", points: SEVERITY_BASE["attention"], detail: "projet sans activité" },
      {
        factor: "staleness",
        points: staleDays >= 14 ? SCORE_FACTORS.STALENESS_TWO_WEEKS : SCORE_FACTORS.STALENESS_WEEK,
        detail: `${staleDays} jours sans activité`,
      },
    ];
    signals.push(
      scored(
        "PROJECT_STALE",
        "attention",
        `PROJECT_STALE:${project.id}`,
        `« ${project.name} » est resté sans activité`,
        `Aucune mise à jour sur ce projet (ou ses tâches) depuis ${staleDays} jours, alors que du travail est encore ouvert.`,
        [
          { label: "Sans activité depuis", value: `${staleDays} jours` },
          { label: "Tâches ouvertes", value: String(pTasks.filter(isActiveTask).length) },
        ],
        { type: "project", id: project.id, label: project.name },
        pTasks.filter(isActiveTask).length,
        [
          navigateSignalAction("Ouvrir le projet", `/projects?focus=${project.id}`, "open_project"),
          mutateSignalAction("Ajouter une tâche de relance", "create_task", { title: "Relancer le projet", projectId: project.id }),
        ],
        now,
        { breakdown, detectedFrom: lastTouch.toISOString() }
      )
    );
  }

  // ----------------------------------------------------------
  // E. BLOCKED_WORK — blocked tasks, and tasks blocking others
  // ----------------------------------------------------------
  for (const task of openTasks) {
    if (task.status !== "blocked") continue;
    const dependsOn = blockedByMap.get(task.id) ?? [];
    const blockedByIt = blocksMap.get(task.id) ?? [];
    const pName = projectName(task.project_id);
    const severity: ProactiveSeverity = blockedByIt.length > 0 ? "critical" : "warning";
    const breakdown: SignalScoreBreakdown[] = [
      { factor: "severity", points: SEVERITY_BASE[severity], detail: "travail bloqué" },
      ...(blockedByIt.length > 0
        ? [{ factor: "blocking", points: SCORE_FACTORS.BLOCKING_EFFECT, detail: `bloque ${blockedByIt.length} tâche(s) en aval` }]
        : []),
      ...(dependsOn.length > 0 ? [{ factor: "dependency", points: 5, detail: `dépend de : ${dependsOn.join(", ")}` }] : []),
    ];
    signals.push(
      scored(
        "BLOCKED_WORK",
        severity,
        `BLOCKED_WORK:${task.id}`,
        blockedByIt.length > 0
          ? `« ${task.title} » bloque ${blockedByIt.length} tâche${blockedByIt.length > 1 ? "s" : ""}`
          : `« ${task.title} » est bloquée`,
        blockedByIt.length > 0
          ? `${blockedByIt.slice(0, 3).map((t) => `« ${t} »`).join(", ")} ne peu${blockedByIt.length === 1 ? "t" : "vent"} pas avancer tant que cette tâche n'est pas débloquée.`
          : dependsOn.length > 0
            ? `Cette tâche attend ${dependsOn.join(", ")}.`
            : "Cette tâche est marquée bloquée et rien en aval ne peut avancer.",
        [
          ...(dependsOn.length > 0 ? [{ label: "Bloquée par", value: dependsOn.join(", ") }] : []),
          ...(blockedByIt.length > 0 ? [{ label: "Bloque", value: `${blockedByIt.length} tâche(s)` }] : []),
          ...(pName ? [{ label: "Projet", value: pName }] : []),
        ],
        { type: "task", id: task.id, label: task.title },
        1 + blockedByIt.length,
        [
          navigateSignalAction("Ouvrir la tâche", `/tasks?focus=${task.id}`, "open_task"),
          navigateSignalAction("Voir les tâches bloquées", "/tasks?filter=blocked", "view_blocked_tasks"),
        ],
        now,
        { breakdown, detectedFrom: task.updated_at ?? null }
      )
    );
  }

  // ----------------------------------------------------------
  // F. PRIORITY_CONFLICT — workspace-level overload
  // ----------------------------------------------------------
  const urgentTasks = openTasks.filter((t) => t.priority === "urgent");
  const urgentNoDate = urgentTasks.filter((t) => !t.due_at);
  const dueTodayCount = openTasks.filter((t) => {
    const due = asDate(t.due_at);
    return due !== null && due.toDateString() === now.toDateString();
  }).length;

  const conflictFactors: { label: string; value: string; points: number }[] = [];
  if (urgentTasks.length >= SIGNAL_CONSTANTS.URGENT_CONFLICT_MIN) {
    conflictFactors.push({ label: "Tâches urgentes simultanées", value: String(urgentTasks.length), points: SCORE_FACTORS.CONFLICT_OVERFLOW * urgentTasks.length });
  }
  if (urgentNoDate.length >= SIGNAL_CONSTANTS.URGENT_NO_DATE_MIN) {
    conflictFactors.push({ label: "Urgentes sans échéance", value: String(urgentNoDate.length), points: 8 });
  }
  if (dueTodayCount >= SIGNAL_CONSTANTS.TODAY_CONFLICT_MIN) {
    conflictFactors.push({ label: "Prévues aujourd'hui", value: String(dueTodayCount), points: SCORE_FACTORS.CONFLICT_OVERFLOW * dueTodayCount });
  }
  if (conflictFactors.length > 0) {
    const severity: ProactiveSeverity =
      urgentTasks.length >= SIGNAL_CONSTANTS.URGENT_CONFLICT_CRITICAL || dueTodayCount >= SIGNAL_CONSTANTS.TODAY_CONFLICT_CRITICAL
        ? "critical"
        : "warning";
    const breakdown: SignalScoreBreakdown[] = [
      { factor: "severity", points: SEVERITY_BASE[severity], detail: "conflit de priorités" },
      ...conflictFactors.map((factor) => ({ factor: factor.label, points: Math.min(factor.points, 15), detail: factor.value })),
    ];
    signals.push(
      scored(
        "PRIORITY_CONFLICT",
        severity,
        "PRIORITY_CONFLICT:workspace",
        "Trop de travail urgent en même temps",
        `Le workspace compte ${urgentTasks.length} tâche${urgentTasks.length > 1 ? "s" : ""} urgente${urgentTasks.length > 1 ? "s" : ""} et ${dueTodayCount} échéance${dueTodayCount > 1 ? "s" : ""} pour aujourd'hui. À vous de choisir ce qui passe en premier.`,
        conflictFactors.map((factor) => ({ label: factor.label, value: factor.value })),
        { type: "workspace", id: "workspace", label: "Workspace" },
        Math.max(urgentTasks.length, dueTodayCount),
        [
          navigateSignalAction("Voir les priorités", "/tasks", "navigate"),
          navigateSignalAction("Organiser ma journée", "/app/intelligence", "navigate"),
        ],
        now,
        { breakdown, detectedFrom: null }
      )
    );
  }

  // ----------------------------------------------------------
  // G. DEADLINE_RISK — project deadline hard to hold (proof-based)
  // ----------------------------------------------------------
  for (const project of snapshot.projects) {
    const due = asDate(project.due_date);
    if (!due) continue;
    const remaining = daysUntil(due, now);
    if (remaining < 0 || remaining > SIGNAL_CONSTANTS.DEADLINE_RISK_DAYS) continue;
    const pOpen = snapshot.tasks.filter((t) => t.project_id === project.id && isActiveTask(t));
    if (pOpen.length === 0) continue;
    const progress = Math.round(project.progress ?? 0);
    const openNeeded = Math.max(0, pOpen.length);
    const severity: ProactiveSeverity = remaining === 0 ? "critical" : remaining === 1 ? "warning" : "attention";
    const breakdown: SignalScoreBreakdown[] = [
      { factor: "severity", points: SEVERITY_BASE[severity], detail: `échéance dans ${remaining}j` },
      { factor: "deadline", points: remaining === 0 ? SCORE_FACTORS.DEADLINE_TODAY : remaining === 1 ? SCORE_FACTORS.DEADLINE_TOMORROW : SCORE_FACTORS.DEADLINE_2DAYS, detail: `${openNeeded} tâche(s) encore ouvertes` },
    ];
    signals.push(
      scored(
        "DEADLINE_RISK",
        severity,
        `DEADLINE_RISK:${project.id}`,
        `L'échéance de « ${project.name} » approche`,
        `L'échéance est dans ${remaining === 0 ? "0 jour (aujourd'hui)" : `${remaining} jour${remaining > 1 ? "s" : ""}`} et ${openNeeded} tâche${openNeeded > 1 ? "s" : ""} reste${openNeeded > 1 ? "nt" : ""} ouverte${progress > 0 ? ` (progression ${progress}%)` : ""}.`,
        [
          { label: "Échéance", value: remaining === 0 ? "aujourd'hui" : `dans ${remaining}j` },
          { label: "Tâches ouvertes", value: String(openNeeded) },
          ...(progress > 0 ? [{ label: "Progression", value: `${progress}%` }] : []),
        ],
        { type: "project", id: project.id, label: project.name },
        openNeeded,
        [
          navigateSignalAction("Ouvrir le projet", `/projects?focus=${project.id}`, "open_project"),
          mutateSignalAction("Créer une tâche de suivi", "create_task", { title: "Suivi échéance projet", projectId: project.id }),
        ],
        now,
        { breakdown, detectedFrom: project.due_date ?? null }
      )
    );
  }

  // ----------------------------------------------------------
  // H. GOAL_AT_RISK — only when the goal has real tracking data
  // ----------------------------------------------------------
  for (const goal of snapshot.goals) {
    if (goal.status === "completed" || goal.status === "cancelled") continue;
    const target = asDate(goal.target_date);
    const progress = Math.round(goal.progress ?? 0);
    const linkedProjects = snapshot.projects.filter((p) => p.goal_id === goal.id);
    const linkedOpen = linkedProjects.length > 0;
    const linkedTasks = snapshot.tasks.filter(
      (t) => linkedProjects.some((p) => p.id === t.project_id) && isActiveTask(t)
    );
    const linkedOverdue = linkedTasks.filter((t) => {
      const due = asDate(t.due_at);
      return due !== null && due.getTime() < now.getTime();
    }).length;
    const linkedBlocked = linkedTasks.filter((t) => t.status === "blocked").length;

    // Honesty rule: without a target date AND without linked-project
    // pressure, there is not enough data to claim the goal is at risk.
    const hasTarget = target !== null;
    if (!hasTarget && !linkedOpen) continue;

    const daysLeft = hasTarget ? daysUntil(target!, now) : null;
    const progressTooLow = hasTarget && daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && progress < 40;
    const deadlineNear = hasTarget && daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
    const projectPressure = linkedOverdue + linkedBlocked > 0;

    if (!progressTooLow && !deadlineNear && !projectPressure) continue;

    const severity: ProactiveSeverity =
      (hasTarget && daysLeft !== null && daysLeft <= 3) || projectPressure
        ? "warning"
        : "attention";

    const evidence: SignalEvidence[] = [];
    if (hasTarget && daysLeft !== null) {
      evidence.push({ label: "Échéance", value: daysLeft === 0 ? "aujourd'hui" : `dans ${daysLeft}j` });
    }
    evidence.push({ label: "Progression", value: `${progress}%` });
    if (linkedOpen) evidence.push({ label: "Projets liés", value: String(linkedProjects.length) });
    if (linkedOverdue > 0) evidence.push({ label: "Tâches en retard (projets liés)", value: String(linkedOverdue) });
    if (linkedBlocked > 0) evidence.push({ label: "Tâches bloquées (projets liés)", value: String(linkedBlocked) });

    const breakdown: SignalScoreBreakdown[] = [
      { factor: "severity", points: SEVERITY_BASE[severity], detail: "objectif en danger" },
      ...(progressTooLow ? [{ factor: "progress", points: 8, detail: `progression ${progress}%` }] : []),
      ...(deadlineNear && hasTarget && daysLeft !== null ? [{ factor: "deadline", points: daysLeft <= 1 ? SCORE_FACTORS.DEADLINE_TODAY : SCORE_FACTORS.DEADLINE_TOMORROW, detail: `échéance dans ${daysLeft}j` }] : []),
      ...(linkedOverdue > 0 ? [{ factor: "linked-overdue", points: 8, detail: `${linkedOverdue} tâche(s) en retard liée(s)` }] : []),
      ...(linkedBlocked > 0 ? [{ factor: "linked-blocked", points: 8, detail: `${linkedBlocked} tâche(s) bloquée(s) liée(s)` }] : []),
    ];

    signals.push(
      scored(
        "GOAL_AT_RISK",
        severity,
        `GOAL_AT_RISK:${goal.id}`,
        `L'objectif « ${goal.title} » est en danger`,
        progressTooLow || deadlineNear
          ? `L'objectif arrive à échéance${daysLeft !== null && daysLeft > 0 ? ` dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}` : daysLeft === 0 ? " aujourd'hui" : ""} avec une progression de ${progress}%.`
          : `${linkedOverdue + linkedBlocked} tâche(s) liée(s) ${linkedBlocked > 0 ? "bloquée(s)" : "en retard"} pèsent sur cet objectif.`,
        evidence,
        { type: "goal", id: goal.id, label: goal.title },
        linkedOpen ? linkedProjects.length : 1,
        [
          navigateSignalAction("Ouvrir les objectifs", "/goals", "navigate"),
          ...(linkedProjects.length > 0
            ? [navigateSignalAction("Voir les projets liés", "/projects", "open_project")]
            : []),
        ],
        now,
        { breakdown, detectedFrom: goal.target_date ?? goal.updated_at ?? null }
      )
    );
  }

  // ----------------------------------------------------------
  // I. POSITIVE_PROGRESS — real completions & velocity
  // ----------------------------------------------------------
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const twoWeeksAgo = now.getTime() - 14 * 86_400_000;
  const completedThisWeek = snapshot.tasks.filter((t) => {
    const c = asDate(t.completed_at);
    return c !== null && c.getTime() >= weekAgo;
  }).length;
  const completedPrevWeek = snapshot.tasks.filter((t) => {
    const c = asDate(t.completed_at);
    return c !== null && c.getTime() >= twoWeeksAgo && c.getTime() < weekAgo;
  }).length;
  const velocityUp = completedThisWeek > completedPrevWeek * SIGNAL_CONSTANTS.POSITIVE_VELOCITY_FACTOR && completedThisWeek >= 3;
  if (completedThisWeek >= SIGNAL_CONSTANTS.POSITIVE_COMPLETED_MIN || velocityUp) {
    const breakdown: SignalScoreBreakdown[] = [
      { factor: "severity", points: SEVERITY_BASE["info"], detail: "progression positive" },
      { factor: "impact", points: Math.min(completedThisWeek * SCORE_FACTORS.IMPACT_PER_ENTITY / 2, SCORE_FACTORS.IMPACT_CAP / 2), detail: `${completedThisWeek} tâches terminées cette semaine` },
      ...(completedPrevWeek > 0 ? [{ factor: "velocity", points: 8, detail: `${completedThisWeek} vs ${completedPrevWeek} la semaine précédente` }] : []),
    ];
    signals.push(
      scored(
        "POSITIVE_PROGRESS",
        "info",
        "POSITIVE_PROGRESS:workspace",
        "Bonne dynamique cette semaine",
        velocityUp
          ? `Vous avez terminé ${completedThisWeek} tâches cette semaine, contre ${completedPrevWeek} la semaine précédente.`
          : `${completedThisWeek} tâches ont été terminées cette semaine.`,
        [
          { label: "Terminées cette semaine", value: String(completedThisWeek) },
          ...(completedPrevWeek > 0 ? [{ label: "Semaine précédente", value: String(completedPrevWeek) }] : []),
        ],
        { type: "workspace", id: "workspace", label: "Workspace" },
        completedThisWeek,
        [navigateSignalAction("Voir l'activité", "/activity", "navigate")],
        now,
        { breakdown, detectedFrom: null }
      )
    );
  }

  // Deterministic order: score desc, then severity desc.
  return signals.sort((a, b) => b.score - a.score || severityRank(b.severity) - severityRank(a.severity));
}

// ============================================================
// DEDUPLICATION + COOLDOWN (pure — against persisted rows)
// ============================================================

export interface SignalMergeResult {
  /** Rows to insert (new fingerprints). */
  toInsert: StoredSignalRow[];
  /** Rows to update (severity/score/evidence changed). */
  toUpdate: { id: string; patch: Partial<StoredSignalRow> }[];
  /** Rows to mark resolved (fingerprint disappeared). */
  toResolve: { id: string }[];
  /** Active signals for display (new | seen | acted, after cooldown). */
  active: StoredSignalRow[];
}

function toRow(detected: DetectedSignal, id: string, now: Date): StoredSignalRow {
  return {
    id,
    fingerprint: detected.fingerprint,
    type: detected.type,
    severity: detected.severity,
    title: detected.title,
    summary: detected.summary,
    evidence: detected.evidence,
    scoreBreakdown: detected.scoreBreakdown,
    suggestedActions: detected.suggestedActions,
    entityType: detected.entity?.type ?? null,
    entityId: detected.entity?.id ?? null,
    entityLabel: detected.entity?.label ?? null,
    score: detected.score,
    confidence: detected.confidence,
    affectedCount: detected.affectedCount,
    status: "new",
    createdAt: now.toISOString(),
    seenAt: null,
    dismissedAt: null,
    resolvedAt: null,
  };
}

/**
 * Merges freshly detected signals with the persisted state:
 *  - same fingerprint + same/lower severity + seen → stays active
 *    (cooldown applies only to re-alerting, not to display)
 *  - same fingerprint + dismissed → reappears only after the cooldown
 *    or when the severity escalates
 *  - severity escalated → re-alert (status new, cooldowns reset)
 *  - fingerprint gone from detection → resolved (after a minimum
 *    lifetime, to avoid flicker)
 */
export function mergeSignalsWithState(
  detected: DetectedSignal[],
  stored: StoredSignalRow[],
  now: Date = new Date()
): SignalMergeResult {
  const detectedByFp = new Map(detected.map((signal) => [signal.fingerprint, signal]));
  const storedByFp = new Map(stored.map((row) => [row.fingerprint, row]));

  const toInsert: StoredSignalRow[] = [];
  const toUpdate: { id: string; patch: Partial<StoredSignalRow> }[] = [];
  const toResolve: { id: string }[] = [];
  const active: StoredSignalRow[] = [];

  for (const [fingerprint, detectedSignal] of detectedByFp) {
    if (detectedSignal.score < SIGNAL_CONSTANTS.PERSIST_MIN_SCORE) continue;
    const existing = storedByFp.get(fingerprint);

    if (!existing) {
      const row = toRow(detectedSignal, `new-${fingerprint}`, now);
      toInsert.push(row);
      active.push(row);
      continue;
    }

    const escalated = severityRank(detectedSignal.severity) > severityRank(existing.severity);

    if (existing.status === "dismissed" && !escalated) {
      const dismissedAt = existing.dismissedAt ? new Date(existing.dismissedAt).getTime() : 0;
      const cooldownPassed = now.getTime() - dismissedAt >= SIGNAL_CONSTANTS.COOLDOWN_DISMISSED_MS;
      if (!cooldownPassed) continue; // stay silent — problem still exists but no spam
      // cooldown passed → re-alert
      toUpdate.push({
        id: existing.id,
        patch: {
          ...refreshRowFields(existing, detectedSignal),
          status: "new",
          dismissedAt: null,
        },
      });
      active.push({ ...existing, ...refreshRowFields(existing, detectedSignal), status: "new", dismissedAt: null });
      continue;
    }

    if (escalated) {
      // Aggravation → re-alert immediately.
      toUpdate.push({
        id: existing.id,
        patch: {
          ...refreshRowFields(existing, detectedSignal),
          status: "new",
          dismissedAt: null,
          seenAt: null,
        },
      });
      active.push({ ...existing, ...refreshRowFields(existing, detectedSignal), status: "new", dismissedAt: null, seenAt: null });
      continue;
    }

    // Same or lower severity: keep the row's lifecycle, refresh facts.
    const refreshed = { ...existing, ...refreshRowFields(existing, detectedSignal) };
    if (
      refreshed.severity !== existing.severity ||
      refreshed.score !== existing.score ||
      JSON.stringify(refreshed.evidence) !== JSON.stringify(existing.evidence) ||
      refreshed.title !== existing.title ||
      refreshed.summary !== existing.summary
    ) {
      toUpdate.push({ id: existing.id, patch: refreshRowFields(existing, detectedSignal) });
    }
    if (refreshed.status === "new" || refreshed.status === "seen" || refreshed.status === "acted") {
      active.push(refreshed);
    }
  }

  // Fingerprints that vanished → resolved (problem actually gone),
  // unless the signal is younger than the minimum lifetime.
  for (const row of stored) {
    if (row.status === "resolved" || row.status === "dismissed") continue;
    if (detectedByFp.has(row.fingerprint)) continue;
    const age = now.getTime() - new Date(row.createdAt).getTime();
    if (age < SIGNAL_CONSTANTS.MIN_SIGNAL_LIFETIME_MS) continue;
    toResolve.push({ id: row.id });
  }

  return { toInsert, toUpdate, toResolve, active };
}

/** Refreshes the factual fields of a stored row from a detection. */
function refreshRowFields(_existing: StoredSignalRow, detected: DetectedSignal): Partial<StoredSignalRow> {
  return {
    type: detected.type,
    severity: detected.severity,
    score: detected.score,
    scoreBreakdown: detected.scoreBreakdown,
    title: detected.title,
    summary: detected.summary,
    evidence: detected.evidence,
    suggestedActions: detected.suggestedActions,
    confidence: detected.confidence,
    affectedCount: detected.affectedCount,
  };
}

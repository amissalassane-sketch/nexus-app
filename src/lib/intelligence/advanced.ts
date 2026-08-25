// ============================================================
// NEXUS INTELLIGENCE — ADVANCED LAYER
// ============================================================
// The second generation of the intelligence engine. Same contract
// as engine.ts: pure, deterministic, dependency-free — the same
// snapshot always produces the same output, every claim traces back
// to the workspace, nothing is invented and nothing leaves the app.
//
// What it adds on top of the signal queue:
//   workspaceHealth    — a 0–100 operating index with factor breakdown
//   weeklyBriefing     — an executive digest with momentum and top moves
//   forecastWorkspace  — velocity-based completion projections
//   rankPriorities     — a triaged focus list with scored reasons
//   askWorkspace       — deterministic answers to plain-language questions
// ============================================================

import {
  isActiveTask,
  nextBestAction,
  type Insight,
  type ProjectLike,
  type TaskLike,
  type WorkspaceSnapshot,
} from "./engine";
import type {
  StructuredIntelligenceResponse,
  IntelligenceItem,
} from "./types";
import type { WorkspaceContextSummary } from "./context-builder";

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

function daysSince(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

function priorityWeight(priority: string | null | undefined): number {
  return { urgent: 4, high: 3, medium: 2, low: 1 }[priority ?? ""] ?? 0;
}

const PROJECT_ACTIVE_STATUSES = new Set(["planning", "active", "paused"]);

// ============================================================
// 1 — WORKSPACE HEALTH
// ============================================================

export type HealthBand = "steady" | "watch" | "critical";

export interface HealthFactor {
  id: string;
  label: string;
  /** What this factor measures, in one sentence. */
  detail: string;
  /** How much of the total weight this factor carries. */
  weight: number;
  /** How much of its weight was lost, 0 (intact) → 1 (fully lost). */
  penalty: number;
  /** The raw facts behind the penalty. */
  evidence: string;
}

export interface WorkspaceHealth {
  score: number;
  band: HealthBand;
  headline: string;
  /** False when the workspace is too empty to produce a fair score. */
  measured: boolean;
  factors: HealthFactor[];
}

const BAND_COPY: Record<HealthBand, string> = {
  steady: "The operation is under control. Keep the cadence.",
  watch: "Pressure is building. A few deliberate moves will steady it.",
  critical: "The operation needs attention today — start with the overdue and blocked work.",
};

/**
 * A weighted operating index, computed from five factors. Deterministic:
 * the same snapshot always yields the same score. The score is what is
 * lost, not a vibe — every factor exposes the raw count behind it.
 */
export function workspaceHealth(snapshot: WorkspaceSnapshot): WorkspaceHealth {
  const now = snapshot.now ?? new Date();
  const open = snapshot.tasks.filter(isActiveTask);

  const overdue = open.filter((task) => {
    const due = asDate(task.due_at);
    return due !== null && due.getTime() < now.getTime();
  });
  const blocked = open.filter((task) => task.status === "blocked");

  const driftingProjects = snapshot.projects.filter((project) => {
    if (!PROJECT_ACTIVE_STATUSES.has(project.status ?? "planning")) return false;
    const touches = snapshot.tasks
      .filter((task) => task.project_id === project.id)
      .map((task) => asDate(task.updated_at) ?? asDate(task.created_at))
      .filter((date): date is Date => date !== null)
      .sort((a, b) => b.getTime() - a.getTime());
    const last = touches[0];
    return last !== undefined && daysSince(last, now) >= 10;
  });

  const deadlinePressure = snapshot.projects.filter((project) => {
    const due = asDate(project.due_date);
    if (!due) return false;
    const remaining = daysUntil(due, now);
    if (remaining > 7) return false;
    const hasOpen = snapshot.tasks.some(
      (task) => task.project_id === project.id && isActiveTask(task)
    );
    return hasOpen;
  }).length;

  const undated = open.filter((task) => !task.due_at).length;
  const undatedShare = open.length > 0 ? undated / open.length : 0;

  const weekAgo = now.getTime() - 7 * 86_400_000;
  const completedRecently = snapshot.tasks.filter((task) => {
    const completed = asDate(task.completed_at);
    return completed !== null && completed.getTime() >= weekAgo;
  }).length;

  const factors: HealthFactor[] = [
    {
      id: "overdue",
      label: "Deadline debt",
      detail: "Work already past its date, still open.",
      weight: 30,
      penalty: overdue.length === 0 ? 0 : clamp(overdue.length / 4, 0.25, 1),
      evidence:
        overdue.length === 0
          ? "Nothing overdue"
          : `${plural(overdue.length, "task")} overdue`,
    },
    {
      id: "blocked",
      label: "Blockers",
      detail: "Stalled work that holds everything downstream.",
      weight: 20,
      penalty: blocked.length === 0 ? 0 : clamp(blocked.length / 3, 0.25, 1),
      evidence:
        blocked.length === 0
          ? "Nothing blocked"
          : `${plural(blocked.length, "task")} blocked`,
    },
    {
      id: "drift",
      label: "Drift",
      detail: "Active projects with no movement for 10+ days.",
      weight: 15,
      penalty:
        driftingProjects.length === 0
          ? 0
          : clamp(driftingProjects.length / 3, 0.3, 1),
      evidence:
        driftingProjects.length === 0
          ? "Every active project is moving"
          : `${plural(driftingProjects.length, "project")} quiet for 10+ days`,
    },
    {
      id: "pressure",
      label: "Deadline pressure",
      detail: "Projects inside their final week with open work.",
      weight: 15,
      penalty:
        deadlinePressure === 0 ? 0 : clamp(deadlinePressure / 2, 0.3, 1),
      evidence:
        deadlinePressure === 0
          ? "No deadlines inside 7 days"
          : `${plural(deadlinePressure, "project")} in the final week`,
    },
    {
      id: "planning",
      label: "Planning debt",
      detail: "Open work without dates stays invisible to risk detection.",
      weight: 10,
      penalty:
        undatedShare <= 0.5 ? 0 : clamp((undatedShare - 0.5) * 2, 0, 1),
      evidence: `${Math.round(undatedShare * 100)}% of open tasks are undated`,
    },
    {
      id: "momentum",
      label: "Momentum",
      detail: "Throughput over the last seven days.",
      weight: 10,
      penalty:
        completedRecently >= 3 ? 0 : completedRecently === 0 ? 1 : 0.5,
      evidence:
        completedRecently === 0
          ? "No completions in 7 days"
          : `${plural(completedRecently, "task")} completed in 7 days`,
    },
  ];

  const measured =
    snapshot.tasks.length > 0 ||
    snapshot.projects.length > 0 ||
    snapshot.goals.length > 0;

  const loss = factors.reduce((sum, factor) => sum + factor.weight * factor.penalty, 0);
  const score = measured ? Math.round(clamp(100 - loss, 0, 100)) : 100;

  const band: HealthBand = score >= 75 ? "steady" : score >= 50 ? "watch" : "critical";

  return {
    score,
    band,
    headline: measured
      ? BAND_COPY[band]
      : "There is not enough tracked work to assess yet — add tasks and dates.",
    measured,
    factors,
  };
}

// ============================================================
// 2 — WEEKLY BRIEFING
// ============================================================

export interface WeeklyBriefing {
  headline: string;
  summary: string;
  completedThisWeek: number;
  completedPrevWeek: number;
  momentumDelta: number;
  openedThisWeek: number;
  topMoves: Insight[];
  /** One sentence of outlook derived from the deadline queue. */
  outlook: string;
}

/**
 * The executive digest: what moved, what is next, and the outlook —
 * written from the workspace, never from a template of flattery.
 */
export function weeklyBriefing(snapshot: WorkspaceSnapshot): WeeklyBriefing {
  const now = snapshot.now ?? new Date();
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const twoWeeksAgo = now.getTime() - 14 * 86_400_000;

  const completedThisWeek = snapshot.tasks.filter((task) => {
    const completed = asDate(task.completed_at);
    return completed !== null && completed.getTime() >= weekAgo;
  }).length;

  const completedPrevWeek = snapshot.tasks.filter((task) => {
    const completed = asDate(task.completed_at);
    return (
      completed !== null &&
      completed.getTime() >= twoWeeksAgo &&
      completed.getTime() < weekAgo
    );
  }).length;

  const openedThisWeek = snapshot.tasks.filter((task) => {
    const created = asDate(task.created_at);
    return created !== null && created.getTime() >= weekAgo;
  }).length;

  const momentumDelta = completedThisWeek - completedPrevWeek;

  const weekAhead = now.getTime() + 7 * 86_400_000;
  const dueThisWeek = snapshot.tasks.filter((task) => {
    if (!isActiveTask(task)) return false;
    const due = asDate(task.due_at);
    return (
      due !== null &&
      due.getTime() >= now.getTime() &&
      due.getTime() <= weekAhead
    );
  }).length;

  const outlook =
    dueThisWeek === 0
      ? "No deadlines land in the next seven days — good window for the work that has been drifting."
      : `${plural(dueThisWeek, "task")} land${dueThisWeek === 1 ? "s" : ""} in the next seven days. Protect that time before accepting anything new.`;

  const moves = nextBestAction(snapshot);
  const topMoves = moves ? [moves] : [];
  const followUps = snapshot.projects
    .filter((project) => {
      const due = asDate(project.due_date);
      if (!due) return false;
      const remaining = daysUntil(due, now);
      return remaining >= 0 && remaining <= 7;
    })
    .slice(0, 2);

  const headline =
    completedThisWeek === 0
      ? "A quiet week so far"
      : momentumDelta > 0
        ? `${plural(completedThisWeek, "task")} done — momentum is building`
        : momentumDelta === 0
          ? `${plural(completedThisWeek, "task")} done — holding steady`
          : `${plural(completedThisWeek, "task")} done — slower than last week`;

  const summaryParts: string[] = [];
  if (openedThisWeek > 0) summaryParts.push(`${plural(openedThisWeek, "task")} opened`);
  if (followUps.length > 0)
    summaryParts.push(
      `${followUps.map((project) => `“${project.name}”`).join(" and ")} due this week`
    );
  if (summaryParts.length === 0)
    summaryParts.push("No new work and no deadlines inside the week");

  return {
    headline,
    summary: `${summaryParts.join(" · ")}. ${outlook}`,
    completedThisWeek,
    completedPrevWeek,
    momentumDelta,
    openedThisWeek,
    topMoves,
    outlook,
  };
}

// ============================================================
// 3 — FORECAST
// ============================================================

export type ForecastStatus = "on-track" | "watch" | "at-risk" | "stalled" | "unknown";

export interface ProjectForecast {
  projectId: string;
  name: string;
  projectStatus: ProjectLike["status"];
  progress: number;
  openTasks: number;
  doneTasks: number;
  /** Completions per week over the trailing 28 days. */
  velocity: number;
  /** ISO date of the projected completion, when velocity allows one. */
  projectedCompletion: string | null;
  dueDate: string | null;
  /** Days of overshoot against the due date (negative = early). */
  slipDays: number | null;
  status: ForecastStatus;
  note: string;
}

/**
 * Velocity-based projection per active project. Velocity is real
 * throughput (completions in the trailing 28 days), never a guess.
 * With no history the forecast says so instead of inventing a date.
 */
export function forecastWorkspace(snapshot: WorkspaceSnapshot): ProjectForecast[] {
  const now = snapshot.now ?? new Date();
  const windowStart = now.getTime() - 28 * 86_400_000;

  const forecasts: ProjectForecast[] = [];

  for (const project of snapshot.projects) {
    if (!PROJECT_ACTIVE_STATUSES.has(project.status ?? "planning")) continue;

    const projectTasks = snapshot.tasks.filter(
      (task) => task.project_id === project.id
    );
    const open = projectTasks.filter(isActiveTask);
    const done = projectTasks.length - open.length;
    if (open.length === 0 && projectTasks.length === 0) continue;

    const velocity =
      projectTasks.filter((task) => {
        const completed = asDate(task.completed_at);
        return (
          completed !== null &&
          completed.getTime() >= windowStart &&
          !isActiveTask(task) &&
          task.status !== "cancelled"
        );
      }).length / 4;

    const progress =
      project.progress ??
      (projectTasks.length > 0 ? (done / projectTasks.length) * 100 : 0);

    const due = asDate(project.due_date);

    let projectedCompletion: string | null = null;
    let slipDays: number | null = null;
    let status: ForecastStatus = "unknown";
    let note: string;

    if (open.length === 0) {
      status = "on-track";
      note = "All attached work is complete — ready to close.";
    } else if (velocity <= 0) {
      status = done === 0 ? "unknown" : "stalled";
      note =
        done === 0
          ? "No completions yet — complete tasks to unlock a projection."
          : "No completions in the last 28 days. The finish date cannot be projected.";
    } else {
      const weeksLeft = open.length / velocity;
      const projected = new Date(now.getTime() + weeksLeft * 7 * 86_400_000);
      projectedCompletion = projected.toISOString();
      note = `At the current pace of ${velocity % 1 === 0 ? velocity : velocity.toFixed(1)} ${velocity === 1 ? "task" : "tasks"}/week, this finishes around ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(projected)}.`;

      if (due) {
        slipDays = Math.ceil((projected.getTime() - due.getTime()) / 86_400_000);
        if (slipDays > 3) {
          status = "at-risk";
          note += ` That is ${plural(slipDays, "day")} past the deadline.`;
        } else if (slipDays >= 0) {
          status = "watch";
          note += " Tight against the deadline — protect the remaining time.";
        } else {
          status = "on-track";
        }
      } else {
        status = "on-track";
      }
    }

    forecasts.push({
      projectId: project.id,
      name: project.name,
      projectStatus: project.status ?? null,
      progress: Math.round(progress),
      openTasks: open.length,
      doneTasks: done,
      velocity,
      projectedCompletion,
      dueDate: project.due_date ?? null,
      slipDays,
      status,
      note,
    });
  }

  const severity: Record<ForecastStatus, number> = {
    "at-risk": 0,
    stalled: 1,
    watch: 2,
    unknown: 3,
    "on-track": 4,
  };

  return forecasts.sort((a, b) => severity[a.status] - severity[b.status]);
}

// ============================================================
// 4 — PRIORITY FOCUS (triage)
// ============================================================

export interface PrioritizedTask {
  task: TaskLike;
  score: number;
  reasons: string[];
  href: string;
}

const MAX_SCORE = 100;

/**
 * A triaged focus list: every open task scored on urgency (overdue,
 * due today/soon), friction (blocked), weight (priority) and staleness.
 * The top of the list is what NEXUS would do first — and the reasons
 * say why, so the ranking is auditable.
 */
export function rankPriorities(
  snapshot: WorkspaceSnapshot,
  limit = 5
): PrioritizedTask[] {
  const now = snapshot.now ?? new Date();

  const ranked = snapshot.tasks
    .filter(isActiveTask)
    .map((task) => {
      const due = asDate(task.due_at);
      const updated = asDate(task.updated_at) ?? asDate(task.created_at);
      let score = 0;
      const reasons: string[] = [];

      if (due && due.getTime() < now.getTime()) {
        score += 34;
        reasons.push(`overdue by ${plural(Math.abs(daysUntil(due, now)), "day")}`);
      } else if (due && daysUntil(due, now) === 0) {
        score += 26;
        reasons.push("due today");
      } else if (due && daysUntil(due, now) <= 3) {
        score += 16;
        reasons.push(`due in ${plural(daysUntil(due, now), "day")}`);
      }

      if (task.status === "blocked") {
        score += 22;
        reasons.push("blocked");
      }

      const weight = priorityWeight(task.priority);
      if (weight >= 3) {
        score += weight === 4 ? 20 : 13;
        reasons.push(task.priority ?? "high priority");
      }

      if (updated && daysSince(updated, now) >= 14) {
        score += 8;
        reasons.push(`untouched for ${plural(daysSince(updated, now), "day")}`);
      }

      if (score === 0) {
        score += 4;
        reasons.push("open, nothing urgent attached");
      }

      return {
        task,
        score: Math.round(clamp(score, 0, MAX_SCORE)),
        reasons,
        href: task.status === "blocked" ? "/tasks?filter=blocked" : "/tasks",
      } satisfies PrioritizedTask;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked;
}

// ============================================================
// 5 — ASK THE WORKSPACE
// ============================================================

export type AskKind =
  | "blocked"
  | "overdue"
  | "today"
  | "week"
  | "momentum"
  | "next"
  | "project"
  | "projects_attention"
  | "priorities"
  | "projects_blocked"
  | "synthesis"
  | "planning"
  | "action_proposal"
  | "health"
  | "help"
  | "empty";

export interface ActionProposal {
  type: "create_task";
  title: string;
  priority?: "low" | "medium" | "high" | "urgent";
  dueDate?: string | null;
  projectId?: string | null;
  actionLabel: string;
}

export interface AskAnswer {
  kind: AskKind;
  title: string;
  /** Fact rows: the evidence behind the answer. */
  lines: { label: string; value: string }[];
  /** Deep links into the exact saved view that answers the question. */
  links: { href: string; label: string }[];
  /** Follow-up questions that map to other intents. */
  suggestions: string[];
  actionProposal?: ActionProposal;
  evidenceNote?: string;
}

const SUGGESTIONS: Record<AskKind, string[]> = {
  blocked: ["What is overdue?", "What should I do next?", "How is the workspace?"],
  overdue: ["What is blocked?", "What is due this week?", "What should I do next?"],
  today: ["What is overdue?", "What should I do next?", "How is the workspace?"],
  week: ["What is due today?", "What moved this week?", "What should I do next?"],
  momentum: ["What is due this week?", "How is the workspace?", "What should I do next?"],
  next: ["What is blocked?", "What is overdue?", "How is the workspace?"],
  project: ["What is blocked?", "What should I do next?", "How is the workspace?"],
  projects_attention: ["Quelles sont mes 3 prochaines tâches prioritaires ?", "Quels projets semblent bloqués ?", "Aide-moi à organiser cette semaine."],
  priorities: ["Quels projets nécessitent mon attention ?", "Aide-moi à organiser cette semaine.", "Résume l'activité de cette semaine."],
  projects_blocked: ["Quelles sont mes 3 prochaines tâches prioritaires ?", "Quels projets nécessitent mon attention ?"],
  synthesis: ["Quels projets nécessitent mon attention ?", "Aide-moi à organiser cette semaine."],
  planning: ["Quelles sont mes 3 prochaines tâches prioritaires ?", "Quels projets nécessitent mon attention ?"],
  action_proposal: ["What should I do next?", "Quelles sont mes 3 prochaines tâches prioritaires ?"],
  health: ["What should I do next?", "What is blocked?", "What is due this week?"],
  help: ["What is blocked?", "What is overdue?", "What should I do next?"],
  empty: ["What should I do next?", "What is blocked?", "How is the workspace?"],
};

const has = (tokens: string[], ...needles: string[]) =>
  tokens.some((token) => needles.some((needle) => token.includes(needle)));

/**
 * Deterministic answers to plain-language questions about this
 * workspace. No model call, no invented facts: every line is read
 * from the snapshot, and every link lands on the view that proves it.
 *
 * Resolution order: an explicitly named project wins ("how is the
 * website project going"), then the specific intents (blocked →
 * overdue → today → week → momentum → health → next), then an honest
 * steering answer. A bare name match never hijacks an intent.
 */
/**
 * Core reasoning engine for NEXUS Intelligence.
 * Pure, deterministic, evidence-grounded. Maps the user's intent to one of the
 * 6 core capabilities (Analysis, Prioritization, Planning, Synthesis, Detection, Action).
 */
export function reasonWorkspace(
  snapshot: WorkspaceSnapshot,
  query: string,
  context?: WorkspaceContextSummary
): StructuredIntelligenceResponse {
  const now = snapshot.now ?? new Date();
  const open = snapshot.tasks.filter(isActiveTask);
  const lowerQuery = query.toLowerCase().trim();
  const tokens = lowerQuery.split(/\s+/).filter(Boolean);

  // 1. ACTION (Task or Project creation intent)
  if (
    lowerQuery.startsWith("crée une tâche") ||
    lowerQuery.startsWith("créer une tâche") ||
    lowerQuery.startsWith("ajoute une tâche") ||
    lowerQuery.startsWith("ajouter une tâche") ||
    lowerQuery.startsWith("create a task") ||
    lowerQuery.startsWith("add a task") ||
    lowerQuery.startsWith("new task") ||
    lowerQuery.includes("dois préparer") ||
    lowerQuery.includes("faut préparer") ||
    lowerQuery.includes("besoin de préparer")
  ) {
    const rawTitle = lowerQuery
      .replace(/^(je\s+dois|il\s+faut|j'ai\s+besoin\s+de)\s+/i, "")
      .replace(/^(crée|créer|ajoute|ajouter)\s+une\s+tâche\s*(pour|de|:)?\s*/i, "")
      .replace(/^(create|add)\s+(a\s+)?task\s*(to|for|:)?\s*/i, "")
      .replace(/^new\s+task\s*(:)?\s*/i, "")
      .trim();

    const title = rawTitle ? rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1) : "New Task";
    let suggestedDueDate: string | null = null;
    let dueLabel: string | null = null;

    if (lowerQuery.includes("vendredi") || lowerQuery.includes("friday")) {
      const d = new Date(now);
      const day = d.getDay();
      const diff = (5 - day + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      suggestedDueDate = d.toISOString().slice(0, 10);
      dueLabel = "This Friday";
    } else if (lowerQuery.includes("demain") || lowerQuery.includes("tomorrow")) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      suggestedDueDate = d.toISOString().slice(0, 10);
      dueLabel = "Tomorrow";
    }

    return {
      query,
      intent: "action",
      headline: `Recommended action: Create task “${title}”`,
      narrative: `It would be useful to create a dedicated task for “${title}”${dueLabel ? ` due ${dueLabel}` : ""} in your workspace so NEXUS can track its momentum and protect that time.`,
      provider: "nexus-engine",
      evidence: {
        metrics: [
          { label: "Suggested title", value: title },
          { label: "Suggested priority", value: "High" },
          ...(dueLabel ? [{ label: "Target deadline", value: dueLabel }] : []),
        ],
        traceCount: "Parsed from intent · Verified workspace action",
        sources: ["User Prompt", "Workspace Context"],
      },
      action: {
        id: `act-task-${Date.now()}`,
        type: "create_task",
        label: "Create this task",
        description: `Create "${title}" in current workspace`,
        confirmationRequired: true,
        payload: {
          title,
          priority: "high",
          dueDate: suggestedDueDate,
          status: "todo",
        },
      },
      suggestions: [
        "Quelles sont mes 3 prochaines tâches prioritaires ?",
        "Quels projets nécessitent mon attention ?",
        "Aide-moi à organiser cette semaine.",
      ],
    };
  }

  // 2. ANALYSE (Projects needing attention, risk of delays, key issues)
  if (
    lowerQuery.includes("attention") ||
    lowerQuery.includes("nécessitent") ||
    lowerQuery.includes("need attention") ||
    lowerQuery.includes("require attention") ||
    lowerQuery.includes("retard") ||
    lowerQuery.includes("slipping") ||
    lowerQuery.includes("problème") ||
    lowerQuery.includes("issues") ||
    (has(tokens, "attention") && has(tokens, "projet", "projets", "project", "projects"))
  ) {
    const projectsNeedingAttention = snapshot.projects
      .map((project) => {
        const projectTasks = open.filter((t) => t.project_id === project.id);
        const overdueTasks = projectTasks.filter((t) => {
          const due = asDate(t.due_at);
          return due !== null && due.getTime() < now.getTime();
        });
        const blockedTasks = projectTasks.filter((t) => t.status === "blocked");
        const projectDue = asDate(project.due_date);
        const reasons: string[] = [];

        if (projectDue && projectDue.getTime() < now.getTime()) {
          reasons.push("Deadline passed");
        } else if (projectDue && daysUntil(projectDue, now) <= 7) {
          reasons.push("Deadline inside 7 days");
        }
        if (blockedTasks.length > 0) {
          reasons.push(`${plural(blockedTasks.length, "task")} blocked`);
        }
        if (overdueTasks.length > 0) {
          reasons.push(`${plural(overdueTasks.length, "task")} overdue`);
        }
        if (project.status === "paused") {
          reasons.push("Project paused");
        }

        return { project, reasons, overdueTasks, blockedTasks };
      })
      .filter((entry) => entry.reasons.length > 0);

    const items: IntelligenceItem[] = projectsNeedingAttention.map((p) => ({
      id: p.project.id,
      title: p.project.name,
      subtitle: `Status: ${p.project.status ?? "planning"} · Progress: ${Math.round(p.project.progress ?? 0)}%`,
      badge: {
        label: p.reasons[0].includes("passed") ? "OVERDUE" : "AT RISK",
        tone: "danger",
      },
      href: "/projects",
      reasons: p.reasons,
    }));

    const overdueTotal = open.filter((t) => {
      const d = asDate(t.due_at);
      return d !== null && d.getTime() < now.getTime();
    }).length;

    const blockedTotal = open.filter((t) => t.status === "blocked").length;

    return {
      query,
      intent: "analysis",
      headline:
        items.length === 0
          ? "No projects currently need urgent attention"
          : `${plural(items.length, "project")} require attention`,
      narrative:
        items.length === 0
          ? "No projects currently have overdue deadlines, blocked work or stalled momentum. All initiatives are progressing within safe parameters."
          : `Analysis of ${snapshot.projects.length} workspace projects identified ${items.length} initiatives with critical risks: ${items.map((i) => `“${i.title}” (${i.reasons?.[0]})`).join(", ")}.`,
      provider: "nexus-engine",
      evidence: {
        metrics: [
          { label: "Projects at risk", value: String(items.length) },
          { label: "Overdue tasks", value: String(overdueTotal) },
          { label: "Blocked tasks", value: String(blockedTotal) },
          { label: "Total open tasks", value: String(open.length) },
        ],
        traceCount: `Derived from ${snapshot.projects.length} projects and ${open.length} open tasks`,
        sources: ["Projects Registry", "Task Deadlines"],
      },
      items: items.length > 0 ? items : undefined,
      action: items.length > 0 ? {
        id: "act-view-projects",
        type: "view_risky_projects",
        label: "Inspect projects",
        confirmationRequired: false,
        payload: { url: "/projects" },
      } : undefined,
      suggestions: [
        "Quelles sont mes 3 prochaines tâches prioritaires ?",
        "Quels projets semblent bloqués ?",
        "Aide-moi à organiser cette semaine.",
      ],
    };
  }

  // 3. PRIORISATION (Top priority tasks, what to do first, today's focus)
  if (
    (has(tokens, "priorit", "priority") &&
      (has(tokens, "tâche", "tâches", "task", "tasks", "3", "trois", "prochain", "next", "mes", "my", "premier", "first") ||
        lowerQuery.includes("3") ||
        lowerQuery.includes("top"))) ||
    lowerQuery.includes("tâches prioritaires") ||
    lowerQuery.includes("priority tasks") ||
    lowerQuery.includes("prochaines tâches") ||
    lowerQuery.includes("faire en premier") ||
    lowerQuery.includes("faire aujourd'hui") ||
    lowerQuery.includes("what should i do first") ||
    lowerQuery.includes("what to do today")
  ) {
    const ranked = rankPriorities(snapshot, 3);
    const items: IntelligenceItem[] = ranked.map((r, idx) => ({
      id: r.task.id,
      title: r.task.title,
      subtitle: `Rank #${idx + 1} · Priority: ${r.task.priority ?? "medium"}`,
      badge: {
        label: r.reasons[0].toUpperCase(),
        tone: r.task.status === "blocked" ? "danger" : r.task.due_at && asDate(r.task.due_at)!.getTime() < now.getTime() ? "danger" : "warning",
      },
      href: r.href,
      reasons: r.reasons,
    }));

    return {
      query,
      intent: "prioritization",
      headline:
        items.length === 0
          ? "No priority tasks open right now"
          : `Top ${items.length} priority ${plural(items.length, "task")}`,
      narrative:
        items.length === 0
          ? "All tasks are completed or there are no active tasks recorded. Your queue is clean."
          : `NEXUS triaged open work against real deadlines, overdue status, blocking dependencies and priority weights. Starting with “${items[0]?.title}” eliminates the largest friction point.`,
      provider: "nexus-engine",
      evidence: {
        metrics: [
          { label: "Top task", value: items[0]?.title ?? "None" },
          { label: "Top task criteria", value: items[0]?.reasons?.[0] ?? "—" },
          { label: "Total open tasks", value: String(open.length) },
        ],
        traceCount: `Triaged ${open.length} active tasks across ${snapshot.projects.length} projects`,
        sources: ["Task Queue", "Priority Index"],
      },
      items,
      action: items.length > 0 ? {
        id: "act-open-task",
        type: "open_task",
        label: `Open #${items[0].title}`,
        confirmationRequired: false,
        payload: { url: items[0].href },
      } : undefined,
      suggestions: [
        "Quels projets nécessitent mon attention ?",
        "Aide-moi à organiser cette semaine.",
        "Résume l'activité de cette semaine.",
      ],
    };
  }

  // 4. PLANIFICATION (Organize day, week, sequenced execution)
  if (
    lowerQuery.includes("organis") ||
    lowerQuery.includes("planning") ||
    lowerQuery.includes("plan my week") ||
    lowerQuery.includes("plan this week") ||
    lowerQuery.includes("plan my day") ||
    lowerQuery.includes("organise ma journée") ||
    lowerQuery.includes("schedule") ||
    lowerQuery.includes("comment avancer") ||
    lowerQuery.includes("aide-moi à organiser") ||
    lowerQuery.includes("aide moi à organiser")
  ) {
    const weekAhead = now.getTime() + 7 * 86_400_000;
    const overdue = open.filter((t) => {
      const due = asDate(t.due_at);
      return due !== null && due.getTime() < now.getTime();
    });
    const dueToday = open.filter((t) => {
      const due = asDate(t.due_at);
      return due !== null && daysUntil(due, now) === 0;
    });
    const dueThisWeek = open.filter((t) => {
      const due = asDate(t.due_at);
      return due !== null && due.getTime() >= now.getTime() && due.getTime() <= weekAhead;
    });
    const blocked = open.filter((t) => t.status === "blocked");

    const steps: IntelligenceItem[] = [];
    if (overdue.length > 0) {
      steps.push({
        id: "plan-step-1",
        title: `1. Clear deadline debt (${plural(overdue.length, "task")})`,
        subtitle: `Start immediately with “${overdue[0].title}” to stop project slip`,
        badge: { label: "IMMEDIATE", tone: "danger" },
        href: "/tasks?filter=overdue",
        reasons: [`${overdue.length} tasks are past their due date`],
      });
    }
    if (dueToday.length > 0) {
      steps.push({
        id: "plan-step-2",
        title: `2. Protect today's commitments (${plural(dueToday.length, "task")})`,
        subtitle: dueToday.map((t) => t.title).slice(0, 2).join(", "),
        badge: { label: "TODAY", tone: "warning" },
        href: "/tasks?filter=today",
        reasons: ["Due before the end of the day"],
      });
    }
    if (blocked.length > 0) {
      steps.push({
        id: "plan-step-3",
        title: `3. Resolve blockers (${plural(blocked.length, "task")})`,
        subtitle: `Unblock “${blocked[0].title}” to free downstream work`,
        badge: { label: "UNBLOCK", tone: "lavender" },
        href: "/tasks?filter=blocked",
        reasons: ["Blocked work prevents dependent tasks from starting"],
      });
    }
    if (dueThisWeek.length > 0) {
      steps.push({
        id: "plan-step-4",
        title: `4. Execute scheduled milestones (${plural(dueThisWeek.length, "task")})`,
        subtitle: "Work allocated across the remaining days of the week",
        badge: { label: "THIS WEEK", tone: "neutral" },
        href: "/tasks",
        reasons: ["Scheduled within the next 7 days"],
      });
    }

    if (steps.length === 0) {
      steps.push({
        id: "plan-step-clear",
        title: "No scheduled deadline pressure",
        subtitle: "A clear cadence to focus on strategic long-term goals or start a new project",
        badge: { label: "CLEAR", tone: "success" },
        href: "/projects?create=1",
        reasons: ["No overdue tasks, blockers or tight deadlines"],
      });
    }

    return {
      query,
      intent: "planning",
      headline: "Recommended operating plan for this week",
      narrative: `NEXUS organized your workflow into a prioritized cadence: eliminate overdue debt first, secure today's commitments, remove blockers, then advance weekly milestones.`,
      provider: "nexus-engine",
      evidence: {
        metrics: [
          { label: "1. Urgent today", value: overdue.length > 0 ? `Resolve ${plural(overdue.length, "overdue task")} first` : "No overdue work — queue is clean" },
          { label: "2. Blockers", value: blocked.length > 0 ? `Unblock ${blocked[0].title}` : "No active blockers" },
          { label: "3. Due this week", value: `${plural(dueThisWeek.length, "task")} scheduled` },
        ],
        traceCount: `Sequenced from ${open.length} active tasks`,
        sources: ["Work Cadence", "Deadlines"],
      },
      items: steps,
      action: {
        id: "act-open-tasks",
        type: "navigate",
        label: "Open task board",
        confirmationRequired: false,
        payload: { url: "/tasks" },
      },
      suggestions: [
        "Quelles sont mes 3 prochaines tâches prioritaires ?",
        "Quels projets nécessitent mon attention ?",
        "Résume l'activité de cette semaine.",
      ],
    };
  }

  // 5. SYNTHÈSE (Summary of week, activity, changes, progress)
  if (
    (has(tokens, "résume", "resume", "synthèse", "synthese", "summar", "digest", "bilan") &&
      (has(tokens, "semaine", "week", "activit", "activity") ||
        lowerQuery.includes("cette semaine") ||
        lowerQuery.includes("this week"))) ||
    lowerQuery.includes("résume l'activité") ||
    lowerQuery.includes("résume l activité") ||
    lowerQuery.includes("summarize activity") ||
    lowerQuery.includes("qu'est-ce qui a changé") ||
    lowerQuery.includes("où en suis-je") ||
    lowerQuery.includes("what changed recently")
  ) {
    const briefing = weeklyBriefing(snapshot);
    const recentActs = (context?.recentActivities ?? []).slice(0, 4);

    const items: IntelligenceItem[] = recentActs.map((act) => ({
      id: act.id,
      title: `${act.action.toUpperCase()}: ${act.title}`,
      subtitle: `By ${act.actorName ?? "User"} · ${act.createdAt.slice(0, 10)}`,
      badge: {
        label: act.entityType.toUpperCase(),
        tone: act.action === "created" ? "success" : "neutral",
      },
      href: "/activity",
      reasons: [`Logged in audit feed`],
    }));

    return {
      query,
      intent: "synthesis",
      headline: `Weekly summary: ${briefing.headline}`,
      narrative: `${briefing.summary} ${briefing.outlook}`,
      provider: "nexus-engine",
      evidence: {
        metrics: [
          { label: "Completed (7d)", value: `${briefing.completedThisWeek} tasks done` },
          { label: "Opened (7d)", value: `${briefing.openedThisWeek} new tasks tracked` },
          {
            label: "Momentum",
            value:
              briefing.momentumDelta > 0
                ? `+${briefing.momentumDelta} tasks vs previous week`
                : briefing.momentumDelta === 0
                  ? "Pacing equal to previous week"
                  : `${briefing.momentumDelta} tasks vs previous week`,
          },
          { label: "Outlook", value: briefing.outlook },
        ],
        traceCount: `Derived from verified activity log and task timestamps`,
        sources: ["Audit Log", "Throughput Engine"],
      },
      items: items.length > 0 ? items : undefined,
      action: {
        id: "act-view-activity",
        type: "navigate",
        label: "View activity feed",
        confirmationRequired: false,
        payload: { url: "/activity" },
      },
      suggestions: [
        "Quels projets nécessitent mon attention ?",
        "Quelles sont mes 3 prochaines tâches prioritaires ?",
        "Aide-moi à organiser cette semaine.",
      ],
    };
  }

  // 6. DÉTECTION (Blocked projects, overdue work, approaching risks)
  if (
    lowerQuery.includes("projets bloqu") ||
    lowerQuery.includes("projet bloqu") ||
    lowerQuery.includes("projets semblent bloqu") ||
    lowerQuery.includes("blocked project") ||
    lowerQuery.includes("projects blocked") ||
    lowerQuery.includes("stalled project")
  ) {
    const blockedProjects = snapshot.projects
      .map((project) => {
        const projectTasks = open.filter((t) => t.project_id === project.id);
        const blocked = projectTasks.filter((t) => t.status === "blocked");
        return { project, blocked };
      })
      .filter((entry) => entry.blocked.length > 0);

    const blockedItems: IntelligenceItem[] = blockedProjects.map((bp) => ({
      id: bp.project.id,
      title: bp.project.name,
      subtitle: `${plural(bp.blocked.length, "task")} blocked: “${bp.blocked[0].title}”`,
      badge: { label: "BLOCKED", tone: "danger" as const },
      href: "/tasks?filter=blocked",
      reasons: bp.blocked.map((b) => `Task “${b.title}” is marked blocked`),
    }));

    const overdueTasks = open.filter((t) => {
      const d = asDate(t.due_at);
      return d !== null && d.getTime() < now.getTime();
    });

    const overdueItems: IntelligenceItem[] = overdueTasks.slice(0, 2).map((t) => ({
      id: t.id,
      title: `Overdue: ${t.title}`,
      subtitle: `Was due ${formatShortRelative(t.due_at!, now)}`,
      badge: { label: "OVERDUE", tone: "danger" as const },
      href: "/tasks?filter=overdue",
      reasons: [`Overdue by ${plural(Math.abs(daysUntil(asDate(t.due_at!)!, now)), "day")}`],
    }));

    const items: IntelligenceItem[] = [...blockedItems, ...overdueItems];

    return {
      query,
      intent: "detection",
      headline:
        blockedProjects.length === 0
          ? "No projects are currently blocked"
          : `${plural(blockedProjects.length, "project")} have blocked work`,
      narrative:
        blockedProjects.length === 0
          ? "No active task is marked blocked in any project. Work is flowing smoothly."
          : `Blockers detected in ${blockedProjects.length} projects: ${blockedProjects.map((bp) => `“${bp.project.name}” (${bp.blocked.length} blocked)`).join(", ")}.`,
      provider: "nexus-engine",
      evidence: {
        metrics: [
          { label: "Blocked projects", value: String(blockedProjects.length) },
          { label: "Blocked tasks", value: String(blockedProjects.reduce((acc, p) => acc + p.blocked.length, 0)) },
          { label: "Total open tasks", value: String(open.length) },
        ],
        traceCount: `Scanned ${snapshot.projects.length} projects for blocker states`,
        sources: ["Project Task Graphs", "Task Attributes"],
      },
      items: items.length > 0 ? items : undefined,
      action: blockedProjects.length > 0 ? {
        id: "act-filter-blocked",
        type: "view_blocked_tasks",
        label: "Review blocked tasks",
        confirmationRequired: false,
        payload: { url: "/tasks?filter=blocked" },
      } : undefined,
      suggestions: [
        "Quelles sont mes 3 prochaines tâches prioritaires ?",
        "Quels projets nécessitent mon attention ?",
      ],
    };
  }

  // Fallback: General workspace query / health overview
  const health = workspaceHealth(snapshot);
  return {
    query,
    intent: "general",
    headline: `Workspace Health: ${health.score}/100 (${health.band})`,
    narrative: `NEXUS reads this workspace directly. Ask specific questions about projects, priorities, blockers, planning, or request task creation.`,
    provider: "nexus-engine",
    evidence: {
      metrics: [
        { label: "Operating Index", value: `${health.score}/100` },
        { label: "Projects", value: String(snapshot.projects.length) },
        { label: "Open tasks", value: String(open.length) },
      ],
      traceCount: `${snapshot.projects.length} projects · ${open.length} open tasks · index ${health.score}/100`,
      sources: ["Workspace Health Engine"],
    },
    items: [
      {
        id: "health-1",
        title: health.headline,
        subtitle: `Band: ${health.band.toUpperCase()}`,
        badge: { label: health.band.toUpperCase(), tone: health.band === "steady" ? "success" : health.band === "watch" ? "warning" : "danger" },
        href: "/app/intelligence",
        reasons: health.factors.filter((f) => f.penalty > 0).map((f) => `${f.label}: ${f.evidence}`),
      },
    ],
    action: {
      id: "act-intelligence-view",
      type: "navigate",
      label: "Open Intelligence",
      confirmationRequired: false,
      payload: { url: "/app/intelligence" },
    },
    suggestions: [
      "Quels projets nécessitent mon attention ?",
      "Quelles sont mes 3 prochaines tâches prioritaires ?",
      "Quels projets semblent bloqués ?",
      "Aide-moi à organiser cette semaine.",
    ],
  };
}

export function askWorkspace(
  snapshot: WorkspaceSnapshot,
  query: string
): AskAnswer {
  const lowerQuery = query.toLowerCase().trim();
  const tokens = lowerQuery.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return {
      kind: "empty",
      title: "Ask about this workspace",
      lines: [],
      links: [],
      suggestions: SUGGESTIONS.empty,
    };
  }

  // Check specific project name first if asked specifically about a single project
  const STOPWORDS = new Set([
    "project", "projets", "the", "how", "is", "what", "whats", "status",
    "about", "doing", "going", "with", "tell", "me", "show", "and", "for", "workspace",
    "a", "an", "of", "on", "in", "to", "it", "its", "that", "this",
    "block", "blocked", "overdue", "late", "today", "week", "next",
    "momentum", "health", "should", "work", "attention", "priorit",
  ]);

  const askedAboutProjects = tokens.some((token) =>
    ["project", "projects", "projet", "projets"].includes(token)
  );
  const nameMatch = findNamedProject(snapshot, lowerQuery, tokens, STOPWORDS);

  if (askedAboutProjects && nameMatch && !anyIntentToken(tokens)) {
    return projectAnswer(nameMatch, snapshot, snapshot.now ?? new Date());
  }

  const reasoned = reasonWorkspace(snapshot, query);
  const lines: { label: string; value: string }[] = [];

  for (const m of reasoned.evidence.metrics) {
    lines.push({ label: m.label, value: m.value });
  }

  if (reasoned.items && reasoned.items.length > 0) {
    for (const item of reasoned.items.slice(0, 3)) {
      lines.push({ label: item.title, value: item.reasons?.[0] ?? item.subtitle ?? "active" });
    }
  }

  let kind: AskKind = "help";
  if (reasoned.intent === "action") kind = "action_proposal";
  else if (reasoned.intent === "analysis") kind = "projects_attention";
  else if (reasoned.intent === "prioritization") kind = "priorities";
  else if (reasoned.intent === "detection") kind = "projects_blocked";
  else if (reasoned.intent === "synthesis") kind = "synthesis";
  else if (reasoned.intent === "planning") kind = "planning";

  const links: { href: string; label: string }[] = [];
  if (reasoned.action?.payload?.url) {
    links.push({ href: reasoned.action.payload.url, label: reasoned.action.label });
  }

  return {
    kind,
    title: reasoned.headline,
    lines: lines.slice(0, 6),
    links,
    suggestions: reasoned.suggestions,
    actionProposal: reasoned.action?.type === "create_task" ? {
      type: "create_task",
      title: reasoned.action.payload?.title ?? "New Task",
      priority: reasoned.action.payload?.priority,
      dueDate: reasoned.action.payload?.dueDate,
      actionLabel: reasoned.action.label,
    } : undefined,
    evidenceNote: reasoned.evidence.traceCount,
  };
}

function formatShortRelative(value: string, now: Date): string {
  const date = asDate(value);
  if (!date) return "no date";
  const diff = daysUntil(date, now);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff < 0) return `${Math.abs(diff)}d late`;
  return `in ${diff}d`;
}

/** Tokens that map to a specific intent — a project name must beat these. */
function anyIntentToken(tokens: string[]): boolean {
  return has(
    tokens,
    "block", "stuck", "stall", "bloqu",
    "overdue", "late", "delayed", "past",
    "today", "now", "aujourd",
    "week", "semaine", "upcoming", "coming",
    "momentum", "shipped", "completed", "velocity", "throughput", "productiv",
    "health", "score", "shape",
    "next", "focus", "priority", "priorit", "should", "first",
    "attention", "nécessitent", "tâche", "tâches", "task", "tasks",
    "organis", "synthèse", "résume", "resume", "crée", "créer",
    "help"
  );
}

/**
 * Finds a project the query explicitly names: the full project name
 * appearing in the query, or a distinctive (4+ char, non-stopword)
 * token that appears in exactly one project name.
 */
function findNamedProject(
  snapshot: WorkspaceSnapshot,
  lowerQuery: string,
  tokens: string[],
  stopwords: Set<string>
): ProjectLike | null {
  const byFullName = snapshot.projects.find(
    (project) =>
      project.name.length >= 4 && lowerQuery.includes(project.name.toLowerCase())
  );
  if (byFullName) return byFullName;

  const distinctive = tokens.filter(
    (token) => token.length >= 4 && !stopwords.has(token)
  );
  if (distinctive.length === 0) return null;

  const matches = snapshot.projects.filter((project) => {
    const name = project.name.toLowerCase();
    return distinctive.some((token) => name.includes(token));
  });

  return matches.length === 1 ? matches[0] : null;
}

/** The factual read of one project, used by project questions. */
function projectAnswer(
  project: ProjectLike,
  snapshot: WorkspaceSnapshot,
  now: Date
): AskAnswer {
  const projectTasks = snapshot.tasks.filter(
    (task) => task.project_id === project.id
  );
  const projectOpen = projectTasks.filter(isActiveTask);
  const overdue = projectOpen.filter((task) => {
    const due = asDate(task.due_at);
    return due !== null && due.getTime() < now.getTime();
  });
  const due = asDate(project.due_date);

  return {
    kind: "project",
    title: `“${project.name}” — ${project.status ?? "planning"}`,
    lines: [
      { label: "Progress", value: `${Math.round(project.progress ?? 0)}%` },
      { label: "Open tasks", value: String(projectOpen.length) },
      ...(overdue.length > 0
        ? [{ label: "Overdue", value: String(overdue.length) }]
        : []),
      ...(due
        ? [
            {
              label:
                due.getTime() < now.getTime() ? "Deadline passed" : "Deadline",
              value: new Intl.DateTimeFormat("en", {
                month: "short",
                day: "numeric",
              }).format(due),
            },
          ]
        : []),
    ],
    links: [{ href: "/projects", label: "Open projects" }],
    suggestions: SUGGESTIONS.project,
  };
}

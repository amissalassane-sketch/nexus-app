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
  IntelligenceActionType,
  IntelligenceTarget,
  SessionHistoryItem,
} from "./types";
import type { WorkspaceContextSummary } from "./context-builder";
import {
  classifyIntent,
  dueDayToIsoDayName,
  extractPriorityFromQuery,
  mapLegacyIntentToId,
  riskForAction,
} from "./intent";

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

/** Resolves a task referenced by its title in the snapshot. Never invents one. */
function findTaskByQuery(snapshot: WorkspaceSnapshot, query: string): TaskLike | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const byTitle = snapshot.tasks.find(
    (task) => task.title.length >= 3 && q.includes(task.title.toLowerCase())
  );
  if (byTitle) return byTitle;
  const tokens = q.split(/\s+/).filter((token) => token.length >= 4);
  const matches = snapshot.tasks.filter((task) => {
    const title = task.title.toLowerCase();
    return tokens.some((token) => title.includes(token));
  });
  return matches.length === 1 ? matches[0] : null;
}

/** Resolves a project referenced by its name in the snapshot. Never invents one. */
function findProjectByQuery(snapshot: WorkspaceSnapshot, query: string): ProjectLike | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const byName = snapshot.projects.find(
    (project) => project.name.length >= 3 && q.includes(project.name.toLowerCase())
  );
  if (byName) return byName;
  const tokens = q.split(/\s+/).filter((token) => token.length >= 4);
  const matches = snapshot.projects.filter((project) => {
    const name = project.name.toLowerCase();
    return tokens.some((token) => name.includes(token));
  });
  return matches.length === 1 ? matches[0] : null;
}

/** Detects a natural language due day ("vendredi" / "monday") and returns an ISO date. */
function naturalLanguageDueDate(query: string, now: Date): string | null {
  const normalized = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words: string[] = [];
  for (const day of ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]) {
    if (normalized.includes(day)) words.push(day);
  }
  if (normalized.includes("demain") || normalized.includes("tomorrow")) words.push("tomorrow");
  if (normalized.includes("aujourd") || normalized.includes("today")) words.push("today");
  const day = words[0];
  return day ? dueDayToIsoDayName(day, now) : null;
}

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
function reasonWorkspaceCore(
  snapshot: WorkspaceSnapshot,
  query: string,
  context?: WorkspaceContextSummary,
  sessionHistory?: SessionHistoryItem[],
  /** Memory-resolved target (Phase 2). */
  resolvedTarget?: IntelligenceTarget
): StructuredIntelligenceResponse {
  const now = snapshot.now ?? new Date();
  const open = snapshot.tasks.filter(isActiveTask);
  const lowerQuery = query.toLowerCase().trim();
  const tokens = lowerQuery.split(/\s+/).filter(Boolean);

  const projectMap = new Map<string, ProjectLike>();
  for (const p of snapshot.projects) {
    projectMap.set(p.id, p);
  }

  // 0. EMPTY WORKSPACE GUARD (Section 14)
  if (snapshot.projects.length === 0 && snapshot.tasks.length === 0) {
    return {
      query,
      intent: "general",
      headline: "Intelligence is ready.",
      narrative: "Create a project and a few tasks so NEXUS can start detecting priorities, risks and opportunities.",
      provider: "nexus-engine",
      evidence: {
        metrics: [
          { label: "Projects", value: "0" },
          { label: "Tasks", value: "0" },
          { label: "Status", value: "Workspace is empty" },
        ],
        traceCount: "Workspace initialized · Waiting for first records",
        sources: ["Workspace Telemetry"],
      },
      action: {
        id: "act-create-first-project",
        type: "create_project",
        label: "Create first project",
        description: "Initialize your workspace with a project",
        confirmationRequired: true,
        payload: {
          name: "Main Initiative",
          status: "planning",
        },
      },
      quickActions: [
        { label: "Create project", href: "/projects?create=1" },
        { label: "Create task", href: "/tasks?create=1" },
      ],
      suggestions: [
        "Create your first project",
        "How does NEXUS Intelligence work?",
      ],
    };
  }

  // 0.1 CONVERSATIONAL SESSION MEMORY FOLLOW-UP (Section 11)
  const isFollowUp =
    sessionHistory &&
    sessionHistory.length > 0 &&
    (lowerQuery.includes("lequel") ||
      lowerQuery.includes("laquelle") ||
      lowerQuery.includes("which one") ||
      lowerQuery.includes("le premier") ||
      lowerQuery.includes("la première") ||
      lowerQuery.includes("the first one") ||
      lowerQuery.includes("et pour") ||
      lowerQuery.includes("plus urgent") ||
      lowerQuery.includes("most urgent"));

  if (isFollowUp) {
    const previous = sessionHistory[0];
    const candidateProjects = snapshot.projects.filter((p) =>
      previous.targetEntities?.length ? previous.targetEntities.includes(p.name) : true
    );

    const scored = candidateProjects.map((project) => {
      const pTasks = open.filter((t) => t.project_id === project.id);
      const pOverdue = pTasks.filter((t) => t.due_at && asDate(t.due_at)!.getTime() < now.getTime());
      const pBlocked = pTasks.filter((t) => t.status === "blocked");
      const pDue = asDate(project.due_date);
      let score = 0;
      const reasons: string[] = [];

      if (pDue && pDue.getTime() < now.getTime()) {
        score += 50;
        reasons.push(`Deadline passed on ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(pDue)}`);
      } else if (pDue && daysUntil(pDue, now) <= 7) {
        score += 30;
        reasons.push(`Deadline in ${daysUntil(pDue, now)} days`);
      }
      if (pBlocked.length > 0) {
        score += 25;
        reasons.push(`${plural(pBlocked.length, "task")} blocked`);
      }
      if (pOverdue.length > 0) {
        score += 20;
        reasons.push(`${plural(pOverdue.length, "task")} overdue`);
      }

      return { project, score, reasons, pTasks, pBlocked, pOverdue };
    }).sort((a, b) => b.score - a.score);

    const topProject = scored[0];
    if (topProject && topProject.score > 0) {
      return {
        query,
        intent: "prioritization",
        headline: `“${topProject.project.name}” is the most urgent initiative`,
        narrative: `Contextual follow-up to “${previous.query}”: Among the identified projects, “${topProject.project.name}” requires action first. ${topProject.reasons.join(". ")}.`,
        provider: "nexus-engine",
        evidence: {
          metrics: [
            { label: "Urgent project", value: topProject.project.name },
            { label: "Primary reason", value: topProject.reasons[0] },
            { label: "Blocked tasks", value: String(topProject.pBlocked.length) },
            { label: "Overdue tasks", value: String(topProject.pOverdue.length) },
          ],
          traceCount: `Resolved from previous query context (${previous.headline})`,
          sources: ["Session Memory", "Project Analysis"],
        },
        items: [
          {
            id: topProject.project.id,
            title: topProject.project.name,
            subtitle: `Status: ${topProject.project.status ?? "planning"} · Progress: ${Math.round(topProject.project.progress ?? 0)}%`,
            badge: { label: "MOST URGENT", tone: "danger" },
            href: "/projects",
            reasons: topProject.reasons,
          },
          ...(topProject.pBlocked.length > 0 ? [{
            id: topProject.pBlocked[0].id,
            title: `Blocker: ${topProject.pBlocked[0].title}`,
            subtitle: "Resolve this task to unblock the project",
            badge: { label: "BLOCKER", tone: "danger" as const },
            href: "/tasks?filter=blocked",
            reasons: ["Critical path impediment"],
          }] : []),
        ],
        action: {
          id: `act-open-${topProject.project.id}`,
          type: "open_project",
          label: `Open “${topProject.project.name}”`,
          confirmationRequired: false,
          payload: { url: "/projects" },
        },
        quickActions: [
          { label: "View tasks", href: "/tasks" },
          { label: "Plan my day", query: "Organise ma journée" },
        ],
        suggestions: [
          "Quelles sont mes 3 prochaines tâches prioritaires ?",
          "Comment avancer sur ce projet ?",
          "Aide-moi à organiser cette semaine.",
        ],
      };
    }
  }

  const classified = classifyIntent(query, { snapshot, sessionHistory, resolvedTarget });

  // 1.0 CONVERSATION CONTINUATION — "Et après ?", "Fais-le", "this task"
  // Resolves the referential phrases against the previous turn's action and
  // the previous plan, so a follow-up is never a silent no-op.
  const lastTurn = sessionHistory?.[0];
  const normalizedQuery = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-–—]/g, " ")
    .trim();
  const isNextStepQuery = /et (apres|ensuite)|what next|then what/.test(normalizedQuery);
  if (isNextStepQuery && lastTurn) {
    const previousItems = lastTurn.targetEntities ?? [];
    const nextItems = previousItems.slice(1);
    return {
      query,
      intent: "planning",
      intentId: "PLAN",
      target: lastTurn.target ?? { type: "workspace" },
      headline: nextItems.length > 0 ? "Next step in the current plan" : "Plan complete",
      narrative:
        nextItems.length > 0
          ? `Continuing from the previous plan, the next step is: ${nextItems.join(", ")}.`
          : "The previous plan has no remaining steps. Ask for a new day or week plan whenever you are ready.",
      provider: "nexus-engine",
      evidence: {
        metrics: [{ label: "Previous turn", value: lastTurn.headline }],
        traceCount: `Resolved from session context (${lastTurn.query})`,
        sources: ["Session Memory", "Workspace Plan"],
      },
      action: {
        id: "act-next-plan-step",
        type: "open_task",
        label: nextItems.length > 0 ? "Open next step" : "Plan again",
        description: nextItems.length > 0 ? "Open the tasks view to continue the current plan." : "Generate a new plan for today or this week.",
        confirmationRequired: false,
        risk: "none",
        payload: { url: "/tasks" },
      },
      suggestions: ["Plan ma journée.", "Plan ma semaine.", "Quelles sont mes prioritaires ?"],
    };
  }

  const isExecuteLast = /fais le|fais la|vas y|va y|do it|go ahead|execute/i.test(normalizedQuery);
  if (isExecuteLast && lastTurn?.actionType && lastTurn.actionType !== "open_task" && lastTurn.actionType !== "open_project" && lastTurn.actionType !== "navigate") {
    const actionType = lastTurn.actionType;
    return {
      query,
      intent: "action",
      intentId: mapLegacyIntentToId("action", actionType),
      target: lastTurn.target ?? { type: "task" },
      headline: `Execute proposed action: ${actionType.replace("_", " ")}`,
      narrative: `This repeats the action proposed in the previous turn, targeting the same verified workspace resource.`,
      provider: "nexus-engine",
      evidence: {
        metrics: [{ label: "Action", value: actionType.replace("_", " ") }],
        traceCount: `Resolved from session context (${lastTurn.query})`,
        sources: ["Session Memory"],
      },
      action: {
        id: `act-repeat-${actionType}`,
        type: actionType,
        label: actionType.replace("_", " "),
        description: "Execute the previously proposed action after confirmation.",
        confirmationRequired: true,
        risk: riskForAction(actionType),
        payload: {
          taskId: lastTurn.target?.id,
          title: lastTurn.target?.label,
        },
      },
      suggestions: ["Confirmer cette action.", "Annuler.", "Quels projets nécessitent mon attention ?"],
    };
  }

  // 1.0.1 SEARCH — locate a real task/project by name, or resolve
  // « ouvre-la » / « open it » via the memory-resolved target.
  if (classified.intent === "SEARCH") {
    const task = findTaskByQuery(snapshot, query);
    const project = task ? null : findProjectByQuery(snapshot, query);
    const entity =
      task
        ? { type: "task" as const, id: task.id, label: task.title }
        : project
          ? { type: "project" as const, id: project.id, label: project.name }
          : resolvedTarget?.id
            ? {
                type: (resolvedTarget.type === "project" ? "project" : "task") as "task" | "project",
                id: resolvedTarget.id,
                label: resolvedTarget.label ?? "Item",
              }
            : null;
    if (!entity) {
      return {
        query,
        intent: "general",
        intentId: "SEARCH",
        target: classified.target,
        headline: "No matching workspace item",
        narrative: "No task or project in this workspace matches that reference. The search is scoped to your workspace only.",
        provider: "nexus-engine",
        evidence: { metrics: [{ label: "Scope", value: "Current workspace" }], traceCount: "Search scoped to verified workspace records", sources: ["Workspace Registry"] },
        suggestions: ["Quels projets nécessitent mon attention ?", "Recherche une tâche.", "Recherche un projet."],
      };
    }
    const href = entity.type === "task" ? "/tasks" : "/projects";
    return {
      query,
      intent: entity.type === "task" ? "prioritization" : "analysis",
      intentId: "SEARCH",
      target: entity,
      headline: `Found: ${entity.label}`,
      narrative: `This is a real ${entity.type} in your workspace. Open the corresponding view to inspect it.`,
      provider: "nexus-engine",
      evidence: {
        metrics: [{ label: "Item", value: entity.label }, { label: "Type", value: entity.type }],
        traceCount: "Resolved from verified workspace records",
        sources: [entity.type === "task" ? "Tasks" : "Projects"],
      },
      action: {
        id: `act-open-${entity.type}-${entity.id}`,
        type: entity.type === "task" ? "open_task" : "open_project",
        label: `Open ${entity.label}`,
        confirmationRequired: false,
        risk: "none",
        payload: { url: href, taskId: entity.type === "task" ? entity.id : undefined, projectId: entity.type === "project" ? entity.id : undefined },
      },
      suggestions: ["Qu'est-ce qui est en retard ?", "Quels projets nécessitent mon attention ?"],
    };
  }

  // 1.0.2 EXPLAIN — why a real project is progressing badly
  if (classified.intent === "EXPLAIN") {
    const project = findProjectByQuery(snapshot, query) ?? snapshot.projects[0];
    const projectTasks = project ? open.filter((t) => t.project_id === project.id) : [];
    const overdue = projectTasks.filter((t) => {
      const d = asDate(t.due_at);
      return d !== null && d.getTime() < now.getTime();
    });
    const blocked = projectTasks.filter((t) => t.status === "blocked");
    const progress = Math.round(project?.progress ?? 0);
    const due = asDate(project?.due_date);

    const reasons: string[] = [];
    if (due && due.getTime() < now.getTime()) reasons.push("project deadline has passed");
    else if (due && daysUntil(due, now) <= 7) reasons.push(`deadline is inside ${daysUntil(due, now)} days`);
    if (blocked.length > 0) reasons.push(`${plural(blocked.length, "task")} blocked`);
    if (overdue.length > 0) reasons.push(`${plural(overdue.length, "task")} overdue`);
    if (project?.status === "paused") reasons.push("project is paused");

    return {
      query,
      intent: "analysis",
      intentId: "EXPLAIN",
      target: project ? { type: "project", id: project.id, label: project.name } : { type: "workspace" },
      headline: project ? `Why “${project.name}” needs attention` : "Workspace explanation",
      narrative: project && reasons.length > 0
        ? `The evidence is read directly from the workspace: ${reasons.join(", ")}. Progress is ${progress}%.`
        : "NEXUS cannot find a project-level signal to explain a slowdown — nothing in the verified data currently indicates a risk.",
      provider: "nexus-engine",
      evidence: {
        metrics: project ? [
          { label: "Progress", value: `${progress}%` },
          { label: "Open tasks", value: String(projectTasks.length) },
          { label: "Blocked", value: String(blocked.length) },
          { label: "Overdue", value: String(overdue.length) },
        ] : [{ label: "Scope", value: "Current workspace" }],
        traceCount: "Derived from verified project and task records",
        sources: ["Projects Registry", "Task Attributes"],
      },
      items: project && reasons.length > 0 ? [{
        id: project.id,
        title: project.name,
        subtitle: `Progress ${progress}%`,
        badge: { label: "AT RISK", tone: "danger" },
        href: "/projects",
        reasons,
      }] : undefined,
      suggestions: ["Quels projets nécessitent mon attention ?", "Qu'est-ce qui est bloqué ?", "Plan ma semaine."],
    };
  }

  // 1.0.3 COMPLETE / MOVE / UPDATE — mutate a real task or project
  if (classified.intent === "COMPLETE" || classified.intent === "MOVE" || classified.intent === "UPDATE") {
    const task = findTaskByQuery(snapshot, query);
    const project = task ? null : findProjectByQuery(snapshot, query);
    const sessionEntity = lastTurn?.target?.id
      ? { type: lastTurn.target.type === "project" ? ("project" as const) : ("task" as const), id: lastTurn.target.id, label: lastTurn.target.label ?? "" }
      : resolvedTarget?.id
        ? { type: resolvedTarget.type === "project" ? ("project" as const) : ("task" as const), id: resolvedTarget.id, label: resolvedTarget.label ?? "" }
        : null;
    const entity = task
      ? { type: "task" as const, id: task.id, label: task.title }
      : project
        ? { type: "project" as const, id: project.id, label: project.name }
        : sessionEntity;

    if (!entity) {
      return {
        query,
        intent: "general",
        intentId: classified.intent,
        target: classified.target,
        headline: "No matching task to update",
        narrative: "No task in this workspace matches that reference. Name the task exactly, or ask NEXUS to search for it first.",
        provider: "nexus-engine",
        evidence: { metrics: [{ label: "Scope", value: "Current workspace" }], traceCount: "Target resolution scoped to verified workspace records", sources: ["Workspace Registry"] },
        suggestions: ["Recherche cette tâche.", "Quels projets nécessitent mon attention ?"],
      };
    }

    const actionType: IntelligenceActionType =
      classified.intent === "COMPLETE"
        ? "complete_task"
        : classified.intent === "MOVE"
          ? "move_task"
          : "update_task";

    let headline = `Proposed action: ${actionType.replace("_", " ")}`;
    let narrative = `NEXUS would ${actionType.replace("_", " ")} “${entity.label}” in this workspace. The action is proposed for your confirmation and will be verified before success is reported.`;
    let payload: Record<string, unknown> = { taskId: entity.id, query: entity.label };

    if (classified.intent === "MOVE") {
      const dueDate = naturalLanguageDueDate(query, now);
      if (dueDate) {
        payload = { ...payload, dueDate };
        headline = `Move “${entity.label}” to its new date`;
        narrative = `The new due date is ${dueDate}. NEXUS re-reads the task after the update before confirming.`;
      } else {
        headline = `Where should “${entity.label}” move?`;
        narrative = "Tell NEXUS the new date (e.g. “décale à lundi”, “move to monday”) and the action will be prepared.";
      }
    }
    if (classified.intent === "UPDATE") {
      const priority = extractPriorityFromQuery(query);
      if (priority) {
        payload = { ...payload, priority };
        headline = `Set “${entity.label}” to ${priority} priority`;
        narrative = `The task priority will be set to ${priority}. NEXUS re-reads the task after the update before confirming.`;
      }
    }
    if (classified.intent === "COMPLETE") {
      headline = `Complete “${entity.label}”?`;
      narrative = "This marks the real task as done. NEXUS verifies status and completion date after the mutation.";
    }

    return {
      query,
      intent: "action",
      intentId: classified.intent,
      target: { type: entity.type, id: entity.id, label: entity.label },
      headline,
      narrative,
      provider: "nexus-engine",
      evidence: {
        metrics: [
          { label: "Action", value: actionType.replace("_", " ") },
          { label: "Target", value: entity.label },
          ...(classified.intent === "MOVE" && payload.dueDate ? [{ label: "New due date", value: String(payload.dueDate) }] : []),
          ...(classified.intent === "UPDATE" && payload.priority ? [{ label: "New priority", value: String(payload.priority) }] : []),
        ],
        traceCount: "Target resolved within the active workspace",
        sources: ["Workspace Registry", "Task Attributes"],
      },
      action: {
        id: `act-${actionType}-${entity.id}`,
        type: actionType,
        label:
          classified.intent === "COMPLETE"
            ? "Complete task"
            : classified.intent === "MOVE"
              ? "Move task"
              : "Update task",
        description: narrative,
        confirmationRequired: true,
        risk: riskForAction(actionType),
        payload: payload as never,
      },
      suggestions: ["Confirmer l'action.", "Quels projets nécessitent mon attention ?", "Qu'est-ce qui est en retard ?"],
    };
  }

  // 1.0.4 DELETE — high risk, requires explicit confirmation
  if (classified.intent === "DELETE") {
    const task = findTaskByQuery(snapshot, query);
    const project = task ? null : findProjectByQuery(snapshot, query);
    const sessionEntity = lastTurn?.target?.id
      ? { type: (lastTurn.target.type === "project" ? "project" : "task") as "task" | "project", id: lastTurn.target.id, label: lastTurn.target.label ?? "" }
      : resolvedTarget?.id
        ? { type: (resolvedTarget.type === "project" ? "project" : "task") as "task" | "project", id: resolvedTarget.id, label: resolvedTarget.label ?? "" }
        : null;
    const entity = task
      ? { type: "task" as const, id: task.id, label: task.title }
      : project
        ? { type: "project" as const, id: project.id, label: project.name }
        : sessionEntity;
    if (!entity) {
      return {
        query,
        intent: "general",
        intentId: "DELETE",
        target: classified.target,
        headline: "No matching item to delete",
        narrative: "No task or project in this workspace matches that reference. NEXUS will never delete without a real target.",
        provider: "nexus-engine",
        evidence: { metrics: [{ label: "Scope", value: "Current workspace" }], traceCount: "Target resolution scoped to verified workspace records", sources: ["Workspace Registry"] },
        suggestions: ["Recherche cette tâche.", "Quels projets nécessitent mon attention ?"],
      };
    }
    const actionType = entity.type === "task" ? "delete_task" : "delete_project";
    return {
      query,
      intent: "action",
      intentId: "DELETE",
      target: { type: entity.type, id: entity.id, label: entity.label },
      headline: `Delete “${entity.label}”?`,
      narrative: "This is a destructive action. It requires an explicit confirmation and is executed server-side only after the target is re-validated in this workspace.",
      provider: "nexus-engine",
      evidence: {
        metrics: [{ label: "Action", value: actionType.replace("_", " ") }, { label: "Target", value: entity.label }],
        traceCount: "Destructive action · workspace-scoped target resolved",
        sources: ["Workspace Registry"],
      },
      action: {
        id: `act-${actionType}-${entity.id}`,
        type: actionType,
        label: entity.type === "task" ? "Delete task" : "Delete project",
        description: "Permanently delete the target after explicit confirmation.",
        confirmationRequired: true,
        risk: "high",
        payload: { taskId: entity.type === "task" ? entity.id : undefined, projectId: entity.type === "project" ? entity.id : undefined, query: entity.label, confirmDeletion: true },
      },
      suggestions: ["Annuler.", "Quels projets nécessitent mon attention ?", "Qu'est-ce qui est en retard ?"],
    };
  }

  // 1.0.5 CREATE GOAL
  if (classified.intent === "CREATE" && classified.target?.type === "goal") {
    const title = classified.target.query ? classified.target.query.charAt(0).toUpperCase() + classified.target.query.slice(1) : "New Goal";
    return {
      query,
      intent: "action",
      intentId: "CREATE",
      target: { type: "goal" },
      headline: `Recommended action: Create goal “${title}”`,
      narrative: `Create a goal for “${title}” so NEXUS can measure progress against a real target.`,
      provider: "nexus-engine",
      evidence: { metrics: [{ label: "Proposed goal", value: title }], traceCount: "Parsed from intent · Verified workspace action", sources: ["User Prompt", "Workspace Context"] },
      action: { id: `act-goal-${Date.now()}`, type: "create_goal", label: "Create this goal", description: `Create goal “${title}” in the current workspace`, confirmationRequired: true, risk: "low", payload: { title } },
      quickActions: [{ label: "Open goals", href: "/goals" }],
      suggestions: ["Quels projets nécessitent mon attention ?", "Plan ma semaine."],
    };
  }

  // 1. ACTION (Task or Project creation intent)
  const isCreateProject =
    lowerQuery.startsWith("crée un projet") ||
    lowerQuery.startsWith("créer un projet") ||
    lowerQuery.startsWith("ajoute un projet") ||
    lowerQuery.startsWith("ajouter un projet") ||
    lowerQuery.startsWith("create a project") ||
    lowerQuery.startsWith("add a project") ||
    lowerQuery.startsWith("new project");

  if (isCreateProject) {
    const rawName = lowerQuery
      .replace(/^(crée|créer|ajoute|ajouter)\s+un\s+projet\s*(pour\s+(mon|notre|le|la)?|de\s+(mon|notre|le|la)?|pour|de|:)?\s*/i, "")
      .replace(/^(create|add)\s+(a\s+)?project\s*(for\s+(my|our|the)?|to\s+(my|our|the)?|for|to|:)?\s*/i, "")
      .replace(/^new\s+project\s*(:)?\s*/i, "")
      .replace(/[.]+$/, "")
      .trim();

    const name = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : "New Project";

    return {
      query,
      intent: "action",
      headline: `Recommended action: Create project “${name}”`,
      narrative: `It is recommended to create a dedicated project for “${name}” so your team can organize tasks, track deadlines and monitor momentum.`,
      provider: "nexus-engine",
      evidence: {
        metrics: [
          { label: "Proposed name", value: name },
          { label: "Default status", value: "Planning" },
        ],
        traceCount: "Parsed from intent · Verified workspace action",
        sources: ["User Prompt", "Workspace Registry"],
      },
      action: {
        id: `act-proj-${Date.now()}`,
        type: "create_project",
        label: "Create project",
        description: `Create project “${name}” in current workspace`,
        confirmationRequired: true,
        payload: {
          name,
          status: "planning",
        },
      },
      quickActions: [
        { label: "Open projects", href: "/projects" },
        { label: "Plan my day", query: "Organise ma journée" },
      ],
      suggestions: [
        "Quels projets nécessitent mon attention ?",
        "Quelles sont mes 3 prochaines tâches prioritaires ?",
        "Aide-moi à organiser cette semaine.",
      ],
    };
  }

  const isCreateTask =
    lowerQuery.startsWith("crée une tâche") ||
    lowerQuery.startsWith("créer une tâche") ||
    lowerQuery.startsWith("ajoute une tâche") ||
    lowerQuery.startsWith("ajouter une tâche") ||
    lowerQuery.startsWith("create a task") ||
    lowerQuery.startsWith("add a task") ||
    lowerQuery.startsWith("new task") ||
    lowerQuery.includes("dois préparer") ||
    lowerQuery.includes("faut préparer") ||
    lowerQuery.includes("besoin de préparer");

  if (isCreateTask) {
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
      quickActions: [
        { label: "Open task board", href: "/tasks" },
        { label: "Plan my day", query: "Organise ma journée" },
      ],
      suggestions: [
        "Quelles sont mes 3 prochaines tâches prioritaires ?",
        "Quels projets nécessitent mon attention ?",
        "Aide-moi à organiser cette semaine.",
      ],
    };
  }

  // 2. DAILY OPERATIONAL PLANNING ("Organise ma journée" — Section 10)
  const isDayPlanning =
    lowerQuery.includes("organise ma journée") ||
    lowerQuery.includes("organise la journée") ||
    lowerQuery.includes("organiser ma journée") ||
    lowerQuery.includes("plan my day") ||
    lowerQuery.includes("planning du jour") ||
    lowerQuery.includes("programme du jour") ||
    (lowerQuery.includes("que") && lowerQuery.includes("faire aujourd'hui"));

  if (isDayPlanning) {
    const overdue = open.filter((t) => t.due_at && asDate(t.due_at)!.getTime() < now.getTime());
    const dueToday = open.filter((t) => t.due_at && daysUntil(asDate(t.due_at)!, now) === 0);
    const blocked = open.filter((t) => t.status === "blocked");
    const highPriority = open.filter((t) => (t.priority === "urgent" || t.priority === "high") && !overdue.includes(t) && !dueToday.includes(t));

    const pool = [
      ...overdue.map((t) => ({ task: t, reason: `Overdue by ${plural(Math.abs(daysUntil(asDate(t.due_at)!, now)), "day")}`, urgency: 1 })),
      ...blocked.map((t) => ({ task: t, reason: "Blocker holding downstream work", urgency: 2 })),
      ...dueToday.map((t) => ({ task: t, reason: "Deadline lands today", urgency: 3 })),
      ...highPriority.map((t) => ({ task: t, reason: `${t.priority ?? "High"} priority commitment`, urgency: 4 })),
      ...open.filter((t) => !overdue.includes(t) && !dueToday.includes(t) && !blocked.includes(t) && !highPriority.includes(t)).map((t) => ({ task: t, reason: "Active backlog deliverable", urgency: 5 })),
    ];

    const uniqueTasks = Array.from(new Map(pool.map((p) => [p.task.id, p])).values());
    const daySchedule: IntelligenceItem[] = [];

    const timeSlots = ["09:00", "10:30", "14:00", "15:30"];
    for (let i = 0; i < Math.min(timeSlots.length, uniqueTasks.length); i++) {
      const item = uniqueTasks[i];
      const slot = timeSlots[i];
      daySchedule.push({
        id: `slot-${i}`,
        title: `${slot} — ${item.task.title}`,
        subtitle: `Reason: ${item.reason} · Project: ${item.task.project_id ? (projectMap.get(item.task.project_id)?.name ?? "General") : "General"}`,
        badge: {
          label: slot,
          tone: item.urgency === 1 || item.urgency === 2 ? "danger" : item.urgency === 3 ? "warning" : "neutral",
        },
        href: "/tasks",
        reasons: [`Reason: ${item.reason}`],
      });
    }

    if (daySchedule.length === 0) {
      daySchedule.push({
        id: "slot-empty",
        title: "No urgent tasks scheduled for today",
        subtitle: "Your queue is clear. Good window for strategic deep work.",
        badge: { label: "CLEAR", tone: "success" },
        href: "/tasks?create=1",
        reasons: ["No open commitments in workspace"],
      });
    }

    return {
      query,
      intent: "planning",
      headline: "Operational schedule for today",
      narrative: daySchedule.length > 1
        ? `NEXUS structured your workday based on verified deadlines and dependencies: clear overdue debt first at 09:00, address blockers before noon, and execute scheduled commitments this afternoon.`
        : `Your workspace has no immediate deadline debt today. A clear window to advance strategic projects or add new deliverables.`,
      provider: "nexus-engine",
      evidence: {
        metrics: [
          { label: "09:00 Focus", value: uniqueTasks[0]?.task.title ? uniqueTasks[0].task.title.slice(0, 24) : "Open slot" },
          { label: "Overdue debt", value: String(overdue.length) },
          { label: "Due today", value: String(dueToday.length) },
          { label: "Blockers", value: String(blocked.length) },
        ],
        traceCount: `Sequenced ${daySchedule.length} time-blocks from verified workspace data`,
        sources: ["Today Schedule", "Task Due Dates"],
      },
      items: daySchedule,
      action: uniqueTasks.length > 0 ? {
        id: "act-start-today",
        type: "open_task",
        label: `Start with "${uniqueTasks[0].task.title}"`,
        confirmationRequired: false,
        payload: { url: "/tasks" },
      } : undefined,
      quickActions: [
        { label: "Open task board", href: "/tasks" },
        { label: "Inspect projects", href: "/projects" },
      ],
      suggestions: [
        "Quelles sont mes 3 prochaines tâches prioritaires ?",
        "Quels projets nécessitent mon attention ?",
        "Aide-moi à organiser cette semaine.",
      ],
    };
  }

  // 2. ANALYSE (Projects needing attention, risk of delays, key issues)
  // A planning request ("plan pour rattraper mes tâches en retard")
  // must never be hijacked by the "retard" keyword — planning wins.
  const isPlanningRequest =
    lowerQuery.includes("organis") ||
    lowerQuery.includes("plan") ||
    lowerQuery.includes("planning") ||
    lowerQuery.includes("schedule") ||
    lowerQuery.includes("rattrap") ||
    lowerQuery.includes("rattrape") ||
    lowerQuery.includes("catch up") ||
    lowerQuery.includes("aide-moi") ||
    lowerQuery.includes("aide moi") ||
    lowerQuery.includes("prépare") ||
    lowerQuery.includes("prepare");
  if (
    !isPlanningRequest &&
    (lowerQuery.includes("attention") ||
      lowerQuery.includes("nécessitent") ||
      lowerQuery.includes("need attention") ||
      lowerQuery.includes("require attention") ||
      lowerQuery.includes("retard") ||
      lowerQuery.includes("slipping") ||
      lowerQuery.includes("problème") ||
      lowerQuery.includes("issues") ||
      (has(tokens, "attention") && has(tokens, "projet", "projets", "project", "projects")))
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
    lowerQuery.includes("aide moi à organiser") ||
    lowerQuery.includes("plan pour") ||
    lowerQuery.includes("plan de rattrapage") ||
    lowerQuery.includes("rattrap") ||
    lowerQuery.includes("rattrape") ||
    lowerQuery.includes("catch up") ||
    lowerQuery.includes("fais-moi un plan") ||
    lowerQuery.includes("fais moi un plan") ||
    lowerQuery.includes("prepare-moi") ||
    lowerQuery.includes("prepare me") ||
    lowerQuery.includes("prépare-moi") ||
    lowerQuery.includes("un planning")
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

  // 6. DÉTECTION (Blocked projects, overdue work, impediments)
  if (
    lowerQuery.includes("projets bloqu") ||
    lowerQuery.includes("projet bloqu") ||
    lowerQuery.includes("projets semblent bloqu") ||
    lowerQuery.includes("blocked project") ||
    lowerQuery.includes("projects blocked") ||
    lowerQuery.includes("stalled project") ||
    lowerQuery.includes("bloqu") ||
    lowerQuery.includes("block") ||
    lowerQuery.includes("stuck") ||
    lowerQuery.includes("stall") ||
    lowerQuery.includes("empêche") ||
    lowerQuery.includes("empeche") ||
    lowerQuery.includes("overdue") ||
    lowerQuery.includes("en retard")
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

/**
 * Public entry point: deterministic reasoning, then normalized with the
 * structured intent contract (Phase 3). This keeps the core function
 * untouched so existing callers and tests keep their behavior.
 */
export function reasonWorkspace(
  snapshot: WorkspaceSnapshot,
  query: string,
  context?: WorkspaceContextSummary,
  sessionHistory?: SessionHistoryItem[],
  /** Target resolved by the reference resolver (Phase 2 memory). Used
   *  as a priority fallback for referential branches — never guessed. */
  resolvedTarget?: IntelligenceTarget
): StructuredIntelligenceResponse {
  const response = reasonWorkspaceCore(snapshot, query, context, sessionHistory, resolvedTarget);
  const classified = classifyIntent(query, { snapshot, sessionHistory, resolvedTarget });
  return {
    ...response,
    intentId: response.intentId ?? mapLegacyIntentToId(response.intent, response.action?.type),
    target: response.target ?? classified.target,
    action: response.action
      ? {
          ...response.action,
          risk: response.action.risk ?? riskForAction(response.action.type),
        }
      : undefined,
  };
}

export function askWorkspace(
  snapshot: WorkspaceSnapshot,
  query: string,
  sessionHistory?: SessionHistoryItem[]
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

  const reasoned = reasonWorkspace(snapshot, query, undefined, sessionHistory);
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

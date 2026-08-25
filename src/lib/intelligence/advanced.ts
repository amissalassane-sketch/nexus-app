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
  const projectsById = new Map(snapshot.projects.map((p) => [p.id, p]));

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
  | "health"
  | "help"
  | "empty";

export interface AskAnswer {
  kind: AskKind;
  title: string;
  /** Fact rows: the evidence behind the answer. */
  lines: { label: string; value: string }[];
  /** Deep links into the exact saved view that answers the question. */
  links: { href: string; label: string }[];
  /** Follow-up questions that map to other intents. */
  suggestions: string[];
}

const SUGGESTIONS: Record<AskKind, string[]> = {
  blocked: ["What is overdue?", "What should I do next?", "How is the workspace?"],
  overdue: ["What is blocked?", "What is due this week?", "What should I do next?"],
  today: ["What is overdue?", "What should I do next?", "How is the workspace?"],
  week: ["What is due today?", "What moved this week?", "What should I do next?"],
  momentum: ["What is due this week?", "How is the workspace?", "What should I do next?"],
  next: ["What is blocked?", "What is overdue?", "How is the workspace?"],
  project: ["What is blocked?", "What should I do next?", "How is the workspace?"],
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
export function askWorkspace(
  snapshot: WorkspaceSnapshot,
  query: string
): AskAnswer {
  const now = snapshot.now ?? new Date();
  const open = snapshot.tasks.filter(isActiveTask);
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

  // ---- a specifically named project -----------------------------
  const STOPWORDS = new Set([
    "project", "projets", "the", "how", "is", "what", "whats", "status",
    "about", "doing", "going", "with", "tell", "me", "show", "and", "for", "workspace",
    "a", "an", "of", "on", "in", "to", "it", "its", "that", "this",
    "block", "blocked", "overdue", "late", "today", "week", "next",
    "momentum", "health", "should", "work",
  ]);

  const askedAboutProjects = tokens.some((token) =>
    ["project", "projects", "projet", "projets"].includes(token)
  );
  const nameMatch = findNamedProject(snapshot, lowerQuery, tokens, STOPWORDS);

  if (askedAboutProjects && nameMatch) {
    return projectAnswer(nameMatch, snapshot, now);
  }
  if (nameMatch && !anyIntentToken(tokens)) {
    return projectAnswer(nameMatch, snapshot, now);
  }

  // ---- blocked --------------------------------------------------
  if (has(tokens, "block", "stuck", "stall", "bloqu")) {
    const blocked = open.filter((task) => task.status === "blocked");
    return {
      kind: "blocked",
      title:
        blocked.length === 0
          ? "Nothing is blocked right now"
          : `${plural(blocked.length, "task")} blocked`,
      lines:
        blocked.length === 0
          ? [{ label: "Open tasks", value: String(open.length) }]
          : [
              {
                label: "First blocked",
                value: blocked[0].title,
              },
              ...(blocked.length > 1
                ? [{ label: "Also blocked", value: `${blocked.length - 1} more` }]
                : []),
            ],
      links:
        blocked.length > 0
          ? [{ href: "/tasks?filter=blocked", label: "Review blocked work" }]
          : [],
      suggestions: SUGGESTIONS.blocked,
    };
  }

  // ---- overdue --------------------------------------------------
  if (has(tokens, "overdue", "late", "delayed", "past", "en retard")) {
    const overdue = open.filter((task) => {
      const due = asDate(task.due_at);
      return due !== null && due.getTime() < now.getTime();
    });
    return {
      kind: "overdue",
      title:
        overdue.length === 0
          ? "Nothing is overdue"
          : `${plural(overdue.length, "task")} past their date`,
      lines:
        overdue.length === 0
          ? [{ label: "On time", value: "Every dated task is within its window" }]
          : [
              {
                label: "Oldest",
                value: `${overdue[0].title} (${formatShortRelative(overdue[0].due_at!, now)})`,
              },
              ...(overdue.length > 1
                ? [{ label: "Also late", value: `${overdue.length - 1} more` }]
                : []),
            ],
      links:
        overdue.length > 0
          ? [{ href: "/tasks?filter=overdue", label: "Review overdue work" }]
          : [],
      suggestions: SUGGESTIONS.overdue,
    };
  }

  // ---- today ----------------------------------------------------
  if (has(tokens, "today", "now", "aujourd")) {
    const dueToday = open.filter((task) => {
      const due = asDate(task.due_at);
      return due !== null && daysUntil(due, now) === 0;
    });
    return {
      kind: "today",
      title:
        dueToday.length === 0
          ? "Nothing is due today"
          : `${plural(dueToday.length, "task")} due today`,
      lines:
        dueToday.length === 0
          ? [{ label: "Open tasks", value: String(open.length) }]
          : dueToday.slice(0, 3).map((task) => ({
              label: task.priority ?? "medium",
              value: task.title,
            })),
      links:
        dueToday.length > 0
          ? [{ href: "/tasks?filter=today", label: "Plan the day" }]
          : [],
      suggestions: SUGGESTIONS.today,
    };
  }

  // ---- momentum / what moved --------------------------------------
  if (
    has(
      tokens,
      "momentum",
      "shipped",
      "completed",
      "done",
      "moved",
      "progress",
      "velocity",
      "throughput",
      "productiv"
    )
  ) {
    const weekAgo = now.getTime() - 7 * 86_400_000;
    const completed = snapshot.tasks.filter((task) => {
      const at = asDate(task.completed_at);
      return at !== null && at.getTime() >= weekAgo;
    });
    return {
      kind: "momentum",
      title:
        completed.length === 0
          ? "No completions in the last seven days"
          : `${plural(completed.length, "task")} completed this week`,
      lines:
        completed.length === 0
          ? [{ label: "Open tasks", value: String(open.length) }]
          : [
              { label: "Completed (7d)", value: String(completed.length) },
              { label: "Still open", value: String(open.length) },
              ...(completed[0]?.completed_at
                ? [
                    {
                      label: "Latest",
                      value: completed[0].title,
                    },
                  ]
                : []),
            ],
      links: [{ href: "/activity", label: "See the activity log" }],
      suggestions: SUGGESTIONS.momentum,
    };
  }

  // ---- this week --------------------------------------------------
  if (has(tokens, "week", "semaine", "upcoming", "coming")) {
    const weekAhead = now.getTime() + 7 * 86_400_000;
    const dueThisWeek = open.filter((task) => {
      const due = asDate(task.due_at);
      return (
        due !== null &&
        due.getTime() >= now.getTime() &&
        due.getTime() <= weekAhead
      );
    });
    return {
      kind: "week",
      title:
        dueThisWeek.length === 0
          ? "Nothing lands in the next seven days"
          : `${plural(dueThisWeek.length, "task")} due in the next seven days`,
      lines:
        dueThisWeek.length === 0
          ? [
              {
                label: "Window",
                value: "Clear week — good time for drifting work",
              },
            ]
          : dueThisWeek.slice(0, 3).map((task) => ({
              label: formatShortRelative(task.due_at!, now),
              value: task.title,
            })),
      links:
        dueThisWeek.length > 0
          ? [{ href: "/tasks", label: "Open the task board" }]
          : [],
      suggestions: SUGGESTIONS.week,
    };
  }

  // ---- health ------------------------------------------------------
  if (
    has(tokens, "health", "status", "score", "shape", "going", "overall") ||
    lowerQuery.includes("how are we") ||
    lowerQuery.includes("workspace")
  ) {
    const health = workspaceHealth(snapshot);
    return {
      kind: "health",
      title: `Operating index: ${health.score}/100 — ${health.band}`,
      lines: health.factors
        .filter((factor) => factor.penalty > 0)
        .slice(0, 3)
        .map((factor) => ({
          label: factor.label,
          value: factor.evidence,
        })),
      links: [{ href: "/app/intelligence", label: "Open Intelligence" }],
      suggestions: SUGGESTIONS.health,
    };
  }

  // ---- next / priority ---------------------------------------------
  if (has(tokens, "next", "focus", "priority", "should", "first", "work on", "do")) {
    const action = nextBestAction(snapshot);
    const ranked = rankPriorities(snapshot, 3);
    return {
      kind: "next",
      title: action ? action.title : "Nothing needs a decision right now",
      lines: [
        ...(action ? [{ label: "Why", value: action.reason }] : []),
        ...ranked
          .filter((entry) => entry.task.id !== action?.entity.id)
          .slice(0, 2)
          .map((entry) => ({
            label: `#${ranked.indexOf(entry) + 2}`,
            value: `${entry.task.title} — ${entry.reasons[0]}`,
          })),
      ],
      links: action ? [{ href: action.href, label: action.cta }] : [],
      suggestions: SUGGESTIONS.next,
    };
  }

  // ---- fallback: honest steering, not a guess -----------------------
  const health = workspaceHealth(snapshot);
  return {
    kind: "help",
    title: "I read this workspace, not a chat script",
    lines: [
      { label: "Try", value: "“What is blocked?” or “What is overdue?”" },
      { label: "Or", value: "“What should I do next?”" },
      { label: "Workspace", value: `${snapshot.projects.length} projects · ${open.length} open tasks · index ${health.score}/100` },
    ],
    links: [{ href: "/app/intelligence", label: "Open Intelligence" }],
    suggestions: SUGGESTIONS.help,
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
    "next", "focus", "priority", "should", "first",
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

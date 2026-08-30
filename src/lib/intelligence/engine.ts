// ============================================================
// NEXUS INTELLIGENCE — DETERMINISTIC ENGINE
// ============================================================
// A pure, dependency-free engine that turns the *real* workspace data
// into actionable signals. It never calls an external service and never
// invents data. Every signal carries the evidence it was derived from,
// so "why NEXUS flagged this" is always answerable from the workspace
// itself — no chain-of-thought, no unverifiable claims.
//
// An optional LLM layer can later consume the AGGREGATED signals via
// `summarizeForLLM()` — raw rows and secrets are never shipped anywhere.
// That key must be server-only (`NEXUS_AI_API_KEY`, never `NEXT_PUBLIC_*`).
// ============================================================

export type InsightSeverity = "critical" | "warning" | "info" | "positive";

/** The operational category of a signal — drives icon, label and grouping. */
export type SignalKind =
  | "blocked"
  | "at-risk"
  | "deadline"
  | "drifting"
  | "inactive"
  | "dependency"
  | "opportunity"
  | "momentum";

export type EntityRef = {
  type: "task" | "project" | "goal" | "workspace";
  id: string;
  label: string;
};

/** One piece of verifiable evidence behind a signal. */
export type Evidence = {
  label: string;
  value: string;
};

export type Insight = {
  id: string;
  kind: SignalKind;
  severity: InsightSeverity;
  title: string;
  /** One-sentence explanation, always derived from the snapshot. */
  reason: string;
  /** The facts NEXUS used. Rendered under "Why NEXUS flagged this". */
  evidence: Evidence[];
  entity: EntityRef;
  href: string;
  /** The recommended next action label — always a verb. */
  cta: string;
  /** ISO timestamp of the most recent fact behind the signal, if any. */
  detectedFrom?: string | null;
  /** How many entities this signal covers (used for "3 blocked items"). */
  count?: number;
};

export type TaskLike = {
  id: string;
  title: string;
  status: string;
  priority?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  project_id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type ProjectLike = {
  id: string;
  name: string;
  status?: string | null;
  due_date?: string | null;
  goal_id?: string | null;
  progress?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type GoalLike = {
  id: string;
  title: string;
  status?: string | null;
  progress?: number | null;
  target_date?: string | null;
  updated_at?: string | null;
};

export type WorkspaceSnapshot = {
  tasks: TaskLike[];
  projects: ProjectLike[];
  goals: GoalLike[];
  now?: Date;
};

const DONE_STATUSES = new Set(["done", "cancelled"]);

/** Human labels for each signal kind. Never colour alone. */
export const SIGNAL_LABEL: Record<SignalKind, string> = {
  blocked: "Blocked",
  "at-risk": "At risk",
  deadline: "Deadline",
  drifting: "Drifting",
  inactive: "Inactive",
  dependency: "Dependency",
  opportunity: "Opportunity",
  momentum: "Momentum",
};

export const SEVERITY_LABEL: Record<InsightSeverity, string> = {
  critical: "Critical",
  warning: "High",
  info: "Medium",
  positive: "Informational",
};

export function isActiveTask(task: TaskLike): boolean {
  return !DONE_STATUSES.has(task.status);
}

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** True when `date` falls on the same calendar day as `now`. */
function isSameDay(date: Date, now: Date): boolean {
  return date.toDateString() === now.toDateString();
}

function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

function daysSince(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3,
};

export function sortInsights(insights: Insight[]): Insight[] {
  return [...insights].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

// ============================================================
// SIGNALS
// ============================================================

/**
 * Computes every signal for a workspace snapshot. Pure and deterministic:
 * the same snapshot always produces the same signals, in the same order.
 */
export function computeInsights(snapshot: WorkspaceSnapshot): Insight[] {
  const now = snapshot.now ?? new Date();
  const insights: Insight[] = [];

  const activeTasks = snapshot.tasks.filter(isActiveTask);
  const completedTasks = snapshot.tasks.filter((task) => !isActiveTask(task));
  const projectsById = new Map(snapshot.projects.map((p) => [p.id, p]));

  // ---- OVERDUE ----------------------------------------------------
  const overdue = activeTasks
    .map((task) => ({ task, due: asDate(task.due_at) }))
    .filter((entry) => entry.due !== null && entry.due.getTime() < now.getTime())
    .sort((a, b) => a.due!.getTime() - b.due!.getTime());

  if (overdue.length > 0) {
    const oldest = overdue[0].task;
    const project = oldest.project_id ? projectsById.get(oldest.project_id) : null;
    const lateBy = Math.abs(daysUntil(overdue[0].due!, now));

    insights.push({
      id: "overdue",
      kind: "deadline",
      severity: "critical",
      title:
        overdue.length === 1
          ? `“${oldest.title}” is past its due date`
          : `${overdue.length} tasks are past their due date`,
      reason: `The oldest is “${oldest.title}”, due ${formatRelative(
        oldest.due_at!,
        now
      )} and still open.`,
      evidence: [
        { label: "Tasks overdue", value: String(overdue.length) },
        { label: "Oldest overdue by", value: plural(lateBy, "day") },
        ...(project
          ? [{ label: "Project", value: project.name }]
          : []),
      ],
      entity: { type: "task", id: oldest.id, label: oldest.title },
      href: "/tasks?filter=overdue",
      cta: "Review overdue work",
      detectedFrom: oldest.due_at ?? null,
      count: overdue.length,
    });
  }

  // ---- BLOCKED ----------------------------------------------------
  const blocked = activeTasks.filter((task) => task.status === "blocked");
  if (blocked.length > 0) {
    const first = blocked[0];
    const project = first.project_id ? projectsById.get(first.project_id) : null;
    const blockedProjects = new Set(
      blocked.map((task) => task.project_id).filter(Boolean)
    );

    insights.push({
      id: "blocked",
      kind: "blocked",
      severity: "critical",
      title:
        blocked.length === 1
          ? `“${first.title}” is blocked`
          : `${blocked.length} items are blocked`,
      reason:
        blocked.length === 1
          ? "This task is marked blocked, so nothing downstream of it can move."
          : `Work is stalled across ${plural(
              Math.max(blockedProjects.size, 1),
              "project"
            )} until these are unblocked.`,
      evidence: [
        { label: "Blocked tasks", value: String(blocked.length) },
        ...(blockedProjects.size > 0
          ? [{ label: "Projects affected", value: String(blockedProjects.size) }]
          : []),
        ...(project ? [{ label: "First blocked in", value: project.name }] : []),
      ],
      entity: { type: "task", id: first.id, label: first.title },
      href: "/tasks?filter=blocked",
      cta: "Resolve blockers",
      detectedFrom: first.updated_at ?? null,
      count: blocked.length,
    });
  }

  // ---- DEADLINE PRESSURE (projects) -------------------------------
  for (const project of snapshot.projects) {
    const due = asDate(project.due_date);
    if (!due) continue;

    const remaining = daysUntil(due, now);
    if (remaining < 0 || remaining > 7) continue;

    const projectTasks = snapshot.tasks.filter((t) => t.project_id === project.id);
    const open = projectTasks.filter(isActiveTask);
    if (open.length === 0) continue;

    insights.push({
      id: `project-deadline-${project.id}`,
      kind: "at-risk",
      severity: remaining <= 3 ? "critical" : "warning",
      title: `“${project.name}” may miss its date`,
      reason: `The deadline is ${
        remaining === 0 ? "today" : `in ${plural(remaining, "day")}`
      } and ${plural(open.length, "task")} ${
        open.length === 1 ? "remains" : "remain"
      } incomplete.`,
      evidence: [
        {
          label: "Deadline",
          value: remaining === 0 ? "Today" : `In ${plural(remaining, "day")}`,
        },
        { label: "Open tasks", value: String(open.length) },
        {
          label: "Completed",
          value: `${projectTasks.length - open.length}/${projectTasks.length}`,
        },
      ],
      entity: { type: "project", id: project.id, label: project.name },
      href: "/projects",
      cta: "Rebalance the project",
      detectedFrom: project.due_date ?? null,
      count: open.length,
    });
  }

  // ---- DUE TODAY --------------------------------------------------
  const dueToday = activeTasks.filter((task) => {
    const due = asDate(task.due_at);
    return due !== null && isSameDay(due, now);
  });
  if (dueToday.length > 0) {
    const first = dueToday[0];
    insights.push({
      id: "due-today",
      kind: "deadline",
      severity: "warning",
      title:
        dueToday.length === 1
          ? `“${first.title}” is due today`
          : `${dueToday.length} tasks are due today`,
      reason:
        dueToday.length === 1
          ? "It is scheduled for today and is still open."
          : "These are scheduled for today and are still open.",
      evidence: [
        { label: "Due today", value: String(dueToday.length) },
        {
          label: "Highest priority",
          value:
            [...dueToday].sort(
              (a, b) => priorityWeight(b.priority) - priorityWeight(a.priority)
            )[0]?.priority ?? "medium",
        },
      ],
      entity: { type: "task", id: first.id, label: first.title },
      href: "/tasks?filter=today",
      cta: "Plan the day",
      detectedFrom: first.due_at ?? null,
      count: dueToday.length,
    });
  }

  // ---- INACTIVE / DRIFTING PROJECTS -------------------------------
  for (const project of snapshot.projects) {
    const projectTasks = snapshot.tasks.filter((t) => t.project_id === project.id);
    const hasActiveTask = projectTasks.some(isActiveTask);

    if (projectTasks.length === 0) {
      insights.push({
        id: `empty-project-${project.id}`,
        kind: "opportunity",
        severity: "info",
        title: `“${project.name}” has no work attached`,
        reason:
          "There are no tasks in this project, so NEXUS cannot track progress on it.",
        evidence: [
          { label: "Tasks", value: "0" },
          { label: "Status", value: project.status ?? "planning" },
        ],
        entity: { type: "project", id: project.id, label: project.name },
        href: "/projects",
        cta: "Add the first task",
        detectedFrom: project.created_at ?? null,
      });
      continue;
    }

    if (!hasActiveTask) {
      insights.push({
        id: `stale-project-${project.id}`,
        kind: "inactive",
        severity: "info",
        title: `“${project.name}” has no next action`,
        reason: "Every task in this project is done or cancelled.",
        evidence: [
          { label: "Tasks", value: String(projectTasks.length) },
          { label: "Open", value: "0" },
        ],
        entity: { type: "project", id: project.id, label: project.name },
        href: "/projects",
        cta: "Close or extend the project",
        detectedFrom: project.updated_at ?? null,
      });
      continue;
    }

    // Drifting: open work exists, but nothing has moved in 10+ days.
    const lastTouch = projectTasks
      .map((task) => asDate(task.updated_at) ?? asDate(task.created_at))
      .filter((date): date is Date => date !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    if (lastTouch && daysSince(lastTouch, now) >= 10) {
      insights.push({
        id: `drifting-project-${project.id}`,
        kind: "drifting",
        severity: "warning",
        title: `“${project.name}” has gone quiet`,
        reason: `Nothing in this project has changed in ${plural(
          daysSince(lastTouch, now),
          "day"
        )}, and ${plural(
          projectTasks.filter(isActiveTask).length,
          "task"
        )} ${
          projectTasks.filter(isActiveTask).length === 1 ? "is" : "are"
        } still open.`,
        evidence: [
          { label: "Last activity", value: `${daysSince(lastTouch, now)} days ago` },
          {
            label: "Open tasks",
            value: String(projectTasks.filter(isActiveTask).length),
          },
          ...(project.due_date
            ? [{ label: "Deadline", value: formatRelative(project.due_date, now) }]
            : []),
        ],
        entity: { type: "project", id: project.id, label: project.name },
        href: "/projects",
        cta: "Restart the project",
        detectedFrom: lastTouch.toISOString(),
      });
    }
  }

  // ---- GOAL AT RISK ------------------------------------------------
  for (const goal of snapshot.goals) {
    if (goal.status === "completed") continue;

    const target = asDate(goal.target_date);
    const progress = toNumber(goal.progress);
    if (target === null || progress >= 80) continue;

    const remaining = daysUntil(target, now);
    if (remaining > 14) continue;

    insights.push({
      id: `goal-at-risk-${goal.id}`,
      kind: "at-risk",
      severity: remaining < 0 ? "critical" : "warning",
      title: `“${goal.title}” is behind`,
      reason: `${Math.round(progress)}% complete with ${
        remaining < 0
          ? "the target date already passed"
          : `${plural(remaining, "day")} to the target date`
      }.`,
      evidence: [
        { label: "Progress", value: `${Math.round(progress)}%` },
        {
          label: "Target date",
          value:
            remaining < 0
              ? `${plural(Math.abs(remaining), "day")} ago`
              : `In ${plural(remaining, "day")}`,
        },
        { label: "Status", value: goal.status ?? "active" },
      ],
      entity: { type: "goal", id: goal.id, label: goal.title },
      href: "/goals",
      cta: "Re-scope the goal",
      detectedFrom: goal.target_date ?? null,
    });
  }

  // ---- UNASSIGNED / UNSCHEDULED (dependency-style signal) ----------
  const undated = activeTasks.filter((task) => !task.due_at);
  if (activeTasks.length >= 5 && undated.length / activeTasks.length > 0.6) {
    insights.push({
      id: "unscheduled",
      kind: "dependency",
      severity: "info",
      title: `${undated.length} open tasks have no date`,
      reason:
        "Without dates NEXUS cannot detect deadline pressure on this work, so risk stays invisible.",
      evidence: [
        { label: "Undated", value: String(undated.length) },
        { label: "Open tasks", value: String(activeTasks.length) },
        {
          label: "Share undated",
          value: `${Math.round((undated.length / activeTasks.length) * 100)}%`,
        },
      ],
      entity: { type: "workspace", id: "workspace", label: "Workspace" },
      href: "/tasks",
      cta: "Add dates",
    });
  }

  // ---- MOMENTUM ----------------------------------------------------
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const completedLastWeek = completedTasks.filter((task) => {
    const completed = asDate(task.completed_at);
    return completed !== null && completed.getTime() >= sevenDaysAgo.getTime();
  });
  if (completedLastWeek.length > 0) {
    insights.push({
      id: "momentum",
      kind: "momentum",
      severity: "positive",
      title: `${plural(completedLastWeek.length, "task")} completed this week`,
      reason: "Throughput over the last seven days, measured from completion dates.",
      evidence: [
        { label: "Completed (7d)", value: String(completedLastWeek.length) },
        { label: "Still open", value: String(activeTasks.length) },
      ],
      entity: { type: "workspace", id: "workspace", label: "Workspace" },
      href: "/activity",
      cta: "See what shipped",
      count: completedLastWeek.length,
    });
  }

  return sortInsights(insights);
}

function priorityWeight(priority: string | null | undefined): number {
  return { urgent: 4, high: 3, medium: 2, low: 1 }[priority ?? ""] ?? 0;
}

// ============================================================
// NEXT BEST ACTION
// ============================================================

/**
 * Returns the single most important thing to do next, following the
 * priority order: no project -> no task -> overdue -> blocked ->
 * high priority -> next active task.
 */
export function nextBestAction(snapshot: WorkspaceSnapshot): Insight | null {
  const now = snapshot.now ?? new Date();

  if (snapshot.projects.length === 0) {
    return {
      id: "nba-create-project",
      kind: "opportunity",
      severity: "info",
      title: "Create your first project",
      reason:
        "There are no projects in this workspace yet, so work has nothing to belong to.",
      evidence: [{ label: "Projects", value: "0" }],
      entity: { type: "workspace", id: "workspace", label: "Workspace" },
      href: "/projects?create=1",
      cta: "Create project",
    };
  }

  if (snapshot.tasks.length === 0) {
    return {
      id: "nba-create-task",
      kind: "opportunity",
      severity: "info",
      title: "Add the first task",
      reason: "Your projects have no tasks yet, so nothing is actionable.",
      evidence: [
        { label: "Projects", value: String(snapshot.projects.length) },
        { label: "Tasks", value: "0" },
      ],
      entity: { type: "workspace", id: "workspace", label: "Workspace" },
      href: "/tasks?create=1",
      cta: "Create task",
    };
  }

  const activeTasks = snapshot.tasks.filter(isActiveTask);

  const overdue = activeTasks
    .filter((task) => {
      const due = asDate(task.due_at);
      return due !== null && due.getTime() < now.getTime();
    })
    .sort(
      (a, b) =>
        (asDate(a.due_at)?.getTime() ?? 0) - (asDate(b.due_at)?.getTime() ?? 0)
    );

  if (overdue.length > 0) {
    const task = overdue[0];
    const lateBy = Math.abs(daysUntil(asDate(task.due_at)!, now));
    return {
      id: "nba-overdue",
      kind: "deadline",
      severity: "critical",
      title: `Finish “${task.title}”`,
      reason: `It is the oldest overdue task in the workspace (${formatRelative(
        task.due_at!,
        now
      )}).`,
      evidence: [
        { label: "Overdue by", value: plural(lateBy, "day") },
        { label: "Other overdue tasks", value: String(overdue.length - 1) },
        { label: "Priority", value: task.priority ?? "medium" },
      ],
      entity: { type: "task", id: task.id, label: task.title },
      href: "/tasks?filter=overdue",
      cta: "Open task",
      detectedFrom: task.due_at,
    };
  }

  const blocked = activeTasks.find((task) => task.status === "blocked");
  if (blocked) {
    return {
      id: "nba-blocked",
      kind: "blocked",
      severity: "warning",
      title: `Unblock “${blocked.title}”`,
      reason: "It is blocked, which stalls everything that depends on it.",
      evidence: [
        { label: "Status", value: "Blocked" },
        { label: "Priority", value: blocked.priority ?? "medium" },
        ...(blocked.due_at
          ? [{ label: "Due", value: formatRelative(blocked.due_at, now) }]
          : []),
      ],
      entity: { type: "task", id: blocked.id, label: blocked.title },
      href: "/tasks?filter=blocked",
      cta: "Open task",
      detectedFrom: blocked.updated_at ?? null,
    };
  }

  const highPriority = [...activeTasks].sort(
    (a, b) => priorityWeight(b.priority) - priorityWeight(a.priority)
  )[0];

  if (highPriority && priorityWeight(highPriority.priority) >= 3) {
    return {
      id: "nba-priority",
      kind: "opportunity",
      severity: "info",
      title: `Work on “${highPriority.title}”`,
      reason: `It is the highest-priority open task (${
        highPriority.priority ?? "medium"
      }).`,
      evidence: [
        { label: "Priority", value: highPriority.priority ?? "medium" },
        { label: "Open tasks", value: String(activeTasks.length) },
        ...(highPriority.due_at
          ? [{ label: "Due", value: formatRelative(highPriority.due_at, now) }]
          : []),
      ],
      entity: { type: "task", id: highPriority.id, label: highPriority.title },
      href: "/tasks",
      cta: "Open task",
    };
  }

  if (activeTasks.length > 0) {
    const next = activeTasks[0];
    return {
      id: "nba-next",
      kind: "opportunity",
      severity: "info",
      title: `Next: “${next.title}”`,
      reason: "Nothing is overdue or blocked. This is the next open task.",
      evidence: [
        { label: "Open tasks", value: String(activeTasks.length) },
        { label: "Overdue", value: "0" },
      ],
      entity: { type: "task", id: next.id, label: next.title },
      href: "/tasks",
      cta: "Open task",
    };
  }

  return null;
}

// ============================================================
// WORKSPACE CONTEXT — what NEXUS currently understands
// ============================================================

export type WorkspaceContext = {
  projects: number;
  activeProjects: number;
  tasks: number;
  openTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  dueThisWeek: number;
  goals: number;
  datedItems: number;
  completionRate: number;
  lastActivity: string | null;
};

/** A compact, factual read of the snapshot — used by the context strip. */
export function describeWorkspace(snapshot: WorkspaceSnapshot): WorkspaceContext {
  const now = snapshot.now ?? new Date();
  const open = snapshot.tasks.filter(isActiveTask);
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);

  const timestamps = [
    ...snapshot.tasks.map((t) => t.updated_at ?? t.created_at),
    ...snapshot.projects.map((p) => p.updated_at ?? p.created_at),
  ]
    .map((value) => asDate(value))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime());

  return {
    projects: snapshot.projects.length,
    activeProjects: snapshot.projects.filter(
      (project) => project.status !== "completed" && project.status !== "archived"
    ).length,
    tasks: snapshot.tasks.length,
    openTasks: open.length,
    blockedTasks: open.filter((task) => task.status === "blocked").length,
    overdueTasks: open.filter((task) => {
      const due = asDate(task.due_at);
      return due !== null && due.getTime() < now.getTime();
    }).length,
    dueThisWeek: open.filter((task) => {
      const due = asDate(task.due_at);
      return (
        due !== null &&
        due.getTime() >= now.getTime() &&
        due.getTime() <= weekAhead.getTime()
      );
    }).length,
    goals: snapshot.goals.length,
    datedItems:
      snapshot.tasks.filter((task) => task.due_at).length +
      snapshot.projects.filter((project) => project.due_date).length,
    completionRate:
      snapshot.tasks.length > 0
        ? Math.round(
            ((snapshot.tasks.length - open.length) / snapshot.tasks.length) * 100
          )
        : 0,
    lastActivity: timestamps[0]?.toISOString() ?? null,
  };
}

// ============================================================
// OPTIONAL LLM LAYER — AGGREGATED SIGNALS ONLY
// ============================================================

/**
 * Reduces signals to a minimal, aggregated payload. This is the ONLY
 * shape that may ever leave the server to a model provider — never raw
 * rows, never secrets, never user identifiers beyond what is needed.
 */
export function summarizeForLLM(insights: Insight[]) {
  const counts = { critical: 0, warning: 0, info: 0, positive: 0 };
  for (const insight of insights) {
    counts[insight.severity] += 1;
  }
  return {
    counts,
    signals: insights.map(({ id, kind, severity, title, reason, cta }) => ({
      id,
      kind,
      severity,
      title,
      reason,
      cta,
    })),
  };
}

export function formatRelative(value: string, now: Date = new Date()): string {
  const date = asDate(value);
  if (!date) return "no date";
  const diff = daysUntil(date, now);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `in ${diff} days`;
}

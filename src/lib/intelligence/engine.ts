// ============================================================
// NEXUS INTELLIGENCE — DETERMINISTIC ENGINE
// ============================================================
// A pure, dependency-free engine that turns the *real* workspace data
// into actionable insights. It never calls an external service and never
// invents data. Every insight carries a `reason` so the user always
// understands *why* NEXUS is recommending something — never "magic".
//
// An optional LLM layer (section 11) can later consume the AGGREGATED
// signals via `summarizeForLLM()` — raw rows and secrets are never
// shipped anywhere. That key must be server-only (`NEXUS_AI_API_KEY`,
// never `NEXT_PUBLIC_*`).
// ============================================================

export type InsightSeverity = "critical" | "warning" | "info" | "positive";

export type EntityRef = {
  type: "task" | "project" | "goal" | "workspace";
  id: string;
  label: string;
};

export type Insight = {
  id: string;
  severity: InsightSeverity;
  title: string;
  reason: string;
  entity: EntityRef;
  href: string;
  cta: string;
};

export type TaskLike = {
  id: string;
  title: string;
  status: string;
  priority?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  project_id?: string | null;
};

export type ProjectLike = {
  id: string;
  name: string;
  status?: string | null;
  due_date?: string | null;
  goal_id?: string | null;
};

export type GoalLike = {
  id: string;
  title: string;
  status?: string | null;
  progress?: number | null;
  target_date?: string | null;
};

export type WorkspaceSnapshot = {
  tasks: TaskLike[];
  projects: ProjectLike[];
  goals: GoalLike[];
  now?: Date;
};

const DONE_STATUSES = new Set(["done", "cancelled"]);

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

/** True when `date` falls on the same calendar day as `now` (UTC-agnostic). */
function isSameDay(date: Date, now: Date): boolean {
  return date.toDateString() === now.toDateString();
}

function daysUntil(date: Date, now: Date): number {
  const ms = date.getTime() - now.getTime();
  return Math.ceil(ms / 86_400_000);
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

// ============================================================
// SIGNALS
// ============================================================

/**
 * Computes every insight for a workspace snapshot. Pure and deterministic:
 * the same snapshot always produces the same insights.
 */
export function computeInsights(snapshot: WorkspaceSnapshot): Insight[] {
  const now = snapshot.now ?? new Date();
  const insights: Insight[] = [];

  const activeTasks = snapshot.tasks.filter(isActiveTask);
  const completedTasks = snapshot.tasks.filter((task) => !isActiveTask(task));
  const projectsById = new Map(snapshot.projects.map((p) => [p.id, p]));

  // ---- OVERDUE --------------------------------------------------
  const overdue = activeTasks
    .map((task) => ({ task, due: asDate(task.due_at) }))
    .filter((entry) => entry.due !== null && entry.due.getTime() < now.getTime())
    .sort((a, b) => a.due!.getTime() - b.due!.getTime());

  if (overdue.length > 0) {
    const oldest = overdue[0].task;
    const project = oldest.project_id ? projectsById.get(oldest.project_id) : null;
    insights.push({
      id: "overdue",
      severity: "critical",
      title:
        overdue.length === 1
          ? "1 task overdue"
          : `${overdue.length} tasks overdue`,
      reason: `The oldest is "${oldest.title}", due ${formatRelative(
        oldest.due_at!,
        now
      )} and still open.`,
      entity: { type: "task", id: oldest.id, label: oldest.title },
      href: "/tasks",
      cta: "Open task",
    });
    void project;
  }

  // ---- DUE TODAY ------------------------------------------------
  const dueToday = activeTasks.filter((task) => {
    const due = asDate(task.due_at);
    return due !== null && isSameDay(due, now);
  });
  if (dueToday.length > 0) {
    const first = dueToday[0];
    insights.push({
      id: "due-today",
      severity: "info",
      title:
        dueToday.length === 1
          ? `"${first.title}" is due today`
          : `${dueToday.length} tasks due today`,
      reason: "These tasks are scheduled for the current day and are still open.",
      entity: { type: "task", id: first.id, label: first.title },
      href: "/tasks",
      cta: "Open task",
    });
  }

  // ---- BLOCKED --------------------------------------------------
  const blocked = activeTasks.filter((task) => task.status === "blocked");
  for (const task of blocked) {
    insights.push({
      id: `blocked-${task.id}`,
      severity: "warning",
      title: `"${task.title}" is blocked`,
      reason:
        "This task is marked blocked and has no forward progress. Unblock it or reschedule.",
      entity: { type: "task", id: task.id, label: task.title },
      href: "/tasks",
      cta: "Review task",
    });
  }

  // ---- EMPTY / STALE PROJECTS -----------------------------------
  for (const project of snapshot.projects) {
    const projectTasks = snapshot.tasks.filter((t) => t.project_id === project.id);
    const hasActiveTask = projectTasks.some(isActiveTask);

    if (projectTasks.length === 0) {
      insights.push({
        id: `empty-project-${project.id}`,
        severity: "info",
        title: `Give "${project.name}" a first action`,
        reason: "This project has no tasks yet, so nothing is moving it forward.",
        entity: { type: "project", id: project.id, label: project.name },
        href: "/projects",
        cta: "Open project",
      });
    } else if (!hasActiveTask) {
      insights.push({
        id: `stale-project-${project.id}`,
        severity: "info",
        title: `"${project.name}" has no next action`,
        reason: "Every task in this project is done or cancelled.",
        entity: { type: "project", id: project.id, label: project.name },
        href: "/projects",
        cta: "Open project",
      });
    }
  }

  // ---- GOAL AT RISK ---------------------------------------------
  for (const goal of snapshot.goals) {
    const done = goal.status === "completed";
    if (done) continue;

    const target = asDate(goal.target_date);
    const progress = toNumber(goal.progress);
    if (target === null || progress >= 80) continue;

    const remaining = daysUntil(target, now);
    // Close to the deadline (<= 14 days, or already late) with low progress.
    if (remaining <= 14) {
      insights.push({
        id: `goal-at-risk-${goal.id}`,
        severity: "warning",
        title: `"${goal.title}" is at risk`,
        reason: `${progress}% complete with ${
          remaining < 0 ? "a past deadline" : `${remaining} days to the deadline`
        }.`,
        entity: { type: "goal", id: goal.id, label: goal.title },
        href: "/goals",
        cta: "Open goal",
      });
    }
  }

  // ---- MOMENTUM -------------------------------------------------
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const completedLastWeek = completedTasks.filter((task) => {
    const completed = asDate(task.completed_at);
    return completed !== null && completed.getTime() >= sevenDaysAgo.getTime();
  });
  if (completedLastWeek.length > 0) {
    insights.push({
      id: "momentum",
      severity: "positive",
      title: "Weekly momentum",
      reason: `${completedLastWeek.length} ${
        completedLastWeek.length === 1 ? "task" : "tasks"
      } completed in the last 7 days.`,
      entity: { type: "workspace", id: "workspace", label: "Workspace" },
      href: "/tasks",
      cta: "Review completed",
    });
  }

  return sortInsights(insights);
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
      severity: "info",
      title: "Create your first project",
      reason: "There are no projects in this workspace yet, so work has no container.",
      entity: { type: "workspace", id: "workspace", label: "Workspace" },
      href: "/projects?create=1",
      cta: "Create project",
    };
  }

  if (snapshot.tasks.length === 0) {
    return {
      id: "nba-create-task",
      severity: "info",
      title: "Add your first task",
      reason: "Your projects have no tasks yet, so nothing is actionable.",
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
    .sort((a, b) => {
      return (asDate(a.due_at)?.getTime() ?? 0) - (asDate(b.due_at)?.getTime() ?? 0);
    });

  if (overdue.length > 0) {
    const task = overdue[0];
    return {
      id: "nba-overdue",
      severity: "critical",
      title: `Finish "${task.title}"`,
      reason: `It is overdue (${formatRelative(task.due_at!, now)}) and has no completed next step.`,
      entity: { type: "task", id: task.id, label: task.title },
      href: "/tasks",
      cta: "Open task",
    };
  }

  const blocked = activeTasks.find((task) => task.status === "blocked");
  if (blocked) {
    return {
      id: "nba-blocked",
      severity: "warning",
      title: `Unblock "${blocked.title}"`,
      reason: "It is blocked, which stalls everything that depends on it.",
      entity: { type: "task", id: blocked.id, label: blocked.title },
      href: "/tasks",
      cta: "Open task",
    };
  }

  const priorityWeight: Record<string, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  const highPriority = [...activeTasks].sort((a, b) => {
    const pa = priorityWeight[a.priority ?? ""] ?? 0;
    const pb = priorityWeight[b.priority ?? ""] ?? 0;
    return pb - pa;
  })[0];

  if (highPriority && (priorityWeight[highPriority.priority ?? ""] ?? 0) >= 3) {
    return {
      id: "nba-priority",
      severity: "info",
      title: `Work on "${highPriority.title}"`,
      reason: `It is the highest priority open task (${highPriority.priority ?? "medium"}).`,
      entity: { type: "task", id: highPriority.id, label: highPriority.title },
      href: "/tasks",
      cta: "Open task",
    };
  }

  if (activeTasks.length > 0) {
    const next = activeTasks[0];
    return {
      id: "nba-next",
      severity: "info",
      title: `Next: "${next.title}"`,
      reason: "It is the next open task in your workspace.",
      entity: { type: "task", id: next.id, label: next.title },
      href: "/tasks",
      cta: "Open task",
    };
  }

  return null;
}

// ============================================================
// OPTIONAL LLM LAYER — AGGREGATED SIGNALS ONLY
// ============================================================

/**
 * Reduces insights to a minimal, aggregated payload. This is the ONLY
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
    signals: insights.map(({ id, severity, title, reason, cta }) => ({
      id,
      severity,
      title,
      reason,
      cta,
    })),
  };
}

function formatRelative(value: string, now: Date): string {
  const date = asDate(value);
  if (!date) return "no date";
  const diff = daysUntil(date, now);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `in ${diff} days`;
}

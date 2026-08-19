// ============================================================
// NEXUS INTELLIGENCE — DETERMINISTIC ENGINE (Layer 1, P3)
//
// Pure functions over REAL workspace data. No external API, no
// plan gate: the deterministic engine is complete on FREE.
// Every insight carries its REASON — that is what separates
// intelligence from decoration.
//
// This module is intentionally dependency-free (pure TypeScript)
// so it can be unit-tested directly with node --experimental-strip-types.
// ============================================================

export type Severity = "critical" | "warning" | "info" | "positive";

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3,
};

export type SignalName =
  | "overdue"
  | "blocked"
  | "due_today"
  | "stale_project"
  | "goal_at_risk"
  | "empty_project"
  | "momentum"
  | "next_best_action";

export type IntelEntity = {
  type: "task" | "project" | "goal" | "workspace";
  id: string | null;
  label: string;
};

export type Insight = {
  /** Stable id, e.g. "overdue:aggregate" — safe as React key. */
  id: string;
  signal: SignalName;
  severity: Severity;
  title: string;
  /** ALWAYS display the reason — never a bare verdict. */
  reason: string;
  entity: IntelEntity;
  href: string;
  cta: string;
};

export type IntelTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  project_id: string | null;
  completed_at?: string | null;
};

export type IntelProject = {
  id: string;
  name: string;
  status: string;
  progress: number;
  due_date: string | null;
};

export type IntelGoal = {
  id: string;
  title: string;
  status: string;
  progress: number;
  target_date: string | null;
};

export type IntelInput = {
  now: Date;
  tasks: IntelTask[];
  projects: IntelProject[];
  goals: IntelGoal[];
};

export type NextAction = {
  insight: Insight;
  task: IntelTask | null;
  project: IntelProject | null;
};

export type IntelResult = {
  insights: Insight[];
  nextAction: NextAction | null;
  momentum: { completed7d: number; label: string };
};

const DAY_MS = 24 * 60 * 60 * 1000;

const isDone = (task: IntelTask) => task.status === "done" || task.status === "cancelled";
const isBlocked = (task: IntelTask) => task.status === "blocked";
const isActiveTask = (task: IntelTask) => !isDone(task);

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysLate(dueAt: string, now: Date): number {
  return Math.floor((startOfDay(now) - startOfDay(new Date(dueAt))) / DAY_MS);
}

function daysUntil(value: string, now: Date): number {
  return Math.ceil((startOfDay(new Date(value)) - startOfDay(now)) / DAY_MS);
}

function priorityRank(priority: string): number {
  switch (priority) {
    case "urgent":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    default:
      return 3;
  }
}

function truncate(value: string, max = 48): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// ------------------------------------------------------------
// Individual signals
// ------------------------------------------------------------

function overdueSignal(tasks: IntelTask[], now: Date): Insight | null {
  const overdue = tasks
    .filter((task) => isActiveTask(task) && task.due_at && new Date(task.due_at).getTime() < now.getTime())
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));

  if (overdue.length === 0) return null;

  const oldest = overdue[0];
  const late = daysLate(oldest.due_at ?? "", now);

  return {
    id: "overdue:aggregate",
    signal: "overdue",
    severity: "critical",
    title:
      overdue.length === 1
        ? `1 task overdue — the oldest: ${truncate(oldest.title)}`
        : `${overdue.length} tasks overdue — the oldest: ${truncate(oldest.title)}`,
    reason:
      late <= 0
        ? `«${truncate(oldest.title)}» passed its due date today.`
        : `«${truncate(oldest.title)}» was due ${late} day${late === 1 ? "" : "s"} ago and is still ${oldest.status.replace("_", " ")}.`,
    entity: { type: "task", id: oldest.id, label: oldest.title },
    href: "/tasks",
    cta: "Review overdue",
  };
}

function blockedSignals(tasks: IntelTask[], projects: IntelProject[]): Insight[] {
  const blockedTasks = tasks.filter(isActiveTask).filter(isBlocked);
  const insights: Insight[] = [];

  // Group blocked tasks by project → "this project no longer moves"
  const byProject = new Map<string, IntelTask[]>();
  for (const task of blockedTasks) {
    const key = task.project_id ?? "__none__";
    const list = byProject.get(key) ?? [];
    list.push(task);
    byProject.set(key, list);
  }

  for (const [projectId, projectBlocked] of byProject) {
    const project = projects.find((item) => item.id === projectId);
    if (project) {
      insights.push({
        id: `blocked:project:${project.id}`,
        signal: "blocked",
        severity: "warning",
        title: `${truncate(project.name, 32)} no longer moves`,
        reason: `${projectBlocked.length} blocked task${projectBlocked.length === 1 ? "" : "s"} — starting with «${truncate(projectBlocked[0].title)}». A blocked project needs a decision, not more work.`,
        entity: { type: "project", id: project.id, label: project.name },
        href: "/projects",
        cta: "Unblock",
      });
    }
  }

  const orphan = byProject.get("__none__") ?? [];
  if (orphan.length > 0) {
    insights.push({
      id: "blocked:tasks",
      signal: "blocked",
      severity: "warning",
      title: `${orphan.length} blocked task${orphan.length === 1 ? "" : "s"} outside any project`,
      reason: `«${truncate(orphan[0].title)}» is blocked — either drop it or clear what blocks it.`,
      entity: { type: "task", id: orphan[0].id, label: orphan[0].title },
      href: "/tasks",
      cta: "Unblock",
    });
  }

  return insights;
}

function dueTodaySignal(tasks: IntelTask[], now: Date): Insight | null {
  const todayStamp = startOfDay(now);
  const dueToday = tasks.filter((task) => {
    if (!isActiveTask(task) || !task.due_at) return false;
    return startOfDay(new Date(task.due_at)) === todayStamp;
  });

  if (dueToday.length === 0) return null;

  const titles = dueToday
    .slice(0, 2)
    .map((task) => `«${truncate(task.title, 32)}»`)
    .join(", ");

  return {
    id: "due_today:aggregate",
    signal: "due_today",
    severity: "info",
    title:
      dueToday.length === 1
        ? `1 task to finish today: ${titles}`
        : `${dueToday.length} tasks to finish today: ${titles}${dueToday.length > 2 ? "…" : ""}`,
    reason: `Due today — ${dueToday.length} task${dueToday.length === 1 ? "" : "s"} still active.`,
    entity: { type: "task", id: dueToday[0].id, label: dueToday[0].title },
    href: "/tasks",
    cta: "Finish today",
  };
}

function emptyAndStaleProjectSignals(tasks: IntelTask[], projects: IntelProject[]): Insight[] {
  const insights: Insight[] = [];

  for (const project of projects) {
    if (project.status === "done" || project.status === "cancelled") continue;

    const projectTasks = tasks.filter((task) => task.project_id === project.id);
    const activeTasks = projectTasks.filter(isActiveTask);

    if (projectTasks.length === 0) {
      insights.push({
        id: `empty_project:${project.id}`,
        signal: "empty_project",
        severity: "info",
        title: `«${truncate(project.name, 32)}» has no task yet`,
        reason: "A project without a first task never starts. Give it one concrete step.",
        entity: { type: "project", id: project.id, label: project.name },
        href: "/projects",
        cta: "Give it a first task",
      });
      continue;
    }

    if (activeTasks.length === 0) {
      insights.push({
        id: `stale_project:${project.id}`,
        signal: "stale_project",
        severity: "warning",
        title: `«${truncate(project.name, 32)}» has no next action`,
        reason: `All ${projectTasks.length} task${projectTasks.length === 1 ? "" : "s"} are done or cancelled — the project is parked at ${Math.round(Number(project.progress) || 0)}%.`,
        entity: { type: "project", id: project.id, label: project.name },
        href: "/projects",
        cta: "Add a next action",
      });
    }
  }

  return insights;
}

function goalAtRiskSignals(goals: IntelGoal[], now: Date): Insight[] {
  const insights: Insight[] = [];

  for (const goal of goals) {
    if (goal.status !== "active" || !goal.target_date) continue;

    const remaining = daysUntil(goal.target_date, now);
    const progress = Math.round(Number(goal.progress) || 0);

    // At risk: deadline close and progression low.
    const atRisk =
      (remaining <= 7 && progress < 70) ||
      (remaining <= 14 && progress < 50) ||
      (remaining <= 30 && progress < 25);

    if (!atRisk) continue;

    insights.push({
      id: `goal_at_risk:${goal.id}`,
      signal: "goal_at_risk",
      severity: remaining <= 7 ? "critical" : "warning",
      title: `Goal at risk: ${truncate(goal.title)}`,
      reason: `${progress}% done with ${remaining <= 0 ? "the deadline today" : `${remaining} day${remaining === 1 ? "" : "s"} left`} — the current pace will miss it.`,
      entity: { type: "goal", id: goal.id, label: goal.title },
      href: "/goals",
      cta: "Review goal",
    });
  }

  return insights;
}

function momentumSignal(tasks: IntelTask[], now: Date): Insight | null {
  const weekAgo = now.getTime() - 7 * DAY_MS;
  const completed7d = tasks.filter(
    (task) =>
      task.status === "done" &&
      task.completed_at &&
      new Date(task.completed_at).getTime() >= weekAgo
  ).length;

  const activeCount = tasks.filter(isActiveTask).length;
  if (completed7d === 0 && activeCount === 0) return null;

  const label =
    completed7d === 0
      ? "Nothing completed in the last 7 days — one small task restarts the rhythm."
      : completed7d >= 10
        ? "Strong week — keep the streak alive."
        : "Week rhythm";

  return {
    id: "momentum:7d",
    signal: "momentum",
    severity: "positive",
    title: `Weekly rhythm — ${completed7d} completed`,
    reason: label,
    entity: { type: "workspace", id: null, label: "Workspace" },
    href: "/tasks",
    cta: completed7d === 0 ? "Restart with one task" : "Keep going",
  };
}

// ------------------------------------------------------------
// next_best_action — the cascade:
// no project → no task → overdue → blocked → priority → next
// ------------------------------------------------------------

export function computeNextAction(input: IntelInput): NextAction | null {
  const { now, tasks, projects, goals } = input;

  const activeProjects = projects.filter(
    (project) => project.status !== "done" && project.status !== "cancelled"
  );
  const activeTasks = tasks.filter(isActiveTask);

  // 1. No project at all → create one.
  if (activeProjects.length === 0) {
    return {
      task: null,
      project: null,
      insight: {
        id: "next_best_action:create_project",
        signal: "next_best_action",
        severity: "info",
        title: "Create your first project",
        reason: `You have ${tasks.length} task${tasks.length === 1 ? "" : "s"} but no active project — work without structure dilutes. One project gives them a spine.`,
        entity: { type: "workspace", id: null, label: "Workspace" },
        href: "/projects?new=1",
        cta: "Create a project",
      },
    };
  }

  // 2. No task at all → create one.
  if (activeTasks.length === 0) {
    const goal = goals.find((item) => item.status === "active");
    return {
      task: null,
      project: activeProjects[0],
      insight: {
        id: "next_best_action:create_task",
        signal: "next_best_action",
        severity: "info",
        title: "Add your next task",
        reason: goal
          ? `Nothing is active right now, and the goal «${truncate(goal.title)}» sits at ${Math.round(Number(goal.progress) || 0)}%. One task moves it.`
          : "Nothing is active right now — a goal without a next task is a wish.",
        entity: { type: "task", id: null, label: "New task" },
        href: "/tasks?new=1",
        cta: "Add a task",
      },
    };
  }

  // 3. Overdue → the oldest one.
  const overdue = activeTasks
    .filter((task) => task.due_at && new Date(task.due_at).getTime() < now.getTime())
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  if (overdue.length > 0) {
    const oldest = overdue[0];
    const late = daysLate(oldest.due_at ?? "", now);
    return {
      task: oldest,
      project: projects.find((project) => project.id === oldest.project_id) ?? null,
      insight: {
        id: "next_best_action:overdue",
        signal: "next_best_action",
        severity: "critical",
        title: `Work on: ${truncate(oldest.title)}`,
        reason: `It is the oldest overdue item${late > 0 ? ` — ${late} day${late === 1 ? "" : "s"} late` : " — due earlier today"}, and ${overdue.length - 1 > 0 ? `${overdue.length - 1} more wait behind it` : "nothing else is late"}.`,
        entity: { type: "task", id: oldest.id, label: oldest.title },
        href: "/tasks",
        cta: "Open tasks",
      },
    };
  }

  // 4. Blocked → clear it.
  const blocked = activeTasks.filter(isBlocked);
  if (blocked.length > 0) {
    const task = blocked[0];
    return {
      task,
      project: projects.find((project) => project.id === task.project_id) ?? null,
      insight: {
        id: "next_best_action:blocked",
        signal: "next_best_action",
        severity: "warning",
        title: `Unblock: ${truncate(task.title)}`,
        reason: `It is the only thing standing still${blocked.length > 1 ? ` (${blocked.length} blocked in total)` : ""} — everything else can flow.`,
        entity: { type: "task", id: task.id, label: task.title },
        href: "/tasks",
        cta: "Open tasks",
      },
    };
  }

  // 5. High / urgent priority.
  const byPriority = [...activeTasks].sort(
    (a, b) => priorityRank(a.priority) - priorityRank(b.priority)
  );
  const urgent = byPriority[0];
  if (priorityRank(urgent.priority) <= 1) {
    return {
      task: urgent,
      project: projects.find((project) => project.id === urgent.project_id) ?? null,
      insight: {
        id: "next_best_action:priority",
        signal: "next_best_action",
        severity: "info",
        title: `Work on: ${truncate(urgent.title)}`,
        reason: `Marked ${urgent.priority} and nothing is late or blocked — it is the highest-leverage item available.`,
        entity: { type: "task", id: urgent.id, label: urgent.title },
        href: "/tasks",
        cta: "Open tasks",
      },
    };
  }

  // 6. Next up by due date.
  const byDue = [...activeTasks]
    .filter((task) => task.due_at)
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  const next = byDue[0] ?? byPriority[0];
  return {
    task: next,
    project: projects.find((project) => project.id === next.project_id) ?? null,
    insight: {
      id: "next_best_action:next",
      signal: "next_best_action",
      severity: "info",
      title: `Work on: ${truncate(next.title)}`,
      reason: next.due_at
        ? `Due ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(next.due_at))} — the nearest deadline on the list.`
        : "No deadlines in play — the first item on the list is as good as any.",
      entity: { type: "task", id: next.id, label: next.title },
      href: "/tasks",
      cta: "Open tasks",
    },
  };
}

// ------------------------------------------------------------
// Aggregate
// ------------------------------------------------------------

export function computeInsights(input: IntelInput): IntelResult {
  const { tasks, projects, goals, now } = input;

  const overdue = overdueSignal(tasks, now);
  const dueToday = dueTodaySignal(tasks, now);

  const insights: Insight[] = [
    ...(overdue ? [overdue] : []),
    ...blockedSignals(tasks, projects),
    ...(dueToday ? [dueToday] : []),
    ...emptyAndStaleProjectSignals(tasks, projects),
    ...goalAtRiskSignals(goals, now),
    ...(momentumSignal(tasks, now) ? [momentumSignal(tasks, now) as Insight] : []),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const nextAction = computeNextAction(input);

  const weekAgo = now.getTime() - 7 * DAY_MS;
  const completed7d = tasks.filter(
    (task) =>
      task.status === "done" &&
      task.completed_at &&
      new Date(task.completed_at).getTime() >= weekAgo
  ).length;

  return {
    insights,
    nextAction,
    momentum: {
      completed7d,
      label: completed7d === 0 ? "Nothing this week" : `${completed7d} this week`,
    },
  };
}

/** Deterministic one-paragraph brief (Layer 2 fallback). */
export function deterministicBrief(result: IntelResult, input: IntelInput): string {
  const { nextAction, insights, momentum } = result;

  const parts: string[] = [];

  if (insights.length === 0) {
    // No signal at all: say it honestly, then suggest something useful.
    parts.push("Nothing requires arbitration — no overdue, blocked or at-risk item");
    if (nextAction) {
      parts.push(`useful next step: ${nextAction.insight.title.charAt(0).toLowerCase()}${nextAction.insight.title.slice(1)}`);
    } else {
      parts.push("give your main project a next action while things are calm");
    }
    return `${parts.join(". ")}.`;
  }

  if (nextAction) {
    parts.push(`Start with «${nextAction.insight.title.replace(/^Work on: |^Unblock: /, "")}» — ${nextAction.insight.reason.charAt(0).toLowerCase()}${nextAction.insight.reason.slice(1)}`);
  }

  const criticalCount = insights.filter((insight) => insight.severity === "critical").length;
  const warningCount = insights.filter((insight) => insight.severity === "warning").length;
  if (criticalCount > 0) {
    parts.push(`${criticalCount} critical signal${criticalCount === 1 ? "" : "s"} need${criticalCount === 1 ? "s" : ""} a decision`);
  }
  if (warningCount > 0) {
    parts.push(`${warningCount} warning${warningCount === 1 ? "" : "s"} to watch`);
  }
  parts.push(`${input.tasks.filter((task) => task.status !== "done" && task.status !== "cancelled").length} active tasks, momentum ${momentum.label.toLowerCase()}`);

  return `${parts.join(". ")}.`;
}

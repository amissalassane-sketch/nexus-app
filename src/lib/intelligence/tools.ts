// ============================================================
// NEXUS INTELLIGENCE — TOOL SYSTEM
// ============================================================
// An explicit, server-validated tool layer.
//
// Rules:
// 1. Read tools execute against the *already workspace-scoped* snapshot
//    that the query route built. The agent never touches Supabase and
//    never runs SQL.
// 2. Mutate tools are PROPOSAL-ONLY: they define the contract (name,
//    arguments, risk, confirmation policy) and map to the secure
//    /api/intelligence/action route, which re-validates the session,
//    the membership, the payload and the target before mutating and
//    reading the row back. The agent can never call them directly.
// 3. Navigate tools are pure UI shortcuts (deep links).
// 4. Every result is derived from real rows — nothing is invented.
// ============================================================

import { isActiveTask, nextBestAction, type WorkspaceSnapshot } from "./engine";
import { rankPriorities, workspaceHealth } from "./advanced";
import { riskForAction } from "./intent";
import type { WorkspaceContextSummary } from "./context-builder";
import type {
  ActivityContextItem,
  IntelligenceAction,
  IntelligenceActionType,
  IntelligenceRisk,
  IntelligenceToolCall,
  SessionHistoryItem,
  TaskDependencyContextItem,
} from "./types";

// ============================================================
// CONTRACT
// ============================================================

export type ToolPermission = "read" | "mutate" | "navigate";

export interface ToolArgSpec {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required?: boolean;
}

export interface IntelligenceToolDef {
  name: string;
  description: string;
  permission: ToolPermission;
  risk: IntelligenceRisk;
  args: ToolArgSpec[];
  /** For mutate tools: the server action type that executes it. */
  actionType?: IntelligenceActionType;
  /** For navigate tools: the deep link. */
  navigateTo?: string;
  /** Whether the human must confirm before the server executes. */
  confirmationRequired?: boolean;
}

export interface ToolExecutionContext {
  workspaceId: string;
  snapshot: WorkspaceSnapshot;
  context: WorkspaceContextSummary;
  activities?: ActivityContextItem[];
  dependencies?: TaskDependencyContextItem[];
  sessionHistory?: SessionHistoryItem[];
  now?: Date;
}

export interface ToolResult {
  name: string;
  args: Record<string, unknown>;
  status: "ok" | "error" | "skipped";
  summary: string;
  count: number;
  /** Compact, JSON-safe data derived from real rows only. */
  data: unknown;
  durationMs?: number;
}

export interface ToolSelection {
  name: string;
  args: Record<string, unknown>;
}

// ============================================================
// REGISTRY
// ============================================================

export const TOOL_REGISTRY: Record<string, IntelligenceToolDef> = {
  // ---- READ TOOLS -------------------------------------------
  get_workspace_overview: {
    name: "get_workspace_overview",
    description:
      "Compact totals, operating health and the single next best action for the active workspace.",
    permission: "read",
    risk: "none",
    args: [],
  },
  get_projects: {
    name: "get_projects",
    description:
      "List the workspace projects with status, progress, due date and open/overdue/blocked task counts.",
    permission: "read",
    risk: "none",
    args: [{ name: "status", type: "string", description: "Optional status filter (active|planning|paused|completed|archived)" }],
  },
  get_project: {
    name: "get_project",
    description: "Read one project (by id or by name) with its tasks.",
    permission: "read",
    risk: "none",
    args: [
      { name: "id", type: "string", description: "Project id" },
      { name: "query", type: "string", description: "Project name" },
    ],
  },
  get_tasks: {
    name: "get_tasks",
    description:
      "List tasks; filter by all/open/overdue/blocked/due_today/due_this_week/done.",
    permission: "read",
    risk: "none",
    args: [{ name: "filter", type: "string", description: "all|open|overdue|blocked|due_today|due_this_week|done" }],
  },
  get_task: {
    name: "get_task",
    description: "Read one task (by id or by title) with its dependencies.",
    permission: "read",
    risk: "none",
    args: [
      { name: "id", type: "string", description: "Task id" },
      { name: "query", type: "string", description: "Task title" },
    ],
  },
  get_goals: {
    name: "get_goals",
    description: "List active workspace goals with progress and target dates.",
    permission: "read",
    risk: "none",
    args: [],
  },
  get_notes: {
    name: "get_notes",
    description: "List workspace notes (decisions, meetings, research) newest first, with type and project link.",
    permission: "read",
    risk: "none",
    args: [
      { name: "limit", type: "number", description: "Max notes (default 5)" },
      { name: "query", type: "string", description: "Optional title filter" },
    ],
  },
  get_events: {
    name: "get_events",
    description: "Upcoming calendar events (NEXUS events, plus external calendar when connected).",
    permission: "read",
    risk: "none",
    args: [{ name: "limit", type: "number", description: "Max events (default 5)" }],
  },
  find_free_time: {
    name: "find_free_time",
    description: "Free working-hour windows (08:00–18:00) in the coming days, computed from real events.",
    permission: "read",
    risk: "none",
    args: [
      { name: "days", type: "number", description: "How many days to scan (default 3)" },
      { name: "min_minutes", type: "number", description: "Minimum window length (default 30)" },
    ],
  },
  get_activity: {
    name: "get_activity",
    description: "Recent audited workspace activity (created/updated/deleted events).",
    permission: "read",
    risk: "none",
    args: [{ name: "limit", type: "number", description: "Max events (default 10)" }],
  },
  get_blocked_tasks: {
    name: "get_blocked_tasks",
    description: "Tasks currently in blocked status, with project and blocker info.",
    permission: "read",
    risk: "none",
    args: [],
  },
  get_overdue_tasks: {
    name: "get_overdue_tasks",
    description: "Open tasks past their due date.",
    permission: "read",
    risk: "none",
    args: [],
  },
  get_priorities: {
    name: "get_priorities",
    description: "Ranked priority list of open tasks with scored reasons.",
    permission: "read",
    risk: "none",
    args: [{ name: "limit", type: "number", description: "How many priorities (default 5)" }],
  },
  search_workspace: {
    name: "search_workspace",
    description: "Search tasks and projects by name/title.",
    permission: "read",
    risk: "none",
    args: [{ name: "query", type: "string", description: "Search text", required: true }],
  },

  // ---- MUTATE TOOLS (proposal-only) -------------------------
  create_task: {
    name: "create_task",
    description: "Propose creating a task. Executed server-side after confirmation.",
    permission: "mutate",
    risk: "low",
    actionType: "create_task",
    confirmationRequired: true,
    args: [
      { name: "title", type: "string", description: "Task title", required: true },
      { name: "priority", type: "string", description: "low|medium|high|urgent" },
      { name: "dueDate", type: "string", description: "YYYY-MM-DD" },
      { name: "projectId", type: "string", description: "Target project id" },
      { name: "description", type: "string", description: "Optional description" },
    ],
  },
  update_task: {
    name: "update_task",
    description: "Propose updating a task (priority/status/due date/title). Confirmation-gated.",
    permission: "mutate",
    risk: "medium",
    actionType: "update_task",
    confirmationRequired: true,
    args: [
      { name: "taskId", type: "string", description: "Task id" },
      { name: "query", type: "string", description: "Task title when no id" },
      { name: "priority", type: "string", description: "low|medium|high|urgent" },
      { name: "status", type: "string", description: "todo|in_progress|in_review|blocked|done" },
      { name: "dueDate", type: "string", description: "YYYY-MM-DD" },
    ],
  },
  complete_task: {
    name: "complete_task",
    description: "Propose marking a task done. Executed server-side after confirmation.",
    permission: "mutate",
    risk: "low",
    actionType: "complete_task",
    confirmationRequired: true,
    args: [
      { name: "taskId", type: "string", description: "Task id" },
      { name: "query", type: "string", description: "Task title when no id" },
    ],
  },
  move_task: {
    name: "move_task",
    description: "Propose rescheduling a task to a new due date.",
    permission: "mutate",
    risk: "low",
    actionType: "move_task",
    confirmationRequired: true,
    args: [
      { name: "taskId", type: "string", description: "Task id" },
      { name: "query", type: "string", description: "Task title when no id" },
      { name: "dueDate", type: "string", description: "New due date YYYY-MM-DD", required: true },
    ],
  },
  delete_task: {
    name: "delete_task",
    description:
      "Propose deleting a task. Destructive. Always requires explicit human confirmation.",
    permission: "mutate",
    risk: "high",
    actionType: "delete_task",
    confirmationRequired: true,
    args: [
      { name: "taskId", type: "string", description: "Task id" },
      { name: "query", type: "string", description: "Task title when no id" },
    ],
  },
  create_project: {
    name: "create_project",
    description: "Propose creating a project. Executed server-side after confirmation.",
    permission: "mutate",
    risk: "low",
    actionType: "create_project",
    confirmationRequired: true,
    args: [
      { name: "name", type: "string", description: "Project name", required: true },
      { name: "dueDate", type: "string", description: "YYYY-MM-DD" },
      { name: "description", type: "string", description: "Optional project description" },
    ],
  },
  update_project: {
    name: "update_project",
    description: "Propose updating a project (name/status/progress/due date).",
    permission: "mutate",
    risk: "medium",
    actionType: "update_project",
    confirmationRequired: true,
    args: [
      { name: "projectId", type: "string", description: "Project id" },
      { name: "query", type: "string", description: "Project name when no id" },
      { name: "status", type: "string", description: "planning|active|paused|completed|archived" },
      { name: "progress", type: "number", description: "0–100" },
      { name: "dueDate", type: "string", description: "YYYY-MM-DD" },
    ],
  },
  delete_project: {
    name: "delete_project",
    description:
      "Propose deleting a project and all its tasks. Destructive. Always requires explicit human confirmation.",
    permission: "mutate",
    risk: "high",
    actionType: "delete_project",
    confirmationRequired: true,
    args: [
      { name: "projectId", type: "string", description: "Project id" },
      { name: "query", type: "string", description: "Project name when no id" },
    ],
  },
  create_goal: {
    name: "create_goal",
    description: "Propose creating a goal. Executed server-side after confirmation.",
    permission: "mutate",
    risk: "low",
    actionType: "create_goal",
    confirmationRequired: true,
    args: [
      { name: "title", type: "string", description: "Goal title", required: true },
      { name: "targetDate", type: "string", description: "YYYY-MM-DD" },
    ],
  },
  update_goal: {
    name: "update_goal",
    description: "Propose updating a goal (title/status/progress/target date).",
    permission: "mutate",
    risk: "medium",
    actionType: "update_goal",
    confirmationRequired: true,
    args: [
      { name: "goalId", type: "string", description: "Goal id" },
      { name: "query", type: "string", description: "Goal title when no id" },
      { name: "status", type: "string", description: "active|completed|cancelled" },
      { name: "progress", type: "number", description: "0–100" },
      { name: "targetDate", type: "string", description: "YYYY-MM-DD" },
    ],
  },
  delete_goal: {
    name: "delete_goal",
    description: "Propose deleting a goal. Destructive. Requires explicit confirmation.",
    permission: "mutate",
    risk: "high",
    actionType: "delete_goal",
    confirmationRequired: true,
    args: [
      { name: "goalId", type: "string", description: "Goal id" },
      { name: "query", type: "string", description: "Goal title when no id" },
    ],
  },

  // ---- NAVIGATE TOOLS ---------------------------------------
  open_project: {
    name: "open_project",
    description: "Deep link to a project page.",
    permission: "navigate",
    risk: "none",
    navigateTo: "/projects",
    args: [{ name: "id", type: "string", description: "Project id" }],
  },
  open_task: {
    name: "open_task",
    description: "Deep link to the task board, focused on one task.",
    permission: "navigate",
    risk: "none",
    navigateTo: "/tasks",
    args: [{ name: "id", type: "string", description: "Task id" }],
  },
  open_tasks: {
    name: "open_tasks",
    description: "Deep link to the task board.",
    permission: "navigate",
    risk: "none",
    navigateTo: "/tasks",
    args: [],
  },
  open_intelligence: {
    name: "open_intelligence",
    description: "Deep link to the Intelligence console.",
    permission: "navigate",
    risk: "none",
    navigateTo: "/app/intelligence",
    args: [],
  },
  open_activity: {
    name: "open_activity",
    description: "Deep link to the activity log.",
    permission: "navigate",
    risk: "none",
    navigateTo: "/activity",
    args: [],
  },
};

export const READ_TOOL_NAMES = new Set(
  Object.values(TOOL_REGISTRY)
    .filter((tool) => tool.permission === "read")
    .map((tool) => tool.name)
);

export const MUTATE_TOOL_NAMES = new Set(
  Object.values(TOOL_REGISTRY)
    .filter((tool) => tool.permission === "mutate")
    .map((tool) => tool.name)
);

export const NAVIGATE_TOOL_NAMES = new Set(
  Object.values(TOOL_REGISTRY)
    .filter((tool) => tool.permission === "navigate")
    .map((tool) => tool.name)
);

export function getTool(name: string): IntelligenceToolDef | undefined {
  return TOOL_REGISTRY[name];
}

// ============================================================
// TOOL SELECTION — deterministic intent → tool mapping
// ============================================================

/** Returns the ordered read tools the agent must consult to answer a
 *  request of the given intent. The AI may propose additional read
 *  tools; the server validates every proposal against the registry. */
export function selectToolsForIntent(
  intentId: string,
  query = ""
): ToolSelection[] {
  switch (intentId) {
    case "ANALYZE":
      return [
        { name: "get_workspace_overview", args: {} },
        { name: "get_projects", args: {} },
        { name: "get_tasks", args: { filter: "open" } },
        { name: "get_activity", args: {} },
      ];
    case "PRIORITIZE":
      return [
        { name: "get_workspace_overview", args: {} },
        { name: "get_priorities", args: { limit: 5 } },
        { name: "get_overdue_tasks", args: {} },
        { name: "get_blocked_tasks", args: {} },
      ];
    case "PLAN":
      return [
        { name: "get_workspace_overview", args: {} },
        { name: "get_overdue_tasks", args: {} },
        { name: "get_blocked_tasks", args: {} },
        { name: "get_tasks", args: { filter: "due_today" } },
        { name: "get_tasks", args: { filter: "due_this_week" } },
        { name: "get_priorities", args: { limit: 5 } },
        { name: "get_projects", args: {} },
      ];
    case "SUMMARIZE":
      return [
        { name: "get_workspace_overview", args: {} },
        { name: "get_activity", args: {} },
        { name: "get_tasks", args: { filter: "done" } },
        { name: "get_projects", args: {} },
        { name: "get_goals", args: {} },
      ];
    case "DETECT":
      return [
        { name: "get_workspace_overview", args: {} },
        { name: "get_blocked_tasks", args: {} },
        { name: "get_overdue_tasks", args: {} },
        { name: "get_projects", args: {} },
      ];
    case "SEARCH":
      return [{ name: "search_workspace", args: { query } }];
    case "EXPLAIN":
      return [
        { name: "get_projects", args: {} },
        { name: "get_project", args: { query } },
        { name: "get_tasks", args: { filter: "open" } },
      ];
    case "CREATE": {
      const lower = query.toLowerCase();
      if (lower.includes("projet") || lower.includes("project")) {
        return [
          { name: "get_workspace_overview", args: {} },
          { name: "get_projects", args: {} },
        ];
      }
      if (lower.includes("objectif") || lower.includes("goal")) {
        return [
          { name: "get_workspace_overview", args: {} },
          { name: "get_goals", args: {} },
        ];
      }
      return [
        { name: "get_workspace_overview", args: {} },
        { name: "get_projects", args: {} },
      ];
    }
    case "UPDATE":
    case "COMPLETE":
    case "MOVE":
    case "DELETE":
      return [
        { name: "get_tasks", args: { filter: "open" } },
        { name: "get_task", args: { query } },
        ...(intentId === "DELETE" || intentId === "UPDATE"
          ? [{ name: "get_projects", args: {} }]
          : []),
      ];
    case "GENERAL_ASSISTANCE":
    default:
      return [
        { name: "get_workspace_overview", args: {} },
        { name: "get_projects", args: {} },
        { name: "get_tasks", args: { filter: "open" } },
      ];
  }
}

// ============================================================
// READ TOOL EXECUTORS — real data only
// ============================================================

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveTask(
  snapshot: WorkspaceSnapshot,
  args: Record<string, unknown>
): { id: string; title: string } | null {
  const id = typeof args.id === "string" ? args.id : null;
  if (id) {
    const task = snapshot.tasks.find((t) => t.id === id);
    return task ? { id: task.id, title: task.title } : null;
  }
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query) return null;
  const lower = query.toLowerCase();
  const byTitle = snapshot.tasks.find(
    (task) => task.title.length >= 3 && lower.includes(task.title.toLowerCase())
  );
  if (byTitle) return { id: byTitle.id, title: byTitle.title };
  const tokens = lower.split(/\s+/).filter((token) => token.length >= 4);
  const matches = snapshot.tasks.filter((task) => {
    const title = task.title.toLowerCase();
    return tokens.some((token) => title.includes(token));
  });
  return matches.length === 1 ? { id: matches[0].id, title: matches[0].title } : null;
}

function resolveProject(
  snapshot: WorkspaceSnapshot,
  args: Record<string, unknown>
): { id: string; name: string } | null {
  const id = typeof args.id === "string" ? args.id : null;
  if (id) {
    const project = snapshot.projects.find((p) => p.id === id);
    return project ? { id: project.id, name: project.name } : null;
  }
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query) return null;
  const lower = query.toLowerCase();
  const byName = snapshot.projects.find(
    (project) => project.name.length >= 3 && lower.includes(project.name.toLowerCase())
  );
  if (byName) return { id: byName.id, name: byName.name };
  const tokens = lower.split(/\s+/).filter((token) => token.length >= 4);
  const matches = snapshot.projects.filter((project) => {
    const name = project.name.toLowerCase();
    return tokens.some((token) => name.includes(token));
  });
  return matches.length === 1 ? { id: matches[0].id, name: matches[0].name } : null;
}

function taskCounts(snapshot: WorkspaceSnapshot, projectId: string, now: Date) {
  const open = snapshot.tasks.filter((t) => t.project_id === projectId && isActiveTask(t));
  const overdue = open.filter((t) => {
    const due = asDate(t.due_at);
    return due !== null && due.getTime() < now.getTime();
  });
  const blocked = open.filter((t) => t.status === "blocked");
  return { open: open.length, overdue: overdue.length, blocked: blocked.length };
}

function projectMap(snapshot: WorkspaceSnapshot): Map<string, string> {
  return new Map(snapshot.projects.map((p) => [p.id, p.name]));
}

const DAY_MS_LOCAL = 86_400_000;

/** Start (midnight) of `dayOffset` days from `now`, in local time. */
function startOfLocalDay(now: Date, dayOffset: number): number {
  const date = new Date(now);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function pushLocalWindow(
  windows: { date: string; start: string; minutes: number }[],
  start: number,
  end: number,
  minMinutes: number
): void {
  const minutes = Math.round((end - start) / 60_000);
  if (minutes >= minMinutes && end > start) {
    const startDate = new Date(start);
    windows.push({
      date: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(startDate),
      start: new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(startDate),
      minutes,
    });
  }
}

export function executeReadTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): ToolResult {
  const now = ctx.now ?? new Date();
  const weekAhead = now.getTime() + 7 * 86_400_000;
  const { snapshot, context } = ctx;
  const projects = snapshot.projects;
  const openTasks = snapshot.tasks.filter(isActiveTask);
  const projectsById = projectMap(snapshot);
  const start = Date.now();

  const done = (summary: string, count: number, data: unknown): ToolResult => ({
    name,
    args,
    status: "ok",
    summary,
    count,
    data,
    durationMs: Date.now() - start,
  });

  switch (name) {
    case "get_workspace_overview": {
      const health = workspaceHealth(snapshot);
      const nba = nextBestAction(snapshot);
      return done(
        `${snapshot.projects.length} projets, ${openTasks.length} tâches ouvertes (${context.totals.overdueTasks} en retard, ${context.totals.blockedTasks} bloquées), ${snapshot.goals.length} objectifs, santé ${health.score}/100 (${health.band})`,
        snapshot.projects.length + openTasks.length + snapshot.goals.length,
        {
          workspaceId: ctx.workspaceId,
          totals: context.totals,
          healthScore: health.score,
          healthBand: health.band,
          nextBestAction: nba ? { title: nba.title, reason: nba.reason, href: nba.href } : null,
        }
      );
    }

    case "get_projects": {
      const list = projects.map((p) => {
        const counts = taskCounts(snapshot, p.id, now);
        return {
          id: p.id,
          name: p.name,
          status: p.status ?? "planning",
          progress: Math.round(p.progress ?? 0),
          dueDate: p.due_date ?? null,
          openTasks: counts.open,
          overdue: counts.overdue,
          blocked: counts.blocked,
        };
      });
      return done(
        list.length === 0
          ? "Aucun projet dans le workspace"
          : `${list.length} projet(s) lus (${list.filter((p) => p.status === "active" || p.status === "planning").length} actifs)`,
        list.length,
        list
      );
    }

    case "get_project": {
      const found = resolveProject(snapshot, args);
      if (!found) {
        return {
          name,
          args,
          status: "error",
          summary: "Aucun projet ne correspond à cette référence dans le workspace",
          count: 0,
          data: null,
          durationMs: Date.now() - start,
        };
      }
      const project = projects.find((p) => p.id === found.id)!;
      const tasks = snapshot.tasks
        .filter((t) => t.project_id === found.id)
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority ?? "medium",
          dueDate: t.due_at ?? null,
        }));
      return done(
        `Projet “${found.name}” (${project.status ?? "planning"}, ${Math.round(project.progress ?? 0)}%) avec ${tasks.length} tâches`,
        tasks.length,
        {
          id: found.id,
          name: found.name,
          status: project.status ?? "planning",
          progress: Math.round(project.progress ?? 0),
          dueDate: project.due_date ?? null,
          tasks,
        }
      );
    }

    case "get_tasks": {
      const filter = typeof args.filter === "string" ? args.filter : "open";
      let rows = snapshot.tasks;
      if (filter === "open") rows = openTasks;
      else if (filter === "done") rows = snapshot.tasks.filter((t) => !isActiveTask(t));
      else if (filter === "overdue")
        rows = openTasks.filter((t) => {
          const due = asDate(t.due_at);
          return due !== null && due.getTime() < now.getTime();
        });
      else if (filter === "blocked") rows = openTasks.filter((t) => t.status === "blocked");
      else if (filter === "due_today")
        rows = openTasks.filter((t) => {
          const due = asDate(t.due_at);
          return due !== null && due.toDateString() === now.toDateString();
        });
      else if (filter === "due_this_week")
        rows = openTasks.filter((t) => {
          const due = asDate(t.due_at);
          return due !== null && due.getTime() >= now.getTime() && due.getTime() <= weekAhead;
        });

      const list = rows.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority ?? "medium",
        dueDate: t.due_at ?? null,
        project: t.project_id ? projectsById.get(t.project_id) ?? null : null,
      }));
      const filterLabel = filter === "all" ? "" : ` (${filter})`;
      return done(`${list.length} tâche(s)${filterLabel}`, list.length, list);
    }

    case "get_task": {
      const found = resolveTask(snapshot, args);
      if (!found) {
        return {
          name,
          args,
          status: "error",
          summary: "Aucune tâche ne correspond à cette référence dans le workspace",
          count: 0,
          data: null,
          durationMs: Date.now() - start,
        };
      }
      const task = snapshot.tasks.find((t) => t.id === found.id)!;
      const blockedBy = (ctx.dependencies ?? [])
        .filter((dep) => dep.taskId === found.id)
        .map((dep) => ({ id: dep.dependsOnTaskId, title: dep.dependsOnTitle }));
      return done(
        `Tâche “${found.title}” (${task.status}, ${task.priority ?? "medium"})${blockedBy.length > 0 ? `, bloquée par ${blockedBy.length} prérequis` : ""}`,
        blockedBy.length,
        {
          id: found.id,
          title: found.title,
          status: task.status,
          priority: task.priority ?? "medium",
          dueDate: task.due_at ?? null,
          project: task.project_id ? projectsById.get(task.project_id) ?? null : null,
          blockedBy,
        }
      );
    }

    case "get_goals": {
      const list = snapshot.goals
        .filter((g) => g.status !== "completed" && g.status !== "cancelled")
        .map((g) => ({
          id: g.id,
          title: g.title,
          status: g.status ?? "active",
          progress: Math.round(g.progress ?? 0),
          targetDate: g.target_date ?? null,
        }));
      return done(
        list.length === 0 ? "Aucun objectif actif" : `${list.length} objectif(s) actif(s)`,
        list.length,
        list
      );
    }

    case "get_notes": {
      const limit = Math.min(Math.max(Number(args.limit ?? 5) || 5, 1), 20);
      const needle = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
      const notes = (snapshot.notes ?? [])
        .filter((note) => !needle || note.title.toLowerCase().includes(needle))
        .slice(0, limit)
        .map((note) => ({
          id: note.id,
          title: note.title,
          type: note.note_type ?? "standard",
          project: note.project_id ? projectsById.get(note.project_id) ?? null : null,
          updatedAt: note.updated_at ?? null,
        }));
      return done(
        notes.length === 0
          ? needle
            ? `Aucune note ne correspond à “${needle}”`
            : "Aucune note dans cet espace de travail"
          : `${notes.length} note(s)${notes[0] ? ` (ex: “${notes[0].title}”)` : ""}`,
        notes.length,
        notes
      );
    }

    case "get_events": {
      const limit = Math.min(Math.max(Number(args.limit ?? 5) || 5, 1), 20);
      const events = (snapshot.events ?? [])
        .filter((event) => new Date(event.start_at).getTime() >= now.getTime() - 3_600_000)
        .sort((a, b) => a.start_at.localeCompare(b.start_at))
        .slice(0, limit)
        .map((event) => ({
          id: event.id,
          title: event.title,
          startsAt: event.start_at,
          location: event.location ?? null,
          project: event.project_id ? projectsById.get(event.project_id) ?? null : null,
        }));
      return done(
        events.length === 0
          ? "Aucun événement à venir"
          : `${events.length} événement(s) à venir (prochain : “${events[0].title}”)`,
        events.length,
        events
      );
    }

    case "find_free_time": {
      const days = Math.min(Math.max(Number(args.days ?? 3) || 3, 1), 14);
      const minMinutes = Math.min(Math.max(Number(args.min_minutes ?? 30) || 30, 15), 480);
      const busy = (snapshot.events ?? [])
        .filter((event) => new Date(event.start_at).getTime() >= now.getTime() - DAY_MS_LOCAL && new Date(event.start_at).getTime() <= now.getTime() + days * DAY_MS_LOCAL)
        .map((event) => ({
          start: new Date(event.start_at).getTime(),
          end: new Date(event.end_at ?? event.start_at).getTime() + (event.end_at ? 0 : 3_600_000),
        }))
        .sort((a, b) => a.start - b.start);

      const windows: { date: string; start: string; minutes: number }[] = [];
      for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
        const dayStart = startOfLocalDay(now, dayIndex) + 8 * 3_600_000; // 08:00
        const dayEnd = startOfLocalDay(now, dayIndex) + 18 * 3_600_000; // 18:00
        let cursor = dayStart;
        for (const interval of busy) {
          if (interval.start > cursor) {
            pushLocalWindow(windows, cursor, Math.min(interval.start, dayEnd), minMinutes);
          }
          if (interval.end > cursor) cursor = interval.end;
        }
        pushLocalWindow(windows, cursor, dayEnd, minMinutes);
      }
      return done(
        windows.length === 0
          ? "Aucun créneau libre de la longueur demandée dans les prochains jours"
          : `${windows.length} créneau(x) libre(s) d'au moins ${minMinutes} min (premier : ${windows[0].date} ${windows[0].start})`,
        windows.length,
        windows
      );
    }

    case "get_activity": {
      const limit = Math.min(Math.max(Number(args.limit ?? 10) || 10, 1), 30);
      const events = (ctx.activities ?? []).slice(0, limit).map((a) => ({
        id: a.id,
        date: a.createdAt.slice(0, 10),
        actor: a.actorName ?? "Member",
        action: a.action,
        entityType: a.entityType,
        title: a.title,
      }));
      return done(
        events.length === 0 ? "Aucune activité récente" : `${events.length} événement(s) récent(s)`,
        events.length,
        events
      );
    }

    case "get_blocked_tasks": {
      const list = openTasks
        .filter((t) => t.status === "blocked")
        .map((t) => {
          const blockedBy = (ctx.dependencies ?? [])
            .filter((dep) => dep.taskId === t.id)
            .map((dep) => dep.dependsOnTitle);
          return {
            id: t.id,
            title: t.title,
            project: t.project_id ? projectsById.get(t.project_id) ?? null : null,
            priority: t.priority ?? "medium",
            dueDate: t.due_at ?? null,
            blockedBy,
          };
        });
      return done(
        list.length === 0
          ? "Aucune tâche bloquée"
          : `${list.length} tâche(s) bloquée(s)${list.length > 0 && list[0].project ? ` (ex: “${list[0].title}” dans “${list[0].project}”)` : ""}`,
        list.length,
        list
      );
    }

    case "get_overdue_tasks": {
      const list = openTasks
        .filter((t) => {
          const due = asDate(t.due_at);
          return due !== null && due.getTime() < now.getTime();
        })
        .sort((a, b) => (asDate(a.due_at)?.getTime() ?? 0) - (asDate(b.due_at)?.getTime() ?? 0))
        .map((t) => ({
          id: t.id,
          title: t.title,
          project: t.project_id ? projectsById.get(t.project_id) ?? null : null,
          priority: t.priority ?? "medium",
          dueDate: t.due_at ?? null,
        }));
      return done(
        list.length === 0
          ? "Aucune tâche en retard"
          : `${list.length} tâche(s) en retard${list[0] ? `, la plus ancienne “${list[0].title}”` : ""}`,
        list.length,
        list
      );
    }

    case "get_priorities": {
      const limit = Math.min(Math.max(Number(args.limit ?? 5) || 5, 1), 10);
      const ranked = rankPriorities(snapshot, limit).map((entry) => ({
        id: entry.task.id,
        title: entry.task.title,
        priority: entry.task.priority ?? "medium",
        status: entry.task.status ?? "todo",
        dueDate: entry.task.due_at ?? null,
        project: entry.task.project_id ? projectsById.get(entry.task.project_id) ?? null : null,
        reasons: entry.reasons,
      }));
      return done(
        ranked.length === 0
          ? "Aucune priorité détectée"
          : `${ranked.length} priorité(s), en tête “${ranked[0]?.title}”`,
        ranked.length,
        ranked
      );
    }

    case "search_workspace": {
      const q = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
      if (!q) {
        return {
          name,
          args,
          status: "error",
          summary: "Aucun terme de recherche fourni",
          count: 0,
          data: null,
          durationMs: Date.now() - start,
        };
      }
      const tasks = snapshot.tasks
        .filter((t) => t.title.toLowerCase().includes(q))
        .slice(0, 10)
        .map((t) => ({ id: t.id, title: t.title, kind: "task" as const, status: t.status }));
      const foundProjects = projects
        .filter((p) => p.name.toLowerCase().includes(q))
        .slice(0, 10)
        .map((p) => ({ id: p.id, title: p.name, kind: "project" as const, status: p.status ?? "planning" }));
      const results = [...foundProjects, ...tasks];
      return done(
        results.length === 0
          ? `Aucun résultat pour “${q}”`
          : `${results.length} résultat(s) pour “${q}”`,
        results.length,
        results
      );
    }

    default:
      return {
        name,
        args,
        status: "error",
        summary: `Outil inconnu ou non exécutable par l'agent: ${name}`,
        count: 0,
        data: null,
        durationMs: Date.now() - start,
      };
  }
}

/** Runs an ordered list of read tools, sequentially, against the real
 *  workspace context. Returns the trace (never inventing results). */
export function runReadTools(
  selections: ToolSelection[],
  ctx: ToolExecutionContext
): IntelligenceToolCall[] {
  const trace: IntelligenceToolCall[] = [];
  for (const selection of selections) {
    const def = getTool(selection.name);
    if (!def) {
      trace.push({
        name: selection.name,
        args: selection.args,
        status: "skipped",
        summary: "Outil inconnu",
        count: 0,
      });
      continue;
    }
    if (def.permission !== "read") {
      trace.push({
        name: selection.name,
        args: selection.args,
        status: "skipped",
        summary: "Outil de mutation/navigation, jamais exécuté par l'agent",
        count: 0,
      });
      continue;
    }
    const result = executeReadTool(selection.name, selection.args, ctx);
    trace.push({
      name: result.name,
      args: result.args,
      status: result.status,
      summary: result.summary,
      count: result.count,
      durationMs: result.durationMs,
    });
  }
  return trace;
}

/** Validates a model-proposed tool call. The server decides: only
 *  registry tools pass, and mutate/navigate tools are never executed
 *  by the agent — they are converted into confirmation-gated actions
 *  (or UI deep links) instead. */
export function validateToolProposal(
  name: string
): { ok: true; def: IntelligenceToolDef } | { ok: false; reason: string } {
  const def = getTool(name);
  if (!def) return { ok: false, reason: `Outil inconnu: ${name}` };
  return { ok: true, def };
}

// ============================================================
// PROPOSAL-ONLY MUTATION TOOLS → server action contract
// ============================================================

export function actionFromTool(
  toolName: string,
  args: Record<string, unknown>,
  workspaceId: string
): IntelligenceAction | null {
  const def = getTool(toolName);
  if (!def || def.permission !== "mutate" || !def.actionType) return null;
  const risk = def.risk === "none" ? riskForAction(def.actionType) : def.risk;
  const labelByType: Record<string, string> = {
    create_task: "Create this task",
    update_task: "Apply this update",
    complete_task: "Complete task",
    move_task: "Move task",
    delete_task: "Delete task",
    create_project: "Create project",
    update_project: "Apply project update",
    delete_project: "Delete project",
    create_goal: "Create goal",
    update_goal: "Apply goal update",
    delete_goal: "Delete goal",
  };
  const payload: Record<string, unknown> = { ...args };
  if (def.actionType === "delete_task" || def.actionType === "delete_project" || def.actionType === "delete_goal") {
    payload.confirmDeletion = true;
  }
  return {
    id: `act-${toolName}-${workspaceId}-${Date.now()}`,
    type: def.actionType,
    label: labelByType[def.actionType] ?? toolName.replace("_", " "),
    description: def.description,
    confirmationRequired: true,
    risk,
    payload: payload as IntelligenceAction["payload"],
  };
}

export function navigateUrlFromTool(toolName: string, args: Record<string, unknown>): string | null {
  const def = getTool(toolName);
  if (!def || def.permission !== "navigate") return null;
  const base = def.navigateTo ?? "/";
  const id = typeof args.id === "string" ? args.id : null;
  return id ? `${base}?focus=${encodeURIComponent(id)}` : base;
}

/** Human label for a tool name, used by the UI trace. */
export function toolDisplayLabel(name: string): string {
  return name.replace(/_/g, " ");
}

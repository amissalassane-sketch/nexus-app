// ============================================================
// NEXUS INTELLIGENCE — CONTEXT BUILDER
// Builds minimal, relevant, authorized workspace context for
// NEXUS intelligence analysis and AI reasoning.
//
// Rules:
// 1. Scoped strictly to the authenticated user's active workspace.
// 2. Only loads active and relevant entities (never unbounded raw dumps).
// 3. Compacted into structured representations with traceable facts.
// 4. Never hallucinates; evidence is explicitly attached to each claim.
// ============================================================

import type { ProjectLike, WorkspaceSnapshot } from "./engine";
import { isActiveTask } from "./engine";
import { workspaceHealth, rankPriorities } from "./advanced";

export interface WorkspaceContextSummary {
  workspaceId: string;
  totals: {
    projects: number;
    activeProjects: number;
    tasks: number;
    openTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    goals: number;
  };
  healthScore: number;
  healthBand: string;
  projectsNeedingAttention: {
    id: string;
    name: string;
    status: string;
    progress: number;
    dueDate: string | null;
    openTaskCount: number;
    blockedCount: number;
    overdueCount: number;
    reasons: string[];
  }[];
  topPriorityTasks: {
    id: string;
    title: string;
    priority: string;
    status: string;
    dueDate: string | null;
    projectName?: string;
    score: number;
    reasons: string[];
  }[];
  recentCompletionsCount7d: number;
  newTasksCount7d: number;
  tasksDueNext7dCount: number;
  activeGoals: {
    id: string;
    title: string;
    progress: number;
    targetDate: string | null;
  }[];
}

export function buildWorkspaceContext(
  workspaceId: string,
  snapshot: WorkspaceSnapshot
): WorkspaceContextSummary {
  const now = snapshot.now ?? new Date();
  const openTasks = snapshot.tasks.filter(isActiveTask);
  const nowTime = now.getTime();
  const weekAgo = nowTime - 7 * 86_400_000;
  const weekAhead = nowTime + 7 * 86_400_000;

  const projectMap = new Map<string, ProjectLike>();
  for (const p of snapshot.projects) {
    projectMap.set(p.id, p);
  }

  const overdueTasks = openTasks.filter((t) => {
    if (!t.due_at) return false;
    const d = new Date(t.due_at).getTime();
    return !Number.isNaN(d) && d < nowTime;
  });

  const blockedTasks = openTasks.filter((t) => t.status === "blocked");

  const completedLast7d = snapshot.tasks.filter((t) => {
    if (!t.completed_at) return false;
    const c = new Date(t.completed_at).getTime();
    return !Number.isNaN(c) && c >= weekAgo;
  }).length;

  const createdLast7d = snapshot.tasks.filter((t) => {
    if (!t.created_at) return false;
    const c = new Date(t.created_at).getTime();
    return !Number.isNaN(c) && c >= weekAgo;
  }).length;

  const dueNext7d = openTasks.filter((t) => {
    if (!t.due_at) return false;
    const d = new Date(t.due_at).getTime();
    return !Number.isNaN(d) && d >= nowTime && d <= weekAhead;
  }).length;

  // Projects needing attention
  const projectsNeedingAttention = snapshot.projects
    .map((p) => {
      const pTasks = openTasks.filter((t) => t.project_id === p.id);
      const pBlocked = pTasks.filter((t) => t.status === "blocked").length;
      const pOverdue = pTasks.filter((t) => {
        if (!t.due_at) return false;
        const d = new Date(t.due_at).getTime();
        return !Number.isNaN(d) && d < nowTime;
      }).length;

      const reasons: string[] = [];
      if (p.due_date) {
        const pDue = new Date(p.due_date).getTime();
        if (!Number.isNaN(pDue)) {
          if (pDue < nowTime) reasons.push("Project deadline has passed");
          else if (pDue - nowTime <= 7 * 86_400_000) reasons.push("Deadline inside 7 days");
        }
      }
      if (pBlocked > 0) reasons.push(`${pBlocked} task${pBlocked > 1 ? "s" : ""} blocked`);
      if (pOverdue > 0) reasons.push(`${pOverdue} task${pOverdue > 1 ? "s" : ""} overdue`);

      return {
        id: p.id,
        name: p.name,
        status: p.status ?? "planning",
        progress: Math.round(p.progress ?? 0),
        dueDate: p.due_date ?? null,
        openTaskCount: pTasks.length,
        blockedCount: pBlocked,
        overdueCount: pOverdue,
        reasons,
      };
    })
    .filter((p) => p.reasons.length > 0 || p.status === "paused")
    .slice(0, 5);

  // Ranked priorities
  const ranked = rankPriorities(snapshot, 5).map((entry) => ({
    id: entry.task.id,
    title: entry.task.title,
    priority: entry.task.priority ?? "medium",
    status: entry.task.status ?? "todo",
    dueDate: entry.task.due_at ?? null,
    projectName: entry.task.project_id ? projectMap.get(entry.task.project_id)?.name : undefined,
    score: entry.score,
    reasons: entry.reasons,
  }));

  const health = workspaceHealth(snapshot);

  return {
    workspaceId,
    totals: {
      projects: snapshot.projects.length,
      activeProjects: snapshot.projects.filter((p) => p.status !== "completed" && p.status !== "cancelled").length,
      tasks: snapshot.tasks.length,
      openTasks: openTasks.length,
      overdueTasks: overdueTasks.length,
      blockedTasks: blockedTasks.length,
      goals: snapshot.goals.length,
    },
    healthScore: health.score,
    healthBand: health.band,
    projectsNeedingAttention,
    topPriorityTasks: ranked,
    recentCompletionsCount7d: completedLast7d,
    newTasksCount7d: createdLast7d,
    tasksDueNext7dCount: dueNext7d,
    activeGoals: snapshot.goals
      .filter((g) => g.status !== "completed" && g.status !== "cancelled")
      .map((g) => ({
        id: g.id,
        title: g.title,
        progress: Math.round(g.progress ?? 0),
        targetDate: g.target_date ?? null,
      })),
  };
}

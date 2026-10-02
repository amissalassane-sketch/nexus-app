// ============================================================
// NEXUS INTELLIGENCE — PROACTIVE AUTOMATION ENGINE
// Detects friction across workspace entities and generates
// structured batch proposals with full Human-in-the-Loop gates.
//
// Invariants:
// 1. Zero autonomous silent writes: all actions require explicit
//    user confirmation (confirmationRequired: true).
// 2. Full explainability: every proposal has diffItems with
//    current vs proposed values and justification.
// 3. Forward-looking dates: rescheduling proposals never suggest
//    dates in the past.
// 4. Strict workspace isolation: entities are loaded exclusively
//    from the target workspace.
// ============================================================

import type {
  ProactiveAutomationProposal,
  AutomationDiffItem,
  AutomationDetectionOptions,
  IntelligenceAction,
} from "./types";
import type { WorkspaceSnapshot, TaskLike } from "./engine";
import { isActiveTask } from "./engine";
import { extractCivilDate } from "./daily-briefing";
import { assertIntelligenceData } from "./data-error";

/**
 * Shifts a YYYY-MM-DD civil date by a number of days.
 */
export function addDays(civilDate: string, days: number): string {
  const parts = civilDate.split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Detects overdue tasks and generates a progressive forward rescheduling proposal.
 */
export function detectOverdueRescheduling(
  snapshot: WorkspaceSnapshot,
  civilDate: string,
  lang: "fr" | "en" = "fr"
): ProactiveAutomationProposal | null {
  const isFr = lang === "fr";
  const tasks = (snapshot.tasks || []).filter(isActiveTask);
  const overdueTasks = tasks.filter((t) => {
    if (!t.due_at) return false;
    const taskCivil = extractCivilDate(t.due_at);
    return taskCivil < civilDate;
  });

  if (overdueTasks.length === 0) return null;

  // Sort by urgency/priority
  overdueTasks.sort((a, b) => {
    const pOrder: Record<string, number> = { urgent: 0, p0: 0, high: 1, p1: 1, medium: 2, p2: 2, low: 3 };
    const pA = pOrder[(a.priority || "").toLowerCase()] ?? 2;
    const pB = pOrder[(b.priority || "").toLowerCase()] ?? 2;
    return pA - pB;
  });

  const diffItems: AutomationDiffItem[] = [];
  const actions: IntelligenceAction[] = [];

  overdueTasks.forEach((task, index) => {
    // Distribute across upcoming working days (max 2 per day)
    const dayOffset = Math.floor(index / 2);
    const newCivilDate = addDays(civilDate, dayOffset);
    const proposedDueAt = `${newCivilDate}T12:00:00Z`;

    diffItems.push({
      entityId: task.id,
      entityType: "task",
      title: task.title,
      field: "due_at",
      currentValue: task.due_at ?? null,
      proposedValue: proposedDueAt,
      reason: isFr
        ? `Replanification à J+${dayOffset} pour décongestionner le planning`
        : `Rescheduling to +${dayOffset}d to relieve backlog`,
    });

    actions.push({
      id: `act-reschedule-${task.id}`,
      type: "update_task",
      label: isFr ? `Replanifier "${task.title}"` : `Reschedule "${task.title}"`,
      description: isFr
        ? `Déplacer l'échéance au ${newCivilDate}`
        : `Move due date to ${newCivilDate}`,
      payload: { taskId: task.id, dueDate: proposedDueAt },
      risk: "low",
      confirmationRequired: true,
    });
  });

  return {
    id: `proposal-reschedule-${civilDate}`,
    workspaceId: snapshot.tasks[0]?.project_id ?? "workspace",
    kind: "reschedule_overdue",
    title: isFr
      ? `Replanification progressive (${overdueTasks.length} tâches en retard)`
      : `Progressive rescheduling (${overdueTasks.length} overdue tasks)`,
    description: isFr
      ? `Répartit vos ${overdueTasks.length} tâches en retard sur les prochains jours pour restaurer votre dynamique.`
      : `Spreads your ${overdueTasks.length} overdue tasks across upcoming days to restore momentum.`,
    severity: overdueTasks.length >= 3 ? "critical" : "warning",
    diffItems,
    actions,
    estimatedTimeSavedMinutes: overdueTasks.length * 4,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Detects tasks inactive for an extended period (> threshold) and proposes archival.
 */
export function detectStaleTaskArchival(
  snapshot: WorkspaceSnapshot,
  civilDate: string,
  staleDaysThreshold = 30,
  lang: "fr" | "en" = "fr"
): ProactiveAutomationProposal | null {
  const isFr = lang === "fr";
  const tasks = (snapshot.tasks || []).filter(isActiveTask);
  const nowTs = new Date(`${civilDate}T12:00:00Z`).getTime();
  const thresholdMs = staleDaysThreshold * 24 * 60 * 60 * 1000;

  const staleTasks = tasks.filter((t) => {
    // Cannot be stale if due today or in the future
    if (t.due_at && extractCivilDate(t.due_at) >= civilDate) return false;

    const lastTouchStr = t.updated_at || t.created_at;
    if (!lastTouchStr) return false;
    const lastTouchTs = new Date(lastTouchStr).getTime();
    return nowTs - lastTouchTs > thresholdMs;
  });

  if (staleTasks.length === 0) return null;

  const diffItems: AutomationDiffItem[] = [];
  const actions: IntelligenceAction[] = [];

  for (const task of staleTasks) {
    diffItems.push({
      entityId: task.id,
      entityType: "task",
      title: task.title,
      field: "status",
      currentValue: task.status,
      proposedValue: "archived",
      reason: isFr
        ? `Inactive depuis plus de ${staleDaysThreshold} jours`
        : `Inactive for over ${staleDaysThreshold} days`,
    });

    actions.push({
      id: `act-archive-${task.id}`,
      type: "update_task",
      label: isFr ? `Archiver "${task.title}"` : `Archive "${task.title}"`,
      description: isFr
        ? `Archiver la tâche inactive pour clarifier l'espace`
        : `Archive inactive task to declutter workspace`,
      payload: { taskId: task.id, status: "archived" },
      risk: "low",
      confirmationRequired: true,
    });
  }

  return {
    id: `proposal-archive-${civilDate}`,
    workspaceId: snapshot.tasks[0]?.project_id ?? "workspace",
    kind: "archive_stale",
    title: isFr
      ? `Nettoyage de ${staleTasks.length} tâche(s) inactive(s)`
      : `Archive ${staleTasks.length} stale task(s)`,
    description: isFr
      ? `${staleTasks.length} tâche(s) n'ont eu aucune activité depuis plus d'un mois. L'archivage permet de clarifier votre tableau de bord.`
      : `${staleTasks.length} task(s) had no activity for over a month. Archiving clears workspace noise.`,
    severity: "info",
    diffItems,
    actions,
    estimatedTimeSavedMinutes: staleTasks.length * 3,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Detects days with excessive task accumulation and suggests balanced distribution.
 */
export function detectWorkloadConflicts(
  snapshot: WorkspaceSnapshot,
  civilDate: string,
  maxPerDay = 4,
  lang: "fr" | "en" = "fr"
): ProactiveAutomationProposal | null {
  const isFr = lang === "fr";
  const tasks = (snapshot.tasks || []).filter(isActiveTask);

  // Group active future/today tasks by civil date
  const byDate = new Map<string, TaskLike[]>();
  for (const task of tasks) {
    if (!task.due_at) continue;
    const taskDate = extractCivilDate(task.due_at);
    if (taskDate < civilDate) continue; // Overdue is handled separately

    const list = byDate.get(taskDate) || [];
    list.push(task);
    byDate.set(taskDate, list);
  }

  // Find the first overloaded date
  let overloadedDate: string | null = null;
  let overloadedTasks: TaskLike[] = [];

  for (const [date, list] of byDate.entries()) {
    if (list.length > maxPerDay) {
      overloadedDate = date;
      overloadedTasks = list;
      break;
    }
  }

  if (!overloadedDate || overloadedTasks.length <= maxPerDay) return null;

  // Keep maxPerDay highest priority tasks on that day, shift excess forward
  const sorted = [...overloadedTasks].sort((a, b) => {
    const pOrder: Record<string, number> = { urgent: 0, p0: 0, high: 1, p1: 1, medium: 2, p2: 2, low: 3 };
    const pA = pOrder[(a.priority || "").toLowerCase()] ?? 2;
    const pB = pOrder[(b.priority || "").toLowerCase()] ?? 2;
    return pA - pB;
  });

  const excessTasks = sorted.slice(maxPerDay);
  const diffItems: AutomationDiffItem[] = [];
  const actions: IntelligenceAction[] = [];

  excessTasks.forEach((task, idx) => {
    const nextDate = addDays(overloadedDate, idx + 1);
    const proposedDue = `${nextDate}T14:00:00Z`;

    diffItems.push({
      entityId: task.id,
      entityType: "task",
      title: task.title,
      field: "due_at",
      currentValue: task.due_at ?? null,
      proposedValue: proposedDue,
      reason: isFr
        ? `Décalage à ${nextDate} pour éviter la surcharge le ${overloadedDate}`
        : `Shifted to ${nextDate} to prevent deadline spike on ${overloadedDate}`,
    });

    actions.push({
      id: `act-rebalance-${task.id}`,
      type: "update_task",
      label: isFr ? `Lisser l'échéance de "${task.title}"` : `Rebalance "${task.title}"`,
      description: isFr
        ? `Reporter au ${nextDate} pour équilibrer la charge`
        : `Postpone to ${nextDate} to balance workload`,
      payload: { taskId: task.id, dueDate: proposedDue },
      risk: "low",
      confirmationRequired: true,
    });
  });

  return {
    id: `proposal-workload-${overloadedDate}`,
    workspaceId: snapshot.tasks[0]?.project_id ?? "workspace",
    kind: "rebalance_workload",
    title: isFr
      ? `Lissage de charge (${excessTasks.length} tâches à rééquilibrer)`
      : `Workload rebalancing (${excessTasks.length} tasks to spread)`,
    description: isFr
      ? `${overloadedTasks.length} tâches sont programmées le ${overloadedDate} (seuil max recommandé : ${maxPerDay}). Ce lissage évite les goulots d'étranglement.`
      : `${overloadedTasks.length} tasks are scheduled for ${overloadedDate} (threshold: ${maxPerDay}). Spreading avoids bottleneck stress.`,
    severity: "warning",
    diffItems,
    actions,
    estimatedTimeSavedMinutes: excessTasks.length * 5,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Aggregates all proactive proposals for a given workspace snapshot.
 */
export function detectAutomationProposals(
  snapshot: WorkspaceSnapshot,
  options: AutomationDetectionOptions
): ProactiveAutomationProposal[] {
  const { workspaceId, language = "fr", staleDaysThreshold = 30, maxOverloadPerDay = 4 } = options;
  const civilDate = options.civilDate || extractCivilDate(snapshot.now);
  const proposals: ProactiveAutomationProposal[] = [];

  // 1. Overdue tasks rescheduling
  const overdueProposal = detectOverdueRescheduling(snapshot, civilDate, language);
  if (overdueProposal) {
    overdueProposal.workspaceId = workspaceId;
    proposals.push(overdueProposal);
  }

  // 2. Stale tasks archival
  const staleProposal = detectStaleTaskArchival(snapshot, civilDate, staleDaysThreshold, language);
  if (staleProposal) {
    staleProposal.workspaceId = workspaceId;
    proposals.push(staleProposal);
  }

  // 3. Workload balancing
  const workloadProposal = detectWorkloadConflicts(snapshot, civilDate, maxOverloadPerDay, language);
  if (workloadProposal) {
    workloadProposal.workspaceId = workspaceId;
    proposals.push(workloadProposal);
  }

  return proposals;
}

export interface AutomationApiDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface HandleAutomationRequestOptions {
  db: AutomationApiDb;
  userId: string | null;
  workspaceId: string | null;
  civilDate?: string;
  language?: "fr" | "en";
}

/**
 * Handles incoming automation API requests with authentication and tenancy checks.
 */
export async function handleAutomationRequest(
  options: HandleAutomationRequestOptions
): Promise<{ status: number; body: Record<string, unknown> | { proposals: ProactiveAutomationProposal[] } }> {
  const { db, userId, workspaceId, civilDate, language = "fr" } = options;

  if (!userId) {
    return { status: 401, body: { error: "Authentication required" } };
  }

  if (!workspaceId) {
    return { status: 400, body: { error: "Active workspace is required" } };
  }

  const [tasksRes, projectsRes, goalsRes] = await Promise.all([
    db
      .from("tasks")
      .select("id, title, status, priority, due_at, completed_at, project_id, updated_at, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("projects")
      .select("id, name, status, due_date, progress, goal_id, updated_at, created_at")
      .eq("workspace_id", workspaceId),
    db
      .from("goals")
      .select("id, title, status, progress, target_date, updated_at")
      .eq("workspace_id", workspaceId),
  ]);

  assertIntelligenceData(tasksRes, projectsRes, goalsRes);

  const snapshot: WorkspaceSnapshot = {
    tasks: (tasksRes.data ?? []) as WorkspaceSnapshot["tasks"],
    projects: (projectsRes.data ?? []) as WorkspaceSnapshot["projects"],
    goals: (goalsRes.data ?? []) as WorkspaceSnapshot["goals"],
  };

  const proposals = detectAutomationProposals(snapshot, {
    workspaceId,
    civilDate,
    language,
  });

  return { status: 200, body: { proposals } };
}

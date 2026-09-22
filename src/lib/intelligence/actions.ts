// ============================================================
// NEXUS INTELLIGENCE — SECURE ACTION EXECUTION LAYER
//
// The LLM never touches Supabase. It produces a typed tool call;
// this server-side layer re-validates the payload, re-resolves the
// target inside the authenticated workspace, performs the mutation,
// reads the row back and verifies the expected values before the UI
// is allowed to report success.
//
// Every destructive mutation requires an explicit confirmation flag
// and is re-scoped to the authenticated workspace. No client-provided
// id is trusted without a workspace-scoped existence check.
// ============================================================

import type { IntelligenceActionType, ActionVerification } from "./types";
import { riskForAction } from "./intent";

export class ActionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ActionError";
    this.status = status;
  }
}

/** Minimal client surface used by this layer, satisfied by the real
 *  Supabase client and by the test fakes. */
export interface ActionDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export type ActionExecutionResult = {
  success: true;
  actionType: IntelligenceActionType;
  entityId: string;
  message: string;
  verified: ActionVerification;
  entity: Record<string, unknown>;
};

export function riskForIntelligenceAction(type: IntelligenceActionType) {
  return riskForAction(type);
}

function stringValue(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
}

function normalizeDate(value: unknown): string | null {
  const raw = stringValue(value, 200);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new ActionError("Invalid date value");
  return new Date(raw.includes("T") ? raw : `${raw}T00:00:00`).toISOString();
}

function normalizeDailyDate(value: unknown): string | null {
  const raw = stringValue(value, 200);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new ActionError("Invalid date value");
  return parsed.toISOString().slice(0, 10);
}

const VALID_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const VALID_TASK_STATUSES = new Set(["todo", "in_progress", "in_review", "blocked", "done", "cancelled"]);
const VALID_PROJECT_STATUSES = new Set(["planning", "active", "paused", "completed", "archived"]);

async function resolveEntity(
  db: ActionDbClient,
  table: "projects" | "tasks" | "goals",
  workspaceId: string,
  payload: Record<string, unknown>
): Promise<string | null> {
  const id = stringValue(payload.id ?? payload.taskId ?? payload.projectId ?? payload.goalId, 100);
  if (id) {
    const { data } = await db
      .from(table)
      .select("id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    return data?.id ?? null;
  }

  const query = stringValue(payload.query) ?? stringValue(payload.title) ?? stringValue(payload.name);
  if (!query) return null;
  const labelColumn = table === "projects" ? "name" : "title";
  const { data } = await db
    .from(table)
    .select("id")
    .eq("workspace_id", workspaceId)
    .ilike(labelColumn, `%${query}%`)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

function requireTarget(id: string | null, label: string) {
  if (!id) throw new ActionError(`No matching ${label} found in this workspace`, 404);
  return id;
}

async function verifyTask(
  db: ActionDbClient,
  workspaceId: string,
  taskId: string,
  expected: Record<string, unknown>
): Promise<ActionVerification> {
  const { data } = await db
    .from("tasks")
    .select("id, workspace_id, title, status, priority, due_at, project_id, completed_at, updated_at")
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data) {
    return { verified: false, summary: "Task could not be read back", matched: [], mismatched: ["missing row"] };
  }

  const matched: string[] = [];
  const mismatched: string[] = [];
  for (const [key, value] of Object.entries(expected)) {
    const actual = data[key];
    const same = actual === value || (value === null && (actual === null || actual === undefined));
    if (same) matched.push(key);
    else mismatched.push(`${key}: expected ${String(value)}, got ${String(actual)}`);
  }

  return {
    verified: matched.length === Object.keys(expected).length,
    summary: `Task “${data.title}” read back in this workspace`,
    matched,
    mismatched,
  };
}

async function verifyProject(
  db: ActionDbClient,
  workspaceId: string,
  projectId: string,
  expected: Record<string, unknown>
): Promise<ActionVerification> {
  const { data } = await db
    .from("projects")
    .select("id, workspace_id, name, status, progress, due_date, updated_at")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data) {
    return { verified: false, summary: "Project could not be read back", matched: [], mismatched: ["missing row"] };
  }

  const matched: string[] = [];
  const mismatched: string[] = [];
  for (const [key, value] of Object.entries(expected)) {
    const actual = data[key];
    const same = actual === value || (value === null && (actual === null || actual === undefined));
    if (same) matched.push(key);
    else mismatched.push(`${key}: expected ${String(value)}, got ${String(actual)}`);
  }
  return {
    verified: matched.length === Object.keys(expected).length,
    summary: `Project “${data.name}” read back in this workspace`,
    matched,
    mismatched,
  };
}

async function verifyGoal(
  db: ActionDbClient,
  workspaceId: string,
  goalId: string,
  expected: Record<string, unknown>
): Promise<ActionVerification> {
  const { data } = await db
    .from("goals")
    .select("id, workspace_id, title, status, progress, target_date")
    .eq("id", goalId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data) return { verified: false, summary: "Goal could not be read back", matched: [], mismatched: ["missing row"] };
  const matched: string[] = [];
  const mismatched: string[] = [];
  for (const [key, value] of Object.entries(expected)) {
    const actual = data[key];
    const same = actual === value || (value === null && (actual === null || actual === undefined));
    if (same) matched.push(key);
    else mismatched.push(`${key}: expected ${String(value)}, got ${String(actual)}`);
  }
  return {
    verified: matched.length === Object.keys(expected).length,
    summary: `Goal “${data.title}” read back in this workspace`,
    matched,
    mismatched,
  };
}

/** Executes a confirmed Intelligence mutation in a single re-validated path. */
export async function executeIntelligenceAction(
  db: ActionDbClient,
  workspaceId: string,
  userId: string,
  actionType: IntelligenceActionType,
  rawPayload: Record<string, unknown>
): Promise<ActionExecutionResult> {
  const payload = { ...rawPayload };
  const risk = riskForIntelligenceAction(actionType);

  if (!["low", "medium", "high"].includes(risk)) {
    throw new ActionError("Action cannot be executed", 400);
  }

  // Every mutation must be explicitly confirmed by the UI after the
  // action card was shown. High-risk destructive actions also require
  // the dedicated confirmDeletion flag.
  if (rawPayload.confirmed !== true) {
    throw new ActionError("Confirmation is required before executing this action", 409);
  }
  if (actionType.startsWith("delete_") && rawPayload.confirmDeletion !== true) {
    throw new ActionError("This destructive action requires an explicit confirmation", 409);
  }

  switch (actionType) {
    case "create_task": {
      const title = stringValue(payload.title);
      if (!title) throw new ActionError("Task title is required", 422);
      const priority = typeof payload.priority === "string" && VALID_PRIORITIES.has(payload.priority)
        ? payload.priority
        : "medium";
      const dueAt = normalizeDate(payload.dueDate ?? payload.due_at);
      const projectId = payload.projectId
        ? await resolveEntity(db, "projects", workspaceId, { id: payload.projectId })
        : null;
      const description = stringValue(payload.description, 1000);

      const { data: task, error } = await db
        .from("tasks")
        .insert({
          workspace_id: workspaceId,
          title,
          description,
          priority,
          status: "todo",
          due_at: dueAt,
          project_id: projectId,
          created_by: userId,
        })
        .select("id, title, priority, status, due_at, project_id")
        .single();

      if (error || !task) throw new ActionError(error?.message ?? "Failed to create task", 500);
      const verification = await verifyTask(db, workspaceId, task.id, {
        title,
        priority,
        status: "todo",
        due_at: dueAt,
        workspace_id: workspaceId,
      });
      if (!verification.verified) throw new ActionError(`Task was created but verification failed: ${verification.mismatched.join(", ")}`, 500);
      return { success: true, actionType, entityId: task.id, message: `Task “${title}” created and verified`, verified: verification, entity: task };
    }

    case "create_project": {
      const name = stringValue(payload.name) ?? stringValue(payload.title);
      if (!name) throw new ActionError("Project name is required", 422);
      const dueDate = normalizeDailyDate(payload.dueDate ?? payload.due_date);
      const description = stringValue(payload.description, 1000);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

      const { data: project, error } = await db
        .from("projects")
        .insert({
          workspace_id: workspaceId,
          name,
          slug,
          description,
          status: "planning",
          progress: 0,
          due_date: dueDate,
          owner_id: userId,
        })
        .select("id, name, status, progress, due_date")
        .single();

      if (error || !project) throw new ActionError(error?.message ?? "Failed to create project", 500);
      const verification = await verifyProject(db, workspaceId, project.id, {
        name,
        status: "planning",
        progress: 0,
        due_date: dueDate,
        workspace_id: workspaceId,
      });
      if (!verification.verified) throw new ActionError("Project was created but verification failed", 500);
      return { success: true, actionType, entityId: project.id, message: `Project “${name}” created and verified`, verified: verification, entity: project };
    }

    case "create_goal": {
      const title = stringValue(payload.title);
      if (!title) throw new ActionError("Goal title is required", 422);
      const targetDate = normalizeDailyDate(payload.targetDate ?? payload.target_date ?? payload.dueDate);
      const { data: goal, error } = await db
        .from("goals")
        .insert({
          workspace_id: workspaceId,
          title,
          status: "active",
          progress: 0,
          target_date: targetDate,
          created_by: userId,
        })
        .select("id, title, status, progress, target_date")
        .single();
      if (error || !goal) throw new ActionError(error?.message ?? "Failed to create goal", 500);
      const verification = await verifyGoal(db, workspaceId, goal.id, {
        title,
        status: "active",
        progress: 0,
        workspace_id: workspaceId,
      });
      if (!verification.verified) throw new ActionError("Goal was created but verification failed", 500);
      return { success: true, actionType, entityId: goal.id, message: `Goal “${title}” created and verified`, verified: verification, entity: goal };
    }

    case "update_task": {
      const taskId = requireTarget(await resolveEntity(db, "tasks", workspaceId, payload), "task");
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const expected: Record<string, unknown> = {};

      if (payload.priority && VALID_PRIORITIES.has(payload.priority as string)) {
        updates.priority = payload.priority;
        expected.priority = payload.priority;
      }
      if (payload.status && VALID_TASK_STATUSES.has(payload.status as string)) {
        updates.status = payload.status;
        expected.status = payload.status;
        if (payload.status === "done") {
          updates.completed_at = new Date().toISOString();
          expected.completed_at = updates.completed_at;
        } else {
          updates.completed_at = null;
          expected.completed_at = null;
        }
      }
      if (payload.dueDate !== undefined || payload.due_at !== undefined) {
        updates.due_at = normalizeDate(payload.dueDate ?? payload.due_at);
        expected.due_at = updates.due_at;
      }
      const title = stringValue(payload.title);
      if (title) {
        updates.title = title;
        expected.title = title;
      }
      if (payload.projectId !== undefined) {
        updates.project_id = payload.projectId
          ? await resolveEntity(db, "projects", workspaceId, { id: payload.projectId })
          : null;
        expected.project_id = updates.project_id;
      }

      if (Object.keys(expected).length === 0) throw new ActionError("No updatable field provided", 422);

      const { data: updated, error } = await db
        .from("tasks")
        .update(updates)
        .eq("id", taskId)
        .eq("workspace_id", workspaceId)
        .select("id, title, status, priority, due_at, project_id, completed_at")
        .single();

      if (error || !updated) throw new ActionError(error?.message ?? "Failed to update task", 500);
      const verification = await verifyTask(db, workspaceId, taskId, expected);
      if (!verification.verified) throw new ActionError("Task update could not be verified", 500);
      return { success: true, actionType, entityId: taskId, message: `Task updated and verified`, verified: verification, entity: updated };
    }

    case "complete_task": {
      const taskId = requireTarget(await resolveEntity(db, "tasks", workspaceId, payload), "task");
      const completedAt = new Date().toISOString();
      const { data: updated, error } = await db
        .from("tasks")
        .update({ status: "done", completed_at: completedAt, updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .eq("workspace_id", workspaceId)
        .select("id, title, status, priority, due_at, completed_at")
        .single();
      if (error || !updated) throw new ActionError(error?.message ?? "Failed to complete task", 500);
      const verification = await verifyTask(db, workspaceId, taskId, {
        status: "done",
        completed_at: completedAt,
      });
      if (!verification.verified) throw new ActionError("Task completion could not be verified", 500);
      return { success: true, actionType, entityId: taskId, message: `Task “${updated.title}” completed and verified`, verified: verification, entity: updated };
    }

    case "move_task": {
      const taskId = requireTarget(await resolveEntity(db, "tasks", workspaceId, payload), "task");
      const dueAt = normalizeDate(payload.dueDate ?? payload.due_at);
      if (!dueAt) throw new ActionError("A target date is required to move a task", 422);
      const { data: updated, error } = await db
        .from("tasks")
        .update({ due_at: dueAt, updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .eq("workspace_id", workspaceId)
        .select("id, title, status, priority, due_at")
        .single();
      if (error || !updated) throw new ActionError(error?.message ?? "Failed to move task", 500);
      const verification = await verifyTask(db, workspaceId, taskId, { due_at: dueAt });
      if (!verification.verified) throw new ActionError("Task move could not be verified", 500);
      return { success: true, actionType, entityId: taskId, message: `Task moved and verified`, verified: verification, entity: updated };
    }

    case "update_project": {
      const projectId = requireTarget(await resolveEntity(db, "projects", workspaceId, payload), "project");
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const expected: Record<string, unknown> = {};
      const name = stringValue(payload.name);
      if (name) {
        updates.name = name;
        expected.name = name;
      }
      if (payload.status && VALID_PROJECT_STATUSES.has(payload.status as string)) {
        updates.status = payload.status;
        expected.status = payload.status;
      }
      if (typeof payload.progress === "number" || typeof payload.progress === "string") {
        const progress = Math.min(100, Math.max(0, Number(payload.progress)));
        updates.progress = progress;
        expected.progress = progress;
      }
      if (payload.dueDate !== undefined || payload.due_date !== undefined) {
        updates.due_date = normalizeDailyDate(payload.dueDate ?? payload.due_date);
        expected.due_date = updates.due_date;
      }
      if (Object.keys(expected).length === 0) throw new ActionError("No updatable field provided", 422);

      const { data: updated, error } = await db
        .from("projects")
        .update(updates)
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .select("id, name, status, progress, due_date")
        .single();
      if (error || !updated) throw new ActionError(error?.message ?? "Failed to update project", 500);
      const verification = await verifyProject(db, workspaceId, projectId, expected);
      if (!verification.verified) throw new ActionError("Project update could not be verified", 500);
      return { success: true, actionType, entityId: projectId, message: `Project updated and verified`, verified: verification, entity: updated };
    }

    case "delete_task": {
      const taskId = requireTarget(await resolveEntity(db, "tasks", workspaceId, payload), "task");
      const { error } = await db.from("tasks").delete().eq("id", taskId).eq("workspace_id", workspaceId);
      if (error) throw new ActionError(error?.message ?? "Failed to delete task", 500);
      const { data } = await db.from("tasks").select("id").eq("id", taskId).eq("workspace_id", workspaceId).maybeSingle();
      const verification: ActionVerification = data
        ? { verified: false, summary: "Task still exists after delete", matched: [], mismatched: ["row still present"] }
        : { verified: true, summary: "Task removed from this workspace", matched: ["deleted"], mismatched: [] };
      if (!verification.verified) throw new ActionError("Task deletion could not be verified", 500);
      return { success: true, actionType, entityId: taskId, message: `Task deleted and verified`, verified: verification, entity: { id: taskId } };
    }

    case "delete_project": {
      const projectId = requireTarget(await resolveEntity(db, "projects", workspaceId, payload), "project");
      const { error } = await db.from("projects").delete().eq("id", projectId).eq("workspace_id", workspaceId);
      if (error) throw new ActionError(error?.message ?? "Failed to delete project", 500);
      const { data } = await db.from("projects").select("id").eq("id", projectId).eq("workspace_id", workspaceId).maybeSingle();
      const verification: ActionVerification = data
        ? { verified: false, summary: "Project still exists after delete", matched: [], mismatched: ["row still present"] }
        : { verified: true, summary: "Project removed from this workspace", matched: ["deleted"], mismatched: [] };
      if (!verification.verified) throw new ActionError("Project deletion could not be verified", 500);
      return { success: true, actionType, entityId: projectId, message: `Project deleted and verified`, verified: verification, entity: { id: projectId } };
    }

    case "update_goal": {
      const goalId = requireTarget(await resolveEntity(db, "goals", workspaceId, payload), "goal");
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const expected: Record<string, unknown> = {};
      const title = stringValue(payload.title);
      if (title) {
        updates.title = title;
        expected.title = title;
      }
      if (payload.status && ["active", "completed", "cancelled"].includes(payload.status as string)) {
        updates.status = payload.status;
        expected.status = payload.status;
      }
      if (typeof payload.progress === "number" || typeof payload.progress === "string") {
        const progress = Math.min(100, Math.max(0, Number(payload.progress)));
        updates.progress = progress;
        expected.progress = progress;
      }
      if (payload.targetDate !== undefined || payload.target_date !== undefined) {
        updates.target_date = normalizeDailyDate(payload.targetDate ?? payload.target_date);
        expected.target_date = updates.target_date;
      }
      if (Object.keys(expected).length === 0) throw new ActionError("No updatable field provided", 422);

      const { data: updated, error } = await db
        .from("goals")
        .update(updates)
        .eq("id", goalId)
        .eq("workspace_id", workspaceId)
        .select("id, title, status, progress, target_date")
        .single();
      if (error || !updated) throw new ActionError(error?.message ?? "Failed to update goal", 500);
      const verification = await verifyGoal(db, workspaceId, goalId, expected);
      if (!verification.verified) throw new ActionError("Goal update could not be verified", 500);
      return { success: true, actionType, entityId: goalId, message: `Goal updated and verified`, verified: verification, entity: updated };
    }

    case "delete_goal": {
      const goalId = requireTarget(await resolveEntity(db, "goals", workspaceId, payload), "goal");
      const { error } = await db.from("goals").delete().eq("id", goalId).eq("workspace_id", workspaceId);
      if (error) throw new ActionError(error?.message ?? "Failed to delete goal", 500);
      const { data } = await db.from("goals").select("id").eq("id", goalId).eq("workspace_id", workspaceId).maybeSingle();
      const verification: ActionVerification = data
        ? { verified: false, summary: "Goal still exists after delete", matched: [], mismatched: ["row still present"] }
        : { verified: true, summary: "Goal removed from this workspace", matched: ["deleted"], mismatched: [] };
      if (!verification.verified) throw new ActionError("Goal deletion could not be verified", 500);
      return { success: true, actionType, entityId: goalId, message: `Goal deleted and verified`, verified: verification, entity: { id: goalId } };
    }

    default:
      throw new ActionError(`Action "${actionType}" does not require server execution`, 400);
  }
}

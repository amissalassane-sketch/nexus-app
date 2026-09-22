import { assertIntelligenceData } from "./data-error";
// ============================================================
// NEXUS INTELLIGENCE — STRUCTURED WORKING MEMORY (Phase 2)
// ============================================================
// A compact, reliable, server-persisted memory of what the agent
// knows about the current conversation:
//
//   - last displayed entities (ordered — the index base for
//     "la deuxième")
//   - last resolved target (pronouns / ordinals / verb suffixes)
//   - last plan proposed
//   - last mutation action (proposed / executed+verified / failed)
//   - pending human confirmation (proposed ≠ executed)
//   - deleted entity ids (reference invalidation)
//   - explicit, durable preferences (persistent memory)
//
// Hard rules:
//   - Memory NEVER creates an entity: every id stored comes from a
//     real read or from a verified server mutation.
//   - A proposed action is stored as "proposed", never as executed.
//   - "executed" requires a verified read-back (status verified=true).
//   - A failed action is stored as "failed", never as executed.
//
// Persistence: one row per (user_id, workspace_id) in the
// `intelligence_memory` table (RLS-scoped). The client never touches
// it directly — only the server routes read/write it.
// ============================================================

import type {
  IntelligenceActionType,
  IntelligenceIntentId,
  IntelligenceMemoryState,
  IntelligencePreference,
  IntelligenceTarget,
  MemoryEntityRef,
  MemoryEntityType,
  StructuredIntelligenceResponse,
} from "./types";
import type { WorkspaceSnapshot } from "./engine";

export const MEMORY_MAX_ITEMS = 8;
export const MEMORY_MAX_DELETED = 5;
export const MEMORY_MAX_PREFERENCES = 10;

const MUTATION_ACTION_TYPES = new Set<IntelligenceActionType>([
  "create_task",
  "create_project",
  "create_goal",
  "update_task",
  "update_project",
  "update_goal",
  "complete_task",
  "move_task",
  "delete_task",
  "delete_project",
  "delete_goal",
]);

export function emptyMemoryState(now: Date = new Date()): IntelligenceMemoryState {
  return {
    conversationId: `conv-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    lastIntent: null,
    lastQuery: null,
    lastTarget: null,
    lastItems: [],
    lastPlan: null,
    lastAction: null,
    pendingConfirmation: null,
    deletedEntityIds: [],
    updatedAt: now.toISOString(),
  };
}

// ============================================================
// Entity helpers
// ============================================================

/** Maps a workspace snapshot row to a memory entity ref (real data). */
export function entityRefFromRow(
  row: { id: string; title?: string | null; name?: string | null; due_at?: string | null; due_date?: string | null; project_id?: string | null },
  type: MemoryEntityType,
  projectName?: string | null
): MemoryEntityRef {
  return {
    id: row.id,
    title: row.title ?? row.name ?? "Item",
    type,
    dueDate: row.due_at ?? row.due_date ?? null,
    projectName: projectName ?? null,
  };
}

/** True when the id still exists in the real snapshot (scoped). */
export function entityExistsInSnapshot(
  id: string,
  type: MemoryEntityType,
  snapshot: WorkspaceSnapshot
): boolean {
  if (type === "task") return snapshot.tasks.some((t) => t.id === id);
  if (type === "project") return snapshot.projects.some((p) => p.id === id);
  return snapshot.goals.some((g) => g.id === id);
}

export function refToTarget(ref: MemoryEntityRef): IntelligenceTarget {
  return { type: ref.type, id: ref.id, label: ref.title };
}

/** Infers the entity type from an item href when available. */
export function typeFromHref(href?: string): MemoryEntityType | null {
  if (!href) return null;
  if (href.includes("/projects")) return "project";
  if (href.includes("/goals")) return "goal";
  if (href.includes("/tasks") || href.includes("/task")) return "task";
  return null;
}

// ============================================================
// Update after a turn (pure)
// ============================================================

/** Derives the ordered list of entities the response showed to the
 *  user. Only real ids are kept; titles come from the response items;
 *  due dates and project names are cross-checked against the snapshot. */
export function itemsFromResponse(
  response: StructuredIntelligenceResponse,
  snapshot: WorkspaceSnapshot,
  limit = MEMORY_MAX_ITEMS
): MemoryEntityRef[] {
  const items: MemoryEntityRef[] = [];
  const projectNames = new Map(snapshot.projects.map((p) => [p.id, p.name]));

  for (const item of response.items ?? []) {
    if (!item.id || typeof item.id !== "string") continue;
    const hrefType = typeFromHref(item.href);
    let type: MemoryEntityType | null = hrefType;

    // Cross-check with the real snapshot to guarantee reality.
    if (snapshot.tasks.some((t) => t.id === item.id)) type = type ?? "task";
    else if (snapshot.projects.some((p) => p.id === item.id)) type = type ?? "project";
    else if (snapshot.goals.some((g) => g.id === item.id)) type = type ?? "goal";

    if (!type) continue; // unknown id — never store fabricated entities

    const task = snapshot.tasks.find((t) => t.id === item.id);
    const project = snapshot.projects.find((p) => p.id === item.id);
    const goal = snapshot.goals.find((g) => g.id === item.id);

    items.push({
      id: item.id,
      title: item.title,
      type,
      dueDate: task?.due_at ?? project?.due_date ?? goal?.target_date ?? null,
      projectName: task?.project_id ? projectNames.get(task.project_id) ?? null : null,
    });
    if (items.length >= limit) break;
  }
  return items;
}

/** Updates the memory state after a completed agent turn. Mutations in
 *  the response are always stored as PROPOSED (they need human
 *  confirmation; the server executes and verifies them separately). */
export function updateMemoryAfterTurn(
  prev: IntelligenceMemoryState,
  response: StructuredIntelligenceResponse,
  snapshot: WorkspaceSnapshot,
  now: Date = new Date()
): IntelligenceMemoryState {
  const items = itemsFromResponse(response, snapshot);
  const action = response.action;

  const lastAction = action && MUTATION_ACTION_TYPES.has(action.type)
    ? {
        type: action.type,
        status: "proposed" as const,
        entityId: action.payload?.taskId ?? action.payload?.projectId ?? action.payload?.goalId ?? null,
        entityLabel: action.payload?.title ?? action.payload?.name ?? action.payload?.query ?? null,
        verified: false,
        payload: action.payload ? { ...action.payload } : undefined,
        timestamp: now.toISOString(),
      }
    : prev.lastAction;

  const pendingConfirmation =
    action && action.confirmationRequired && MUTATION_ACTION_TYPES.has(action.type)
      ? {
          actionType: action.type,
          entityId: lastAction?.entityId ?? null,
          entityLabel: lastAction?.entityLabel ?? null,
          timestamp: now.toISOString(),
        }
      : action && !action.confirmationRequired
        ? null // resolved (e.g. navigation / non-mutation) — clear stale pending
        : prev.pendingConfirmation;

  return {
    ...prev,
    lastIntent: response.intentId ?? prev.lastIntent,
    lastQuery: response.query,
    lastTarget: response.target?.id ? { ...response.target } : items[0] ? refToTarget(items[0]) : prev.lastTarget,
    lastItems: items.length > 0 ? items : prev.lastItems,
    lastPlan: response.plan
      ? { summary: response.plan.summary, stepCount: response.plan.steps.length }
      : prev.lastPlan,
    lastAction,
    pendingConfirmation,
    updatedAt: now.toISOString(),
  };
}

// ============================================================
// Update after a server mutation (pure)
// ============================================================

/** Applies a VERIFIED mutation result to the memory. Only called after
 *  the server read the row back. Deletions invalidate the reference. */
export function applyActionSuccess(
  prev: IntelligenceMemoryState,
  actionType: IntelligenceActionType,
  entityId: string,
  entityLabel: string,
  verified: boolean,
  entityType: MemoryEntityType = "task",
  now: Date = new Date()
): IntelligenceMemoryState {
  const isDelete =
    actionType === "delete_task" || actionType === "delete_project" || actionType === "delete_goal";

  let deletedEntityIds = prev.deletedEntityIds;
  let lastItems = prev.lastItems;
  let lastTarget = prev.lastTarget;

  if (isDelete) {
    deletedEntityIds = [
      entityId,
      ...prev.deletedEntityIds.filter((id) => id !== entityId),
    ].slice(0, MEMORY_MAX_DELETED);
    lastItems = prev.lastItems.filter((item) => item.id !== entityId);
    // lastTarget intentionally stays on the deleted entity: a follow-up
    // reference ("Passe-la en urgente" right after the delete) must be
    // reported as "n'existe plus", never silently re-targeted.
  } else {
    // New/updated entity becomes the fresh target.
    lastTarget = { type: entityType, id: entityId, label: entityLabel };
    const existing = prev.lastItems.find((item) => item.id === entityId);
    if (existing) {
      lastItems = prev.lastItems.map((item) =>
        item.id === entityId ? { ...item, title: entityLabel } : item
      );
    } else {
      lastItems = [
        { id: entityId, title: entityLabel, type: entityType },
        ...prev.lastItems.filter((item) => item.id !== entityId),
      ].slice(0, MEMORY_MAX_ITEMS);
    }
  }

  return {
    ...prev,
    lastTarget,
    lastItems,
    deletedEntityIds,
    lastAction: {
      type: actionType,
      status: verified ? "executed" : "failed",
      entityId,
      entityLabel,
      verified,
      timestamp: now.toISOString(),
    },
    pendingConfirmation: null,
    updatedAt: now.toISOString(),
  };
}

/** Applies a failed/rejected mutation to the memory. The action is
 *  recorded as FAILED — never as executed. */
export function applyActionFailure(
  prev: IntelligenceMemoryState,
  actionType: IntelligenceActionType,
  entityLabel?: string | null,
  now: Date = new Date()
): IntelligenceMemoryState {
  return {
    ...prev,
    lastAction: {
      type: actionType,
      status: "failed",
      entityId: null,
      entityLabel: entityLabel ?? null,
      verified: false,
      timestamp: now.toISOString(),
    },
    pendingConfirmation: null,
    updatedAt: now.toISOString(),
  };
}

/** Points the working memory at a specific real entity (used when the
 *  user focuses a proactive signal, so "pourquoi ?" / "débloque-la"
 *  resolve to the signalled entity). Never creates an entity: the id
 *  must come from a real read or a stored signal row. */
export function focusMemoryOnEntity(
  prev: IntelligenceMemoryState,
  entity: { type: "task" | "project" | "goal" | "workspace" | null; id: string | null; label: string | null },
  contextLabel: string,
  now: Date = new Date()
): IntelligenceMemoryState {
  if (!entity?.id) return { ...prev, lastQuery: contextLabel, updatedAt: now.toISOString() };
  const type: "task" | "project" | "goal" =
    entity.type === "project" ? "project" : entity.type === "goal" ? "goal" : "task";
  const target: IntelligenceTarget = { type, id: entity.id, label: entity.label ?? "Item" };
  const existing = prev.lastItems.find((item) => item.id === entity.id);
  const lastItems = existing
    ? prev.lastItems
    : [{ id: entity.id, title: entity.label ?? "Item", type }, ...prev.lastItems].slice(0, MEMORY_MAX_ITEMS);
  return {
    ...prev,
    lastQuery: contextLabel,
    lastTarget: target,
    lastItems,
    updatedAt: now.toISOString(),
  };
}

/** Removes references to deleted ids defensively (used on read). */
export function scrubDeletedIds(
  state: IntelligenceMemoryState,
  deletedIds: string[]
): IntelligenceMemoryState {
  if (deletedIds.length === 0) return state;
  const set = new Set(deletedIds);
  const lastItems = state.lastItems.filter((item) => !set.has(item.id));
  return {
    ...state,
    lastItems,
    lastTarget: state.lastTarget && set.has(state.lastTarget.id ?? "") ? (lastItems[0] ? refToTarget(lastItems[0]) : null) : state.lastTarget,
  };
}

// ============================================================
// Persistent preferences (explicit only)
// ============================================================

const PREFERENCE_PATTERNS: { key: string; re: RegExp }[] = [
  { key: "work_style", re: /(souviens-toi|souvenez-vous|retiens|retenez|rappelle-toi|remember|note)\s+(que|bien que)?\s*(.+)/i },
  { key: "organize", re: /(à l'avenir|dorénavant|désormais|from now on|always|toujours)\s+(.+)/i },
];

/** Extracts an explicit durable preference from the query. A casual
 *  temporary sentence is never converted into a preference. */
export function extractPreference(query: string): { key: string; value: string } | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  for (const pattern of PREFERENCE_PATTERNS) {
    const match = trimmed.match(pattern.re);
    if (!match) continue;
    const value = (match[3] ?? match[2] ?? "").trim().replace(/[.!?]+$/, "");
    if (value.length < 3 || value.length > 200) continue;
    const slug = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    return { key: slug || pattern.key, value };
  }
  return null;
}

export function upsertPreference(
  preferences: IntelligencePreference[],
  preference: { key: string; value: string },
  now: Date = new Date()
): IntelligencePreference[] {
  const existing = preferences.find((p) => p.key === preference.key);
  if (existing) {
    return preferences.map((p) =>
      p.key === preference.key ? { ...p, value: preference.value, createdAt: now.toISOString() } : p
    );
  }
  return [
    ...preferences,
    { ...preference, source: "explicit" as const, createdAt: now.toISOString() },
  ].slice(0, MEMORY_MAX_PREFERENCES);
}

export function compactPreferencesForPrompt(preferences: IntelligencePreference[]): string {
  if (preferences.length === 0) return "";
  return preferences
    .map((p) => `- ${p.value}`)
    .join("\n");
}

// ============================================================
// History reconstruction (refresh / other tabs)
// ============================================================

export function legacyIntentFromId(intentId?: IntelligenceIntentId | null): "analysis" | "prioritization" | "planning" | "synthesis" | "detection" | "action" | "general" {
  switch (intentId) {
    case "ANALYZE": return "analysis";
    case "PRIORITIZE": return "prioritization";
    case "PLAN": return "planning";
    case "SUMMARIZE": return "synthesis";
    case "DETECT": return "detection";
    case "CREATE":
    case "UPDATE":
    case "COMPLETE":
    case "MOVE":
    case "DELETE":
      return "action";
    default:
      return "general";
  }
}

// ============================================================
// Persistence (server only — Supabase row, RLS-scoped)
// ============================================================

/** Minimal client surface used by this layer (real Supabase client or
 *  the test fakes). */
export interface MemoryDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface StoredMemory {
  state: IntelligenceMemoryState;
  preferences: IntelligencePreference[];
}

/** Reads the memory row for (workspace, user). Returns null when the
 *  user never used Intelligence in this workspace before. */
export async function readMemory(
  db: MemoryDbClient,
  workspaceId: string,
  userId: string
): Promise<StoredMemory | null> {
  const { data, error } = await db
    .from("intelligence_memory")
    .select("state, preferences, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  assertIntelligenceData({ error });
  if (!data) return null;
  // Stop using inactive memory after 90 days even if the purge worker is delayed.
  if (data.updated_at && Date.parse(data.updated_at) <= Date.now() - 90 * 86400000) return null;
  return {
    state: {
      ...emptyMemoryState(),
      ...(typeof data.state === "object" && data.state !== null ? data.state : {}),
      lastItems: Array.isArray(data.state?.lastItems) ? data.state.lastItems : [],
      deletedEntityIds: Array.isArray(data.state?.deletedEntityIds) ? data.state.deletedEntityIds : [],
    },
    preferences: Array.isArray(data.preferences) ? data.preferences : [],
  };
}

/** Upserts the memory row (update first, insert when absent). */
export async function saveMemory(
  db: MemoryDbClient,
  workspaceId: string,
  userId: string,
  state: IntelligenceMemoryState,
  preferences: IntelligencePreference[]
): Promise<void> {
  const payload = {
    state,
    preferences,
    updated_at: new Date().toISOString(),
  };
  const { data: existing, error } = await db
    .from("intelligence_memory")
    .update(payload)
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  assertIntelligenceData({ error });
  if (!existing) {
    const inserted = await db.from("intelligence_memory").insert({
      user_id: userId,
      workspace_id: workspaceId,
      state,
      preferences,
    });
    assertIntelligenceData(inserted);
  }
}

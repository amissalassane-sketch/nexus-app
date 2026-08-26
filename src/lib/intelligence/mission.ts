// ============================================================
// NEXUS INTELLIGENCE — MISSION ENGINE (Phase 4)
// ============================================================
// A mission is a persistent operational objective decomposed into
// verifiable steps:
//
//   UNDERSTAND → LOAD CONTEXT → DECOMPOSE → PLAN → VALIDATE →
//   EXECUTE → VERIFY → UPDATE MISSION → RE-EVALUATE (bounded)
//
// Hard rules:
//   - The server is the authority. The LLM may propose; the server
//     validates. The LLM can NEVER declare a step completed.
//   - A step becomes completed ONLY when its deterministic
//     completionRule is satisfied against real data (snapshot rows or
//     a verified server read-back).
//   - A step's dependencies must be satisfied before it turns ready.
//   - The recompute loop is bounded (no infinite execution).
//   - A mission is persisted per (user, workspace) with RLS; the
//     client never writes the table directly.
// ============================================================

import { isActiveTask, type WorkspaceSnapshot } from "./engine";
import type { StoredSignalRow } from "./signals";
import type {
  IntelligenceAction,
  IntelligenceActionType,
  IntelligenceMission,
  MissionContext,
  MissionKind,
  MissionNextBestAction,
  MissionStep,
  MissionStepCompletionRule,
  MissionStepStatus,
} from "./types";

export interface MissionDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export const MISSION_LOOP_MAX_ITERATIONS = 8;
export const MISSION_MAX_ACTIVE = 5;
export const MISSION_STEP_LIMIT = 8;

// ============================================================
// DETECTION — "Prépare-moi pour ma présentation de vendredi"
// ============================================================

export interface MissionRequest {
  title: string;
  objective: string;
  kind: MissionKind;
  keyword: string | null;
  deadline: string | null;
  deadlineLabel: string | null;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[?!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DAYS_FR: Record<string, number> = {
  lundi: 1,
  monday: 1,
  mardi: 2,
  tuesday: 2,
  mercredi: 3,
  wednesday: 3,
  jeudi: 4,
  thursday: 4,
  vendredi: 5,
  friday: 5,
  samedi: 6,
  saturday: 6,
  dimanche: 0,
  sunday: 0,
};

function parseDeadline(query: string, now: Date): { iso: string; label: string } | null {
  const normalized = normalize(query);
  for (const [day, weekday] of Object.entries(DAYS_FR)) {
    if (normalized.includes(day)) {
      const diff = (weekday - now.getDay() + 7) % 7 || 7;
      const target = new Date(now);
      target.setDate(target.getDate() + diff);
      return { iso: target.toISOString().slice(0, 10), label: day };
    }
  }
  if (normalized.includes("demain") || normalized.includes("tomorrow")) {
    const target = new Date(now);
    target.setDate(target.getDate() + 1);
    return { iso: target.toISOString().slice(0, 10), label: "demain" };
  }
  if (normalized.includes("aujourd")) {
    return { iso: now.toISOString().slice(0, 10), label: "aujourd'hui" };
  }
  return null;
}

/** Extracts a topic keyword: the noun after "pour/pour ma/mon/la/le"
 *  or the gerund object ("préparer X", "prepare X"). */
function extractKeyword(query: string): string | null {
  const normalized = normalize(query);
  const patterns = [
    /(?:preparer|prepare|prépare|prepares|organiser|organize)\s+(?:pour|pour\s+(?:ma|mon|la|le|les|un|une))?\s*([a-zà-ÿ]+)/,
    /pour\s+(?:ma|mon|mes|la|le|les|un|une)\s+([a-zà-ÿ]+)/,
    /(?:presentation|présentation|reunion|réunion|rapport|meeting|presentation)\b/,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1] && match[1].length >= 3) return match[1];
    if (match?.[0]) {
      const keyword = match[0].split(" ").pop();
      if (keyword && keyword.length >= 3) return keyword;
    }
  }
  return null;
}

const MISSION_PHRASES = [
  "prepare-moi",
  "prépare-moi",
  "prepare me",
  "prepare-moi pour",
  "fais-moi un plan pour",
  "fais moi un plan pour",
  "organise mon",
  "organise ma",
  "aides-moi à préparer",
  "aide-moi à préparer",
  "organize my",
  "plan my",
  "prépare",
  "prepare",
];

/** Detects whether a user request should become a mission. Returns
 *  null when the request is a plain question or single action. */
export function detectMissionRequest(query: string, now: Date = new Date()): MissionRequest | null {
  const normalized = normalize(query);
  if (!normalized) return null;
  const isMissionPhrase = MISSION_PHRASES.some((phrase) => normalized.includes(phrase));
  if (!isMissionPhrase) return null;

  const keyword = extractKeyword(query) ?? "projet";
  const deadline = parseDeadline(query, now);
  // Recover the ORIGINAL (accented) word for a nicer title.
  const rawKeyword = rawKeywordFrom(query, keyword);
  const title = buildTitle(rawKeyword ?? keyword, deadline?.label ?? null);
  const kind: MissionKind = normalized.includes("rattrap") || normalized.includes("retard") || normalized.includes("catch up") ? "catchup" : "prepare";

  return {
    title,
    objective: query.trim(),
    kind,
    keyword,
    deadline: deadline?.iso ?? null,
    deadlineLabel: deadline?.label ?? null,
  };
}

/** Finds the original (accented) token in the raw query whose
 *  normalized form equals the extracted keyword. */
function rawKeywordFrom(query: string, keyword: string): string | null {
  for (const token of query.split(/\s+/)) {
    if (normalize(token) === keyword) return token;
  }
  return null;
}

function buildTitle(keyword: string, deadlineLabel: string | null): string {
  const capitalized = keyword.charAt(0).toUpperCase() + keyword.slice(1);
  return deadlineLabel ? `Préparer ${capitalized} (${deadlineLabel})` : `Préparer ${capitalized}`;
}

// ============================================================
// RELATED ENTITIES — real rows only
// ============================================================

export interface MissionRelated {
  taskIds: string[];
  projectIds: string[];
  blockerLabels: string[];
  blockerTaskIds: string[];
}

/** Finds real tasks/projects related to the mission keyword. Never
 *  invents an entity: only snapshot rows whose title/name contains
 *  the keyword (or a distinctive token of it). */
export function findRelatedEntities(
  snapshot: WorkspaceSnapshot,
  keyword: string | null
): MissionRelated {
  if (!keyword) return { taskIds: [], projectIds: [], blockerLabels: [], blockerTaskIds: [] };

  const kw = keyword.toLowerCase();
  const token = kw.split(" ")[0];
  const normalizedValue = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const matches = (value: string) =>
    value.length >= 3 &&
    (normalizedValue(value).includes(kw) ||
      (token.length >= 4 && normalizedValue(value).includes(token)));

  const taskIds = snapshot.tasks.filter((t) => matches(t.title)).map((t) => t.id);
  const projectIds = snapshot.projects.filter((p) => matches(p.name)).map((p) => p.id);
  const blockerTasks = snapshot.tasks.filter((t) => taskIds.includes(t.id) && t.status === "blocked");
  const blockerLabels = blockerTasks.map((t) => t.title);
  const blockerTaskIds = blockerTasks.map((t) => t.id);

  return { taskIds, projectIds, blockerLabels, blockerTaskIds };
}

// ============================================================
// DECOMPOSITION — deterministic, verifiable steps
// ============================================================

function step(
  id: string,
  order: number,
  title: string,
  description: string,
  completionRule: MissionStepCompletionRule,
  dependencies: string[],
  targetEntity: MissionStep["targetEntity"],
  action: IntelligenceAction | null,
  now: Date
): MissionStep {
  return {
    id,
    title,
    description,
    status: "planned",
    order,
    dependencies,
    completionRule,
    targetEntity,
    action,
    verification: null,
    blockedReason: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function searchAction(label: string, url: string): IntelligenceAction {
  return {
    id: `act-mission-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "navigate",
    label,
    confirmationRequired: false,
    risk: "none",
    payload: { url },
  };
}

function mutateActionFor(
  type: IntelligenceActionType,
  label: string,
  payload: Record<string, unknown>,
  risk: "low" | "medium" | "high"
): IntelligenceAction {
  return {
    id: `act-mission-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    label,
    confirmationRequired: true,
    risk,
    payload: payload as IntelligenceAction["payload"],
  };
}

/** Builds the ordered, dependency-aware steps for a mission. The
 *  steps reference real entities found in the snapshot. */
export function decomposeMission(
  request: MissionRequest,
  snapshot: WorkspaceSnapshot,
  related: MissionRelated,
  now: Date = new Date()
): MissionStep[] {
  const steps: MissionStep[] = [];

  // 1 — Identify the related tasks (real rows).
  steps.push(
    step(
      "step-1",
      1,
      "Identifier les tâches existantes",
      related.taskIds.length > 0
        ? `${related.taskIds.length} tâche(s) liée(s) identifiée(s) dans le workspace.`
        : "Aucune tâche existante liée à cet objectif — il faudra la créer.",
      { kind: "linked_tasks_exist" },
      [],
      null,
      related.taskIds.length > 0
        ? searchAction("Voir les tâches liées", "/tasks")
        : mutateActionFor("create_task", "Créer la tâche", { title: request.title.replace(/^Préparer\s+/i, "") }, "low"),
      now
    )
  );

  // 2 — Blockers.
  steps.push(
    step(
      "step-2",
      2,
      "Vérifier les blocages",
      related.blockerLabels.length > 0
        ? `${related.blockerLabels.length} tâche(s) liée(s) bloquée(s) : ${related.blockerLabels.join(", ")}.`
        : "Aucune tâche liée n'est bloquée.",
      { kind: "no_linked_blocked" },
      ["step-1"],
      null,
      related.blockerLabels.length > 0
        ? searchAction("Voir les tâches bloquées", "/tasks?filter=blocked")
        : null,
      now
    )
  );

  // 3 — Deadlines.
  steps.push(
    step(
      "step-3",
      3,
      "Vérifier les échéances",
      request.deadlineLabel
        ? `Échéance cible : ${request.deadlineLabel}. Les tâches liées doivent porter une date.`
        : "Aucune échéance cible demandée — vérifier les dates des tâches liées.",
      { kind: "linked_tasks_dated" },
      ["step-1"],
      null,
      null,
      now
    )
  );

  // 4 — Plan ready (≥1 related open task).
  const openRelated = snapshot.tasks.filter((t) => related.taskIds.includes(t.id) && isActiveTask(t));
  steps.push(
    step(
      "step-4",
      4,
      "Construire le plan",
      openRelated.length > 0
        ? `${openRelated.length} tâche(s) ouverte(s) prête(s) à être exécutée(s).`
        : "Aucune tâche ouverte à exécuter — le plan ne peut pas démarrer.",
      { kind: "plan_ready" },
      ["step-2", "step-3"],
      null,
      null,
      now
    )
  );

  // 5 — Execute (complete the related open tasks, one by one).
  const firstOpen = openRelated[0] ?? null;
  const targetEntity = firstOpen
    ? { type: "task" as const, id: firstOpen.id, label: firstOpen.title }
    : related.taskIds.length > 0
      ? { type: "task" as const, id: related.taskIds[0], label: snapshot.tasks.find((t) => t.id === related.taskIds[0])?.title ?? "Tâche liée" }
      : null;
  steps.push(
    step(
      "step-5",
      5,
      "Exécuter le travail lié",
      firstOpen
        ? `Terminer « ${firstOpen.title} »${request.deadlineLabel ? ` avant ${request.deadlineLabel}` : ""}.`
        : related.taskIds.length > 0
          ? "Terminer les tâches liées à l'objectif."
          : "Créer puis exécuter le travail lié.",
      { kind: "target_done" },
      ["step-4"],
      targetEntity,
      firstOpen
        ? mutateActionFor("complete_task", `Terminer « ${firstOpen.title} »`, { taskId: firstOpen.id }, "low")
        : related.taskIds.length > 0
          ? mutateActionFor("complete_task", "Terminer la tâche liée", { taskId: related.taskIds[0] }, "low")
          : null,
      now
    )
  );

  return steps;
}

// ============================================================
// RECOMPUTE — deterministic, against the real snapshot + signals
// ============================================================

function evaluateRule(
  rule: MissionStepCompletionRule,
  step_: MissionStep,
  mission: IntelligenceMission,
  snapshot: WorkspaceSnapshot
): boolean {
  const relatedTasks = snapshot.tasks.filter((t) => mission.context.relatedTaskIds.includes(t.id));
  switch (rule.kind) {
    case "linked_tasks_exist":
      return mission.context.relatedTaskIds.length > 0;
    case "no_linked_blocked":
      return !relatedTasks.some((t) => t.status === "blocked");
    case "linked_tasks_dated": {
      const open = relatedTasks.filter(isActiveTask);
      return open.every((t) => Boolean(t.due_at));
    }
    case "plan_ready":
      return relatedTasks.some(isActiveTask);
    case "target_done": {
      const target = step_.targetEntity;
      if (!target?.id) return false;
      if (target.type === "task") {
        const task = snapshot.tasks.find((t) => t.id === target.id);
        return Boolean(task && task.status === "done");
      }
      if (target.type === "project") {
        const project = snapshot.projects.find((p) => p.id === target.id);
        return Boolean(project && (project.status === "completed" || project.status === "archived"));
      }
      return false;
    }
    case "action_verified":
      return Boolean(step_.verification?.verified);
    default:
      return false;
  }
}

/** Signals touching the mission's entities (Phase 3 link). */
function missionSignals(mission: IntelligenceMission, signals: StoredSignalRow[] | undefined): MissionContext["signals"] {
  if (!signals) return mission.context.signals ?? [];
  const entityIds = new Set([
    ...mission.context.relatedTaskIds,
    ...mission.context.relatedProjectIds,
  ]);
  return signals
    .filter(
      (signal) =>
        signal.status !== "resolved" &&
        signal.entityId &&
        entityIds.has(signal.entityId)
    )
    .map((signal) => ({ type: signal.type, title: signal.title, severity: signal.severity }));
}

/** Recomputes every step status, progress, current step, mission
 *  status and next best action from the REAL snapshot (+ signals).
 *  Pure: returns a new mission. */
export function recomputeMission(
  mission: IntelligenceMission,
  snapshot: WorkspaceSnapshot,
  signals?: StoredSignalRow[],
  now: Date = new Date()
): IntelligenceMission {
  const steps = mission.steps.map((s) => ({ ...s }));
  const signalList = missionSignals(mission, signals);

  // Related tasks still blocked in the REAL snapshot (recomputed, not
  // the frozen creation-time list).
  const activeBlockers = mission.context.blockerTaskIds.filter((id) =>
    snapshot.tasks.some((t) => t.id === id && t.status === "blocked")
  );

  // First pass: statuses from dependencies + real state.
  for (const step_ of steps) {
    if (step_.status === "cancelled") continue;
    if (step_.status === "completed") {
      // A completed step stays completed only if its rule still holds
      // (the entity could have been re-opened or deleted).
      if (!evaluateRule(step_.completionRule, step_, mission, snapshot)) {
        step_.status = "blocked";
        step_.blockedReason = "La condition vérifiée n'est plus satisfaite dans le workspace.";
        step_.updatedAt = now.toISOString();
      }
      continue;
    }
    if (step_.status === "failed") continue;

    // Dependencies.
    const deps = steps.filter((d) => step_.dependencies.includes(d.id));
    const depBlocked = deps.find((d) => d.status === "blocked" || d.status === "failed");
    if (depBlocked) {
      step_.status = "blocked";
      step_.blockedReason = `Dépend sur « ${depBlocked.title} » (${depBlocked.status}).`;
      step_.updatedAt = now.toISOString();
      continue;
    }
    const depPending = deps.find((d) => d.status !== "completed");
    if (depPending) {
      step_.status = "waiting";
      step_.blockedReason = null;
      step_.updatedAt = now.toISOString();
      continue;
    }

    // Rule already satisfied → completed (real data).
    if (evaluateRule(step_.completionRule, step_, mission, snapshot)) {
      step_.status = "completed";
      step_.blockedReason = null;
      step_.updatedAt = now.toISOString();
      continue;
    }

    // A related task actually blocked → the step depending on "no
    // blocked work" is blocked (real data, honest reason).
    if (step_.completionRule.kind === "no_linked_blocked" && activeBlockers.length > 0) {
      step_.status = "blocked";
      step_.blockedReason = `Tâche liée bloquée : ${snapshot.tasks.find((t) => t.id === activeBlockers[0])?.title ?? activeBlockers[0]}.`;
      step_.updatedAt = now.toISOString();
      continue;
    }

    // Signal blocking this step's entity (Phase 3 link).
    const targetId = step_.targetEntity?.id;
    const blockingSignal = targetId
      ? signalList.find((signal) => {
          const entityTouched = mission.context.relatedTaskIds.includes(targetId) || mission.context.relatedProjectIds.includes(targetId);
          return entityTouched && (signal.severity === "critical" || signal.severity === "warning");
        })
      : undefined;

    if (step_.targetEntity?.id && !snapshotHasEntity(snapshot, step_.targetEntity)) {
      step_.status = "blocked";
      step_.blockedReason = "L'entité cible n'existe plus dans le workspace.";
      step_.updatedAt = now.toISOString();
      continue;
    }

    if (blockingSignal) {
      step_.status = "blocked";
      step_.blockedReason = `Signal actif : ${blockingSignal.title}`;
      step_.updatedAt = now.toISOString();
      continue;
    }

    if (step_.targetEntity?.type === "task" && snapshot.tasks.find((t) => t.id === step_.targetEntity?.id)?.status === "blocked") {
      step_.status = "blocked";
      step_.blockedReason = "La tâche cible est bloquée.";
      step_.updatedAt = now.toISOString();
      continue;
    }

    // Otherwise ready (action awaiting user confirmation). A step that
    // was blocked/waiting becomes ready again as soon as nothing blocks
    // it in the real snapshot — the status always reflects reality.
    if (
      step_.status === "planned" ||
      step_.status === "waiting" ||
      step_.status === "ready" ||
      step_.status === "blocked" ||
      step_.status === "in_progress"
    ) {
      step_.status = "ready";
      step_.blockedReason = null;
      step_.updatedAt = now.toISOString();
    }
  }

  // Progress + mission status.
  const countable = steps.filter((s) => s.status !== "cancelled");
  const completed = steps.filter((s) => s.status === "completed");
  const progress =
    countable.length > 0 ? Math.round((completed.length / countable.length) * 100) : 0;
  const hasBlocked = steps.some((s) => s.status === "blocked");
  const hasFailed = steps.some((s) => s.status === "failed");
  const allDone = countable.length > 0 && completed.length === countable.length;

  const status: IntelligenceMission["status"] = allDone
    ? "completed"
    : hasFailed
      ? "failed"
      : hasBlocked
        ? "blocked"
        : "active";

  // Next best action — deterministic.
  const nextBestAction = computeNextBestAction(steps, mission);

  const currentStep =
    steps.find((s) => s.status === "ready") ??
    steps.find((s) => s.status === "in_progress") ??
    null;

  const updated: IntelligenceMission = {
    ...mission,
    steps,
    progress,
    status,
    currentStepId: currentStep?.id ?? null,
    nextBestAction,
    context: { ...mission.context, signals: signalList },
    lastEvaluatedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return updated;
}

function snapshotHasEntity(
  snapshot: WorkspaceSnapshot,
  target: { type: "task" | "project" | "goal"; id: string | null }
): boolean {
  if (!target.id) return true; // no concrete target → nothing to check
  if (target.type === "task") return snapshot.tasks.some((t) => t.id === target.id);
  if (target.type === "project") return snapshot.projects.some((p) => p.id === target.id);
  return snapshot.goals.some((g) => g.id === target.id);
}

export function computeNextBestAction(
  steps: MissionStep[],
  mission: IntelligenceMission
): MissionNextBestAction | null {
  const ready = steps
    .filter((s) => s.status === "ready" && s.action)
    .sort((a, b) => a.order - b.order);
  if (ready.length > 0) {
    const step_ = ready[0];
    const action = step_.action!;
    if (action.type === "navigate" || action.type === "open_task" || action.type === "open_project") {
      return {
        stepId: step_.id,
        label: action.label,
        reason: `Prochaine étape : ${step_.title}.`,
        kind: "navigate",
        action,
        href: action.payload?.url ?? "/tasks",
      };
    }
    return {
      stepId: step_.id,
      label: action.label,
      reason: `Prochaine étape : ${step_.title}.`,
      kind: "mutate",
      action,
    };
  }

  const blocked = steps.find((s) => s.status === "blocked");
  if (blocked) {
    // A related blocked task → propose unblocking it (real task id).
    if (mission.context.blockerTaskIds.length > 0) {
      const taskId = mission.context.blockerTaskIds[0];
      return {
        stepId: blocked.id,
        label: `Débloquer « ${mission.context.blockerLabels[0] ?? "la tâche"} »`,
        reason: blocked.blockedReason ?? `Étape bloquée : ${blocked.title}.`,
        kind: "mutate",
        action: {
          id: `act-mission-unblock-${Date.now()}`,
          type: "update_task",
          label: "Débloquer la tâche",
          confirmationRequired: true,
          risk: "medium",
          payload: { taskId, status: "in_progress" },
        },
      };
    }
    if (blocked.targetEntity?.id) {
      return {
        stepId: blocked.id,
        label: `Ouvrir « ${blocked.targetEntity.label ?? "la tâche"} »`,
        reason: blocked.blockedReason ?? `Étape bloquée : ${blocked.title}.`,
        kind: "navigate",
        href: "/tasks",
      };
    }
    if (blocked.action) {
      return {
        stepId: blocked.id,
        label: blocked.action.label,
        reason: blocked.blockedReason ?? `Étape bloquée : ${blocked.title}.`,
        kind: blocked.action.type === "navigate" ? "navigate" : "mutate",
        action: blocked.action,
        href: blocked.action.payload?.url,
      };
    }
    return {
      stepId: blocked.id,
      label: "Voir les détails",
      reason: blocked.blockedReason ?? `Étape bloquée : ${blocked.title}.`,
      kind: "navigate",
      href: "/app/intelligence",
    };
  }

  return null;
}

// ============================================================
// MUTATION INTEGRATION — verified read-back only
// ============================================================

/** Applies a VERIFIED mutation result to a step. Only called after the
 *  server read the row back. A failed/rejected mutation marks the step
 *  failed — never completed. */
export function applyVerifiedActionToStep(
  mission: IntelligenceMission,
  stepId: string,
  result: { verified: boolean; matched: string[]; summary: string },
  now: Date = new Date()
): IntelligenceMission {
  const steps = mission.steps.map((s) =>
    s.id === stepId
      ? {
          ...s,
          verification: {
            verified: result.verified,
            summary: result.summary,
            matched: result.matched,
            mismatched: [],
          },
          status: result.verified ? ("completed" as MissionStepStatus) : ("failed" as MissionStepStatus),
          blockedReason: result.verified ? null : "La mutation n'a pas pu être vérifiée.",
          updatedAt: now.toISOString(),
        }
      : s
  );
  return { ...mission, steps, updatedAt: now.toISOString() };
}

// ============================================================
// CREATION + PERSISTENCE
// ============================================================

export function createMissionObject(
  request: MissionRequest,
  workspaceId: string,
  userId: string,
  snapshot: WorkspaceSnapshot,
  related: MissionRelated,
  now: Date = new Date()
): IntelligenceMission {
  const steps = decomposeMission(request, snapshot, related, now);
  const id = `mission-${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const mission: IntelligenceMission = {
    id,
    userId,
    workspaceId,
    title: request.title,
    objective: request.objective,
    kind: request.kind,
    status: "active",
    progress: 0,
    currentStepId: null,
    steps,
    context: {
      relatedTaskIds: related.taskIds,
      relatedProjectIds: related.projectIds,
      keyword: request.keyword,
      deadline: request.deadline,
      deadlineLabel: request.deadlineLabel,
      blockerLabels: related.blockerLabels,
      blockerTaskIds: related.blockerTaskIds,
      signals: [],
    },
    nextBestAction: null,
    lastEvaluatedAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return recomputeMission(mission, snapshot, undefined, now);
}

export async function readMission(
  db: MissionDbClient,
  workspaceId: string,
  userId: string,
  missionId: string
): Promise<IntelligenceMission | null> {
  const { data } = await db
    .from("intelligence_missions")
    .select("*")
    .eq("id", missionId)
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return normalizeMissionRow(data as Record<string, unknown>);
}

export async function readActiveMissions(
  db: MissionDbClient,
  workspaceId: string,
  userId: string
): Promise<IntelligenceMission[]> {
  const { data, error } = await db
    .from("intelligence_missions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .in("status", ["active", "blocked"])
    .order("updated_at", { ascending: false })
    .limit(MISSION_MAX_ACTIVE);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((row) => normalizeMissionRow(row));
}

export async function saveMission(
  db: MissionDbClient,
  mission: IntelligenceMission
): Promise<void> {
  const payload = {
    user_id: mission.userId,
    workspace_id: mission.workspaceId,
    title: mission.title,
    objective: mission.objective,
    kind: mission.kind,
    status: mission.status,
    progress: mission.progress,
    current_step_id: mission.currentStepId,
    steps: mission.steps,
    context: mission.context,
    next_best_action: mission.nextBestAction,
    last_evaluated_at: mission.lastEvaluatedAt,
    updated_at: mission.updatedAt,
  };
  const { data: existing } = await db
    .from("intelligence_missions")
    .update(payload)
    .eq("id", mission.id)
    .eq("workspace_id", mission.workspaceId)
    .eq("user_id", mission.userId)
    .select("id")
    .maybeSingle();
  if (!existing) {
    await db.from("intelligence_missions").insert({
      id: mission.id,
      ...payload,
      created_at: mission.createdAt,
    });
  }
}

function normalizeMissionRow(row: Record<string, unknown>): IntelligenceMission {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    workspaceId: String(row.workspace_id ?? ""),
    title: String(row.title ?? ""),
    objective: String(row.objective ?? ""),
    kind: (row.kind ?? "general") as MissionKind,
    status: (row.status ?? "active") as IntelligenceMission["status"],
    progress: Number(row.progress ?? 0),
    currentStepId: (row.current_step_id ?? null) as string | null,
    steps: Array.isArray(row.steps) ? (row.steps as MissionStep[]) : [],
    context: {
      relatedTaskIds: Array.isArray((row.context as Record<string, unknown>)?.relatedTaskIds)
        ? ((row.context as Record<string, unknown>).relatedTaskIds as string[])
        : [],
      relatedProjectIds: Array.isArray((row.context as Record<string, unknown>)?.relatedProjectIds)
        ? ((row.context as Record<string, unknown>).relatedProjectIds as string[])
        : [],
      keyword: ((row.context as Record<string, unknown>)?.keyword ?? null) as string | null,
      deadline: ((row.context as Record<string, unknown>)?.deadline ?? null) as string | null,
      deadlineLabel: ((row.context as Record<string, unknown>)?.deadlineLabel ?? null) as string | null,
      blockerLabels: Array.isArray((row.context as Record<string, unknown>)?.blockerLabels)
        ? ((row.context as Record<string, unknown>).blockerLabels as string[])
        : [],
      blockerTaskIds: Array.isArray((row.context as Record<string, unknown>)?.blockerTaskIds)
        ? ((row.context as Record<string, unknown>).blockerTaskIds as string[])
        : [],
      signals: Array.isArray((row.context as Record<string, unknown>)?.signals)
        ? ((row.context as Record<string, unknown>).signals as MissionContext["signals"])
        : [],
    },
    nextBestAction: (row.next_best_action ?? null) as MissionNextBestAction | null,
    lastEvaluatedAt: String(row.last_evaluated_at ?? new Date().toISOString()),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

// ============================================================
// BOUNDED LOOP
// ============================================================

/** Re-evaluates a mission against the real snapshot until stable or
 *  until MISSION_LOOP_MAX_ITERATIONS. The loop is bounded — a mission
 *  can never spin forever. */
export function runMissionLoop(
  mission: IntelligenceMission,
  snapshot: WorkspaceSnapshot,
  signals?: StoredSignalRow[],
  maxIterations: number = MISSION_LOOP_MAX_ITERATIONS
): IntelligenceMission {
  let current = mission;
  for (let i = 0; i < maxIterations; i += 1) {
    const next = recomputeMission(current, snapshot, signals);
    const stable =
      JSON.stringify(next.steps.map((s) => [s.id, s.status])) ===
      JSON.stringify(current.steps.map((s) => [s.id, s.status]));
    current = next;
    if (stable) break;
  }
  return current;
}

/** Recomputes every active mission of a workspace (used after a
 *  mutation or a signal refresh). Bounded per mission. */
export async function recomputeWorkspaceMissions(
  db: MissionDbClient,
  workspaceId: string,
  userId: string,
  snapshot: WorkspaceSnapshot,
  signals?: StoredSignalRow[]
): Promise<IntelligenceMission[]> {
  const missions = await readActiveMissions(db, workspaceId, userId);
  const updated: IntelligenceMission[] = [];
  for (const mission of missions) {
    const next = runMissionLoop(mission, snapshot, signals);
    await saveMission(db, next);
    updated.push(next);
  }
  return updated;
}

/** Marks a mission cancelled. */
export async function cancelMission(
  db: MissionDbClient,
  workspaceId: string,
  userId: string,
  missionId: string,
  now: Date = new Date()
): Promise<boolean> {
  const { data } = await db
    .from("intelligence_missions")
    .update({ status: "cancelled", updated_at: now.toISOString() })
    .eq("id", missionId)
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

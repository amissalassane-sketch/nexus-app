// ============================================================
// NEXUS INTELLIGENCE — STRUCTURED INTENT ENGINE
// Language-aware intent classification for French and English.
// Pure and deterministic: never calls an external service and
// never invents entities. The resolved target is always matched
// against real workspace rows when a snapshot is available.
// ============================================================

import type { WorkspaceSnapshot } from "./engine";
import type { IntelligenceActionType, SessionHistoryItem } from "./types";

export type IntelligenceIntentId =
  | "ANALYZE"
  | "PRIORITIZE"
  | "PLAN"
  | "SUMMARIZE"
  | "DETECT"
  | "SEARCH"
  | "CREATE"
  | "UPDATE"
  | "COMPLETE"
  | "MOVE"
  | "DELETE"
  | "EXPLAIN"
  | "GENERAL_ASSISTANCE";

export type IntelligenceTargetType = "task" | "project" | "goal" | "workspace" | null;

export interface IntelligenceTarget {
  type: IntelligenceTargetType;
  /** A free-text name/title extracted from the query, when present. */
  query?: string;
  /** A concrete entity id resolved from the workspace snapshot. */
  id?: string;
  /** A concrete entity label resolved from the snapshot. */
  label?: string;
}

export interface IntelligenceIntentResult {
  intent: IntelligenceIntentId;
  target?: IntelligenceTarget;
  actionType?: IntelligenceActionType;
  risk: "low" | "medium" | "high" | "none";
  confidence: number;
}

/** Accent-insensitive normalization for robust FR/EN intent matching. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(normalized: string, ...needles: string[]): boolean {
  return needles.some((needle) => normalized.includes(needle));
}

const DAY_NAME_TO_WEEKDAY: Record<string, number> = {
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

function extractNamedEntity(
  snapshot: WorkspaceSnapshot,
  normalized: string,
  type: "project" | "task"
): { id: string; label: string } | null {
  const rows = type === "project" ? snapshot.projects : snapshot.tasks;
  const labelField = type === "project" ? "name" : "title";

  for (const row of rows) {
    const label = (row as { [key: string]: unknown })[labelField];
    if (typeof label === "string" && label.length >= 4 && normalized.includes(normalize(label))) {
      return { id: row.id, label };
    }
  }

  // Single distinctive token match, 4+ chars.
  const tokens = normalized.split(" ").filter((token) => token.length >= 4);
  const matches = rows.filter((row) => {
    const label = (row as { [key: string]: unknown })[labelField];
    if (typeof label !== "string" || label.length < 4) return false;
    const name = normalize(label);
    return tokens.some((token) => name.includes(token));
  });
  return matches.length === 1
    ? { id: matches[0].id, label: (matches[0] as { [key: string]: unknown })[labelField] as string }
    : null;
}

function lastHistoryAction(history?: SessionHistoryItem[]): {
  actionType?: IntelligenceActionType;
  target?: IntelligenceTarget;
} {
  const last = history?.[0];
  if (!last) return {};
  return {
    actionType: last.actionType,
    target: last.target ? { type: last.target.type ?? null, id: last.target.id, label: last.target.label } : undefined,
  };
}

/**
 * Resolves a referential "cette tâche / this task" reference to the
 * entity previously mentioned in the session. Only used when the
 * snapshot could not resolve an exact name.
 */
function referentialTarget(normalized: string, last: IntelligenceTarget | undefined): IntelligenceTarget | undefined {
  if (!last) return undefined;
  const referential = hasAny(
    normalized,
    "cette tache",
    "ce projet",
    "cette action",
    "this task",
    "that task",
    "this project",
    "that project",
    "le,",
    "le"
  );
  return referential ? { type: last.type ?? "task", id: last.id, label: last.label } : undefined;
}

export function classifyIntent(
  query: string,
  options?: {
    snapshot?: WorkspaceSnapshot;
    sessionHistory?: SessionHistoryItem[];
  }
): IntelligenceIntentResult {
  const normalized = normalize(query);
  const snapshot = options?.snapshot;
  const history = options?.sessionHistory ?? [];

  if (!normalized) {
    return { intent: "GENERAL_ASSISTANCE", risk: "none", confidence: 0.3 };
  }

  const last = lastHistoryAction(history);

  // Conversation continuations — resolve "le"/"cette tâche" to the last
  // referenced entity / proposed action before keyword scanning.
  const isExecuteLast = hasAny(normalized, "fais le", "fais la", "do it", "go ahead", "va y", "vas y", "go a head", "execute");
  const isNextStep = hasAny(normalized, "et apres", "ensuite", "et ensuite", "what next", "whats next", "then what");
  const isWhich = hasAny(normalized, "lequel", "laquelle", "which one", "le premier", "la premiere", "the first one", "plus urgent", "most urgent");

  if (isWhich) {
    return {
      intent: "PRIORITIZE",
      target: last.target ?? { type: "workspace" },
      risk: "none",
      confidence: 0.9,
    };
  }

  if (isNextStep) {
    return {
      intent: "PLAN",
      target: last.target ?? { type: "workspace" },
      risk: "none",
      confidence: 0.85,
    };
  }

  if (isExecuteLast && last.actionType) {
    const intentByAction: Partial<Record<IntelligenceActionType, IntelligenceIntentId>> = {
      create_task: "CREATE",
      create_project: "CREATE",
      create_goal: "CREATE",
      update_task: "UPDATE",
      update_project: "UPDATE",
      complete_task: "COMPLETE",
      move_task: "MOVE",
      delete_task: "DELETE",
      delete_project: "DELETE",
    };
    return {
      intent: intentByAction[last.actionType] ?? "GENERAL_ASSISTANCE",
      target: { type: last.target?.type ?? "task", id: last.target?.id, label: last.target?.label },
      actionType: last.actionType,
      risk: riskForAction(last.actionType),
      confidence: 0.9,
    };
  }

  // DELETE
  if (hasAny(normalized, "supprime", "delete", "efface", "remove", "annule cette", "annule")) {
    const taskNamed = snapshot ? extractNamedEntity(snapshot, normalized, "task") : undefined;
    const projectNamed = snapshot ? extractNamedEntity(snapshot, normalized, "project") : undefined;
    const referential = referentialTarget(normalized, last.target);
    const target: IntelligenceTarget = taskNamed
      ? { type: "task", ...taskNamed }
      : projectNamed
        ? { type: "project", ...projectNamed }
        : referential ?? { type: "project", query: strippedTarget(normalized) };
    const actionType = target.type === "project" ? "delete_project" : "delete_task";
    return {
      intent: "DELETE",
      target,
      actionType,
      risk: "high",
      confidence: 0.85,
    };
  }

  // COMPLETE
  if (hasAny(normalized, "marque comme termine", "marque comme faite", "marque cette tache comme terminee", "marque cette tache comme faite", "complete", "termine la", "terminer", "finis la", "cloture", "done", "marque tache")) {
    const named = snapshot ? extractNamedEntity(snapshot, normalized, "task") : undefined;
    const target = named ?? referentialTarget(normalized, last.target);
    return {
      intent: "COMPLETE",
      target: { type: "task", id: target?.id, label: target?.label, query: strippedTarget(normalized) },
      actionType: "complete_task",
      risk: "low",
      confidence: 0.9,
    };
  }

  // PLAN — checked early so planning phrasing ("en priorité") never
  // leaks into UPDATE/prioritize matches.
  if (
    hasAny(
      normalized,
      "organise ma journee",
      "organiser ma journee",
      "organise ma semaine",
      "organiser ma semaine",
      "plan my day",
      "plan my week",
      "programme du jour",
      "schedule",
      "planning",
      "aide moi à organiser",
      "aide moi a organiser",
      "fais moi un plan",
      "fais-moi un plan",
      "un plan pour",
      "rattrap",
      "rattrape",
      "catch up",
      "prepares moi",
      "prépare-moi",
      "prepare me",
      "prepare-moi",
      "un planning"
    ) || /\bplan\b/.test(normalized)
  ) {
    return { intent: "PLAN", target: { type: "workspace" }, risk: "none", confidence: 0.94 };
  }

  // MOVE — explicit move verbs, or a day-name follow-up on the last
  // referenced task ("Et pour vendredi ?" / "And for Friday?")
  const hasDayFollowUp = (last.target?.type === "task" || last.target?.id) && hasAny(
    normalized,
    "pour lundi", "pour mardi", "pour mercredi", "pour jeudi", "pour vendredi", "pour samedi", "pour dimanche",
    "for monday", "for tuesday", "for wednesday", "for thursday", "for friday", "for saturday", "for sunday",
    "et pour", "and for"
  );
  if (hasAny(normalized, "decale", "déplace", "reporter", "move", "shift", "reschedule", "remets a", "pousse a") || hasDayFollowUp) {
    const named = snapshot ? extractNamedEntity(snapshot, normalized, "task") : undefined;
    const target = named ?? referentialTarget(normalized, last.target) ?? (last.target?.type === "task" || last.target?.type === "project" ? last.target : undefined);
    return {
      intent: "MOVE",
      target: { type: "task", id: target?.id, label: target?.label, query: strippedTarget(normalized) },
      actionType: "move_task",
      risk: "low",
      confidence: hasDayFollowUp ? 0.9 : 0.85,
    };
  }

  // UPDATE — including priority phrasing ("Mets cette tâche en urgente",
  // "Passe-la en haute priorité", "Set this task as urgent")
  if (
    hasAny(
      normalized,
      "change la priorite", "update priority", "mets a jour", "modifie la", "edite la", "change le statut", "update status", "update task",
      "en urgente", "en priorite", "en haute", "en basse", "en moyenne",
      "mets la en", "passe la en", "passes la en", "met la en", "mets en", "passe en",
      "as urgent", "as high", "as low", "as medium", "set as urgent", "make it urgent", "set priority",
      "priorite urgente", "priorite haute", "priorite basse", "priority urgent", "priority high"
    )
  ) {
    const named = snapshot ? extractNamedEntity(snapshot, normalized, "task") : undefined;
    const target = named ?? referentialTarget(normalized, last.target);
    return {
      intent: "UPDATE",
      target: { type: "task", id: target?.id, label: target?.label, query: strippedTarget(normalized) },
      actionType: "update_task",
      risk: "medium",
      confidence: 0.9,
    };
  }

  // CREATE
  if (
    hasAny(
      normalized,
      "cree un projet",
      "crée un projet",
      "cree une projet",
      "create a project",
      "ajoute un projet",
      "add a project",
      "nouveau projet",
      "new project"
    )
  ) {
    return {
      intent: "CREATE",
      target: { type: "project", query: strippedTarget(normalized) },
      actionType: "create_project",
      risk: "low",
      confidence: 0.95,
    };
  }

  if (
    hasAny(
      normalized,
      "cree une tache",
      "crée une tâche",
      "create a task",
      "ajoute une tache",
      "add a task",
      "nouvelle tache",
      "new task",
      "je dois preparer",
      "il faut preparer",
      "besoin de preparer"
    )
  ) {
    return {
      intent: "CREATE",
      target: { type: "task", query: strippedTarget(normalized) },
      actionType: "create_task",
      risk: "low",
      confidence: 0.95,
    };
  }

  if (hasAny(normalized, "cree un objectif", "créer un objectif", "create a goal", "add a goal")) {
    return {
      intent: "CREATE",
      target: { type: "goal", query: strippedTarget(normalized) },
      actionType: "create_goal",
      risk: "low",
      confidence: 0.9,
    };
  }

  // EXPLAIN
  if (hasAny(normalized, "pourquoi", "why is", "why does", "explique", "explain", "comment ce projet")) {
    const target = snapshot ? extractNamedEntity(snapshot, normalized, "project") : undefined;
    return {
      intent: "EXPLAIN",
      target: { type: "project", id: target?.id, label: target?.label, query: strippedTarget(normalized) },
      risk: "none",
      confidence: 0.85,
    };
  }

  // SEARCH
  if (hasAny(normalized, "cherche", "trouve", "où est", "search", "find", "where is")) {
    const task = snapshot ? extractNamedEntity(snapshot, normalized, "task") : undefined;
    const project = snapshot ? extractNamedEntity(snapshot, normalized, "project") : undefined;
    return {
      intent: "SEARCH",
      target: {
        type: task ? "task" : project ? "project" : "workspace",
        id: task?.id ?? project?.id,
        label: task?.label ?? project?.label,
        query: strippedTarget(normalized),
      },
      risk: "none",
      confidence: 0.8,
    };
  }

  // SUMMARIZE
  if (
    hasAny(
      normalized,
      "resume",
      "resume l activite",
      "summary",
      "summarize",
      "bilan",
      "synthese",
      "what changed",
      "recap cette semaine",
      "resume ma semaine"
    )
  ) {
    return { intent: "SUMMARIZE", target: { type: "workspace" }, risk: "none", confidence: 0.9 };
  }

  // PRIORITIZE
  if (
    hasAny(
      normalized,
      "priorit",
      "taches prioritaires",
      "priority tasks",
      "faire en premier",
      "do first",
      "should i",
      "what should",
      "dois je faire",
      "dois faire",
      "prochaines taches",
      "top tasks",
      "plus urgent"
    )
  ) {
    return { intent: "PRIORITIZE", target: { type: "workspace" }, risk: "none", confidence: 0.92 };
  }

  // DETECT
  if (
    hasAny(
      normalized,
      "bloqu",
      "block",
      "retard",
      "overdue",
      "stuck",
      "stall",
      "empeche",
      "impediment",
      "necessitent mon attention",
      "need attention",
      "at risk",
      "risque",
      "probleme"
    )
  ) {
    return { intent: "DETECT", target: { type: "workspace" }, risk: "none", confidence: 0.88 };
  }

  // ANALYZE
  if (hasAny(normalized, "analyse", "analyze", "état du", "health", "how is", "comment va", "santé", "où en suis", "progress")) {
    return { intent: "ANALYZE", target: { type: "workspace" }, risk: "none", confidence: 0.85 };
  }

  return { intent: "GENERAL_ASSISTANCE", target: { type: "workspace" }, risk: "none", confidence: 0.3 };
}

/** Removes common intent phrasing so the remaining text can be used as a name/title. */
function strippedTarget(normalized: string): string | undefined {
  const cleaned = normalized
    .replace(/^(crée|cree|créer|creer|ajoute|ajouter|create|add)\s+(un|une|a|an|nouveau|nouvelle|new|the)\s+(projet|proj|projet|tâche|tache|task|objectif|goal)\s*/i, "")
    .replace(/^(je\s+dois|il\s+faut|j'ai\s+besoin\s+de|i\s+need\s+to)\s*/i, "")
    .replace(/\b(préparer|preparer|prepare|pour|for|de|to|le|la|the)\b/g, " ")
    .replace(/[.!?]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function riskForAction(type: IntelligenceActionType): "low" | "medium" | "high" | "none" {
  switch (type) {
    case "delete_task":
    case "delete_project":
    case "delete_goal":
      return "high";
    case "update_project":
    case "update_task":
    case "update_goal":
      return "medium";
    case "create_task":
    case "create_project":
    case "create_goal":
    case "complete_task":
    case "move_task":
    case "open_project":
    case "open_task":
    case "view_blocked_tasks":
    case "view_overdue_tasks":
    case "view_risky_projects":
    case "navigate":
      return "low";
    default:
      return "low";
  }
}

/** Maps the legacy deterministic intent label to the structured intent id. */
export function mapLegacyIntentToId(
  legacy: string,
  actionType?: IntelligenceActionType
): IntelligenceIntentId {
  switch (legacy) {
    case "analysis":
      return "ANALYZE";
    case "prioritization":
      return "PRIORITIZE";
    case "planning":
      return "PLAN";
    case "synthesis":
      return "SUMMARIZE";
    case "detection":
      return "DETECT";
    case "action":
      return actionType === "create_project" || actionType === "create_task" || actionType === "create_goal"
        ? "CREATE"
        : "GENERAL_ASSISTANCE";
    default:
      return "GENERAL_ASSISTANCE";
  }
}

export type ExtractedPriority = "low" | "medium" | "high" | "urgent";

/** Extracts an explicit priority from natural language ("urgente",
 *  "haute priorité", "as urgent", "low"...). Returns null when the
 *  query does not state a priority. */
export function extractPriorityFromQuery(query: string): ExtractedPriority | null {
  const normalized = normalize(query).replace(/[.!?,;:]+$/g, "");
  const words = new Set(normalized.split(" ").filter(Boolean));

  const hasUrgent =
    words.has("urgente") ||
    words.has("urgent") ||
    normalized.includes("priorite urgente") ||
    normalized.includes("priority urgent");
  if (hasUrgent) return "urgent";

  const hasHigh =
    normalized.includes("haute") ||
    normalized.includes("haute priorite") ||
    words.has("high") ||
    normalized.includes("high priority") ||
    normalized.includes("priorite haute") ||
    normalized.includes("priority high");
  if (hasHigh) return "high";

  const hasMedium =
    normalized.includes("moyenne") ||
    normalized.includes("priorite moyenne") ||
    words.has("medium") ||
    normalized.includes("medium priority") ||
    normalized.includes("priority medium");
  if (hasMedium) return "medium";

  const hasLow =
    normalized.includes("basse") ||
    normalized.includes("priorite basse") ||
    words.has("low") ||
    normalized.includes("low priority") ||
    normalized.includes("priority low");
  if (hasLow) return "low";

  return null;
}

/** Extracts a due day/datetime from natural language ("vendredi",
 *  "vendredi prochain", "friday", "demain", "tomorrow") as ISO date. */
export function extractDueDateFromQuery(query: string, now: Date = new Date()): string | null {
  const normalized = normalize(query);
  for (const day of ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]) {
    if (normalized.includes(day)) {
      const iso = dueDayToIsoDayName(day, now);
      if (iso) return iso;
    }
  }
  if (normalized.includes("demain") || normalized.includes("tomorrow")) {
    return dueDayToIsoDayName("tomorrow", now);
  }
  if (normalized.includes("aujourd") || normalized.includes("today")) {
    return dueDayToIsoDayName("today", now);
  }
  return null;
}

export function dueDayToIsoDayName(dueDay: string, now: Date = new Date()): string | null {
  const today = new Date(now);
  if (dueDay === "today") return today.toISOString().slice(0, 10);
  if (dueDay === "tomorrow") {
    const next = new Date(today);
    next.setDate(next.getDate() + 1);
    return next.toISOString().slice(0, 10);
  }
  const weekday = DAY_NAME_TO_WEEKDAY[dueDay];
  if (weekday === undefined) return null;
  const diff = (weekday - today.getDay() + 7) % 7 || 7;
  const target = new Date(today);
  target.setDate(target.getDate() + diff);
  return target.toISOString().slice(0, 10);
}

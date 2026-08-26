// ============================================================
// NEXUS INTELLIGENCE — DATA & ACTION TYPES
// Structured contract shared across UI, API, Context Builder,
// AI Provider, and Deterministic Engine.
// ============================================================

export type IntelligenceIntent =
  | "analysis"
  | "prioritization"
  | "planning"
  | "synthesis"
  | "detection"
  | "action"
  | "general";

/** Structured Operation intent (Phase 3). Kept separate from the legacy
 *  `intent` label so existing UI and engine contracts stay compatible. */
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

export type IntelligenceRisk = "low" | "medium" | "high" | "none";

export interface IntelligenceTarget {
  type: "task" | "project" | "goal" | "workspace" | null;
  query?: string;
  id?: string;
  label?: string;
}

export type IntelligenceActionType =
  | "create_task"
  | "create_project"
  | "create_goal"
  | "update_task"
  | "update_project"
  | "update_goal"
  | "complete_task"
  | "move_task"
  | "delete_task"
  | "delete_project"
  | "delete_goal"
  | "open_project"
  | "open_task"
  | "view_blocked_tasks"
  | "view_overdue_tasks"
  | "view_risky_projects"
  | "navigate";

export interface ActionVerification {
  verified: boolean;
  /** Free-text summary of the resource read back after the mutation. */
  summary: string;
  /** Expected vs actual fields that matched. */
  matched: string[];
  /** Expected vs actual fields that did not match, if any. */
  mismatched: string[];
}

export interface IntelligenceAction {
  id: string;
  type: IntelligenceActionType;
  label: string;
  description?: string;
  confirmationRequired: boolean;
  /** Risk class used by the UI and the server approval gate. */
  risk?: IntelligenceRisk;
  payload?: {
    title?: string;
    name?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    status?: string;
    dueDate?: string | null;
    projectId?: string | null;
    taskId?: string | null;
    goalId?: string | null;
    description?: string;
    url?: string;
    /** Entity query used when no concrete id is available yet. */
    query?: string;
    /** High-risk destructive actions require an explicit confirmation flag. */
    confirmDeletion?: boolean;
  };
}

export interface QuickAction {
  label: string;
  href?: string;
  query?: string;
  icon?: string;
}

export interface IntelligenceItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: {
    label: string;
    tone: "danger" | "warning" | "success" | "neutral" | "lavender";
  };
  href?: string;
  reasons?: string[];
}

export interface StructuredIntelligenceResponse {
  query: string;
  intent: IntelligenceIntent;
  /** Structured operation intent (Phase 3). */
  intentId?: IntelligenceIntentId;
  /** Entity this response reasoning targeted, when applicable. */
  target?: IntelligenceTarget;
  headline: string;
  narrative: string;
  provider: "openai" | "anthropic" | "nexus-engine";
  evidence: {
    metrics: { label: string; value: string }[];
    traceCount: string;
    sources: string[];
  };
  items?: IntelligenceItem[];
  action?: IntelligenceAction;
  quickActions?: QuickAction[];
  suggestions: string[];
  /** Present after a server-executed action; shows the verified result. */
  verification?: ActionVerification;

  // ============================================================
  // AGENTIC CONTRACT (Phase 4 — Tool system / Planner)
  // All optional so legacy consumers and the client-side fallback
  // keep working unchanged.
  // ============================================================
  /** The read tools actually executed to answer this request. Every
   *  entry is real: a tool that was selected and ran against the
   *  workspace snapshot (never a claim). */
  toolCalls?: IntelligenceToolCall[];
  /** Explicit plan when the request required planning. */
  plan?: IntelligencePlan;
  /** 0–1 confidence in the answer. Deterministic, data-backed answers
   *  are scored high; model answers carry the model's own score. */
  confidence?: number;
  /** True when the response proposes an action that must be confirmed
   *  by the human before the server executes it. */
  needsConfirmation?: boolean;
  /** Top-level source provenance (mirrors evidence.sources). */
  sources?: string[];
}

// ============================================================
// TOOL SYSTEM — explicit, server-validated tool contract
// ============================================================

/** One tool invocation actually performed by the agent (read-only). */
export interface IntelligenceToolCall {
  name: string;
  args?: Record<string, unknown>;
  status: "ok" | "error" | "skipped";
  /** Human-readable, factual summary of what the tool found. */
  summary: string;
  /** How many entities the tool returned (0 when none). */
  count?: number;
  durationMs?: number;
}

export interface IntelligencePlanStep {
  id: string;
  title: string;
  description: string;
  href?: string;
  /** Optional proposed actions attached to this step (always
   *  confirmation-gated; the server never executes them alone). */
  actions?: IntelligenceAction[];
}

export interface IntelligencePlan {
  /** One-line human summary of the analysis behind the plan,
   *  e.g. "J'ai analysé 4 projets et 17 tâches." */
  summary: string;
  steps: IntelligencePlanStep[];
  /** True when at least one step carries a mutation. */
  needsConfirmation: boolean;
}

/** Agent lifecycle states surfaced by the UI. */
export type AgentState =
  | "idle"
  | "thinking"
  | "planning"
  | "using_tools"
  | "executing"
  | "verifying"
  | "completed"
  | "failed";

export interface AgentRunResult {
  state: AgentState;
  /** Ordered, honest trace of what the agent did for this request. */
  steps: { label: string; state: AgentState }[];
  toolCalls: IntelligenceToolCall[];
  plan?: IntelligencePlan;
  confidence: number;
  needsConfirmation: boolean;
  provider: "openai" | "anthropic" | "nexus-engine";
  sources: string[];
}

export interface ActivityContextItem {
  id: string;
  entityType: string;
  action: string;
  title: string;
  actorName: string | null;
  createdAt: string;
}

export interface TaskDependencyContextItem {
  taskId: string;
  taskTitle: string;
  dependsOnTaskId: string;
  dependsOnTitle: string;
}

export interface SessionHistoryItem {
  id: string;
  query: string;
  intent: IntelligenceIntent;
  intentId?: IntelligenceIntentId;
  headline: string;
  targetEntities?: string[];
  actionTaken?: string;
  /** The proposed action from the previous turn, when present. */
  actionType?: IntelligenceActionType;
  target?: IntelligenceTarget;
  timestamp?: string;
}

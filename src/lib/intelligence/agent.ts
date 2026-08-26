// ============================================================
// NEXUS INTELLIGENCE — AGENT ORCHESTRATOR
// ============================================================
// The agentic loop that turns a plain-language request into a
// verified, evidence-grounded result:
//
//   User → Intent → Tool selection → Tool execution (read) →
//   (model proposes extra tools → server validates → executes) →
//   Plan → Response → Needs-confirmation flag
//
// Hard rules:
//   - Read tools execute against the real, workspace-scoped snapshot.
//   - Mutate tools are NEVER executed here: they become
//     confirmation-gated actions executed by /api/intelligence/action.
//   - The model proposes (intent, plan, tool calls, arguments); the
//     server decides (permissions, validation, execution, security).
//   - Invalid model output falls back to the deterministic engine.
//   - Nothing is ever claimed without a real read behind it.
// ============================================================

import { classifyIntent, mapLegacyIntentToId, riskForAction } from "./intent";
import { reasonWorkspace } from "./advanced";
import { callAIProvider, type AIProviderConfig } from "./ai-provider";
import {
  actionFromTool,
  runReadTools,
  selectToolsForIntent,
  validateToolProposal,
  type ToolExecutionContext,
} from "./tools";
import { buildPlan } from "./planner";
import { legacyIntentFromId } from "./memory";
import { resolveReference, resolutionToTarget } from "./references";
import type { WorkspaceContextSummary } from "./context-builder";
import type { WorkspaceSnapshot } from "./engine";
import type {
  ActivityContextItem,
  AgentRunResult,
  AgentState,
  IntelligenceAction,
  IntelligenceMemoryState,
  IntelligencePlan,
  IntelligencePlanStep,
  IntelligencePreference,
  IntelligenceTarget,
  IntelligenceToolCall,
  MemoryTrace,
  ReferenceResolution,
  SessionHistoryItem,
  StructuredIntelligenceResponse,
  TaskDependencyContextItem,
} from "./types";

export interface AgentInput {
  workspaceId: string;
  query: string;
  snapshot: WorkspaceSnapshot;
  context: WorkspaceContextSummary;
  sessionHistory?: SessionHistoryItem[];
  activities?: ActivityContextItem[];
  dependencies?: TaskDependencyContextItem[];
  /** Phase 2 — structured working memory (server-persisted). */
  memory?: IntelligenceMemoryState;
  preferences?: IntelligencePreference[];
  /** Reference resolution pre-computed by the route (server has the
   *  persisted memory). When absent, the agent resolves it itself. */
  resolution?: ReferenceResolution;
  aiConfig?: AIProviderConfig;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface AgentOutput {
  response: StructuredIntelligenceResponse;
  agent: AgentRunResult;
}

/**
 * Rebuilds a session-history view from the structured memory when the
 * client sent no history (refresh, other tab, other device). This is
 * how "fais-le", "et après", "cette tâche" keep working after a reload.
 */
export function buildEffectiveHistory(
  sessionHistory: SessionHistoryItem[] | undefined,
  memory: IntelligenceMemoryState | undefined,
  resolvedTarget?: IntelligenceTarget
): SessionHistoryItem[] {
  if (sessionHistory && sessionHistory.length > 0) return sessionHistory;
  if (!memory) return [];

  const lastTarget: IntelligenceTarget | undefined =
    resolvedTarget ??
    memory.lastTarget ??
    (memory.lastItems[0]
      ? { type: memory.lastItems[0].type, id: memory.lastItems[0].id, label: memory.lastItems[0].title }
      : undefined);

  const lastActionType =
    memory.pendingConfirmation?.actionType ?? memory.lastAction?.type;

  return [
    {
      id: "memory-restored",
      query: memory.lastQuery ?? "",
      intent: legacyIntentFromId(memory.lastIntent),
      intentId: memory.lastIntent ?? undefined,
      headline: memory.lastItems[0]?.title ?? memory.lastQuery ?? "",
      targetEntities: memory.lastItems.map((item) => item.title),
      actionType: lastActionType,
      target: lastTarget,
      timestamp: memory.updatedAt,
    },
  ];
}

function toolContext(input: AgentInput): ToolExecutionContext {
  return {
    workspaceId: input.workspaceId,
    snapshot: input.snapshot,
    context: input.context,
    activities: input.activities,
    dependencies: input.dependencies,
    sessionHistory: input.sessionHistory,
    now: input.snapshot.now,
  };
}

/**
 * Validates model-proposed tool calls. Only registry READ tools are
 * accepted and scheduled for execution; everything else is recorded
 * as skipped (never executed by the agent). Returns the rejected
 * entries (trace) and the approved read selections.
 */
export function validateModelToolCalls(
  raw: unknown
): { selections: { name: string; args: Record<string, unknown> }[]; rejected: IntelligenceToolCall[] } {
  const rejected: IntelligenceToolCall[] = [];
  const selections: { name: string; args: Record<string, unknown> }[] = [];
  if (!Array.isArray(raw)) return { selections, rejected };
  for (const entry of raw.slice(0, 8)) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";
    if (!name) continue;
    const args =
      record.args && typeof record.args === "object"
        ? (record.args as Record<string, unknown>)
        : {};
    const validated = validateToolProposal(name);
    if (!validated.ok) {
      rejected.push({ name, args, status: "skipped", summary: validated.reason, count: 0 });
      continue;
    }
    if (validated.def.permission !== "read") {
      rejected.push({
        name,
        args,
        status: "skipped",
        summary:
          "Outil de mutation/navigation proposé par le modèle — non exécuté par l'agent (le serveur décide seul)",
        count: 0,
      });
      continue;
    }
    // Only keep arguments declared by the tool contract.
    const cleanArgs: Record<string, unknown> = {};
    for (const spec of validated.def.args) {
      if (args[spec.name] !== undefined) cleanArgs[spec.name] = args[spec.name];
    }
    selections.push({ name, args: cleanArgs });
  }
  return { selections, rejected };
}

/** Validates a model-provided plan. The server prefers its own
 *  deterministic plan; the model plan fills a gap only when its shape
 *  is sound. */
export function validateModelPlan(raw: unknown): IntelligencePlan | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const summary = typeof record.summary === "string" && record.summary.trim() ? record.summary.trim() : "";
  if (!Array.isArray(record.steps)) return undefined;
  const steps: IntelligencePlanStep[] = [];
  for (const step of record.steps.slice(0, 8)) {
    if (!step || typeof step !== "object") continue;
    const s = step as Record<string, unknown>;
    const title = typeof s.title === "string" && s.title.trim() ? s.title.trim() : "";
    if (!title) continue;
    steps.push({
      id: `ai-plan-${steps.length + 1}`,
      title,
      description: typeof s.description === "string" ? s.description : "",
      href: typeof s.href === "string" ? s.href : undefined,
    });
  }
  if (steps.length === 0) return undefined;
  return { summary: summary || "Plan", steps, needsConfirmation: false };
}

function dedupeSelections(
  base: { name: string; args: Record<string, unknown> }[],
  extra: { name: string; args: Record<string, unknown> }[]
): { name: string; args: Record<string, unknown> }[] {
  const seen = new Set(base.map((s) => `${s.name}:${JSON.stringify(s.args)}`));
  const merged = [...base];
  for (const selection of extra) {
    const key = `${selection.name}:${JSON.stringify(selection.args)}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(selection);
    }
  }
  return merged;
}

function dedupeTrace(trace: IntelligenceToolCall[]): IntelligenceToolCall[] {
  const seen = new Set<string>();
  const out: IntelligenceToolCall[] = [];
  for (const call of trace) {
    const key = `${call.name}:${JSON.stringify(call.args ?? {})}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(call);
  }
  return out;
}

function enrichResponse(
  base: StructuredIntelligenceResponse,
  classified: ReturnType<typeof classifyIntent>,
  trace: IntelligenceToolCall[],
  plan: IntelligencePlan | undefined,
  provider: "openai" | "anthropic" | "nexus-engine",
  modelConfidence?: number
): { response: StructuredIntelligenceResponse; needsConfirmation: boolean } {
  const needsConfirmation =
    Boolean(base.action?.confirmationRequired) ||
    Boolean(plan?.needsConfirmation) ||
    base.action?.risk === "high" ||
    false;

  const confidence =
    provider === "nexus-engine"
      ? base.evidence?.metrics?.length > 0
        ? 0.95
        : 0.7
      : Math.min(1, Math.max(0, typeof modelConfidence === "number" ? modelConfidence : 0.6));

  const response: StructuredIntelligenceResponse = {
    ...base,
    intentId: base.intentId ?? mapLegacyIntentToId(base.intent, base.action?.type),
    target: base.target ?? classified.target,
    action: base.action
      ? {
          ...base.action,
          risk: base.action.risk ?? riskForAction(base.action.type),
        }
      : undefined,
    toolCalls: trace,
    plan,
    confidence,
    needsConfirmation,
    sources: base.evidence?.sources ?? [],
  };
  return { response, needsConfirmation };
}

function buildAgentResult(
  input: AgentInput,
  options: {
    response: StructuredIntelligenceResponse;
    trace: IntelligenceToolCall[];
    plan: IntelligencePlan | undefined;
    provider: "openai" | "anthropic" | "nexus-engine";
    needsConfirmation: boolean;
    usedFallback: boolean;
    memoryTrace?: MemoryTrace;
  }
): AgentRunResult {
  const steps: { label: string; state: AgentState }[] = [
    { label: "Analyse de votre workspace réel", state: "thinking" },
  ];
  if (options.memoryTrace?.referenceResolved && options.memoryTrace.referenceResolved.kind !== "none") {
    steps.push({
      label: "Contexte mémorisé utilisé pour résoudre la référence",
      state: "thinking",
    });
  }
  if (options.trace.length > 0) {
    steps.push({
      label: `Consultation de ${options.trace.length} outil(s): ${options.trace.map((t) => t.name).join(", ")}`,
      state: "using_tools",
    });
  }
  if (options.plan) {
    steps.push({ label: "Préparation du plan", state: "planning" });
  }
  if (options.usedFallback) {
    steps.push({
      label: "Provider IA non configuré ou indisponible — moteur déterministe NEXUS utilisé",
      state: "thinking",
    });
  }
  steps.push({ label: "Réponse prête", state: "completed" });

  return {
    state: "completed",
    steps,
    toolCalls: options.trace,
    plan: options.plan,
    confidence: options.response.confidence ?? 0.5,
    needsConfirmation: options.needsConfirmation,
    provider: options.provider,
    sources: options.response.sources ?? options.response.evidence?.sources ?? [],
    memory: options.memoryTrace,
  };
}

// ============================================================
// REFERENCE / MEMORY INTEGRATION
// ============================================================

function buildMemoryTrace(
  input: AgentInput,
  resolution: ReferenceResolution | undefined,
  fromClient: boolean
): MemoryTrace {
  return {
    retrieved: Boolean(input.memory),
    fromClient,
    referenceResolved: resolution,
    entity: resolution?.entity ?? null,
    action: input.memory?.lastAction ?? null,
    preferences: input.preferences?.length ?? 0,
  };
}

/** Short clarification response — never guesses. */
function clarificationResponse(query: string, resolution: ReferenceResolution): StructuredIntelligenceResponse {
  return {
    query,
    intent: "general",
    intentId: "GENERAL_ASSISTANCE",
    headline: "J'ai besoin d'une précision",
    narrative: resolution.question ?? "De quel élément parlez-vous ?",
    provider: "nexus-engine",
    evidence: {
      metrics: [{ label: "Référence", value: "ambiguë" }],
      traceCount: "Résolution référentielle : clarification demandée (aucune supposition)",
      sources: ["Mémoire de session"],
    },
    items: (resolution.candidates ?? []).map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      subtitle: candidate.type,
      href: candidate.type === "task" ? "/tasks" : candidate.type === "project" ? "/projects" : "/goals",
      reasons: ["Élément réellement disponible dans le workspace"],
    })),
    suggestions: ["Quelles sont mes tâches prioritaires ?", "Quels projets nécessitent mon attention ?"],
    confidence: 0.9,
    needsConfirmation: false,
    sources: ["Mémoire de session"],
  };
}

/** Honest "entity no longer exists" response — never re-uses a stale id. */
function deletedEntityResponse(query: string, resolution: ReferenceResolution): StructuredIntelligenceResponse {
  const label = resolution.entity?.title ?? "Cet élément";
  return {
    query,
    intent: "general",
    intentId: "GENERAL_ASSISTANCE",
    headline: `${label} n'existe plus.`,
    narrative: `L'élément auquel vous faites référence a été supprimé de ce workspace. Désignez un autre élément ou utilisez la recherche pour retrouver le travail restant.`,
    provider: "nexus-engine",
    evidence: {
      metrics: [{ label: "État", value: "supprimé" }],
      traceCount: "Référence mémoire invalidée : entité absente du workspace",
      sources: ["Mémoire de session", "Workspace Registry"],
    },
    suggestions: ["Quelles sont mes tâches prioritaires ?", "Recherche dans le workspace", "Quels projets nécessitent mon attention ?"],
    confidence: 0.95,
    needsConfirmation: false,
    sources: ["Mémoire de session"],
  };
}

/** "Pareil / fais la même chose" → re-propose the last mutation action
 *  (confirmation-gated; never executed automatically). */
function repeatActionResponse(
  query: string,
  resolution: ReferenceResolution,
  memory: IntelligenceMemoryState
): StructuredIntelligenceResponse | null {
  const lastAction = memory.lastAction;
  if (!lastAction || lastAction.status === "failed") return null;
  if (!resolution.target?.id) return null;

  const payload: Record<string, unknown> = {
    ...(lastAction.payload ?? {}),
    taskId: lastAction.entityId ?? resolution.target.id,
    projectId: lastAction.type.startsWith("delete_project") || lastAction.type === "update_project" ? lastAction.entityId ?? resolution.target.id : undefined,
    goalId: lastAction.type.includes("goal") ? lastAction.entityId ?? resolution.target.id : undefined,
    query: resolution.target.label,
  };
  const labelByType: Record<string, string> = {
    create_task: "Create the same task",
    update_task: "Apply the same update",
    complete_task: "Complete the same task",
    move_task: "Move the same task",
    delete_task: "Delete the same task",
  };

  return {
    query,
    intent: "action",
    intentId: "UPDATE",
    headline: `Répéter l'action « ${lastAction.type.replace(/_/g, " ")} » ?`,
    narrative: `La dernière action ${lastAction.status === "executed" ? "exécutée" : "proposée"} était « ${lastAction.type.replace(/_/g, " ")} »${lastAction.entityLabel ? ` sur « ${lastAction.entityLabel} »` : ""}. Confirmez pour l'appliquer.`,
    provider: "nexus-engine",
    evidence: {
      metrics: [
        { label: "Action", value: lastAction.type.replace(/_/g, " ") },
        { label: "Cible", value: resolution.target.label ?? "" },
      ],
      traceCount: "Répétition résolue depuis la mémoire de session",
      sources: ["Mémoire de session"],
    },
    action: {
      id: `act-repeat-${Date.now()}`,
      type: lastAction.type as IntelligenceAction["type"],
      label: labelByType[lastAction.type] ?? "Répéter l'action",
      description: "Même action que précédemment — exécutée côté serveur après confirmation et vérifiée.",
      confirmationRequired: true,
      risk: riskForAction(lastAction.type),
      payload: payload as IntelligenceAction["payload"],
    },
    suggestions: ["Confirmer l'action.", "Quelles sont mes tâches prioritaires ?", "Qu'est-ce qui est en retard ?"],
    confidence: 0.85,
    needsConfirmation: true,
    sources: ["Mémoire de session"],
  };
}

/**
 * Derives a working-memory view from the client session history when
 * no persisted memory exists yet (first use in this workspace, or the
 * client fallback path). Only the LAST resolved target carries a real
 * id — titles without ids are never turned into references, because
 * memory must never invent an entity.
 */
export function memoryFromSessionHistory(
  sessionHistory: SessionHistoryItem[] | undefined
): IntelligenceMemoryState | undefined {
  const last = sessionHistory?.[0];
  if (!last) return undefined;
  const items: IntelligenceMemoryState["lastItems"] = [];
  if (last.target?.id) {
    items.push({
      id: last.target.id,
      title: last.target.label ?? last.headline ?? "Item",
      type: last.target.type === "project" ? "project" : last.target.type === "goal" ? "goal" : "task",
    });
  }
  const lastTarget: IntelligenceTarget | undefined = last.target?.id ? last.target : undefined;
  return {
    conversationId: "client-history",
    lastIntent: last.intentId ?? null,
    lastQuery: last.query,
    lastTarget: lastTarget ?? null,
    lastItems: items,
    lastPlan: null,
    lastAction: last.actionType
      ? {
          type: last.actionType,
          status: "proposed",
          entityId: lastTarget?.id ?? null,
          entityLabel: lastTarget?.label ?? null,
          verified: false,
          timestamp: last.timestamp ?? new Date().toISOString(),
        }
      : null,
    pendingConfirmation: last.actionType
      ? {
          actionType: last.actionType,
          entityId: lastTarget?.id ?? null,
          entityLabel: lastTarget?.label ?? null,
          timestamp: last.timestamp ?? new Date().toISOString(),
        }
      : null,
    deletedEntityIds: [],
    updatedAt: last.timestamp ?? new Date().toISOString(),
  };
}

/** Phase 2 entry point: resolves the reference, rebuilds the session
 *  history from memory when needed, and returns everything the loop
 *  needs. Handles the no-guess early exits (ambiguous / deleted). */
export function resolveAgentContext(
  input: AgentInput
): {
  resolution: ReferenceResolution;
  resolvedTarget: IntelligenceTarget | undefined;
  effectiveHistory: SessionHistoryItem[];
  earlyResponse?: StructuredIntelligenceResponse;
  memoryTrace: MemoryTrace;
} {
  // Persisted memory wins; otherwise fall back to the client history
  // (only its last resolved target carries a real id).
  const workingMemory = input.memory ?? memoryFromSessionHistory(input.sessionHistory);
  const resolution =
    input.resolution ??
    resolveReference(
      input.query,
      workingMemory,
      input.snapshot,
      input.memory ? { verify: true } : undefined
    );
  const resolvedTarget = resolutionToTarget(resolution);
  const effectiveHistory = buildEffectiveHistory(input.sessionHistory, workingMemory, resolvedTarget);
  const memoryTrace = buildMemoryTrace(input, resolution, Boolean(input.memory) && !input.sessionHistory?.length);

  if (resolution.kind === "ambiguous") {
    return {
      resolution,
      resolvedTarget: undefined,
      effectiveHistory,
      earlyResponse: clarificationResponse(input.query, resolution),
      memoryTrace,
    };
  }
  if (resolution.kind === "deleted") {
    return {
      resolution,
      resolvedTarget: undefined,
      effectiveHistory,
      earlyResponse: deletedEntityResponse(input.query, resolution),
      memoryTrace,
    };
  }
  if (resolution.kind === "repeat" && input.memory) {
    const repeated = repeatActionResponse(input.query, resolution, input.memory);
    if (repeated) {
      return {
        resolution,
        resolvedTarget,
        effectiveHistory,
        earlyResponse: repeated,
        memoryTrace,
      };
    }
  }
  return { resolution, resolvedTarget, effectiveHistory, memoryTrace };
}

// ============================================================
// DETERMINISTIC PATH (always available — no provider required)
// ============================================================

export function runAgentDeterministic(input: AgentInput): AgentOutput {
  const ctx = toolContext(input);
  const { resolvedTarget, effectiveHistory, earlyResponse, memoryTrace } =
    resolveAgentContext(input);

  if (earlyResponse) {
    const agent = buildAgentResult(input, {
      response: earlyResponse,
      trace: [],
      plan: undefined,
      provider: "nexus-engine",
      needsConfirmation: earlyResponse.needsConfirmation ?? false,
      usedFallback: false,
      memoryTrace,
    });
    return { response: earlyResponse, agent };
  }

  const classified = classifyIntent(input.query, {
    snapshot: input.snapshot,
    sessionHistory: effectiveHistory,
    resolvedTarget,
  });

  const selections = selectToolsForIntent(classified.intent, input.query);
  const trace = runReadTools(selections, ctx);

  const plan = buildPlan({
    intentId: classified.intent,
    query: input.query,
    snapshot: input.snapshot,
    context: input.context,
    sessionHistory: effectiveHistory,
  });

  const base = reasonWorkspace(input.snapshot, input.query, input.context, effectiveHistory, resolvedTarget);
  const enriched = enrichResponse(base, classified, trace, plan, "nexus-engine");

  const agent = buildAgentResult(input, {
    response: enriched.response,
    trace,
    plan,
    provider: "nexus-engine",
    needsConfirmation: enriched.needsConfirmation,
    usedFallback: false,
    memoryTrace,
  });
  return { response: enriched.response, agent };
}

// ============================================================
// FULL AGENT LOOP (AI when configured, deterministic otherwise)
// ============================================================

export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const ctx = toolContext(input);
  const { resolvedTarget, effectiveHistory, earlyResponse, memoryTrace } =
    resolveAgentContext(input);

  if (earlyResponse) {
    const agent = buildAgentResult(input, {
      response: earlyResponse,
      trace: [],
      plan: undefined,
      provider: "nexus-engine",
      needsConfirmation: earlyResponse.needsConfirmation ?? false,
      usedFallback: false,
      memoryTrace,
    });
    return { response: earlyResponse, agent };
  }

  const classified = classifyIntent(input.query, {
    snapshot: input.snapshot,
    sessionHistory: effectiveHistory,
    resolvedTarget,
  });

  // Round 1 — server-selected read tools against the real snapshot.
  const selections = selectToolsForIntent(classified.intent, input.query);
  const trace = runReadTools(selections, ctx);

  // Deterministic plan (server-decided, always available).
  const plan = buildPlan({
    intentId: classified.intent,
    query: input.query,
    snapshot: input.snapshot,
    context: input.context,
    sessionHistory: effectiveHistory,
  });

  // Round 2 — the model proposes extra tool calls + the answer.
  // The server validates every proposal and executes only read tools.
  const aiResponse = await callAIProvider(input.query, input.context, effectiveHistory, {
    config: input.aiConfig,
    fetchImpl: input.fetchImpl,
    timeoutMs: input.timeoutMs,
    preferences: input.preferences,
  });

  if (aiResponse) {
    const provider = aiResponse.provider;
    const { selections: extraSelections, rejected } = validateModelToolCalls(aiResponse.toolCalls);
    const extraResults =
      extraSelections.length > 0
        ? runReadTools(dedupeSelections([], extraSelections), ctx)
        : [];

    const finalTrace = dedupeTrace([...trace, ...rejected, ...extraResults]);

    // Server's deterministic plan wins; model plan only fills a gap.
    let finalPlan = plan;
    if (!finalPlan) {
      const modelPlan = validateModelPlan(aiResponse.plan);
      if (modelPlan) finalPlan = modelPlan;
    }

    const enriched = enrichResponse(
      aiResponse,
      classified,
      finalTrace,
      finalPlan,
      provider,
      aiResponse.confidence
    );

    const agent = buildAgentResult(input, {
      response: enriched.response,
      trace: finalTrace,
      plan: finalPlan,
      provider,
      needsConfirmation: enriched.needsConfirmation,
      usedFallback: false,
      memoryTrace,
    });
    return { response: enriched.response, agent };
  }

  // Fallback — no key, timeout, invalid output or provider error.
  const base = reasonWorkspace(input.snapshot, input.query, input.context, effectiveHistory, resolvedTarget);
  const enriched = enrichResponse(base, classified, trace, plan, "nexus-engine");
  const agent = buildAgentResult(input, {
    response: enriched.response,
    trace,
    plan,
    provider: "nexus-engine",
    needsConfirmation: enriched.needsConfirmation,
    usedFallback: true,
    memoryTrace,
  });
  return { response: enriched.response, agent };
}

/** Builds a confirmation-gated action from a mutation tool name and
 *  args (used when the engine or a plan proposes a mutation). Server
 *  execution happens through /api/intelligence/action only. */
export function proposeAction(
  toolName: string,
  args: Record<string, unknown>,
  workspaceId: string
): IntelligenceAction | null {
  return actionFromTool(toolName, args, workspaceId);
}

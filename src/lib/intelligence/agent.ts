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
import type { WorkspaceContextSummary } from "./context-builder";
import type { WorkspaceSnapshot } from "./engine";
import type {
  ActivityContextItem,
  AgentRunResult,
  AgentState,
  IntelligenceAction,
  IntelligencePlan,
  IntelligencePlanStep,
  IntelligenceToolCall,
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
  aiConfig?: AIProviderConfig;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface AgentOutput {
  response: StructuredIntelligenceResponse;
  agent: AgentRunResult;
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
  }
): AgentRunResult {
  const steps: { label: string; state: AgentState }[] = [
    { label: "Analyse de votre workspace réel", state: "thinking" },
  ];
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
  };
}

// ============================================================
// DETERMINISTIC PATH (always available — no provider required)
// ============================================================

export function runAgentDeterministic(input: AgentInput): AgentOutput {
  const ctx = toolContext(input);
  const classified = classifyIntent(input.query, {
    snapshot: input.snapshot,
    sessionHistory: input.sessionHistory,
  });

  const selections = selectToolsForIntent(classified.intent, input.query);
  const trace = runReadTools(selections, ctx);

  const plan = buildPlan({
    intentId: classified.intent,
    query: input.query,
    snapshot: input.snapshot,
    context: input.context,
    sessionHistory: input.sessionHistory,
  });

  const base = reasonWorkspace(input.snapshot, input.query, input.context, input.sessionHistory);
  const enriched = enrichResponse(base, classified, trace, plan, "nexus-engine");

  const agent = buildAgentResult(input, {
    response: enriched.response,
    trace,
    plan,
    provider: "nexus-engine",
    needsConfirmation: enriched.needsConfirmation,
    usedFallback: false,
  });
  return { response: enriched.response, agent };
}

// ============================================================
// FULL AGENT LOOP (AI when configured, deterministic otherwise)
// ============================================================

export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const ctx = toolContext(input);
  const classified = classifyIntent(input.query, {
    snapshot: input.snapshot,
    sessionHistory: input.sessionHistory,
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
    sessionHistory: input.sessionHistory,
  });

  // Round 2 — the model proposes extra tool calls + the answer.
  // The server validates every proposal and executes only read tools.
  const aiResponse = await callAIProvider(input.query, input.context, input.sessionHistory, {
    config: input.aiConfig,
    fetchImpl: input.fetchImpl,
    timeoutMs: input.timeoutMs,
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
    });
    return { response: enriched.response, agent };
  }

  // Fallback — no key, timeout, invalid output or provider error.
  const base = reasonWorkspace(input.snapshot, input.query, input.context, input.sessionHistory);
  const enriched = enrichResponse(base, classified, trace, plan, "nexus-engine");
  const agent = buildAgentResult(input, {
    response: enriched.response,
    trace,
    plan,
    provider: "nexus-engine",
    needsConfirmation: enriched.needsConfirmation,
    usedFallback: true,
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

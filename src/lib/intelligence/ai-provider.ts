// ============================================================
// NEXUS INTELLIGENCE — AI PROVIDER ADAPTER
// Connects to OpenAI or Anthropic using standard REST fetch.
// 100% dependency-free. Strictly falls back to deterministic
// reasoning when unconfigured, timed out, or unavailable.
//
// Agentic contract (Phase 4):
//   - The model PROPOSES: intent, plan, tool calls, arguments,
//     confidence. The server DECIDES: permissions, validation,
//     execution, confirmation, security.
//   - Model-proposed tool calls are validated against the read-only
//     tool registry; the server executes them; mutations never run
//     here.
//   - Bounded requests: AbortController + timeout + one controlled
//     retry on transient network/5xx failures.
// ============================================================

import type {
  StructuredIntelligenceResponse,
  IntelligenceAction,
  IntelligenceActionType,
  IntelligenceIntentId,
  IntelligencePreference,
  IntelligenceRisk,
  IntelligenceTarget,
  IntelligenceToolCall,
  IntelligencePlan,
  SessionHistoryItem,
  QuickAction,
} from "./types";
import type { StoredSignalRow } from "./signals";
import type { IntelligenceMission } from "./types";
import type { WorkspaceContextSummary } from "./context-builder";
import { mapLegacyIntentToId, riskForAction } from "./intent";
import { READ_TOOL_NAMES } from "./tools";

export type AIProviderName = "openai" | "anthropic" | "nexus-engine";

export interface AIProviderConfig {
  provider: AIProviderName;
  apiKey?: string;
  model?: string;
}

export function detectAIProvider(): AIProviderConfig {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    return {
      provider: "anthropic",
      apiKey: anthropicKey,
      model: process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-sonnet-20241022",
    };
  }

  return { provider: "nexus-engine" };
}

/** The read-only tool catalog the model may propose calls against. */
function toolCatalogPrompt(): string {
  const lines: string[] = [];
  for (const name of [...READ_TOOL_NAMES].sort()) {
    const def = name; // names are self-describing; descriptions come from the registry comment above
    lines.push(`- ${def}`);
  }
  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are NEXUS Intelligence, an executive operational intelligence engine for modern teams.
You analyze workspace state and help operators understand what needs attention, what is progressing, what is blocked, and what to do next. You answer in the language the user used (French or English).

STRICT OPERATIONAL RULES:
1. ONLY use facts from the provided verified workspace context. NEVER invent projects, tasks, due dates, statuses, or activities.
2. If data is missing or empty, state it plainly. Do not guess.
3. Be concise, direct, professional, and clear.
4. Output MUST be valid JSON adhering to the specified schema.
5. You propose; the server decides. Never describe executing a mutation — the server executes actions and verifies them.

AVAILABLE READ-ONLY TOOLS (you may propose calling more of them via "toolCalls"; the server validates and executes them):
${toolCatalogPrompt()}

TOOL CALLING RULES:
- Only propose read-only tools from the list above. Never invent tool names.
- If the provided context already answers the request, return "toolCalls": [].
- Never propose mutation or navigation tools — mutations are proposed through the "action" field and executed server-side after human confirmation.

PLANNING RULES:
- For planning requests ("organise ma journée", "plan my day/week", catch-up plans...) include a "plan" object with a one-line factual "summary" and ordered "steps".
- The summary must look like "J'ai analysé X projets et Y tâches. Voici le plan que je recommande." (or English), derived from the context.
- Never expose internal chain-of-thought: steps are user-facing recommendations only.

JSON RESPONSE FORMAT:
{
  "query": "the original question",
  "intent": "analysis" | "prioritization" | "planning" | "synthesis" | "detection" | "action" | "general",
  "intentId": "ANALYZE" | "PRIORITIZE" | "PLAN" | "SUMMARIZE" | "DETECT" | "SEARCH" | "CREATE" | "UPDATE" | "COMPLETE" | "MOVE" | "DELETE" | "EXPLAIN" | "GENERAL_ASSISTANCE",
  "headline": "A short, authoritative summary headline",
  "narrative": "A concise paragraph explaining the situation and evidence",
  "evidence": {
    "metrics": [{"label": "Metric name", "value": "Metric value"}],
    "traceCount": "e.g. Analyzed 3 projects, 8 tasks in workspace",
    "sources": ["Projects", "Tasks", "Activity Log"]
  },
  "items": [
    {
      "id": "entity-id or slug",
      "title": "Item title",
      "subtitle": "Short context or project name",
      "badge": {"label": "OVERDUE", "tone": "danger" | "warning" | "success" | "neutral" | "lavender"},
      "href": "/tasks or /projects or /activity",
      "reasons": ["Specific reason derived from facts"]
    }
  ],
  "action": {
    "id": "unique-action-id",
    "type": "create_task" | "create_project" | "create_goal" | "update_task" | "update_project" | "complete_task" | "move_task" | "delete_task" | "delete_project" | "view_blocked_tasks" | "view_overdue_tasks" | "view_risky_projects" | "navigate",
    "label": "Action label",
    "description": "What this action will do",
    "confirmationRequired": true,
    "risk": "low" | "medium" | "high",
    "payload": {
      "title": "Proposed task or project title",
      "name": "Proposed project name if create_project",
      "taskId": "existing task id for update/complete/move/delete",
      "projectId": "target project id or null",
      "priority": "low" | "medium" | "high" | "urgent",
      "status": "todo" | "in_progress" | "in_review" | "blocked" | "done",
      "dueDate": "YYYY-MM-DD or null",
      "query": "free-text reference to the entity, when no id is known"
    }
  },
  "plan": {
    "summary": "One-line factual summary of the analysis behind the plan",
    "steps": [{"title": "Step title", "description": "Step description", "href": "/tasks"}],
    "needsConfirmation": false
  },
  "toolCalls": [{"name": "get_projects", "args": {}}],
  "confidence": 0.85,
  "needsConfirmation": false,
  "sources": ["Projects", "Tasks"],
  "quickActions": [
    {"label": "View projects", "href": "/projects"},
    {"label": "Plan my day", "query": "Organise ma journée"}
  ],
  "suggestions": ["Follow-up question 1", "Follow-up question 2"]
}`;

/** One controlled retry on transient failures (network error, 5xx,
 *  429). Aborts/timeouts are never retried — the bound must hold. */
async function fetchWithRetry(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  maxAttempts = 2
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts - 1) {
        continue; // transient server error — controlled retry
      }
      return res;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      const aborted =
        error instanceof DOMException && error.name === "AbortError";
      if (aborted || attempt >= maxAttempts - 1) throw error;
    }
  }
  throw lastError;
}

export async function callAIProvider(
  query: string,
  context: WorkspaceContextSummary,
  sessionHistory?: SessionHistoryItem[],
  options?: {
    config?: AIProviderConfig;
    fetchImpl?: typeof fetch;
    /** Overrides the default 10s provider timeout (used by tests). */
    timeoutMs?: number;
    /** Explicitly-requested durable preferences (Phase 2 memory). */
    preferences?: IntelligencePreference[];
    /** Active proactive signals (Phase 3) — derived, verified context
     *  the agent can reference; never a substitute for real rows. */
    signals?: StoredSignalRow[];
    /** Active mission (Phase 4) — persistent multi-step objective. */
    mission?: IntelligenceMission;
  }
): Promise<StructuredIntelligenceResponse | null> {
  const config = options?.config ?? detectAIProvider();
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 10000;

  if (config.provider === "nexus-engine" || !config.apiKey) {
    return null;
  }

  const preferencesBlock =
    options?.preferences && options.preferences.length > 0
      ? `\n\nUSER EXPLICIT PREFERENCES (durable, user-requested):\n${options.preferences.map((p) => `- ${p.value}`).join("\n")}`
      : "";
  const missionBlock =
    options?.mission
      ? `\n\nACTIVE MISSION (persistent objective, steps are verified server-side):\n- ${options.mission.title} (progress ${options.mission.progress}%)\n- Current step: ${options.mission.currentStepId ?? "none"}\n- Next best action: ${options.mission.nextBestAction?.label ?? "none"}`
      : "";
  const signalsBlock =
    options?.signals && options.signals.length > 0
      ? `\n\nCURRENT PROACTIVE SIGNALS (verified, derived from the workspace):\n${options.signals
          .slice(0, 5)
          .map((signal) => `- [${signal.severity.toUpperCase()}] ${signal.title} — ${signal.summary}`)
          .join("\n")}`
      : "";
  const promptContent = `VERIFIED WORKSPACE CONTEXT:\n${context.compactPrompt}${preferencesBlock}${signalsBlock}${missionBlock}\n\nUSER QUESTION:\n${query}`;

  try {
    const historyMessages: { role: "user" | "assistant"; content: string }[] = [];
    if (sessionHistory && sessionHistory.length > 0) {
      for (const item of sessionHistory.slice(0, 3).reverse()) {
        historyMessages.push({ role: "user", content: item.query });
        historyMessages.push({
          role: "assistant",
          content: JSON.stringify({ headline: item.headline, intent: item.intent }),
        });
      }
    }

    if (config.provider === "openai") {
      const res = await fetchWithRetry(
        fetchImpl,
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...historyMessages,
              { role: "user", content: promptContent },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 1600,
          }),
        },
        timeoutMs
      );

      if (!res.ok) return null;

      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content;
      if (!rawText) return null;

      const parsed = JSON.parse(rawText);
      return validateAndNormalizeResponse(parsed, query, "openai");
    }

    if (config.provider === "anthropic") {
      const anthropicMessages = [
        ...historyMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: promptContent },
      ];

      const res = await fetchWithRetry(
        fetchImpl,
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: config.model,
            system: SYSTEM_PROMPT,
            messages: anthropicMessages,
            max_tokens: 1600,
            temperature: 0.1,
          }),
        },
        timeoutMs
      );

      if (!res.ok) return null;

      const data = await res.json();
      const rawText = data.content?.[0]?.text;
      if (!rawText) return null;

      const parsed = JSON.parse(rawText);
      return validateAndNormalizeResponse(parsed, query, "anthropic");
    }

    return null;
  } catch (error) {
    console.warn("AI Provider call failed or timed out, falling back to deterministic reasoning:", error);
    return null;
  }
}

function validateAndNormalizeResponse(
  raw: unknown,
  query: string,
  provider: "openai" | "anthropic"
): StructuredIntelligenceResponse | null {
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;
  const headline = typeof data.headline === "string" && data.headline.trim() ? data.headline.trim() : "Workspace Analysis";
  const narrative = typeof data.narrative === "string" && data.narrative.trim() ? data.narrative.trim() : "";
  const intent = typeof data.intent === "string" && ["analysis", "prioritization", "planning", "synthesis", "detection", "action"].includes(data.intent)
    ? (data.intent as StructuredIntelligenceResponse["intent"])
    : "general";
  const rawIntentId = data.intentId;
  const intentId: IntelligenceIntentId | undefined =
    typeof rawIntentId === "string" &&
    ["ANALYZE", "PRIORITIZE", "PLAN", "SUMMARIZE", "DETECT", "SEARCH", "CREATE", "UPDATE", "COMPLETE", "MOVE", "DELETE", "EXPLAIN", "GENERAL_ASSISTANCE"].includes(rawIntentId)
      ? (rawIntentId as IntelligenceIntentId)
      : mapLegacyIntentToId(intent);
  const rawTarget = data.target && typeof data.target === "object" ? (data.target as Record<string, unknown>) : undefined;
  const targetType: IntelligenceTarget["type"] =
    rawTarget?.type === "task" || rawTarget?.type === "project" || rawTarget?.type === "goal" || rawTarget?.type === "workspace"
      ? rawTarget.type
      : null;
  const target: IntelligenceTarget | undefined = rawTarget
    ? {
        type: targetType,
        query: typeof rawTarget.query === "string" ? rawTarget.query : undefined,
        id: typeof rawTarget.id === "string" ? rawTarget.id : undefined,
        label: typeof rawTarget.label === "string" ? rawTarget.label : undefined,
      }
    : undefined;

  const rawEvidence = data.evidence as Record<string, unknown> | undefined;
  const metrics: { label: string; value: string }[] = [];
  if (Array.isArray(rawEvidence?.metrics)) {
    for (const m of rawEvidence.metrics) {
      if (m && typeof m.label === "string" && typeof m.value === "string") {
        metrics.push({ label: m.label, value: m.value });
      }
    }
  }

  const items: StructuredIntelligenceResponse["items"] = [];
  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      if (item && typeof item.title === "string") {
        items.push({
          id: String(item.id ?? Math.random().toString(36).slice(2)),
          title: item.title,
          subtitle: typeof item.subtitle === "string" ? item.subtitle : undefined,
          href: typeof item.href === "string" ? item.href : undefined,
          reasons: Array.isArray(item.reasons) ? item.reasons.map(String) : undefined,
        });
      }
    }
  }

  let action: StructuredIntelligenceResponse["action"] = undefined;
  if (data.action && typeof data.action === "object") {
    const act = data.action as Record<string, unknown>;
    const validActionTypes: IntelligenceActionType[] = [
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
      "open_project",
      "open_task",
      "view_blocked_tasks",
      "view_overdue_tasks",
      "view_risky_projects",
      "navigate",
    ];

    if (
      typeof act.type === "string" &&
      validActionTypes.includes(act.type as IntelligenceActionType) &&
      typeof act.label === "string"
    ) {
      const rawPayload =
        act.payload && typeof act.payload === "object"
          ? (act.payload as Record<string, unknown>)
          : undefined;

      const payload: IntelligenceAction["payload"] = rawPayload
        ? {
            title: typeof rawPayload.title === "string" ? rawPayload.title : undefined,
            name: typeof rawPayload.name === "string" ? rawPayload.name : undefined,
            priority:
              typeof rawPayload.priority === "string" &&
              ["low", "medium", "high", "urgent"].includes(rawPayload.priority)
                ? (rawPayload.priority as "low" | "medium" | "high" | "urgent")
                : undefined,
            status: typeof rawPayload.status === "string" ? rawPayload.status : undefined,
            dueDate: typeof rawPayload.dueDate === "string" ? rawPayload.dueDate : null,
            projectId: typeof rawPayload.projectId === "string" ? rawPayload.projectId : null,
            description: typeof rawPayload.description === "string" ? rawPayload.description : undefined,
            url: typeof rawPayload.url === "string" ? rawPayload.url : undefined,
            taskId: typeof rawPayload.taskId === "string" ? rawPayload.taskId : undefined,
            goalId: typeof rawPayload.goalId === "string" ? rawPayload.goalId : undefined,
            query: typeof rawPayload.query === "string" ? rawPayload.query : undefined,
            confirmDeletion: rawPayload.confirmDeletion === true ? true : undefined,
          }
        : undefined;

      const actionType = act.type as IntelligenceActionType;
      action = {
        id: String(act.id ?? "act-1"),
        type: actionType,
        label: act.label,
        description: typeof act.description === "string" ? act.description : undefined,
        confirmationRequired: Boolean(act.confirmationRequired ?? true),
        risk:
          typeof act.risk === "string" && ["low", "medium", "high"].includes(act.risk)
            ? (act.risk as IntelligenceRisk)
            : riskForAction(actionType),
        payload,
      };
    }
  }

  // ---- Phase 4: agentic fields ----------------------------------
  const toolCalls: IntelligenceToolCall[] = [];
  if (Array.isArray(data.toolCalls)) {
    for (const tc of data.toolCalls) {
      if (tc && typeof tc === "object" && typeof (tc as Record<string, unknown>).name === "string") {
        const call = tc as Record<string, unknown>;
        toolCalls.push({
          name: String(call.name),
          args:
            call.args && typeof call.args === "object"
              ? (call.args as Record<string, unknown>)
              : {},
          status: "ok",
          summary: "Proposé par le modèle — validation et exécution par le serveur",
          count: 0,
        });
      }
    }
  }

  let plan: IntelligencePlan | undefined;
  if (data.plan && typeof data.plan === "object") {
    const rawPlan = data.plan as Record<string, unknown>;
    if (typeof rawPlan.summary === "string" && Array.isArray(rawPlan.steps)) {
      const steps: IntelligencePlan["steps"] = [];
      for (const step of rawPlan.steps.slice(0, 8)) {
        if (step && typeof step === "object") {
          const s = step as Record<string, unknown>;
          if (typeof s.title === "string" && s.title.trim()) {
            steps.push({
              id: `model-plan-${steps.length + 1}`,
              title: s.title,
              description: typeof s.description === "string" ? s.description : "",
              href: typeof s.href === "string" ? s.href : undefined,
            });
          }
        }
      }
      if (steps.length > 0) {
        plan = {
          summary: rawPlan.summary,
          steps,
          needsConfirmation: rawPlan.needsConfirmation === true,
        };
      }
    }
  }

  const confidence =
    typeof data.confidence === "number" && Number.isFinite(data.confidence)
      ? Math.min(1, Math.max(0, data.confidence))
      : undefined;
  const needsConfirmation =
    typeof data.needsConfirmation === "boolean" ? data.needsConfirmation : undefined;
  const sources = Array.isArray(data.sources)
    ? data.sources.filter((s): s is string => typeof s === "string")
    : undefined;

  const quickActions: QuickAction[] = [];
  if (Array.isArray(data.quickActions)) {
    for (const qa of data.quickActions) {
      if (qa && typeof qa === "object") {
        const item = qa as Record<string, unknown>;
        if (typeof item.label === "string") {
          quickActions.push({
            label: item.label,
            href: typeof item.href === "string" ? item.href : undefined,
            query: typeof item.query === "string" ? item.query : undefined,
          });
        }
      }
    }
  }

  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.filter((s): s is string => typeof s === "string")
    : [];

  return {
    query,
    intent,
    intentId,
    target,
    headline,
    narrative,
    provider,
    evidence: {
      metrics,
      traceCount: typeof rawEvidence?.traceCount === "string" ? rawEvidence.traceCount : "Derived from verified workspace records",
      sources: Array.isArray(rawEvidence?.sources) ? rawEvidence.sources.map(String) : ["Workspace Data"],
    },
    items: items.length > 0 ? items : undefined,
    action,
    quickActions: quickActions.length > 0 ? quickActions : undefined,
    suggestions: suggestions.length > 0 ? suggestions : ["What should I do next?", "What is blocked?"],
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    plan,
    confidence,
    needsConfirmation,
    sources,
  };
}

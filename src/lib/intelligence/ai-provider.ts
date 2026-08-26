// ============================================================
// NEXUS INTELLIGENCE — AI PROVIDER ADAPTER
// Connects to OpenAI or Anthropic using standard REST fetch.
// 100% dependency-free. Strictly falls back to deterministic
// reasoning when unconfigured, timed out, or unavailable.
// ============================================================

import type {
  StructuredIntelligenceResponse,
  IntelligenceAction,
  IntelligenceActionType,
  IntelligenceIntentId,
  IntelligenceRisk,
  IntelligenceTarget,
  SessionHistoryItem,
  QuickAction,
} from "./types";
import type { WorkspaceContextSummary } from "./context-builder";
import { mapLegacyIntentToId, riskForAction } from "./intent";

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

const SYSTEM_PROMPT = `You are NEXUS Intelligence, an executive operational intelligence engine for modern teams.
You analyze workspace state and help operators understand what needs attention, what is progressing, what is blocked, and what to do next.

STRICT OPERATIONAL RULES:
1. ONLY use facts from the provided verified workspace context. NEVER invent projects, tasks, due dates, statuses, or activities.
2. If data is missing or empty, state it plainly. Do not guess.
3. Be concise, direct, professional, and clear.
4. Output MUST be valid JSON adhering to the specified schema.

JSON RESPONSE FORMAT:
{
  "query": "the original question",
  "intent": "analysis" | "prioritization" | "planning" | "synthesis" | "detection" | "action" | "general",
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
  "quickActions": [
    {"label": "View projects", "href": "/projects"},
    {"label": "Plan my day", "query": "Organise ma journée"}
  ],
  "suggestions": ["Follow-up question 1", "Follow-up question 2"]
}`;

export async function callAIProvider(
  query: string,
  context: WorkspaceContextSummary,
  sessionHistory?: SessionHistoryItem[],
  options?: {
    config?: AIProviderConfig;
    fetchImpl?: typeof fetch;
    /** Overrides the default 10s provider timeout (used by tests). */
    timeoutMs?: number;
  }
): Promise<StructuredIntelligenceResponse | null> {
  const config = options?.config ?? detectAIProvider();
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 10000;

  if (config.provider === "nexus-engine" || !config.apiKey) {
    return null;
  }

  const promptContent = `VERIFIED WORKSPACE CONTEXT:\n${context.compactPrompt}\n\nUSER QUESTION:\n${query}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
      const res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
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
          max_tokens: 1200,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
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

      const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
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
          max_tokens: 1200,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
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
      "complete_task",
      "move_task",
      "delete_task",
      "delete_project",
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
  };
}

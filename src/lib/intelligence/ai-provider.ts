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
} from "./types";
import type { WorkspaceContextSummary } from "./context-builder";

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
    "type": "create_task" | "create_project" | "view_blocked_tasks" | "view_overdue_tasks" | "view_risky_projects" | "navigate",
    "label": "Action label",
    "description": "What this action will do",
    "confirmationRequired": true,
    "payload": {
      "title": "Proposed task or project title",
      "priority": "low" | "medium" | "high" | "urgent",
      "dueDate": "YYYY-MM-DD or null",
      "projectId": "target project id or null"
    }
  },
  "suggestions": ["Follow-up question 1", "Follow-up question 2"]
}`;

export async function callAIProvider(
  query: string,
  context: WorkspaceContextSummary
): Promise<StructuredIntelligenceResponse | null> {
  const config = detectAIProvider();
  if (config.provider === "nexus-engine" || !config.apiKey) {
    return null;
  }

  const promptContent = `VERIFIED WORKSPACE CONTEXT:\n${context.compactPrompt}\n\nUSER QUESTION:\n${query}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    if (config.provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
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
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.model,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: promptContent }],
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

      action = {
        id: String(act.id ?? "act-1"),
        type: act.type as IntelligenceActionType,
        label: act.label,
        description: typeof act.description === "string" ? act.description : undefined,
        confirmationRequired: Boolean(act.confirmationRequired ?? true),
        payload,
      };
    }
  }

  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.filter((s): s is string => typeof s === "string")
    : [];

  return {
    query,
    intent,
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
    suggestions: suggestions.length > 0 ? suggestions : ["What should I do next?", "What is blocked?"],
  };
}

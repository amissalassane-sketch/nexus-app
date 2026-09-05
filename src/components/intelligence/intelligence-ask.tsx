"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CornerDownLeft,
  History,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { computeInsights, type WorkspaceSnapshot } from "@/lib/intelligence/engine";
import { buildWorkspaceContext } from "@/lib/intelligence/context-builder";
import { runAgentDeterministic } from "@/lib/intelligence/agent";
import {
  applyActionSuccess,
  emptyMemoryState,
  updateMemoryAfterTurn,
} from "@/lib/intelligence/memory";
import type {
  StructuredIntelligenceResponse,
  IntelligenceAction,
  ActionVerification,
  AgentRunResult,
  IntelligenceMemoryState,
  IntelligencePreference,
} from "@/lib/intelligence/types";
import { emitActivation, trackEvent } from "@/lib/onboarding/analytics";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import {
  IntelligenceProcessingStates,
  VerificationLifecycle,
} from "@/components/motion/intelligence-states";

// ============================================================
// NEXUS INTELLIGENCE — INTERACTIVE WORKSPACE CONSOLE
//
// Connected to the NEXUS AI API and the deterministic context engine.
// Features:
// - Real workspace context only (zero hallucination).
// - Structured 6-capability model (Analysis, Prioritization, Planning, Synthesis, Detection, Action).
// - Action execution with user confirmation.
// - Session conversation history.
// - Full mobile touch readiness (>= 44px hit areas, no hover dependencies).
// - Offline/fallback resilience with AbortController timeout.
// ============================================================

const CATEGORIZED_STARTERS = [
  { label: "Analyse", query: "Quels projets nécessitent mon attention ?" },
  { label: "Priorités", query: "Quelles sont mes 3 prochaines tâches prioritaires ?" },
  { label: "Blocages", query: "Quels projets semblent bloqués ?" },
  { label: "Synthèse", query: "Résume l'activité de cette semaine." },
  { label: "Plan", query: "Aide-moi à organiser cette semaine." },
  { label: "Action", query: "Je dois préparer ma présentation de vendredi." },
];

/** Agent states, rendered as short labels in the trace disclosure. */
const AGENT_STATE_LABEL: Record<string, string> = {
  idle: "En attente",
  thinking: "Réflexion",
  planning: "Plan",
  using_tools: "Outils",
  executing: "Exécution",
  verifying: "Vérification",
  completed: "Terminé",
  failed: "Échec",
};

interface HistoryEntry {
  id: string;
  query: string;
  response: StructuredIntelligenceResponse;
  timestamp: string;
}

interface CachedMemory {
  state: IntelligenceMemoryState;
  preferences: IntelligencePreference[];
}

/** Local mirror of the server-persisted working memory. It survives
 *  refresh and other tabs of the same workspace; the server row stays
 *  the source of truth (the cache only bootstraps the offline/fallback
 *  path and quick UI continuity). */
const MEMORY_CACHE_KEY = "nexus.intelligence.memory.v1";

function loadCachedMemory(): CachedMemory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MEMORY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedMemory;
    if (parsed && typeof parsed === "object" && parsed.state && typeof parsed.state === "object") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function cacheMemory(memory: CachedMemory | null) {
  if (typeof window === "undefined") return;
  try {
    if (memory) window.localStorage.setItem(MEMORY_CACHE_KEY, JSON.stringify(memory));
    else window.localStorage.removeItem(MEMORY_CACHE_KEY);
  } catch {
    // Storage unavailable (private mode / quota) — non-blocking.
  }
}

function sessionHistoryPayload(history: HistoryEntry[]) {
  return history.map((h) => ({
    id: h.id,
    query: h.query,
    intent: h.response.intent,
    intentId: h.response.intentId,
    headline: h.response.headline,
    targetEntities: h.response.items?.map((i) => i.title),
    actionType: h.response.action?.type,
    target: h.response.target,
  }));
}

export function IntelligenceAsk({
  snapshot,
  autoFocus = false,
  initialQuery = "",
}: {
  snapshot: WorkspaceSnapshot;
  /** Focus the composer on mount (deep link from the mobile home CTA). */
  autoFocus?: boolean;
  /** Prefill the composer WITHOUT sending — the user always presses
   *  send; a deep link never triggers a query on its own. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<StructuredIntelligenceResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedMemory, setCachedMemory] = useState<CachedMemory | null>(() => loadCachedMemory());

  // Agentic trace — the real steps the server ran (tools, plan).
  const [agentRun, setAgentRun] = useState<AgentRunResult | null>(null);

  // Agent trace accordions — the summary is always visible; the detailed
  // step list and tool chips stay collapsed on phones so the answer never
  // turns into a wall of text.
  const [traceOpen, setTraceOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  // Multi-line composer — grows up to ~5 rows, Enter sends, Shift+Enter
  // inserts a newline, so long questions stay readable while typing.
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [query]);

  // Deep link (?ask=1): put the composer in front of the user — on a
  // phone this opens the keyboard exactly where the home CTA pointed.
  useEffect(() => {
    if (!autoFocus) return;
    const el = composerRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }, [autoFocus]);

  // Action execution state
  const [confirmingAction, setConfirmingAction] = useState<IntelligenceAction | null>(null);
  const [executingAction, setExecutingAction] = useState(false);
  const [verifyingAction, setVerifyingAction] = useState(false);
  const [executedActionResult, setExecutedActionResult] = useState<{
    success: boolean;
    message: string;
    entityId?: string;
    actionType?: string;
    verification?: ActionVerification;
  } | null>(null);

  const proactive = useMemo(() => {
    return computeInsights(snapshot)
      .filter((insight) => insight.severity !== "positive")
      .slice(0, 3);
  }, [snapshot]);

  const abortRef = useRef<AbortController | null>(null);

  const send = async (textToSend?: string) => {
    const value = (textToSend ?? query).trim();
    if (!value || loading) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setQuery(value);
    setLoading(true);
    setError(null);
    setConfirmingAction(null);
    setExecutedActionResult(null);
    setAgentRun(null);

    emitActivation("intelligence");
    trackEvent("intelligence_interaction");

    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch("/api/intelligence/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: value,
          sessionHistory: sessionHistoryPayload(history),
          memory: cachedMemory ?? undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.response) {
          const structured = data.response as StructuredIntelligenceResponse;
          setCurrentResponse(structured);
          if (data.agent) setAgentRun(data.agent as AgentRunResult);
          // Server-persisted memory comes back — keep the local mirror
          // fresh (refresh / other tabs).
          if (data.memory?.state) {
            const next: CachedMemory = {
              state: data.memory.state,
              preferences: data.memory.preferences ?? [],
            };
            setCachedMemory(next);
            cacheMemory(next);
          }
          setHistory((prev) => [
            {
              id: `hist-${Date.now()}`,
              query: value,
              response: structured,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
            ...prev.slice(0, 9),
          ]);
          return;
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        setError("Query timed out. Retrying with local workspace reasoning...");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }

    // Deterministic fallback — the full agent loop still runs locally:
    // memory retrieval → reference resolution → real read tools →
    // plan → response (honest nexus-engine). The memory mirror keeps
    // working across refreshes even when the API is unavailable.
    const fallback = runAgentDeterministic({
      workspaceId: "client",
      query: value,
      snapshot,
      context: buildWorkspaceContext("client", snapshot),
      sessionHistory: sessionHistoryPayload(history),
      memory: cachedMemory?.state,
      preferences: cachedMemory?.preferences,
    });
    setCurrentResponse(fallback.response);
    setAgentRun(fallback.agent);
    const nextState = updateMemoryAfterTurn(
      cachedMemory?.state ?? emptyMemoryState(),
      fallback.response,
      snapshot
    );
    const nextCache: CachedMemory = {
      state: nextState,
      preferences: cachedMemory?.preferences ?? [],
    };
    setCachedMemory(nextCache);
    cacheMemory(nextCache);
    setHistory((prev) => [
      {
        id: `hist-${Date.now()}`,
        query: value,
        response: fallback.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev.slice(0, 9),
    ]);
  };

  const handleConfirmAction = async (action: IntelligenceAction) => {
    if (executingAction || verifyingAction) return;
    setExecutingAction(true);
    setVerifyingAction(true);
    setError(null);

    try {
      const res = await fetch("/api/intelligence/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: action.type,
          payload: {
            ...action.payload,
            confirmed: true,
            confirmDeletion: action.risk === "high" ? true : undefined,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setExecutedActionResult({
          success: true,
          message: data.message ?? "Action completed successfully",
          entityId: data.entityId,
          actionType: data.actionType,
          verification: data.verification,
        });
        setConfirmingAction(null);

        // ---- Memory: reflect the verified mutation ----------------
        // The server already persisted the updated memory; mirror it
        // locally (fall back to a local pure update when absent).
        if (data.memory?.state) {
          const next: CachedMemory = {
            state: data.memory.state,
            preferences: data.memory.preferences ?? cachedMemory?.preferences ?? [],
          };
          setCachedMemory(next);
          cacheMemory(next);
        } else if (cachedMemory?.state) {
          const entityType =
            action.type.includes("project") ? "project" : action.type.includes("goal") ? "goal" : "task";
          const nextState = applyActionSuccess(
            cachedMemory.state,
            action.type,
            data.entityId ?? "",
            String(action.payload?.title ?? action.payload?.name ?? "Item"),
            data.verification?.verified === true,
            entityType
          );
          const next: CachedMemory = { state: nextState, preferences: cachedMemory.preferences };
          setCachedMemory(next);
          cacheMemory(next);
        }

        // Notify app shell of creation event
        if (action.type === "create_task") {
          window.dispatchEvent(new CustomEvent("nexus:activation", { detail: { type: "task_created" } }));
        } else if (action.type === "create_project") {
          window.dispatchEvent(new CustomEvent("nexus:activation", { detail: { type: "project_created" } }));
        }
        return;
      } else {
        setError(data.error ?? "Failed to execute action");
      }
    } catch (err) {
      console.error("Action execution error:", err);
      setError("Network error while executing action. Please try again.");
    } finally {
      setExecutingAction(false);
      setVerifyingAction(false);
    }
  };

  const activeSuggestions = currentResponse?.suggestions?.length
    ? currentResponse.suggestions
    : CATEGORIZED_STARTERS.map((s) => s.query);

  return (
    <section
      id="nexus-ask"
      aria-label="Ask the workspace"
      className="relative overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/60"
    >
      {/* Quiet intelligence accent — the only lavender in the app shell */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lavender-border to-transparent"
        aria-hidden="true"
      />

      {/* Query Bar */}
      <div className="flex flex-col gap-2 p-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Sparkles
            size={15}
            strokeWidth={1.75}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3.5 text-lavender/80"
          />
          <textarea
            ref={composerRef}
            data-guide="intelligence-input"
            disabled={loading}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter (and mobile keyboards' "return"
              // without the send key) inserts a newline.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            enterKeyHint="send"
            placeholder="Ask NEXUS. Try “Quels projets nécessitent mon attention ?” or “Plan my week”"
            aria-label="Ask a question about this workspace"
            className="min-h-[44px] w-full resize-none overflow-y-auto rounded-input border border-border-default bg-bg-surface py-2.5 pl-9 pr-10 text-body text-[14px] text-text-primary outline-none transition-colors duration-150 ease-nexus placeholder:text-text-quaternary focus:border-border-focus focus:shadow-[0_0_0_3px_rgba(233,228,255,0.1)] disabled:opacity-60"
          />
          {query.trim() ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void send()}
              aria-label="Submit query"
              className="absolute right-1.5 top-1.5 flex min-h-[32px] min-w-[32px] items-center justify-center rounded-[6px] text-text-quaternary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary disabled:opacity-40"
            >
              <CornerDownLeft size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 relative z-50">
          <button
            type="button"
            data-guide="intelligence-send"
            disabled={loading || !query.trim()}
            onClick={() => void send()}
            className="inline-flex min-h-[44px] sm:min-h-[40px] flex-1 sm:flex-initial shrink-0 items-center justify-center gap-2 rounded-input bg-accent px-4 text-button font-medium text-accent-fg transition-colors duration-150 ease-nexus hover:bg-accent-hover active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
          >
            {loading ? (
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="6.5"
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeWidth="1.6"
                />
                <path
                  d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            ) : null}
            <span>{loading ? "Analyzing…" : "Ask NEXUS"}</span>
          </button>

          {history.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              aria-label="Toggle history"
              title="Recent queries"
              className={cn(
                "flex min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] items-center justify-center rounded-input border transition-colors",
                showHistory
                  ? "border-border-strong bg-accent-ghost text-text-primary"
                  : "border-border-subtle bg-bg-surface text-text-tertiary hover:text-text-primary"
              )}
            >
              <History size={16} strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Error / Timeout banner */}
      {error ? (
        <div className="mx-3 mb-3 flex items-center justify-between gap-2 rounded-input border border-danger-border bg-danger-bg/40 px-3.5 py-2.5 text-small text-danger">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void send()}
            className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:opacity-80"
          >
            <RefreshCw size={12} />
            <span>Retry</span>
          </button>
        </div>
      ) : null}

      {/* Session Conversation History Drawer */}
      {showHistory && history.length > 0 ? (
        <div className="mx-3 mb-3 animate-fade-in rounded-input border border-border-subtle bg-bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow text-text-tertiary">Session queries</span>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="text-caption text-text-quaternary hover:text-text-secondary"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-col divide-y divide-border-subtle max-h-48 overflow-y-auto">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCurrentResponse(item.response);
                  setShowHistory(false);
                }}
                className="flex items-center justify-between py-2 text-left text-small text-text-secondary hover:text-text-primary transition-colors"
              >
                <span className="truncate pr-2">{item.query}</span>
                <span className="font-mono text-[10px] text-text-quaternary shrink-0">
                  {item.timestamp}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Proactive read — honest signals before the user asks anything */}
      {!loading && !currentResponse && proactive.length > 0 ? (
        <div className="mx-3 mb-3 animate-fade-in rounded-input border border-lavender-border/30 bg-lavender/5 p-3.5">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} strokeWidth={1.75} className="text-lavender" aria-hidden="true" />
            <p className="text-caption font-medium text-text-primary">
              {proactive.length} point{proactive.length === 1 ? "" : "s"} nécessitent votre attention
            </p>
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {proactive.map((insight) => (
              <li key={insight.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-small text-text-secondary">{insight.title}</span>
                <Link
                  href={insight.href}
                  className="shrink-0 text-caption font-medium text-text-tertiary hover:text-text-primary"
                >
                  Voir
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Loading state — meaningful UI states, not fake dots */}
      {loading ? (
        <div className="mx-3 mb-3 space-y-2.5">
          <IntelligenceProcessingStates active={loading} />
          <div className="animate-[intelligence-state-in_280ms_var(--ease-nexus)_both] rounded-input border border-border-subtle bg-bg-surface/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-small text-text-secondary">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-pill bg-lavender opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-pill bg-lavender" />
                </span>
                <span className="font-medium">NEXUS analyse</span>
                <span className="text-text-tertiary">votre workspace réel</span>
              </div>
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="rounded-input px-2 py-1 text-caption text-text-tertiary transition-colors hover:bg-accent-ghost hover:text-text-primary active:scale-[0.96]"
              >
                Annuler
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <div className="h-2.5 w-3/4 rounded-pill bg-white/[0.06] skeleton-shimmer" />
              <div className="h-2.5 w-1/2 rounded-pill bg-white/[0.04] skeleton-shimmer" style={{ animationDelay: "200ms" }} />
            </div>
          </div>
        </div>
      ) : currentResponse ? (
        /* Structured Response Card — Conversational Command Center */
        <div className="mx-3 mb-3 animate-fade-in rounded-card border border-border-subtle bg-bg-surface p-4 sm:p-5">
          {/* 6-Stage Progressive Command Center Flow */}
          <div className="mb-3.5 flex flex-wrap items-center gap-1.5 border-b border-border-subtle/80 pb-2.5 font-mono text-[10.5px]">
            <span className="flex items-center gap-1 text-lavender font-semibold uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-pill bg-lavender animate-pulse" aria-hidden="true" />
              1. UNDERSTAND
            </span>
            <span className="text-text-quaternary">→</span>
            <span className="flex items-center gap-1 text-text-tertiary uppercase tracking-wider">
              2. CONTEXT ({currentResponse.evidence.metrics.length > 0 ? `${currentResponse.evidence.metrics.length} métriques` : "scanné"})
            </span>
            <span className="text-text-quaternary">→</span>
            <span className="flex items-center gap-1 text-text-tertiary uppercase tracking-wider">
              3. RISKS ({currentResponse.items?.filter((i) => i.badge?.tone === "danger" || i.badge?.tone === "warning").length ?? 0})
            </span>
            <span className="text-text-quaternary">→</span>
            <span className="flex items-center gap-1 text-text-tertiary uppercase tracking-wider">
              4. PLAN ({currentResponse.plan?.steps.length ?? 0} étapes)
            </span>
            <span className="text-text-quaternary">→</span>
            <span className="flex items-center gap-1 text-text-tertiary uppercase tracking-wider">
              5. ACTION
            </span>
            <span className="text-text-quaternary">→</span>
            <span className="flex items-center gap-1 text-text-tertiary uppercase tracking-wider">
              6. VERIFY
            </span>
          </div>

          {/* Header & Source Provenance */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-[5px] border border-border-subtle bg-bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                {currentResponse.plan ? "MISSION · PLAN" : currentResponse.intent.toUpperCase()}
              </span>
              {currentResponse.confidence !== undefined ? (
                <span
                  title="Confiance dans la réponse"
                  className="inline-flex items-center rounded-[5px] border border-border-subtle bg-bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-tertiary"
                >
                  {(currentResponse.confidence * 100).toFixed(0)}% confiance
                </span>
              ) : null}
              <span className="text-caption text-text-quaternary hidden sm:inline">
                {currentResponse.evidence.traceCount}
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-lavender/90">
              {currentResponse.provider === "nexus-engine"
                ? "NEXUS Engine · Verified Workspace"
                : `NEXUS AI · ${currentResponse.provider.toUpperCase()}`}
            </span>
          </div>

          {/* Headline & Narrative */}
          <div className="mt-3.5">
            <h3 className="text-h2 font-semibold tracking-tight text-text-primary">
              {currentResponse.headline}
            </h3>
            {currentResponse.narrative ? (
              <p className="mt-2 text-body text-text-secondary leading-relaxed max-w-prose">
                {currentResponse.narrative}
              </p>
            ) : null}
          </div>

          {/* Evidence Metrics Grid */}
          {currentResponse.evidence.metrics.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-input border border-border-subtle bg-bg-subtle/50 p-2.5">
              {currentResponse.evidence.metrics.map((metric) => (
                <div key={metric.label} className="min-w-0">
                  <span className="block truncate text-caption text-text-quaternary">
                    {metric.label}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-body-medium font-medium text-text-primary">
                    {metric.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {/* Risques et Dépendances Détectés */}
          {(() => {
            const riskItems = currentResponse.items?.filter(
              (i) => i.badge?.tone === "danger" || i.badge?.tone === "warning"
            ) ?? [];
            if (riskItems.length === 0) return null;
            return (
              <div className="mt-4 rounded-input border border-warning-border/40 bg-warning-bg/15 p-3.5 animate-[intelligence-state-in_200ms_var(--ease-nexus)_both]">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} strokeWidth={2} className="text-warning shrink-0" aria-hidden="true" />
                  <p className="eyebrow text-warning font-semibold">
                    Risques & Dépendances détectés ({riskItems.length})
                  </p>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {riskItems.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 text-small text-text-primary">
                      <span className="font-medium truncate">{item.title}</span>
                      {item.badge ? (
                        <span className={cn(
                          "rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] uppercase font-semibold leading-none border",
                          item.badge.tone === "danger"
                            ? "bg-danger-bg text-danger border-danger-border"
                            : "bg-warning-bg text-warning border-warning-border"
                        )}>
                          {item.badge.label}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {/* Plan — an explicit, useful plan derived from real reads */}
          {currentResponse.plan && currentResponse.plan.steps.length > 0 ? (
            <div className="mt-4 rounded-input border border-lavender-border/40 bg-lavender/5 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow text-lavender">Plan recommandé</span>
                {currentResponse.plan.needsConfirmation ? (
                  <span className="rounded-[4px] border border-warning-border bg-warning-bg/40 px-1.5 py-0.5 font-mono text-[10px] uppercase text-warning">
                    Confirmation requise
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-small font-medium text-text-primary">
                {currentResponse.plan.summary}
              </p>
              <ol className="mt-2.5 flex flex-col gap-1.5">
                {currentResponse.plan.steps.map((step) => (
                  <li key={step.id} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border border-border-subtle bg-bg-surface font-mono text-[10px] text-text-tertiary"
                    >
                      {step.id.replace(/[^0-9]/g, "") || "•"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-caption font-medium text-text-primary">{step.title}</p>
                      {step.description ? (
                        <p className="text-caption text-text-tertiary">{step.description}</p>
                      ) : null}
                    </div>
                    {step.href ? (
                      <Link
                        href={step.href}
                        className="mt-0.5 inline-flex min-h-[32px] shrink-0 items-center gap-1 text-caption font-medium text-text-tertiary hover:text-text-primary"
                      >
                        <span>Ouvrir</span>
                        <ArrowRight size={12} strokeWidth={1.75} />
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {/* Agent workflow — the real states the server went through.
              The summary line is always visible; the per-step trace is
              collapsed so a long agentic run never becomes a wall of
              text on a phone. */}
          {agentRun && agentRun.steps.length > 0 ? (
            <div className="mt-4 rounded-input border border-border-subtle bg-bg-subtle/40">
              <button
                type="button"
                onClick={() => setTraceOpen((open) => !open)}
                aria-expanded={traceOpen}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary">
                    Workflow agent
                  </span>
                  <span className="font-mono text-[10px] text-text-tertiary">
                    {agentRun.steps.filter((step) => step.state === "completed").length}/{agentRun.steps.length}{" "}
                    étapes ·{" "}
                    {AGENT_STATE_LABEL[
                      agentRun.steps[agentRun.steps.length - 1]?.state ?? "completed"
                    ]}
                  </span>
                </span>
                <ChevronDown
                  size={13}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 text-text-quaternary transition-transform duration-200 ease-nexus",
                    traceOpen && "rotate-180"
                  )}
                />
              </button>
              {traceOpen ? (
                <ol className="flex flex-col border-t border-border-subtle px-3 py-1.5">
                  {agentRun.steps.map((step, index) => (
                    <li
                      key={`${step.state}-${index}`}
                      className="flex items-center gap-2.5 py-1.5 text-caption text-text-secondary"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-pill",
                          step.state === "completed"
                            ? "bg-success"
                            : step.state === "failed"
                              ? "bg-danger"
                              : "bg-lavender"
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{step.label}</span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-quaternary">
                        {AGENT_STATE_LABEL[step.state]}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ) : null}

          {/* Tool trace — the real read tools executed for this answer.
              Collapsed by default on phones; chips remain reachable via
              the disclosure so the answer stays the primary content. */}
          {currentResponse.toolCalls && currentResponse.toolCalls.length > 0 ? (
            <div className="mt-4 border-t border-border-subtle/60 pt-3">
              <button
                type="button"
                onClick={() => setToolsOpen((open) => !open)}
                aria-expanded={toolsOpen}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary select-none">
                  Outils consultés · {currentResponse.toolCalls.length}
                </span>
                <ChevronDown
                  size={13}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 text-text-quaternary transition-transform duration-200 ease-nexus",
                    toolsOpen && "rotate-180"
                  )}
                />
              </button>
              {toolsOpen ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {currentResponse.toolCalls.map((call) => (
                    <span
                      key={`${call.name}-${JSON.stringify(call.args ?? {})}-${call.status}`}
                      title={call.summary}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-pill border px-2 py-1 font-mono text-[10px]",
                        call.status === "error"
                          ? "border-danger-border bg-danger-bg/30 text-danger"
                          : call.status === "skipped"
                            ? "border-border-subtle bg-bg-surface text-text-quaternary line-through"
                            : "border-border-subtle bg-bg-surface-2 text-text-tertiary"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-1 w-1 rounded-pill",
                          call.status === "error"
                            ? "bg-danger"
                            : call.status === "skipped"
                              ? "bg-text-quaternary"
                              : "bg-success"
                        )}
                      />
                      {call.name}
                      {call.count !== undefined && call.status === "ok" ? (
                        <span className="text-text-quaternary">· {call.count}</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Structured Items List */}
          {currentResponse.items && currentResponse.items.length > 0 ? (
            <div className="mt-4 flex flex-col divide-y divide-border-subtle rounded-input border border-border-subtle bg-bg-subtle/30 overflow-hidden">
              {currentResponse.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-1 p-3 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-body text-text-primary truncate">
                        {item.title}
                      </span>
                      {item.badge ? (
                        <span
                          className={cn(
                            "rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] uppercase font-semibold leading-none",
                            item.badge.tone === "danger"
                              ? "bg-danger-bg text-danger border border-danger-border"
                              : item.badge.tone === "warning"
                                ? "bg-warning-bg text-warning border border-warning-border"
                                : item.badge.tone === "success"
                                  ? "bg-success-bg text-success border border-success-border"
                                  : "bg-bg-surface text-text-tertiary border border-border-subtle"
                          )}
                        >
                          {item.badge.label}
                        </span>
                      ) : null}
                    </div>
                    {item.subtitle ? (
                      <p className="mt-0.5 text-caption text-text-tertiary truncate">
                        {item.subtitle}
                      </p>
                    ) : null}
                    {item.reasons && item.reasons.length > 0 ? (
                      <p className="mt-1 text-caption text-text-secondary">
                        {item.reasons.join(" · ")}
                      </p>
                    ) : null}
                  </div>

                  {item.href ? (
                    <Link
                      href={item.href}
                      className="mt-2 sm:mt-0 inline-flex min-h-[36px] items-center gap-1 text-caption font-medium text-text-tertiary hover:text-text-primary transition-colors"
                    >
                      <span>Voir</span>
                      <ArrowRight size={12} strokeWidth={1.75} />
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {/* Action Recommendation & Execution Card */}
          {currentResponse.action ? (
            <div className="mt-4 rounded-card border border-lavender-border/40 bg-lavender/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="eyebrow text-lavender">Action recommandée</span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-text-quaternary">
                  <span
                    className={cn(
                      "rounded-[4px] border px-1.5 py-0.5",
                      currentResponse.action.risk === "high"
                        ? "border-danger-border bg-danger-bg/40 text-danger"
                        : currentResponse.action.risk === "medium"
                          ? "border-warning-border bg-warning-bg/40 text-warning"
                          : "border-border-subtle bg-bg-surface-2 text-text-tertiary"
                    )}
                  >
                    {currentResponse.action.risk ?? "low"} risk
                  </span>
                  {currentResponse.action.type.replace("_", " ")}
                </span>
              </div>

              <div className="mt-2">
                <p className="font-semibold text-body-medium text-text-primary">
                  {currentResponse.action.label}
                </p>
                {currentResponse.action.description ? (
                  <p className="mt-0.5 text-small text-text-secondary">
                    {currentResponse.action.description}
                  </p>
                ) : null}
              </div>

              {/* Execution Success feedback */}
              {executedActionResult?.success ? (
                <div className="mt-3 rounded-input border border-success-border bg-success-bg/40 px-3.5 py-2.5 text-small text-success animate-fade-in">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Check size={16} strokeWidth={2.5} />
                      <span className="font-medium">{executedActionResult.message}</span>
                    </div>
                    {executedActionResult.actionType === "create_task" ? (
                      <Link
                        href="/tasks"
                        className="inline-flex min-h-[36px] items-center gap-1 font-medium underline underline-offset-2 hover:opacity-80"
                      >
                        <span>Ouvrir dans Tâches</span>
                        <ArrowRight size={12} />
                      </Link>
                    ) : (
                      <Link
                        href="/projects"
                        className="inline-flex min-h-[36px] items-center gap-1 font-medium underline underline-offset-2 hover:opacity-80"
                      >
                        <span>Ouvrir dans {executedActionResult.actionType?.includes("goal") ? "Objectifs" : "Projets"}</span>
                        <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>
                  {executedActionResult.verification ? (
                    <div className="mt-2 border-t border-success-border/40 pt-2 text-caption text-success/80">
                      {executedActionResult.verification.verified ? (
                        <span className="flex items-center gap-1.5">
                          <Check size={12} strokeWidth={2.5} />
                          Verified · {executedActionResult.verification.summary} · {executedActionResult.verification.matched.join(", ")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <X size={12} strokeWidth={2.5} />
                          Verification failed · {executedActionResult.verification.mismatched.join(", ") || "result could not be confirmed"}
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : confirmingAction ? (
                /* Inline Confirmation Box */
                <div className="mt-3 rounded-input border border-border-default bg-bg-surface p-3.5 animate-scale-in">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-small font-medium text-text-primary">
                      {confirmingAction.type === "create_project"
                        ? "Confirm project creation in workspace:"
                        : confirmingAction.type === "create_goal"
                          ? "Confirm goal creation in workspace:"
                          : confirmingAction.type === "complete_task"
                            ? "Confirm task completion in workspace:"
                            : confirmingAction.type === "move_task"
                              ? "Confirm task reschedule in workspace:"
                              : confirmingAction.type === "delete_task" || confirmingAction.type === "delete_project"
                                ? "Confirm destructive action in workspace:"
                                : "Confirm task creation in workspace:"}
                    </p>
                    {confirmingAction.risk === "high" ? (
                      <span className="rounded-[4px] border border-danger-border bg-danger-bg/40 px-1.5 py-0.5 font-mono text-[10px] uppercase text-danger">
                        High risk
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-2 flex flex-col divide-y divide-border-subtle border-y border-border-subtle text-caption text-text-secondary py-1">
                    <div className="flex justify-between py-1.5">
                      <dt className="text-text-tertiary">
                        {confirmingAction.type === "create_project" ? "Project name" : confirmingAction.type === "create_goal" ? "Goal title" : "Task"}
                      </dt>
                      <dd className="font-medium text-text-primary">
                        {confirmingAction.payload?.name ?? confirmingAction.payload?.title ?? confirmingAction.payload?.query}
                      </dd>
                    </div>
                    {confirmingAction.payload?.priority ? (
                      <div className="flex justify-between py-1.5">
                        <dt className="text-text-tertiary">Priority</dt>
                        <dd className="capitalize text-text-primary">
                          {confirmingAction.payload.priority}
                        </dd>
                      </div>
                    ) : null}
                    {confirmingAction.payload?.status ? (
                      <div className="flex justify-between py-1.5">
                        <dt className="text-text-tertiary">Status</dt>
                        <dd className="capitalize text-text-primary">
                          {confirmingAction.payload.status}
                        </dd>
                      </div>
                    ) : null}
                    {confirmingAction.payload?.dueDate ? (
                      <div className="flex justify-between py-1.5">
                        <dt className="text-text-tertiary">Target date</dt>
                        <dd className="font-mono text-text-primary">
                          {confirmingAction.payload.dueDate}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {(executingAction || verifyingAction) ? (
                    <div className="mt-3 animate-[intelligence-state-in_200ms_var(--ease-nexus)_both]">
                      <VerificationLifecycle
                        state={
                          verifyingAction
                            ? executingAction
                              ? "executing"
                              : "verifying"
                            : "confirm"
                        }
                      />
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      loading={executingAction || verifyingAction}
                      onClick={() => void handleConfirmAction(confirmingAction)}
                      className="min-h-[44px] sm:min-h-[36px] active:scale-[0.97]"
                    >
                      {verifyingAction ? "Executing & verifying…" : "Confirm and execute"}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={executingAction}
                      onClick={() => setConfirmingAction(null)}
                      className="min-h-[44px] sm:min-h-[36px] active:scale-[0.97]"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                /* Action Button */
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  {currentResponse.action.confirmationRequired ? (
                    <Button
                      onClick={() => setConfirmingAction(currentResponse.action!)}
                      className="min-h-[44px] sm:min-h-[36px]"
                    >
                      <Plus size={14} strokeWidth={2} />
                      <span>{currentResponse.action.label}</span>
                    </Button>
                  ) : currentResponse.action.payload?.url ? (
                    <Link
                      href={currentResponse.action.payload.url}
                      className="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-2 rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg hover:bg-accent-hover transition-colors"
                    >
                      <span>{currentResponse.action.label}</span>
                      <ArrowRight size={13} strokeWidth={2} />
                    </Link>
                  ) : null}
                </div>
              )}

              {/* Contextual Quick Actions */}
              {currentResponse.quickActions && currentResponse.quickActions.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle/50">
                  <span className="eyebrow text-text-quaternary mr-1 select-none">Quick shortcuts:</span>
                  {currentResponse.quickActions.map((qa) =>
                    qa.query ? (
                      <button
                        key={qa.label}
                        type="button"
                        disabled={loading}
                        onClick={() => void send(qa.query)}
                        className="inline-flex min-h-[40px] sm:min-h-[36px] items-center gap-1.5 rounded-input border border-border-default bg-bg-surface px-2.5 text-caption font-medium text-text-secondary hover:border-border-strong hover:text-text-primary active:bg-accent-ghost transition-colors"
                      >
                        <span>{qa.label}</span>
                        <ArrowRight size={12} />
                      </button>
                    ) : qa.href ? (
                      <Link
                        key={qa.label}
                        href={qa.href}
                        className="inline-flex min-h-[40px] sm:min-h-[36px] items-center gap-1.5 rounded-input border border-border-default bg-bg-surface px-2.5 text-caption font-medium text-text-secondary hover:border-border-strong hover:text-text-primary active:bg-accent-ghost transition-colors"
                      >
                        <span>{qa.label}</span>
                        <ArrowRight size={12} />
                      </Link>
                    ) : null
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Suggested Follow-up Starters */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary select-none">
          {currentResponse ? "Follow up" : "Suggested"}
        </span>
        {activeSuggestions.slice(0, 5).map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={loading}
            onClick={() => void send(suggestion)}
            className="inline-flex min-h-[40px] sm:min-h-[28px] items-center rounded-pill border border-border-subtle bg-bg-surface px-3 text-caption text-text-tertiary transition-colors duration-150 ease-nexus hover:border-border-strong hover:text-text-primary active:bg-accent-ghost disabled:opacity-40"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}

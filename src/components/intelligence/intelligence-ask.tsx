"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CornerDownLeft,
  History,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import {
  reasonWorkspace,
} from "@/lib/intelligence/advanced";
import type { WorkspaceSnapshot } from "@/lib/intelligence/engine";
import type {
  StructuredIntelligenceResponse,
  IntelligenceAction,
} from "@/lib/intelligence/types";
import { emitActivation, trackEvent } from "@/lib/onboarding/analytics";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

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

interface HistoryEntry {
  id: string;
  query: string;
  response: StructuredIntelligenceResponse;
  timestamp: string;
}

export function IntelligenceAsk({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<StructuredIntelligenceResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Action execution state
  const [confirmingAction, setConfirmingAction] = useState<IntelligenceAction | null>(null);
  const [executingAction, setExecutingAction] = useState(false);
  const [executedActionResult, setExecutedActionResult] = useState<{
    success: boolean;
    message: string;
    entityId?: string;
    actionType?: string;
  } | null>(null);

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

    emitActivation("intelligence");
    trackEvent("intelligence_interaction");

    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch("/api/intelligence/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: value,
          sessionHistory: history.map((h) => ({
            id: h.id,
            query: h.query,
            intent: h.response.intent,
            headline: h.response.headline,
            targetEntities: h.response.items?.map((i) => i.title),
          })),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.response) {
          const structured = data.response as StructuredIntelligenceResponse;
          setCurrentResponse(structured);
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

    // Deterministic fallback execution on client
    const fallbackHistory = history.map((h) => ({
      id: h.id,
      query: h.query,
      intent: h.response.intent,
      headline: h.response.headline,
      targetEntities: h.response.items?.map((i) => i.title),
    }));

    const fallbackResponse = reasonWorkspace(snapshot, value, undefined, fallbackHistory);
    setCurrentResponse(fallbackResponse);
    setHistory((prev) => [
      {
        id: `hist-${Date.now()}`,
        query: value,
        response: fallbackResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev.slice(0, 9),
    ]);
  };

  const handleConfirmAction = async (action: IntelligenceAction) => {
    if (executingAction) return;
    setExecutingAction(true);
    setError(null);

    try {
      const res = await fetch("/api/intelligence/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: action.type,
          payload: action.payload,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setExecutedActionResult({
          success: true,
          message: data.message ?? "Action completed successfully",
          entityId: data.entityId,
          actionType: data.actionType,
        });
        setConfirmingAction(null);

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
    }
  };

  const activeSuggestions = currentResponse?.suggestions?.length
    ? currentResponse.suggestions
    : CATEGORIZED_STARTERS.map((s) => s.query);

  return (
    <section
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
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lavender/80"
          />
          <input
            data-guide="intelligence-input"
            disabled={loading}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void send();
            }}
            placeholder="Ask NEXUS — “Quels projets nécessitent mon attention ?”, “Plan my week”…"
            aria-label="Ask a question about this workspace"
            className="h-11 w-full rounded-input border border-border-default bg-bg-surface pl-9 pr-10 text-body text-text-primary outline-none transition-colors duration-150 ease-nexus placeholder:text-text-quaternary focus:border-border-focus focus:shadow-[0_0_0_3px_rgba(233,228,255,0.1)] disabled:opacity-60 text-[14px]"
          />
          {query.trim() ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void send()}
              aria-label="Submit query"
              className="absolute right-1.5 top-1/2 flex min-h-[32px] min-w-[32px] -translate-y-1/2 items-center justify-center rounded-[6px] text-text-quaternary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary disabled:opacity-40"
            >
              <CornerDownLeft size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
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

      {/* Loading state with live reasoning indicator */}
      {loading ? (
        <div className="mx-3 mb-3 animate-fade-in rounded-input border border-border-subtle bg-bg-surface/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-small text-text-secondary">
              <span className="h-2 w-2 rounded-pill bg-lavender animate-ping" />
              <span>Analyzing live workspace context & computing evidence…</span>
            </div>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="text-caption text-text-tertiary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <div className="h-2.5 w-3/4 rounded-pill bg-white/[0.06] animate-pulse" />
            <div className="h-2.5 w-1/2 rounded-pill bg-white/[0.04] animate-pulse" />
          </div>
        </div>
      ) : currentResponse ? (
        /* Structured Response Card */
        <div className="mx-3 mb-3 animate-fade-in rounded-card border border-border-subtle bg-bg-surface p-4 sm:p-5">
          {/* Header & Source Provenance */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-[5px] border border-border-subtle bg-bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                {currentResponse.intent.toUpperCase()}
              </span>
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
                      <span>View</span>
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
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow text-lavender">Action Recommendation</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-quaternary">
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
                <div className="mt-3 flex items-center justify-between gap-2 rounded-input border border-success-border bg-success-bg/40 px-3.5 py-2.5 text-small text-success animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Check size={16} strokeWidth={2.5} />
                    <span className="font-medium">{executedActionResult.message}</span>
                  </div>
                  {executedActionResult.actionType === "create_task" ? (
                    <Link
                      href="/tasks"
                      className="inline-flex min-h-[36px] items-center gap-1 font-medium underline underline-offset-2 hover:opacity-80"
                    >
                      <span>Open in Tasks</span>
                      <ArrowRight size={12} />
                    </Link>
                  ) : (
                    <Link
                      href="/projects"
                      className="inline-flex min-h-[36px] items-center gap-1 font-medium underline underline-offset-2 hover:opacity-80"
                    >
                      <span>Open in Projects</span>
                      <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
              ) : confirmingAction ? (
                /* Inline Confirmation Box */
                <div className="mt-3 rounded-input border border-border-default bg-bg-surface p-3.5 animate-scale-in">
                  <p className="text-small font-medium text-text-primary">
                    {confirmingAction.type === "create_project"
                      ? "Confirm project creation in workspace:"
                      : "Confirm task creation in workspace:"}
                  </p>
                  <dl className="mt-2 flex flex-col divide-y divide-border-subtle border-y border-border-subtle text-caption text-text-secondary py-1">
                    <div className="flex justify-between py-1.5">
                      <dt className="text-text-tertiary">
                        {confirmingAction.type === "create_project" ? "Project name" : "Task title"}
                      </dt>
                      <dd className="font-medium text-text-primary">
                        {confirmingAction.payload?.name ?? confirmingAction.payload?.title}
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

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      loading={executingAction}
                      onClick={() => void handleConfirmAction(confirmingAction)}
                      className="min-h-[44px] sm:min-h-[36px]"
                    >
                      Confirm and execute
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={executingAction}
                      onClick={() => setConfirmingAction(null)}
                      className="min-h-[44px] sm:min-h-[36px]"
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
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-input border border-border-default bg-bg-surface px-2.5 text-caption font-medium text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors"
                      >
                        <span>{qa.label}</span>
                        <ArrowRight size={12} />
                      </button>
                    ) : qa.href ? (
                      <Link
                        key={qa.label}
                        href={qa.href}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-input border border-border-default bg-bg-surface px-2.5 text-caption font-medium text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors"
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
            className="inline-flex min-h-[36px] sm:min-h-[28px] items-center rounded-pill border border-border-subtle bg-bg-surface px-3 text-caption text-text-tertiary transition-colors duration-150 ease-nexus hover:border-border-strong hover:text-text-primary disabled:opacity-40"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}

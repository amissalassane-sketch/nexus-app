"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CornerDownLeft, Plus, Sparkles } from "lucide-react";
import {
  askWorkspace,
  type AskAnswer,
} from "@/lib/intelligence/advanced";
import type { WorkspaceSnapshot } from "@/lib/intelligence/engine";
import { emitActivation, trackEvent } from "@/lib/onboarding/analytics";

// ============================================================
// NEXUS INTELLIGENCE — ASK THE WORKSPACE
//
// Structured query console connected to the NEXUS AI API and the
// deterministic context engine. Answers are computed from live
// workspace entities — never hallucinated, never a generic chat.
// ============================================================

const STARTERS = [
  "Quels projets nécessitent mon attention ?",
  "Quelles sont mes 3 prochaines tâches prioritaires ?",
  "Quels projets semblent bloqués ?",
  "Résume l'activité de cette semaine.",
  "Aide-moi à organiser cette semaine.",
  "What is blocked?",
  "What should I do next?",
];

export function IntelligenceAsk({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [loading, setLoading] = useState(false);

  const suggestions = useMemo(
    () => (answer ? answer.suggestions : STARTERS).slice(0, 4),
    [answer]
  );

  const send = async (text?: string) => {
    const value = (text ?? query).trim();
    if (!value || loading) return;

    setQuery(value);
    setLoading(true);
    emitActivation("intelligence");
    trackEvent("intelligence_interaction");

    try {
      const response = await fetch("/api/intelligence/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: value }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.answer) {
          setAnswer(data.answer);
          return;
        }
      }
    } catch {
      // Offline or network error: fallback to client-side deterministic reasoning
    } finally {
      setLoading(false);
    }

    // Deterministic fallback
    setAnswer(askWorkspace(snapshot, value));
  };

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

      <div className="flex flex-col gap-2 p-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Sparkles
            size={14}
            strokeWidth={1.75}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lavender/70"
          />
          <input
            data-guide="intelligence-input"
            disabled={loading}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void send();
            }}
            placeholder="Ask NEXUS — “Quels projets nécessitent mon attention ?”, “What should I do next?”…"
            aria-label="Ask a question about this workspace"
            className="h-10 w-full rounded-input border border-border-default bg-bg-surface pl-9 pr-9 text-body text-text-primary outline-none transition-colors duration-150 ease-nexus placeholder:text-text-quaternary focus:border-border-focus focus:shadow-[0_0_0_3px_rgba(233,228,255,0.1)] disabled:opacity-60"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void send()}
            aria-label="Ask"
            className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-[6px] text-text-quaternary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary disabled:opacity-40"
          >
            <CornerDownLeft size={13} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          data-guide="intelligence-send"
          disabled={loading}
          onClick={() => void send()}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-input bg-accent px-4 text-button font-medium text-accent-fg transition-colors duration-150 ease-nexus hover:bg-accent-hover active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
        >
          {loading ? (
            <svg
              className="h-3.5 w-3.5 animate-spin"
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
      </div>

      {loading ? (
        <div className="mx-3 mb-3 animate-fade-in rounded-input border border-border-subtle bg-bg-surface/50 p-4">
          <div className="flex items-center gap-2 text-small text-text-secondary">
            <span className="h-2 w-2 rounded-pill bg-lavender animate-ping" />
            <span>Analyzing workspace context & computing real signals…</span>
          </div>
        </div>
      ) : answer ? (
        <div className="mx-3 mb-3 animate-fade-in rounded-input border border-border-subtle bg-bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-body-medium font-medium text-text-primary">{answer.title}</p>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-lavender/90">
              {answer.evidenceNote ?? "computed from this workspace"}
            </span>
          </div>

          {answer.lines.length > 0 ? (
            <dl className="mt-3 flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
              {answer.lines.map((line) => (
                <div
                  key={`${line.label}-${line.value}`}
                  className="flex items-baseline justify-between gap-4 py-2"
                >
                  <dt className="shrink-0 text-caption text-text-tertiary">
                    {line.label}
                  </dt>
                  <dd className="min-w-0 text-right text-small text-text-primary">
                    {line.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {/* Action Proposal Card */}
          {answer.actionProposal ? (
            <div className="mt-3.5 flex flex-col gap-3 rounded-card border border-lavender-border/50 bg-lavender/5 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <span className="eyebrow text-lavender">Recommended Action</span>
                <p className="mt-0.5 text-body-medium font-medium text-text-primary truncate">
                  {answer.actionProposal.title}
                </p>
                <p className="text-caption text-text-tertiary">
                  Priority: {answer.actionProposal.priority ?? "High"}
                  {answer.actionProposal.dueDate ? ` · Due: ${answer.actionProposal.dueDate}` : ""}
                </p>
              </div>
              <Link
                href={`/tasks?create=1&title=${encodeURIComponent(answer.actionProposal.title)}${answer.actionProposal.dueDate ? `&due_at=${answer.actionProposal.dueDate}` : ""}`}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-input bg-accent px-3 text-caption font-medium text-accent-fg hover:bg-accent-hover transition-colors"
              >
                <Plus size={13} strokeWidth={2} />
                <span>{answer.actionProposal.actionLabel}</span>
              </Link>
            </div>
          ) : null}

          {answer.links.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {answer.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex h-8 items-center gap-1.5 rounded-input border border-border-default bg-bg-subtle px-3 text-caption text-text-secondary transition-colors duration-150 ease-nexus hover:border-border-strong hover:text-text-primary"
                >
                  {link.label}
                  <ArrowRight size={12} strokeWidth={1.75} aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary">
          {answer ? "Follow up" : "Try"}
        </span>
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={loading}
            onClick={() => void send(suggestion)}
            className="inline-flex h-7 items-center rounded-pill border border-border-subtle bg-bg-surface px-2.5 text-caption text-text-tertiary transition-colors duration-150 ease-nexus hover:border-border-strong hover:text-text-primary disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CornerDownLeft, Sparkles } from "lucide-react";
import {
  askWorkspace,
  type AskAnswer,
} from "@/lib/intelligence/advanced";
import type { WorkspaceSnapshot } from "@/lib/intelligence/engine";
import { emitActivation, trackEvent } from "@/lib/onboarding/analytics";

// ============================================================
// NEXUS INTELLIGENCE — ASK THE WORKSPACE
//
// A question console over the deterministic engine. Answers are
// computed from the snapshot — never invented, never a chat
// completion. Every answer carries its fact rows, deep links into
// the exact view that proves it, and follow-up questions.
// ============================================================

const STARTERS = [
  "What is blocked?",
  "What is overdue?",
  "What should I do next?",
  "How is the workspace?",
  "What moved this week?",
];

export function IntelligenceAsk({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);

  const suggestions = useMemo(
    () => (answer ? answer.suggestions : STARTERS).slice(0, 4),
    [answer]
  );

  const send = (text?: string) => {
    const value = (text ?? query).trim();
    if (!value) return;
    setQuery(value);
    emitActivation("intelligence");
    trackEvent("intelligence_interaction");
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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") send();
            }}
            placeholder="Ask the workspace — “what is blocked?”, “what should I do next?”…"
            aria-label="Ask a question about this workspace"
            className="h-10 w-full rounded-input border border-border-default bg-bg-surface pl-9 pr-9 text-body text-text-primary outline-none transition-colors duration-150 ease-nexus placeholder:text-text-quaternary focus:border-border-focus focus:shadow-[0_0_0_3px_rgba(233,228,255,0.1)]"
          />
          <button
            type="button"
            onClick={() => send()}
            aria-label="Ask"
            className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-[6px] text-text-quaternary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
          >
            <CornerDownLeft size={13} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          data-guide="intelligence-send"
          onClick={() => send()}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg transition-colors duration-150 ease-nexus hover:bg-accent-hover"
        >
          Ask NEXUS
        </button>
      </div>

      {answer ? (
        <div className="mx-3 mb-3 animate-fade-in rounded-input border border-border-subtle bg-bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-body-medium text-text-primary">{answer.title}</p>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary">
              computed from this workspace
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
                  <dd className="min-w-0 truncate text-right text-small text-text-primary">
                    {line.value}
                  </dd>
                </div>
              ))}
            </dl>
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
            onClick={() => send(suggestion)}
            className="inline-flex h-7 items-center rounded-pill border border-border-subtle bg-bg-surface px-2.5 text-caption text-text-tertiary transition-colors duration-150 ease-nexus hover:border-border-strong hover:text-text-primary"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBan,
  IconCheck,
  IconLoader2,
  IconRadar,
  IconShieldCheck,
  IconSparkles,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { Progress } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import {
  SHOWCASE_SIGNALS,
  SHOWCASE_NEXT_BEST_ACTION,
  SHOWCASE_MISSION,
  SHOWCASE_AI_ASK,
} from "@/lib/showcase/mock-data";

export function IntelligenceShowcaseView() {
  const [askQuery, setAskQuery] = useState(SHOWCASE_AI_ASK.query);
  const [selectedSignal, setSelectedSignal] = useState(SHOWCASE_SIGNALS[0].id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-[6px] border border-lavender/30 bg-lavender/10 text-lavender">
              <NexusIcon icon={IconRadar} className="size-3.5" />
            </span>
            <h1 className="text-[22px] font-semibold text-text-primary">
              NEXUS Intelligence
            </h1>
          </div>
          <p className="text-[13px] text-text-secondary mt-1">
            Proactive signals, automated dependency reasoning &amp; autonomous missions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-bg-surface px-3 py-1 text-[11px] font-mono text-text-secondary">
            <span className="size-1.5 rounded-full bg-lavender animate-pulse" aria-hidden="true" />
            Deterministic graph scan · 100% auditable
          </span>
        </div>
      </header>

      {/* Hero: Next Best Action Card */}
      <section aria-label="Next best action">
        <div className="relative overflow-hidden rounded-panel border border-lavender/30 bg-gradient-to-br from-[#171719] via-[#141416] to-[#101012] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          {/* Subtle glow edge */}
          <div className="pointer-events-none absolute right-0 top-0 -mr-16 -mt-16 size-48 rounded-full bg-lavender/5 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="flex h-5 items-center gap-1.5 rounded-full bg-lavender/15 px-2 text-[10.5px] font-semibold uppercase tracking-wider text-lavender">
                  <NexusIcon icon={IconSparkles} className="size-3" />
                  Next Best Action
                </span>
                <span className="text-[11px] font-mono text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                  {SHOWCASE_NEXT_BEST_ACTION.impactScore}
                </span>
              </div>

              <h2 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.02em] text-text-primary">
                {SHOWCASE_NEXT_BEST_ACTION.title}
              </h2>

              <p className="text-[13.5px] leading-relaxed text-text-secondary">
                {SHOWCASE_NEXT_BEST_ACTION.rationale}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-caption text-text-tertiary">
                <span className="flex items-center gap-1.5 font-mono">
                  <NexusIcon icon={IconShieldCheck} className="size-3.5 text-lavender" />
                  Target: Q4 Launch milestone
                </span>
                <span>·</span>
                <span className="font-mono text-text-secondary">
                  Confidence: 98%
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-pill bg-white px-5 text-[13px] font-semibold text-black shadow-sm transition-all hover:bg-[#E8E8E8] active:scale-[0.99]"
              >
                <span>{SHOWCASE_NEXT_BEST_ACTION.actionLabel}</span>
                <NexusIcon icon={IconArrowRight} className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid: Proactive Signals (Left) + Mission & Ask (Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Proactive Signals Panel (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          <Panel
            eyebrow="PROACTIVE INTELLIGENCE"
            title="Active signals &amp; anomalies"
            description="Detected risks, blockers and optimization opportunities"
          >
            <div className="space-y-3 pt-2">
              {SHOWCASE_SIGNALS.map((signal) => {
                const isSelected = signal.id === selectedSignal;
                const tone =
                  signal.type === "risk"
                    ? "danger"
                    : signal.type === "blocker"
                    ? "warning"
                    : "accent";

                return (
                  <div
                    key={signal.id}
                    onClick={() => setSelectedSignal(signal.id)}
                    className={cn(
                      "cursor-pointer rounded-card border p-4 transition-all duration-150",
                      isSelected
                        ? "border-border-strong bg-[#1A1A1A] shadow-sm"
                        : "border-border-subtle bg-bg-subtle/60 hover:border-border-default hover:bg-bg-subtle"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[7px] border",
                            signal.type === "risk"
                              ? "border-danger/30 bg-danger/10 text-danger"
                              : signal.type === "blocker"
                              ? "border-warning/30 bg-warning/10 text-warning"
                              : "border-lavender/30 bg-lavender/10 text-lavender"
                          )}
                        >
                          <NexusIcon
                            icon={
                              signal.type === "risk"
                                ? IconAlertTriangle
                                : signal.type === "blocker"
                                ? IconBan
                                : IconSparkles
                            }
                            className="size-3.5"
                          />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge
                              tone={
                                tone === "danger"
                                  ? "danger"
                                  : tone === "warning"
                                  ? "warning"
                                  : "lavender"
                              }
                            >
                              {signal.type.toUpperCase()}
                            </Badge>
                            <span className="text-[14px] font-medium text-text-primary">
                              {signal.headline}
                            </span>
                          </div>
                          <p className="mt-1 text-small text-text-secondary leading-relaxed">
                            {signal.summary}
                          </p>

                          {/* Evidence Pills */}
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {signal.evidence.map((ev, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded-[4px] border border-border-subtle bg-bg-surface px-2 py-0.5 font-mono text-[10.5px] text-text-tertiary"
                              >
                                {ev}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Explainable Intelligence Rationale Box */}
          <div className="rounded-card border border-border-default bg-bg-surface p-5">
            <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
              <NexusIcon icon={IconShieldCheck} className="size-4 text-lavender" />
              <h3 className="text-[14px] font-semibold text-text-primary">
                Explainable Reasoning Model
              </h3>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">
              NEXUS Intelligence uses deterministic graph traversal across your tasks, projects and goals. Every recommendation maps 1:1 to measurable data points in your workspace. Zero hallucination, zero black-box decisions.
            </p>
          </div>
        </div>

        {/* Right Column: Autonomous Mission + Ask AI Console (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Active Mission Panel */}
          <Panel
            eyebrow="AUTONOMOUS AGENT"
            title={SHOWCASE_MISSION.title}
            description={SHOWCASE_MISSION.objective}
            actions={
              <Badge tone="lavender" className="font-mono">
                RUNNING · 50%
              </Badge>
            }
          >
            <div className="space-y-4 pt-2">
              <Progress value={SHOWCASE_MISSION.progress} />

              <ol className="relative space-y-3 pl-6 border-l border-border-default mt-4">
                {SHOWCASE_MISSION.steps.map((step, idx) => {
                  const isDone = step.status === "completed";
                  const isCurrent = step.status === "in_progress";

                  return (
                    <li key={step.id} className="relative">
                      {/* Step Marker Dot */}
                      <span
                        className={cn(
                          "absolute -left-[31px] top-1 flex size-4 items-center justify-center rounded-full border bg-bg-base",
                          isDone
                            ? "border-success bg-success/20 text-success"
                            : isCurrent
                            ? "border-lavender bg-lavender/30 text-lavender animate-pulse"
                            : "border-border-default text-text-quaternary"
                        )}
                      >
                        {isDone ? (
                          <NexusIcon icon={IconCheck} className="size-2.5" />
                        ) : isCurrent ? (
                          <NexusIcon icon={IconLoader2} className="size-2.5 animate-spin" />
                        ) : (
                          <span className="size-1 rounded-full bg-text-quaternary" />
                        )}
                      </span>

                      <div>
                        <div className="flex items-center justify-between">
                          <p
                            className={cn(
                              "text-[13px] font-medium",
                              isDone
                                ? "text-text-primary"
                                : isCurrent
                                ? "text-lavender font-semibold"
                                : "text-text-tertiary"
                            )}
                          >
                            {idx + 1}. {step.title}
                          </p>
                          <span className="font-mono text-[10px] text-text-quaternary">
                            {isDone ? "Done" : isCurrent ? "Active" : "Pending"}
                          </span>
                        </div>
                        <p className="text-caption text-text-secondary mt-0.5">
                          {step.detail}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </Panel>

          {/* Intelligence Ask Console */}
          <Panel
            eyebrow="CONTEXTUAL ASK"
            title="Ask NEXUS AI"
            description="Natural language queries over your live workspace graph"
          >
            <div className="space-y-3 pt-2">
              {/* Question Input */}
              <div className="relative flex items-center rounded-input border border-border-strong bg-bg-surface-2 px-3 py-2">
                <NexusIcon icon={IconSparkles} className="size-4 text-lavender shrink-0 mr-2" />
                <input
                  type="text"
                  value={askQuery}
                  onChange={(e) => setAskQuery(e.target.value)}
                  className="w-full bg-transparent text-[13px] text-text-primary outline-none"
                  placeholder="Ask anything about your workspace..."
                />
                <kbd className="shrink-0 rounded bg-bg-surface px-1.5 py-0.5 font-mono text-[9px] text-text-quaternary border border-border-subtle">
                  ↵
                </kbd>
              </div>

              {/* Response Card */}
              <div className="rounded-card border border-border-subtle bg-bg-subtle/80 p-4 space-y-3">
                <div className="flex items-center gap-2 text-caption font-mono text-lavender">
                  <span className="size-1.5 rounded-full bg-lavender" />
                  Synthesized Answer:
                </div>
                <p className="text-[13px] leading-relaxed text-text-primary">
                  The Q4 Launch is primarily at risk due to 2 blocked tasks in the infrastructure layer: <strong className="text-white">API integration</strong> and <strong className="text-white">Staging deployment verification</strong>. Resolving the API endpoint mock will unlock all 3 downstream items without slipping the October 15 milestone.
                </p>

                {/* Grounding Sources */}
                <div className="pt-2 border-t border-border-subtle">
                  <p className="eyebrow text-text-quaternary mb-1.5">Evidence &amp; Grounding Sources</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SHOWCASE_AI_ASK.sources.map((src, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-[4px] border border-border-subtle bg-bg-surface px-2 py-0.5 text-[11px] font-mono text-text-secondary"
                      >
                        <span className="size-1 rounded-full bg-text-tertiary" />
                        <span>{src.label}</span>
                        <span className="text-text-quaternary">({src.status})</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

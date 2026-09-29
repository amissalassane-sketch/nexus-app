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
import { Badge, Tag } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import {
  SHOWCASE_SIGNALS,
  SHOWCASE_NEXT_BEST_ACTION,
  SHOWCASE_MISSION,
  SHOWCASE_AI_ASK,
} from "@/lib/showcase/mock-data";

// ============================================================
// SHOWCASE 03 — AI INTELLIGENCE CORE
// ============================================================
// The reasoning console. Every surface here is the same surface as the
// rest of the product: L2 panel + hairline. Intelligence is signalled by
// *structure and one accent*, never by a gradient, a glow or a coloured
// shadow — those were removed in the design evolution pass.
//
// Layering that must survive a Figma / Butter capture:
//   hero (L2 + lavender hairline) → signals (rows) → mission → ask
// ============================================================

const SEVERITY_TONE = {
  risk: { badge: "danger" as const, icon: IconAlertTriangle, rail: "bg-danger" },
  blocker: { badge: "warning" as const, icon: IconBan, rail: "bg-warning" },
  opportunity: {
    badge: "lavender" as const,
    icon: IconSparkles,
    rail: "bg-lavender",
  },
};

export function IntelligenceShowcaseView() {
  const [askQuery, setAskQuery] = useState(SHOWCASE_AI_ASK.query);
  const [selectedSignal, setSelectedSignal] = useState(SHOWCASE_SIGNALS[0].id);

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-control border border-lavender-border bg-lavender-subtle text-lavender">
              <NexusIcon icon={IconRadar} className="size-4" />
            </span>
            <p className="eyebrow text-text-quaternary">Intelligence</p>
          </div>
          <h1 className="mt-2 text-h1 text-text-primary">
            Signals, reasoning &amp; autonomous missions
          </h1>
          <p className="mt-1 max-w-[68ch] text-small text-text-secondary">
            Every recommendation is derived from your workspace graph. Nothing
            is generated for display: each line maps to a task, a project or a
            goal you can open.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-pill border border-border-subtle bg-bg-surface px-2.5 py-1.5">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-pill bg-lavender"
          />
          <span className="mono-meta text-text-tertiary">
            graph scan · 100% auditable
          </span>
        </span>
      </header>

      {/* ---------- Next best action (canonical: surface + lavender hairline) ---------- */}
      <section aria-label="Next best action">
        <div className="flex flex-col gap-5 rounded-surface border border-lavender-border bg-bg-surface p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="lavender" icon={<NexusIcon icon={IconSparkles} className="size-3" />}>
                Next best action
              </Badge>
              <Tag tone="success">{SHOWCASE_NEXT_BEST_ACTION.impactScore}</Tag>
            </div>

            <h2 className="text-xl text-text-primary">
              {SHOWCASE_NEXT_BEST_ACTION.title}
            </h2>

            <p className="max-w-[76ch] text-small text-text-secondary">
              {SHOWCASE_NEXT_BEST_ACTION.rationale}
            </p>

            <dl className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-0.5">
              <div className="flex items-center gap-2">
                <dt className="mono-token text-text-quaternary">Target</dt>
                <dd className="mono-meta text-text-secondary">
                  Q4 Launch milestone
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="mono-token text-text-quaternary">Confidence</dt>
                <dd className="mono-meta text-text-secondary">98%</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="mono-token text-text-quaternary">Signals</dt>
                <dd className="mono-meta text-text-secondary">3</dd>
              </div>
            </dl>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            <Button variant="primary" size="lg">
              {SHOWCASE_NEXT_BEST_ACTION.actionLabel}
              <NexusIcon icon={IconArrowRight} className="size-3.5" />
            </Button>
            <Button variant="ghost" size="lg">
              Show reasoning
            </Button>
          </div>
        </div>
      </section>

      {/* ---------- Signals + mission/ask ---------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Panel
            eyebrow="Proactive intelligence"
            title="Active signals & anomalies"
            description="Risks, blockers and opportunities detected in this workspace"
            actions={<Tag tone="quiet">3 open</Tag>}
            bodyClassName="p-0"
          >
            <div className="flex flex-col">
              {SHOWCASE_SIGNALS.map((signal) => {
                const config = SEVERITY_TONE[signal.type];
                const isSelected = signal.id === selectedSignal;
                return (
                  <button
                    key={signal.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedSignal(signal.id)}
                    className={cn(
                      "group relative flex w-full flex-col gap-2 border-b border-border-subtle px-4 py-3 text-left transition-colors duration-[120ms] ease-nexus last:border-b-0",
                      isSelected
                        ? "bg-bg-surface-2"
                        : "hover:bg-accent-ghost"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute top-3 bottom-3 left-0 w-0.5 rounded-pill transition-opacity duration-[120ms]",
                        config.rail,
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />

                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={config.badge} icon={<NexusIcon icon={config.icon} className="size-3" />}>
                        {signal.type}
                      </Badge>
                      <span className="text-small font-medium text-text-primary">
                        {signal.headline}
                      </span>
                      <Tag tone="quiet" className="ml-auto">
                        {signal.severity}
                      </Tag>
                    </span>

                    <span className="text-caption text-text-secondary">
                      {signal.summary}
                    </span>

                    <span className="flex flex-wrap items-center gap-1.5">
                      {signal.evidence.map((evidence) => (
                        <Tag key={evidence} tone="quiet">
                          {evidence}
                        </Tag>
                      ))}
                      <span className="mono-meta ml-auto text-text-quaternary">
                        {signal.entityType} · {signal.entityLabel}
                      </span>
                    </span>

                    <span className="flex items-center gap-1.5 text-caption text-lavender">
                      <NexusIcon icon={IconArrowRight} className="size-3" />
                      {signal.suggestedAction}
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <div className="rounded-surface border border-border-subtle bg-bg-surface p-4">
            <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
              <NexusIcon icon={IconShieldCheck} className="size-4 text-lavender" />
              <h2 className="text-h3 text-text-primary">
                Why NEXUS says this
              </h2>
            </div>
            <p className="mt-3 text-small text-text-secondary">
              Deterministic graph traversal across tasks, projects and goals.
              Dependencies, due dates and blockers are read directly from the
              workspace, so the same inputs always produce the same
              recommendation — no sampling, no black box.
            </p>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-border-subtle pt-3 sm:grid-cols-3">
              {[
                { label: "Method", value: "dependency graph" },
                { label: "Inputs", value: "24 tasks · 6 projects" },
                { label: "Last scan", value: "2026-09-28 09:04" },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="mono-token text-text-quaternary">
                    {item.label}
                  </dt>
                  <dd className="mono-meta mt-1 text-text-secondary">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-5">
          {/* Autonomous mission */}
          <Panel
            eyebrow="Autonomous agent"
            title={SHOWCASE_MISSION.title}
            description={SHOWCASE_MISSION.objective}
            actions={<Tag tone="lavender">Running · 50%</Tag>}
          >
            <div className="mb-4 flex items-center gap-3">
              <Progress
                value={SHOWCASE_MISSION.progress}
                label="Mission progress"
                tone="lavender"
                className="flex-1"
              />
              <span className="mono-meta text-text-tertiary">
                {SHOWCASE_MISSION.progress}%
              </span>
            </div>

            <ol className="flex flex-col gap-3">
              {SHOWCASE_MISSION.steps.map((step, index) => {
                const isDone = step.status === "completed";
                const isCurrent = step.status === "in_progress";
                return (
                  <li key={step.id} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill border",
                        isDone
                          ? "border-success-border bg-success-bg text-success"
                          : isCurrent
                            ? "border-lavender-border bg-lavender-subtle text-lavender"
                            : "border-border-default text-text-quaternary"
                      )}
                    >
                      {isDone ? (
                        <NexusIcon icon={IconCheck} className="size-3" />
                      ) : isCurrent ? (
                        <NexusIcon icon={IconLoader2} className="size-3 animate-spin" />
                      ) : (
                        <span className="mono-token">{index + 1}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span
                          className={cn(
                            "truncate text-small",
                            isCurrent
                              ? "font-medium text-text-primary"
                              : isDone
                                ? "text-text-secondary"
                                : "text-text-tertiary"
                          )}
                        >
                          {step.title}
                        </span>
                        <span className="mono-token shrink-0 text-text-quaternary">
                          {isDone ? "done" : isCurrent ? "active" : "queued"}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-caption text-text-tertiary">
                        {step.detail}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Panel>

          {/* Grounded ask */}
          <Panel
            eyebrow="Contextual ask"
            title="Ask NEXUS"
            description="Questions answered from your workspace graph"
          >
            <div className="space-y-3">
              <div className="relative">
                <NexusIcon
                  icon={IconSparkles}
                  className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-lavender"
                />
                <Input
                  value={askQuery}
                  onChange={(event) => setAskQuery(event.target.value)}
                  aria-label="Ask NEXUS about this workspace"
                  className="pl-8"
                  placeholder="Ask anything about your workspace…"
                />
              </div>

              <div className="rounded-control border border-border-subtle bg-bg-subtle p-3">
                <p className="mono-token mb-2 flex items-center gap-2 text-lavender">
                  <span aria-hidden="true" className="size-1.5 rounded-pill bg-lavender" />
                  Synthesised answer
                </p>
                <p className="text-small text-text-primary">
                  {SHOWCASE_AI_ASK.answer}
                </p>

                <div className="mt-3 border-t border-border-subtle pt-3">
                  <p className="mono-token mb-2 text-text-quaternary">
                    Evidence used
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SHOWCASE_AI_ASK.sources.map((source) => (
                      <Tag key={source.label} tone="quiet">
                        {source.label} · {source.status}
                      </Tag>
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

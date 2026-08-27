"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IntelligenceAsk } from "@/components/intelligence/intelligence-ask";
import { WorkspaceHealthPanel } from "@/components/intelligence/health-panel";
import { WeeklyBriefingPanel } from "@/components/intelligence/briefing-panel";
import { PriorityFocusPanel } from "@/components/intelligence/priority-focus";
import { ForecastPanel } from "@/components/intelligence/forecast-panel";
import { ProactiveSignalsPanel } from "@/components/intelligence/proactive-signals-panel";
import { MissionPanel } from "@/components/intelligence/mission-panel";

import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/feedback";
import { SignalCard } from "@/components/intelligence/signal-card";
import { SignalDetail } from "@/components/intelligence/signal-detail";
import { IntelligenceCanvas } from "@/components/intelligence/intelligence-canvas";
import {
  forecastWorkspace,
  rankPriorities,
  weeklyBriefing,
  workspaceHealth,
} from "@/lib/intelligence/advanced";
import {
  SEVERITY_LABEL,
  type Insight,
  type InsightSeverity,
  type WorkspaceContext,
  type WorkspaceSnapshot,
} from "@/lib/intelligence/engine";

// ============================================================
// NEXUS — INTELLIGENCE VIEW
// The intelligence workspace: ask console, operating index, weekly
// briefing, focus list and forecast — all computed from the real
// snapshot by the deterministic engine — above the signal queue
// and its detail panel. Signals are computed on the server; this
// layer owns only presentation state (severity filter, selection,
// session dismissals).
// ============================================================

const FILTERS: { id: "all" | InsightSeverity; label: string }[] = [
  { id: "all", label: "All" },
  { id: "critical", label: SEVERITY_LABEL.critical },
  { id: "warning", label: SEVERITY_LABEL.warning },
  { id: "info", label: SEVERITY_LABEL.info },
  { id: "positive", label: SEVERITY_LABEL.positive },
];

export function IntelligenceView({
  insights,
  context,
  snapshot,
  workspaceId,
  autoFocusAsk = false,
  initialAskQuery = "",
}: {
  insights: Insight[];
  context: WorkspaceContext;
  snapshot: WorkspaceSnapshot;
  workspaceId: string | null;
  /** Focus the Ask console on mount (deep link ?ask=1). */
  autoFocusAsk?: boolean;
  /** Prefill the Ask composer (?q=), never auto-sent. */
  initialAskQuery?: string;
}) {
  const [filter, setFilter] = useState<"all" | InsightSeverity>("all");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The advanced layer is pure and cheap — recompute on new snapshots.
  const health = useMemo(() => workspaceHealth(snapshot), [snapshot]);
  const briefing = useMemo(() => weeklyBriefing(snapshot), [snapshot]);
  const priorities = useMemo(() => rankPriorities(snapshot), [snapshot]);
  const forecasts = useMemo(() => forecastWorkspace(snapshot), [snapshot]);

  const visible = useMemo(
    () => insights.filter((insight) => !hidden.has(insight.id)),
    [insights, hidden]
  );

  const filtered = useMemo(
    () =>
      filter === "all"
        ? visible
        : visible.filter((insight) => insight.severity === filter),
    [visible, filter]
  );

  const selected = useMemo(
    () => filtered.find((insight) => insight.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: visible.length };
    for (const insight of visible) {
      map[insight.severity] = (map[insight.severity] ?? 0) + 1;
    }
    return map;
  }, [visible]);

  const hide = (insight: Insight) => {
    setHidden((current) => new Set(current).add(insight.id));
    setSelectedId(null);
  };

  return (
    <div className="flex flex-col gap-5">
      {workspaceId ? <MissionPanel workspaceId={workspaceId} /> : null}
      {workspaceId ? <ProactiveSignalsPanel workspaceId={workspaceId} /> : null}
      <IntelligenceAsk
        snapshot={snapshot}
        autoFocus={autoFocusAsk}
        initialQuery={initialAskQuery}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <WorkspaceHealthPanel health={health} />
        <WeeklyBriefingPanel briefing={briefing} />
      </div>

      <PriorityFocusPanel priorities={priorities} />
      <ForecastPanel forecasts={forecasts} />

      <IntelligenceCanvas
        context={context}
        signalCount={visible.length}
        criticalCount={counts.critical ?? 0}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {/* Severity filter — a queue control, not decoration */}
          <div
            role="tablist"
            aria-label="Filter signals by severity"
            className="mb-3 flex flex-wrap items-center gap-1"
          >
            {FILTERS.map((entry) => {
              const count = counts[entry.id] ?? 0;
              const disabled = entry.id !== "all" && count === 0;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === entry.id}
                  disabled={disabled}
                  onClick={() => setFilter(entry.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-input border px-2.5 text-caption transition-colors duration-150 ease-nexus sm:h-7",
                    filter === entry.id
                      ? "border-border-strong bg-accent-ghost-hover text-text-primary"
                      : "border-transparent text-text-tertiary hover:bg-accent-ghost hover:text-text-secondary",
                    disabled && "cursor-not-allowed opacity-35 hover:bg-transparent"
                  )}
                >
                  {entry.label}
                  <span className="font-mono text-[10.5px] tabular-nums text-text-quaternary">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            visible.length === 0 && insights.length > 0 ? (
              <EmptyState
                title="Every signal is cleared"
                description="You have dismissed or snoozed everything NEXUS surfaced in this session. Signals are recomputed from your workspace on the next visit."
                action={
                  <button
                    type="button"
                    onClick={() => setHidden(new Set())}
                    className="inline-flex h-9 items-center rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                  >
                    Restore signals
                  </button>
                }
              />
            ) : insights.length === 0 ? (
              <EmptyState
                title="Intelligence is ready for your workspace"
                description="NEXUS watches deadlines, blocked work, drifting projects and goal progress. Create projects and tasks so NEXUS can analyze risks, spot bottlenecks and recommend priorities."
                action={
                  <div className="flex items-center gap-2">
                    <Link
                      href="/projects?create=1"
                      className="inline-flex h-9 items-center rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg transition-colors hover:bg-accent-hover"
                    >
                      Create a project
                    </Link>
                    <Link
                      href="/tasks?create=1"
                      className="inline-flex h-9 items-center rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                    >
                      Create a task
                    </Link>
                  </div>
                }
              />
            ) : (
              <EmptyState
                title={`No ${SEVERITY_LABEL[filter as InsightSeverity].toLowerCase()} signals`}
                description="Nothing at this severity right now. Switch to All to see everything NEXUS detected."
                action={
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className="inline-flex h-9 items-center rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                  >
                    Show all signals
                  </button>
                }
              />
            )
          ) : (
            <ul className="overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/70">
              {filtered.map((insight, index) => (
                <SignalCard
                  key={insight.id}
                  insight={insight}
                  index={index}
                  selected={insight.id === selectedId}
                  onOpen={(next) =>
                    setSelectedId((current) =>
                      current === next.id ? null : next.id
                    )
                  }
                />
              ))}
            </ul>
          )}
        </div>

        {/* Detail rail — sticky on desktop, an overlay panel below lg */}
        <div className="hidden lg:block">
          {selected ? (
            <SignalDetail
              insight={selected}
              onClose={() => setSelectedId(null)}
              onDismiss={hide}
              onSnooze={hide}
            />
          ) : (
            <div className="sticky top-0 rounded-card border border-dashed border-border-subtle bg-bg-subtle/40 px-5 py-6">
              <p className="eyebrow text-text-quaternary">Signal detail</p>
              <p className="mt-2.5 text-small text-text-secondary">
                Select a signal to see the evidence behind it, the work it
                affects and the recommended next step.
              </p>
              <ContextSummary context={context} />
            </div>
          )}
        </div>
      </div>

      {/* Below lg the detail becomes a full-height overlay */}
      <div className="lg:hidden">
        {selected ? (
          <SignalDetail
            insight={selected}
            onClose={() => setSelectedId(null)}
            onDismiss={hide}
            onSnooze={hide}
          />
        ) : null}
      </div>
    </div>
  );
}

/** What NEXUS currently has to work with — the honest version. */
function ContextSummary({ context }: { context: WorkspaceContext }) {
  const rows: [string, string][] = [
    ["Projects", String(context.projects)],
    ["Open tasks", String(context.openTasks)],
    ["Goals", String(context.goals)],
    ["Completion", `${context.completionRate}%`],
  ];

  return (
    <dl className="mt-5 flex flex-col divide-y divide-border-subtle border-t border-border-subtle">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 py-2">
          <dt className="text-caption text-text-tertiary">{label}</dt>
          <dd className="font-mono text-mono tabular-nums text-text-secondary">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

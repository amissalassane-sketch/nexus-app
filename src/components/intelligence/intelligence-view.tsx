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
  autoFocusAsk?: boolean;
  initialAskQuery?: string;
}) {
  const [filter, setFilter] = useState<"all" | InsightSeverity>("all");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterTransitioning, setFilterTransitioning] = useState(false);

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

  const handleFilterChange = (newFilter: "all" | InsightSeverity) => {
    if (newFilter === filter) return;
    setFilterTransitioning(true);
    setTimeout(() => {
      setFilter(newFilter);
      setFilterTransitioning(false);
    }, 100);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-[intelligence-state-in_280ms_var(--ease-nexus)_both]">
        {workspaceId ? <MissionPanel workspaceId={workspaceId} /> : null}
      </div>
      <div className="animate-[intelligence-state-in_280ms_var(--ease-nexus)_60ms_both]">
        {workspaceId ? <ProactiveSignalsPanel workspaceId={workspaceId} /> : null}
      </div>
      <div className="animate-[intelligence-state-in_280ms_var(--ease-nexus)_120ms_both]">
        <IntelligenceAsk key={workspaceId ?? "no-workspace"} snapshot={snapshot} autoFocus={autoFocusAsk} initialQuery={initialAskQuery} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-[intelligence-state-in_300ms_var(--ease-nexus)_180ms_both]">
          <WorkspaceHealthPanel health={health} />
        </div>
        <div className="animate-[intelligence-state-in_300ms_var(--ease-nexus)_240ms_both]">
          <WeeklyBriefingPanel briefing={briefing} />
        </div>
      </div>

      <div className="animate-[intelligence-state-in_300ms_var(--ease-nexus)_300ms_both]">
        <PriorityFocusPanel priorities={priorities} />
      </div>
      <div className="animate-[intelligence-state-in_300ms_var(--ease-nexus)_360ms_both]">
        <ForecastPanel forecasts={forecasts} />
      </div>

      <div className="animate-[intelligence-state-in_320ms_var(--ease-nexus)_420ms_both]">
        <IntelligenceCanvas context={context} signalCount={visible.length} criticalCount={counts.critical ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div role="tablist" aria-label="Filter signals by severity" className="mb-4 flex flex-wrap items-center gap-1">
            {FILTERS.map((entry) => {
              const count = counts[entry.id] ?? 0;
              const disabled = entry.id !== "all" && count === 0;
              const isActive = filter === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  disabled={disabled}
                  onClick={() => handleFilterChange(entry.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-input border px-2.5 text-caption transition-[background-color,border-color,color,transform] duration-[160ms] ease-nexus will-change-transform active:scale-[0.96]",
                    isActive
                      ? "border-border-strong bg-accent-ghost-hover text-text-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                      : "border-transparent text-text-tertiary hover:bg-accent-ghost hover:text-text-secondary",
                    disabled && "cursor-not-allowed opacity-35 hover:bg-transparent"
                  )}
                >
                  <span className="transition-transform duration-150 ease-nexus">{entry.label}</span>
                  <span className="font-mono text-[10.5px] tabular-nums text-text-quaternary transition-colors duration-150">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={cn("transition-opacity duration-150 ease-nexus", filterTransitioning ? "opacity-50" : "opacity-100")}>
            {filtered.length === 0 ? (
              visible.length === 0 && insights.length > 0 ? (
                <EmptyState
                  title="Every signal is cleared"
                  description="You have dismissed or snoozed everything NEXUS surfaced this session. Signals are recomputed from your workspace on the next visit."
                  action={
                    <button
                      type="button"
                      onClick={() => setHidden(new Set())}
                      className="inline-flex h-9 items-center rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-[border-color,color,transform] duration-150 ease-nexus hover:border-border-strong hover:text-text-primary active:scale-[0.97]"
                    >
                      Restore signals
                    </button>
                  }
                />
              ) : insights.length === 0 ? (
                <EmptyState
                  title="Intelligence is ready"
                  description="NEXUS reads deadlines, blocked work, project momentum and goal progress. Create a project and a task, and it starts flagging what needs you."
                  action={
                    <div className="flex items-center gap-2">
                      <Link href="/projects?create=1" className="inline-flex h-9 items-center rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg transition-[background-color,transform] duration-150 ease-nexus hover:bg-accent-hover active:scale-[0.97]">
                        Create a project
                      </Link>
                      <Link href="/tasks?create=1" className="inline-flex h-9 items-center rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-[border-color,color,transform] duration-150 ease-nexus hover:border-border-strong hover:text-text-primary active:scale-[0.97]">
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
                      onClick={() => handleFilterChange("all")}
                      className="inline-flex h-9 items-center rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-[border-color,color,transform] duration-150 ease-nexus hover:border-border-strong hover:text-text-primary active:scale-[0.97]"
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
                    onOpen={(next) => setSelectedId((current) => (current === next.id ? null : next.id))}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="hidden lg:block">
          {selected ? (
            <div className="animate-[scale-in_240ms_var(--ease-nexus)_both]">
              <SignalDetail insight={selected} onClose={() => setSelectedId(null)} onDismiss={hide} onSnooze={hide} />
            </div>
          ) : (
            <div className="sticky top-0 rounded-card border border-dashed border-border-subtle bg-bg-subtle/40 px-5 py-6 animate-[intelligence-state-in_280ms_var(--ease-nexus)_both]">
              <p className="eyebrow text-text-quaternary">Signal detail</p>
              <p className="mt-2.5 text-small text-text-secondary">Select a signal to see its evidence, the work it affects and the recommended next step.</p>
              <ContextSummary context={context} />
            </div>
          )}
        </div>
      </div>

      <div className="lg:hidden">
        {selected ? (
          <div className="animate-[sheet-in_320ms_var(--ease-nexus)_both]">
            <SignalDetail insight={selected} onClose={() => setSelectedId(null)} onDismiss={hide} onSnooze={hide} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ContextSummary({ context }: { context: WorkspaceContext }) {
  const rows: [string, string][] = [
    ["Projects", String(context.projects)],
    ["Open tasks", String(context.openTasks)],
    ["Goals", String(context.goals)],
    ["Completion", `${context.completionRate}%`],
  ];

  return (
    <dl className="mt-5 flex flex-col divide-y divide-border-subtle border-t border-border-subtle">
      {rows.map(([label, value], idx) => (
        <div key={label} className="flex items-baseline justify-between gap-3 py-2 animate-[list-in_180ms_var(--ease-nexus)_both]" style={{ animationDelay: `${idx * 40}ms` }}>
          <dt className="text-caption text-text-tertiary">{label}</dt>
          <dd className="font-mono text-mono tabular-nums text-text-secondary transition-colors duration-200">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

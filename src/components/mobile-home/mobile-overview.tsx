import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Pause,
  Sparkles,
  Target,
} from "lucide-react";
import type { Insight, WorkspaceContext } from "@/lib/intelligence/engine";
import type { IntelligenceMission } from "@/lib/intelligence/types";
import { ActivityList, type ActivityRow } from "@/components/activity-list";
import { FocusPanel, InsightRow } from "@/components/intelligence-panel";

// ============================================================
// NEXUS — MOBILE OVERVIEW (phone surface of /dashboard)
//
// One purpose: on a phone, answer — before the first scroll —
//
//   1. What needs my attention?   → top signals (real engine output)
//   2. What is the active mission? → stored mission + current step
//   3. What is the next best action? → deterministic focus insight
//   4. What just happened?         → real activity rows
//   5. Where is the intelligence?  → Ask CTA + natural starters
//
// Everything is server-rendered from the SAME reads the desktop
// overview uses (one snapshot, one activity query, one mission read).
// No client fetch, no second cache, no invented data: an absent
// mission renders an honest empty card, an empty workspace renders
// guidance — never a fake signal.
//
// Rendered below `lg` only; the desktop overview is untouched.
// ============================================================

/** The same natural starters the Ask console suggests — offered on the
 *  home as one-tap entries into the intelligence (prefill only; the
 *  user always presses send). */
const ASK_STARTERS: { label: string; query: string }[] = [
  {
    label: "Quels projets nécessitent mon attention ?",
    query: "Quels projets nécessitent mon attention ?",
  },
  {
    label: "Mes 3 prochaines tâches prioritaires",
    query: "Quelles sont mes 3 prochaines tâches prioritaires ?",
  },
  {
    label: "Organiser cette semaine",
    query: "Aide-moi à organiser cette semaine.",
  },
];

export function MobileOverview({
  insights,
  focus,
  mission,
  recentActivities,
  activitiesUnavailable,
  context,
}: {
  insights: Insight[];
  focus: Insight | null;
  mission: IntelligenceMission | null;
  recentActivities: ActivityRow[];
  activitiesUnavailable: boolean;
  context: WorkspaceContext;
}) {
  const attention = insights.slice(0, 3);
  const currentStep = mission
    ? mission.steps.find((step) => step.id === mission.currentStepId) ?? null
    : null;
  const blockedReason =
    currentStep?.status === "blocked" ? currentStep.blockedReason : null;

  return (
    <div className="flex flex-col gap-4 lg:hidden">
      {/* ------------------------------------------------ ATTENTION */}
      <section
        aria-label="Needs your attention"
        className="overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/70"
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <AlertTriangle
              size={14}
              strokeWidth={1.75}
              className={
                attention.some((insight) => insight.severity === "critical")
                  ? "shrink-0 text-danger"
                  : "shrink-0 text-text-tertiary"
              }
              aria-hidden="true"
            />
            <p className="eyebrow text-text-secondary">Attention</p>
            <span className="font-mono text-[10px] tabular-nums text-text-quaternary">
              {insights.length}
            </span>
          </div>
          <Link
            href="/app/intelligence"
            className="inline-flex min-h-[44px] items-center gap-1 pr-1 text-caption text-text-tertiary transition-colors hover:text-text-primary active:text-text-primary"
          >
            All signals
            <ArrowRight size={12} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>

        {attention.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="min-w-0">
              <p className="text-body-medium text-text-primary">
                Nothing is at risk right now.
              </p>
              <p className="text-caption text-text-tertiary">
                {context.openTasks > 0
                  ? `${context.openTasks} open tasks · nothing overdue, blocked or drifting.`
                  : "Your workspace is clear."}
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-2">
            {attention.map((insight, index) => (
              <InsightRow key={insight.id} insight={insight} index={index} />
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------ ACTIVE MISSION */}
      {mission && mission.status !== "cancelled" ? (
        <section
          aria-label="Active mission"
          className="rounded-card border border-border-subtle bg-bg-subtle/70 px-4 py-3.5"
        >
          <div className="flex items-center gap-2">
            <Target
              size={14}
              strokeWidth={1.75}
              className="shrink-0 text-accent"
              aria-hidden="true"
            />
            <p className="eyebrow text-text-secondary">Active mission</p>
            {mission.status === "blocked" ? (
              <span className="rounded-[4px] border border-warning-border bg-warning-bg/40 px-1.5 py-0.5 font-mono text-[10px] uppercase text-warning">
                Blocked
              </span>
            ) : null}
          </div>

          <p className="mt-1.5 text-body-medium font-semibold text-text-primary">
            {mission.title}
          </p>

          <div className="mt-2">
            <div className="flex items-center justify-between text-caption text-text-secondary">
              <span>Progress</span>
              <span className="font-mono tabular-nums text-text-primary">
                {mission.progress}%
              </span>
            </div>
            <div
              className="mt-1 h-2 overflow-hidden rounded-pill bg-bg-surface-2"
              role="progressbar"
              aria-valuenow={mission.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Mission progress: ${mission.title}`}
            >
              <div
                className="h-full rounded-pill bg-accent"
                style={{
                  width: `${Math.min(100, Math.max(0, mission.progress))}%`,
                }}
              />
            </div>
          </div>

          {currentStep ? (
            <div className="mt-2.5 rounded-input border border-border-default bg-bg-surface/60 p-3">
              <p className="eyebrow text-text-quaternary">Current step</p>
              <p className="mt-1 text-[13px] font-medium leading-[19px] text-text-primary">
                <span className="font-mono text-[11px] text-text-tertiary">
                  #{currentStep.order + 1}
                </span>{" "}
                {currentStep.title}
              </p>
              {blockedReason ? (
                <p className="mt-1.5 flex items-start gap-1.5 text-caption text-warning">
                  <Pause
                    size={12}
                    strokeWidth={1.75}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{blockedReason}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          {mission.nextBestAction ? (
            <p className="mt-2 text-caption text-text-secondary">
              <span className="text-lavender">Next: </span>
              {mission.nextBestAction.label}
            </p>
          ) : null}

          <Link
            href="/app/intelligence#mission"
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-input bg-accent px-4 text-button font-medium text-accent-fg transition-[background-color,transform] duration-[140ms] ease-nexus hover:bg-accent-hover active:translate-y-px"
          >
            {mission.status === "blocked" ? "Unblock mission" : "Continue mission"}
            <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <section
          aria-label="Active mission"
          className="rounded-card border border-border-subtle bg-bg-subtle/70 px-4 py-3.5"
        >
          <div className="flex items-center gap-2">
            <Target
              size={14}
              strokeWidth={1.75}
              className="shrink-0 text-text-tertiary"
              aria-hidden="true"
            />
            <p className="eyebrow text-text-quaternary">Active mission</p>
          </div>
          <p className="mt-1.5 text-small text-text-secondary">
            No mission in progress. Missions are created from a plan. Tell
            NEXUS what you need to get done.
          </p>
          <Link
            href="/app/intelligence?ask=1"
            className="mt-2.5 inline-flex min-h-[44px] items-center gap-1 text-caption font-medium text-lavender transition-colors hover:text-text-primary active:text-text-primary"
          >
            Start with a mission
            <ArrowRight size={12} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </section>
      )}

      {/* ------------------------------------------------ NEXT BEST ACTION */}
      <FocusPanel insight={focus} />

      {/* ------------------------------------------------ RECENT CONTEXT */}
      <section
        aria-label="Recent activity"
        className="rounded-card border border-border-subtle bg-bg-subtle/70"
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
          <p className="eyebrow text-text-secondary">Recent context</p>
          <Link
            href="/activity"
            className="inline-flex min-h-[44px] items-center pr-1 text-caption text-text-tertiary transition-colors hover:text-text-primary active:text-text-primary"
          >
            All activity
          </Link>
        </div>
        <div className="mt-1 pb-2">
          <ActivityList
            activities={recentActivities.slice(0, 4)}
            unavailable={activitiesUnavailable}
            compact
          />
        </div>
      </section>

      {/* ------------------------------------------------ ASK / INTELLIGENCE */}
      <section
        aria-label="Ask NEXUS"
        className="rounded-card border border-lavender-border/40 bg-bg-subtle/70"
      >
        <div className="px-4 pt-3.5">
          <div className="flex items-center gap-2">
            <Sparkles
              size={14}
              strokeWidth={1.75}
              className="shrink-0 text-lavender"
              aria-hidden="true"
            />
            <p className="eyebrow text-text-secondary">Ask NEXUS</p>
          </div>
          <p className="mt-1.5 text-small text-text-secondary">
            What should I do now? Ask in your own words. Answers come from
            your real workspace, not from guesses.
          </p>
          <Link
            href="/app/intelligence?ask=1"
            data-guide="mobile-ask-cta"
            className="mt-2.5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-input border border-lavender-border/50 bg-lavender/10 px-4 text-button font-medium text-lavender transition-colors hover:bg-lavender/20 active:bg-lavender/20"
          >
            Ask NEXUS
            <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3.5 pt-2.5">
          {ASK_STARTERS.map((starter) => (
            <Link
              key={starter.query}
              href={`/app/intelligence?ask=1&q=${encodeURIComponent(starter.query)}`}
              className="inline-flex min-h-[44px] items-center rounded-pill border border-border-subtle bg-bg-surface px-3 text-caption text-text-tertiary transition-colors hover:border-border-strong hover:text-text-primary active:bg-accent-ghost"
            >
              {starter.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

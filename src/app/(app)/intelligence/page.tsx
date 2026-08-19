import { redirect } from "next/navigation";
import Link from "next/link";
import { redirect as serverRedirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CircleCheck,
  Info,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { NexusShell } from "@/components/nexus-shell";
import { getProfileSummary } from "@/lib/profile";
import { collectWorkspaceIntel } from "@/lib/intelligence/server";
import type { Insight, Severity } from "@/lib/intelligence/engine";

// ============================================================
// NEXUS — /INTELLIGENCE (P3)
// All deterministic signals, grouped by severity, each one
// clickable to the entity it concerns. The REASON is always
// displayed — intelligence, not decoration.
// ============================================================

const SEVERITY_META: Record<Severity, { label: string; icon: typeof AlertTriangle; className: string }> = {
  critical: {
    label: "Critical — needs a decision",
    icon: TriangleAlert,
    className: "text-danger-fg border-danger-border bg-danger-bg",
  },
  warning: {
    label: "Warning — watch closely",
    icon: AlertTriangle,
    className: "text-warning-fg border-warning-border bg-warning-bg",
  },
  info: {
    label: "Info — useful now",
    icon: Info,
    className: "text-info-fg border-info-border bg-info-bg",
  },
  positive: {
    label: "Momentum",
    icon: CircleCheck,
    className: "text-success-fg border-success-border bg-success-bg",
  },
};

const SEVERITY_ORDER: Severity[] = ["critical", "warning", "info", "positive"];

export default async function IntelligencePage() {
  const summary = await getProfileSummary();

  if (!summary) redirect("/login");
  if (!summary.workspaceId) serverRedirect("/onboarding");

  const userName = summary.displayName;
  const username = summary.username ?? undefined;

  const { result, brief, error } = await collectWorkspaceIntel(summary.workspaceId);
  const { insights, nextAction, momentum } = result;

  const grouped = SEVERITY_ORDER.map((severity) => ({
    severity,
    items: insights.filter((insight) => insight.severity === severity),
  })).filter((group) => group.items.length > 0);

  return (
    <NexusShell
      title="Intelligence"
      subtitle="What NEXUS sees in your workspace — every signal carries its reason."
      userName={userName}
      username={username}
    >
      <div className="space-y-6">
        {/* BRIEF */}
        <div className="rounded-xl border border-border-default bg-bg-surface-2 p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} strokeWidth={1.75} className="text-volt" />
              <h2 className="text-body font-semibold text-text-primary">Today&apos;s brief</h2>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-quaternary">
              Deterministic · works on FREE
            </span>
          </div>
          <p className="text-body-lg leading-6 text-text-secondary">
            {error ? `Signals could not be loaded (${error}).` : brief}
          </p>
          <p className="mt-3 font-mono text-mono-small text-text-quaternary">
            MOMENTUM: {momentum.label.toUpperCase()} · {insights.length} SIGNAL
            {insights.length === 1 ? "" : "S"}
          </p>
        </div>

        {/* FOCUS — next best action + its reason */}
        {nextAction ? (
          <div className="animate-rise-in rounded-xl border border-volt-border bg-bg-surface p-5">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-volt">
              Next best action
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-h2 font-semibold text-text-primary">
                  {nextAction.insight.title}
                </div>
                <p className="mt-1 max-w-2xl text-small text-text-secondary">
                  {nextAction.insight.reason}
                </p>
              </div>
              <Link
                href={nextAction.insight.href}
                className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-accent-primary px-4 text-button font-medium text-accent-primary-fg transition-all duration-[120ms] ease-out hover:bg-accent-primary-hover active:scale-[0.98]"
              >
                {nextAction.insight.cta}
                <ArrowRight size={14} strokeWidth={2} />
              </Link>
            </div>
          </div>
        ) : null}

        {/* SIGNALS — grouped by severity */}
        {error && insights.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-default p-5 text-small text-text-secondary">
            Signals could not be loaded: {error}
          </div>
        ) : insights.length === 0 && !nextAction ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default px-6 py-12 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border-default bg-bg-surface text-volt">
              <CircleCheck size={18} strokeWidth={1.75} />
            </div>
            <h3 className="text-body font-medium text-text-primary">
              Nothing requires arbitration
            </h3>
            <p className="mt-1 max-w-md text-small text-text-secondary">
              No overdue task, no blocked project, no goal at risk. Useful while it lasts: give your
              main project a next action, or set a target date on a goal that has none.
            </p>
          </div>
        ) : (
          grouped.map((group) => {
            const meta = SEVERITY_META[group.severity];
            const Icon = meta.icon;
            return (
              <section key={group.severity} className="space-y-2">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${meta.className}`}
                  >
                    <Icon size={12} strokeWidth={2} />
                    {meta.label}
                  </span>
                  <span className="font-mono text-mono-small text-text-quaternary">
                    {group.items.length}
                  </span>
                </div>

                <div className="stagger-list space-y-2">
                  {group.items.map((insight) => (
                    <InsightRow key={insight.id} insight={insight} />
                  ))}
                </div>
              </section>
            );
          })
        )}

        {/* HOW IT WORKS — honesty over theater */}
        <p className="text-caption text-text-quaternary">
          Deterministic engine: overdue, blocked, due today, stale projects, goals at risk,
          momentum, next best action — computed on your real data, free of charge. The optional
          natural-language layer rephrases aggregated signals only, server-side.
        </p>
      </div>
    </NexusShell>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  return (
    <Link
      href={insight.href}
      className="group flex min-h-11 items-center gap-4 rounded-lg border border-border-subtle bg-bg-surface px-4 py-3 transition-all duration-[160ms] ease-out hover:-translate-y-px hover:border-border-strong hover:bg-bg-surface-2 hover:shadow-sm"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-body font-medium text-text-primary">{insight.title}</div>
        {/* The reason is ALWAYS displayed */}
        <p className="mt-0.5 line-clamp-2 text-small text-text-secondary">{insight.reason}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 font-mono text-mono-small text-text-tertiary transition-colors duration-[120ms] group-hover:text-text-primary">
        {insight.cta}
        <ArrowRight
          size={12}
          strokeWidth={2}
          className="transition-transform duration-[160ms] group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  );
}

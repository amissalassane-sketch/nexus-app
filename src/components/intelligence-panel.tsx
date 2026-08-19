import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Insight, InsightSeverity } from "@/lib/intelligence/engine";
import { cn } from "@/lib/cn";
import { Badge, type BadgeTone } from "@/components/ui/badge";

// ============================================================
// NEXUS INTELLIGENCE — SHARED PRESENTATION
// Server-compatible (no hooks). Every insight is rendered with its
// reason and an explicit call-to-action.
// ============================================================

const SEVERITY_TONE: Record<InsightSeverity, BadgeTone> = {
  critical: "danger",
  warning: "warning",
  info: "info",
  positive: "success",
};

const SEVERITY_LABEL: Record<InsightSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
  positive: "Positive",
};

/** Single insight: title + reason + CTA. The reason is never hidden. */
export function InsightRow({
  insight,
  index = 0,
}: {
  insight: Insight;
  index?: number;
}) {
  return (
    <li
      className="stagger-item border-b border-border-subtle px-4 py-3 last:border-b-0"
      style={{ animationDelay: `${Math.min(index, 7) * 25}ms` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone={SEVERITY_TONE[insight.severity]}>
            {SEVERITY_LABEL[insight.severity]}
          </Badge>
          <span className="font-mono text-mono uppercase tracking-[0.06em] text-text-quaternary">
            {insight.entity.type}
          </span>
        </div>
      </div>

      <p className="mt-2 text-body-medium text-text-primary">{insight.title}</p>
      <p className="mt-0.5 text-small text-text-secondary">{insight.reason}</p>

      <Link
        href={insight.href}
        className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-pill border border-border-default px-3 text-caption text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
      >
        {insight.cta}
        <ArrowRight size={13} strokeWidth={1.75} />
      </Link>
    </li>
  );
}

/** The FOCUS block used on the dashboard: the single next best action. */
export function FocusPanel({ insight }: { insight: Insight | null }) {
  if (!insight) {
    return (
      <section
        aria-label="Focus"
        className="rounded-card border border-border-subtle bg-bg-subtle/60 p-5"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={15} strokeWidth={1.75} className="text-text-tertiary" />
          <h2 className="font-mono text-mono uppercase tracking-[0.12em] text-text-tertiary">
            Focus
          </h2>
        </div>
        <p className="mt-3 text-body text-text-primary">
          Nothing currently requires arbitration.
        </p>
        <p className="mt-1 text-small text-text-secondary">
          Add a task or a project and NEXUS will point you to the next thing that
          matters.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Focus"
      className="rounded-card border border-border-subtle bg-bg-subtle/60 p-5"
    >
      <div className="flex items-center gap-2">
        <Sparkles size={15} strokeWidth={1.75} className="text-lavender" />
        <h2 className="font-mono text-mono uppercase tracking-[0.12em] text-text-tertiary">
          Focus
        </h2>
      </div>

      <p className="mt-3 text-h2 text-text-primary">{insight.title}</p>
      <p className="mt-1 text-small text-text-secondary">{insight.reason}</p>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={insight.href}
          className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-accent px-4 text-button font-medium text-accent-fg transition-[background-color,transform] duration-150 ease-nexus hover:bg-accent-hover active:scale-[0.98]"
        >
          {insight.cta}
          <ArrowRight size={14} strokeWidth={1.75} />
        </Link>
      </div>
    </section>
  );
}

/** Full list of insights, grouped by severity order (already sorted). */
export function IntelligenceList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <div className="rounded-empty border border-dashed border-border-default bg-bg-subtle/60 px-6 py-10 text-center">
        <Sparkles size={18} strokeWidth={1.75} className="mx-auto text-text-tertiary" />
        <p className="mt-3 text-h3 text-text-primary">
          Nothing currently requires arbitration.
        </p>
        <p className="mx-auto mt-1 max-w-sm text-small text-text-secondary">
          NEXUS watches your tasks, projects and goals. As deadlines approach and
          work stalls, the signals that matter will appear here.
        </p>
        <Link
          href="/tasks?create=1"
          className="mt-4 inline-flex h-9 items-center rounded-pill bg-accent px-4 text-button font-medium text-accent-fg transition-colors duration-150 ease-nexus hover:bg-accent-hover"
        >
          Add a task
        </Link>
      </div>
    );
  }

  return (
    <ul className={cn("overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/60")}>
      {insights.map((insight, index) => (
        <InsightRow key={insight.id} insight={insight} index={index} />
      ))}
    </ul>
  );
}

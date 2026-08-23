import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import {
  SEVERITY_LABEL,
  SIGNAL_LABEL,
  type Insight,
} from "@/lib/intelligence/engine";
import {
  SEVERITY_TEXT,
  SEVERITY_TONE,
  SIGNAL_ICON,
} from "@/components/intelligence/signal-icons";

// ============================================================
// NEXUS INTELLIGENCE — SERVER-RENDERED PRESENTATION
// Used on the Overview, where there is no interaction budget for a
// detail panel. Every signal still carries its evidence and its action.
// ============================================================

/** The primary "what to do next" block. One decision, one action. */
export function FocusPanel({ insight }: { insight: Insight | null }) {
  if (!insight) {
    return (
      <section
        aria-label="Next action"
        className="rounded-card border border-border-subtle bg-bg-subtle/70 p-5"
      >
        <p className="eyebrow text-text-quaternary">Next action</p>
        <p className="mt-2.5 text-h2 text-text-primary">
          Nothing needs a decision right now.
        </p>
        <p className="mt-1.5 max-w-[52ch] text-small text-text-secondary">
          Add a project or a task and NEXUS will start tracking dates,
          dependencies and momentum for you.
        </p>
      </section>
    );
  }

  const Icon = SIGNAL_ICON[insight.kind];

  return (
    <section
      aria-label="Next action"
      className="relative overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/70 p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("shrink-0", SEVERITY_TEXT[insight.severity])}>
          <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className="eyebrow text-text-quaternary">Next action</p>
        <Badge tone={SEVERITY_TONE[insight.severity]}>
          {SIGNAL_LABEL[insight.kind]}
        </Badge>
      </div>

      <p className="mt-3 text-h2 text-text-primary">{insight.title}</p>
      <p className="mt-1.5 max-w-[62ch] text-small text-text-secondary">
        {insight.reason}
      </p>

      {insight.evidence.length > 0 ? (
        <ul className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {insight.evidence.slice(0, 3).map((item) => (
            <li key={item.label} className="flex items-baseline gap-1.5">
              <span className="font-mono text-mono tabular-nums text-text-primary">
                {item.value}
              </span>
              <span className="text-caption text-text-tertiary">{item.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={insight.href}
          className="inline-flex h-9 items-center gap-1.5 rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg transition-[background-color,transform] duration-[140ms] ease-nexus hover:bg-accent-hover active:translate-y-px"
        >
          {insight.cta}
          <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <Link
          href="/app/intelligence"
          className="inline-flex h-9 items-center rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-colors duration-150 ease-nexus hover:border-border-strong hover:bg-accent-ghost hover:text-text-primary"
        >
          All signals
        </Link>
      </div>
    </section>
  );
}

/** Compact, non-interactive signal row for server-rendered lists. */
export function InsightRow({
  insight,
  index = 0,
}: {
  insight: Insight;
  index?: number;
}) {
  const Icon = SIGNAL_ICON[insight.kind];

  return (
    <li
      className="stagger-item border-b border-border-subtle last:border-b-0"
      style={{ animationDelay: `${Math.min(index, 7) * 24}ms` }}
    >
      <Link
        href={insight.href}
        className="group flex items-start gap-3 px-4 py-3 transition-colors duration-150 ease-nexus hover:bg-white/[0.02]"
      >
        <span
          className={cn("mt-0.5 shrink-0", SEVERITY_TEXT[insight.severity])}
          aria-hidden="true"
        >
          <Icon size={14} strokeWidth={1.75} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={SEVERITY_TONE[insight.severity]}>
              {SIGNAL_LABEL[insight.kind]}
            </Badge>
            <span className="eyebrow text-text-quaternary">
              {SEVERITY_LABEL[insight.severity]}
            </span>
          </span>
          <span className="mt-1.5 block truncate text-[13.5px] font-medium text-text-primary">
            {insight.title}
          </span>
          <span className="mt-0.5 block text-caption text-text-tertiary">
            {insight.reason}
          </span>
        </span>

        <ArrowRight
          size={13}
          strokeWidth={1.75}
          aria-hidden="true"
          className="mt-1 shrink-0 text-text-quaternary transition-[color,transform] duration-150 ease-nexus group-hover:translate-x-0.5 group-hover:text-text-secondary"
        />
      </Link>
    </li>
  );
}

/** Full list of signals for server surfaces. */
export function IntelligenceList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border-default bg-bg-subtle/40 px-6 py-10 text-center">
        <p className="text-h3 text-text-primary">No signals detected</p>
        <p className="mx-auto mt-1.5 max-w-[46ch] text-small text-text-secondary">
          NEXUS is watching your projects, tasks and goals. As deadlines
          approach and work stalls, what matters will appear here.
        </p>
        <Link
          href="/tasks?create=1"
          className="mt-4 inline-flex h-9 items-center rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg transition-colors duration-150 ease-nexus hover:bg-accent-hover"
        >
          Add a task
        </Link>
      </div>
    );
  }

  return (
    <ul className="overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/70">
      {insights.map((insight, index) => (
        <InsightRow key={insight.id} insight={insight} index={index} />
      ))}
    </ul>
  );
}

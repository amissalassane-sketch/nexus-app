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
        className="rounded-card border border-border-subtle bg-bg-subtle/70 p-6 animate-[intelligence-state-in_280ms_var(--ease-nexus)_both]"
      >
        <p className="eyebrow text-text-quaternary">Next action</p>
        <p className="mt-2.5 text-h2 text-text-primary font-semibold">
          Aucune action urgente requise
        </p>
        <p className="mt-1.5 max-w-[52ch] text-small text-text-secondary leading-relaxed">
          Votre espace de travail est fluide. Ajoutez un projet ou une tâche pour que NEXUS commence à surveiller les échéances, les dépendances et le momentum.
        </p>
      </section>
    );
  }

  const Icon = SIGNAL_ICON[insight.kind];

  return (
    <section
      aria-label="Next action"
      className="relative overflow-hidden rounded-card border-2 border-lavender-border/50 bg-bg-surface p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.04] animate-[intelligence-state-in_280ms_var(--ease-nexus)_both]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/70 pb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2 w-2 rounded-pill bg-lavender animate-pulse" aria-hidden="true" />
          <p className="eyebrow text-lavender font-semibold tracking-wider">
            NEXT BEST ACTION · RECOMMANDATION MAJEURE
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("shrink-0", SEVERITY_TEXT[insight.severity])}>
            <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <Badge tone={SEVERITY_TONE[insight.severity]}>
            {SIGNAL_LABEL[insight.kind]}
          </Badge>
        </div>
      </div>

      <h2 className="mt-3.5 text-[22px] font-semibold tracking-[-0.025em] text-text-primary sm:text-[26px] leading-[1.2]">
        {insight.title}
      </h2>

      {/* Structured "Because" rationale */}
      <div className="mt-3.5 rounded-input border border-border-subtle bg-bg-subtle/40 p-3.5 border-l-2 border-l-lavender">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
            Pourquoi NEXUS recommande ceci
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wider text-text-quaternary">
            Impact : <Badge tone={SEVERITY_TONE[insight.severity]}>{insight.severity.toUpperCase()}</Badge>
          </span>
        </div>
        <p className="mt-1.5 text-small text-text-secondary leading-relaxed max-w-prose">
          {insight.reason}
        </p>
      </div>

      {insight.evidence.length > 0 ? (
        <div className="mt-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-quaternary">
            Preuves & Données du workspace
          </span>
          <ul className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {insight.evidence.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-lavender" aria-hidden="true" />
                <span className="font-mono text-mono tabular-nums text-text-primary font-medium">
                  {item.value}
                </span>
                <span className="text-caption text-text-tertiary">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={insight.href}
          className="inline-flex h-11 items-center gap-2 rounded-input bg-accent px-5 text-button font-medium text-accent-fg shadow-[0_2px_14px_rgba(255,255,255,0.12)] transition-[background-color,transform] duration-[140ms] ease-nexus hover:bg-accent-hover active:translate-y-px sm:h-10"
        >
          {insight.cta}
          <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
        </Link>
        <Link
          href="/app/intelligence"
          className="inline-flex h-11 items-center gap-1.5 rounded-input border border-border-default px-4 text-button text-text-secondary transition-colors duration-150 ease-nexus hover:border-border-strong hover:bg-accent-ghost hover:text-text-primary sm:h-10"
        >
          Examiner dans Intelligence
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

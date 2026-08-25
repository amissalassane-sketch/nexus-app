import Link from "next/link";
import { ArrowRight, CalendarClock, TrendingDown, TrendingUp } from "lucide-react";
import type { WeeklyBriefing } from "@/lib/intelligence/advanced";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS INTELLIGENCE — WEEKLY BRIEFING
//
// The executive digest: what moved, the momentum delta against
// last week, and the outlook for the coming one. Written from the
// workspace — no flattery, no invented summary.
// ============================================================

export function WeeklyBriefingPanel({
  briefing,
}: {
  briefing: WeeklyBriefing;
}) {
  const up = briefing.momentumDelta > 0;
  const down = briefing.momentumDelta < 0;
  const DeltaIcon = down ? TrendingDown : TrendingUp;

  return (
    <section
      aria-label="Weekly briefing"
      className="flex flex-col rounded-card border border-border-subtle bg-bg-subtle/60 p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow flex items-center gap-1.5 text-text-quaternary">
          <CalendarClock size={12} strokeWidth={1.75} aria-hidden="true" />
          Weekly briefing
        </p>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-mono text-[10.5px] tabular-nums",
            up && "border-success-border bg-success-bg text-success",
            down && "border-warning-border bg-warning-bg text-warning",
            !up && !down && "border-border-subtle bg-bg-surface text-text-tertiary"
          )}
        >
          {up || down ? (
            <DeltaIcon size={11} strokeWidth={2} aria-hidden="true" />
          ) : null}
          {briefing.momentumDelta > 0 ? "+" : ""}
          {briefing.momentumDelta} vs last week
        </span>
      </div>

      <p className="mt-3 text-h2 text-text-primary">{briefing.headline}</p>
      <p className="mt-1.5 text-small text-text-secondary">{briefing.summary}</p>

      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-input border border-border-subtle bg-border-subtle">
        <MiniStat label="Done (7d)" value={briefing.completedThisWeek} />
        <MiniStat label="Prev. week" value={briefing.completedPrevWeek} />
        <MiniStat label="Opened (7d)" value={briefing.openedThisWeek} />
      </div>

      {briefing.topMoves.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          {briefing.topMoves.map((move) => (
            <Link
              key={move.id}
              href={move.href}
              className="group flex items-center justify-between gap-3 rounded-input border border-border-subtle bg-bg-surface px-3 py-2.5 transition-colors duration-150 ease-nexus hover:border-border-strong"
            >
              <span className="min-w-0">
                <span className="block truncate text-small font-medium text-text-primary">
                  {move.title}
                </span>
                <span className="mt-0.5 block truncate text-caption text-text-tertiary">
                  {move.cta}
                </span>
              </span>
              <ArrowRight
                size={14}
                strokeWidth={1.75}
                aria-hidden="true"
                className="shrink-0 text-text-quaternary transition-colors duration-150 group-hover:text-text-primary"
              />
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-bg-surface px-3 py-2.5">
      <p className="font-mono text-[16px] tabular-nums leading-none text-text-primary">
        {value}
      </p>
      <p className="mt-1 text-caption text-text-quaternary">{label}</p>
    </div>
  );
}

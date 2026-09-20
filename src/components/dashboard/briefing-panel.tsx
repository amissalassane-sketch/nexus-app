import Link from "next/link";
import {
  IconRadar,
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/card";
import type { WeeklyBriefing } from "@/lib/intelligence/advanced";

// ============================================================
// NEXUS — WEEKLY BRIEFING PANEL
// Renders `weeklyBriefing()` from the existing Intelligence engine.
// Nothing here is generated for display: headline, summary, momentum
// and outlook are all derived from the workspace snapshot.
// ============================================================

export function BriefingPanel({ briefing }: { briefing: WeeklyBriefing }) {
  const momentumUp = briefing.momentumDelta > 0;
  const momentumFlat = briefing.momentumDelta === 0;

  return (
    <Panel
      eyebrow="INTELLIGENCE"
      title="NEXUS briefing"
      description="This week, written from your workspace"
      bodyClassName="p-0"
      actions={
        <Link
          href="/app/intelligence"
          className="text-caption text-text-tertiary transition-colors duration-150 ease-nexus hover:text-text-primary"
        >
          Full briefing
        </Link>
      }
    >
      <div className="p-4">
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-input border border-lavender-border bg-lavender-subtle text-lavender"
          >
            <NexusIcon icon={IconRadar} />
          </span>
          <div className="min-w-0">
            <p className="text-body-medium font-medium text-text-primary">
              {briefing.headline}
            </p>
            <p className="mt-1 text-caption leading-relaxed text-text-secondary">
              {briefing.summary}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-input border border-border-subtle bg-bg-subtle/50 p-2.5">
          <BriefingStat
            label="Done · 7d"
            value={briefing.completedThisWeek}
          />
          <BriefingStat
            label="Done · prev"
            value={briefing.completedPrevWeek}
          />
          <BriefingStat label="Opened · 7d" value={briefing.openedThisWeek} />
        </div>

        <p
          className={cn(
            "mt-3 flex items-center gap-1.5 text-caption",
            momentumUp
              ? "text-success"
              : momentumFlat
                ? "text-text-tertiary"
                : "text-warning"
          )}
        >
          {momentumUp ? (
            <NexusIcon icon={IconTrendingUp} px={14} />
          ) : momentumFlat ? null : (
            <NexusIcon icon={IconTrendingDown} px={14} />
          )}
          {momentumFlat
            ? "Same pace as last week."
            : momentumUp
              ? `+${briefing.momentumDelta} vs last week — momentum is building.`
              : `${briefing.momentumDelta} vs last week — pace has slowed.`}
        </p>
      </div>
    </Panel>
  );
}

function BriefingStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <span className="block truncate text-caption text-text-quaternary">
        {label}
      </span>
      <span className="mt-0.5 block font-mono text-body-medium font-medium tabular-nums text-text-primary">
        {value}
      </span>
    </div>
  );
}

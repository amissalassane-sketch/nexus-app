import { IconTrendingUp } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { cn } from "@/lib/cn";
import type {
  ForecastStatus,
  ProjectForecast,
} from "@/lib/intelligence/advanced";

// ============================================================
// NEXUS INTELLIGENCE — FORECAST
//
// Velocity-based completion projections. Velocity is measured
// from real completions over the trailing 28 days; when there is
// no history the panel says so instead of projecting a fiction.
// ============================================================

const STATUS_TONE: Record<ForecastStatus, string> = {
  "on-track": "border-success-border bg-success-bg text-success",
  watch: "border-warning-border bg-warning-bg text-warning",
  "at-risk": "border-danger-border bg-danger-bg text-danger",
  stalled: "border-border-default bg-bg-surface text-text-secondary",
  unknown: "border-border-subtle bg-bg-surface text-text-tertiary",
};

const STATUS_LABEL: Record<ForecastStatus, string> = {
  "on-track": "On track",
  watch: "Watch",
  "at-risk": "At risk",
  stalled: "Stalled",
  unknown: "Unknown",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

export function ForecastPanel({ forecasts }: { forecasts: ProjectForecast[] }) {
  if (forecasts.length === 0) return null;

  return (
    <section
      aria-label="Completion forecast"
      className="overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/60"
    >
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <p className="eyebrow flex items-center gap-1.5 text-text-quaternary">
          <NexusIcon icon={IconTrendingUp} px={12} />
          Completion forecast
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary">
          velocity · trailing 28d
        </span>
      </div>

      <ul>
        {forecasts.map((forecast) => (
          <li
            key={forecast.projectId}
            className="border-t border-border-subtle px-5 py-3.5"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <p className="min-w-0 flex-1 truncate text-body-medium text-text-primary">
                {forecast.name}
              </p>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-pill border px-2 py-0.5 text-[10.5px] font-medium",
                  STATUS_TONE[forecast.status]
                )}
              >
                {STATUS_LABEL[forecast.status]}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex min-w-[120px] flex-1 items-center gap-2">
                <span
                  className="h-1 flex-1 overflow-hidden rounded-pill bg-white/[0.06]"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-pill bg-white/35"
                    style={{ width: `${Math.max(forecast.progress, 2)}%` }}
                  />
                </span>
                <span className="shrink-0 font-mono text-mono tabular-nums text-text-secondary">
                  {forecast.progress}%
                </span>
              </span>

              <span className="font-mono text-mono tabular-nums text-text-tertiary">
                {forecast.velocity > 0
                  ? `${forecast.velocity % 1 === 0 ? forecast.velocity : forecast.velocity.toFixed(1)}/wk`
                  : "no velocity"}
              </span>

              <span className="min-w-[96px] font-mono text-mono tabular-nums text-text-secondary">
                {forecast.projectedCompletion
                  ? `→ ${dateFormatter.format(new Date(forecast.projectedCompletion))}`
                  : "→ –"}
              </span>
            </div>

            <p className="mt-1.5 text-caption text-text-tertiary">
              {forecast.note}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

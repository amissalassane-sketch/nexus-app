import { Activity } from "lucide-react";
import { cn } from "@/lib/cn";
import type { WorkspaceHealth } from "@/lib/intelligence/advanced";

// ============================================================
// NEXUS INTELLIGENCE — WORKSPACE HEALTH PANEL
//
// The operating index: one number, one band, and the factor
// breakdown that produced it. The score is never decorative —
// every factor shows the raw evidence behind its penalty.
// ============================================================

const BAND_TONE: Record<
  WorkspaceHealth["band"],
  { label: string; text: string; bar: string; stroke: string }
> = {
  steady: {
    label: "Steady",
    text: "text-success",
    bar: "bg-success",
    stroke: "stroke-success",
  },
  watch: {
    label: "Watch",
    text: "text-warning",
    bar: "bg-warning",
    stroke: "stroke-warning",
  },
  critical: {
    label: "Critical",
    text: "text-danger",
    bar: "bg-danger",
    stroke: "stroke-danger",
  },
};

const R = 34;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function WorkspaceHealthPanel({ health }: { health: WorkspaceHealth }) {
  const tone = BAND_TONE[health.band];
  const loss = CIRCUMFERENCE * (1 - health.score / 100);

  return (
    <section
      aria-label="Workspace health"
      className="rounded-card border border-border-subtle bg-bg-subtle/60 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5 text-text-quaternary">
            <Activity size={12} strokeWidth={1.75} aria-hidden="true" />
            Operating index
          </p>
          <p className="mt-2 max-w-[30ch] text-small text-text-secondary">
            {health.headline}
          </p>
        </div>

        {/* Score dial — arc length is the score, nothing else moves */}
        <div
          className="relative flex size-[92px] shrink-0 items-center justify-center"
          role="img"
          aria-label={`Operating index ${health.score} out of 100, ${tone.label}`}
        >
          <svg viewBox="0 0 80 80" className="size-full -rotate-90">
            <circle
              cx="40"
              cy="40"
              r={R}
              fill="none"
              strokeWidth="5"
              className="stroke-white/[0.06]"
            />
            <circle
              cx="40"
              cy="40"
              r={R}
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={loss}
              className={cn(tone.stroke, "transition-[stroke-dashoffset] duration-700 ease-nexus")}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-[22px] tabular-nums leading-none text-text-primary">
              {health.score}
            </span>
            <span className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-quaternary">
              /100
            </span>
          </div>
        </div>
      </div>

      <dl className="mt-4 flex flex-col divide-y divide-border-subtle border-t border-border-subtle">
        {health.factors.map((factor) => {
          const intact = 1 - factor.penalty;
          return (
            <div key={factor.id} className="py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-caption font-medium text-text-secondary">
                  {factor.label}
                  <span className="ml-2 font-mono text-[10px] tabular-nums text-text-quaternary">
                    −{Math.round(factor.penalty * factor.weight)}
                  </span>
                </dt>
                <dd className="min-w-0 truncate text-right text-caption text-text-tertiary">
                  {factor.evidence}
                </dd>
              </div>
              <div
                className="mt-1.5 h-[3px] overflow-hidden rounded-pill bg-white/[0.06]"
                aria-hidden="true"
              >
                <div
                  className={cn(
                    "h-full rounded-pill transition-[width] duration-700 ease-nexus",
                    factor.penalty === 0 ? "bg-white/25" : tone.bar
                  )}
                  style={{ width: `${Math.max(intact * 100, 3)}%` }}
                />
              </div>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

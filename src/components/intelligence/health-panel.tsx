import { IconActivity } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
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
  WorkspaceHealth["band"] | "empty",
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
  empty: {
    label: "Awaiting data",
    text: "text-text-tertiary",
    bar: "bg-white/25",
    stroke: "stroke-white/20",
  },
};

const R = 34;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function WorkspaceHealthPanel({ health }: { health: WorkspaceHealth }) {
  const empty = !health.measured;
  const tone = BAND_TONE[empty ? "empty" : health.band];
  const loss = empty
    ? CIRCUMFERENCE
    : CIRCUMFERENCE * (1 - health.score / 100);

  return (
    <section
      aria-label="Workspace health"
      className={cn(
        "rounded-card border p-5",
        empty
          ? "border-border-subtle bg-bg-subtle/40"
          : "border-border-subtle bg-bg-subtle/60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5 text-text-quaternary">
            <NexusIcon icon={IconActivity} px={12} />
            Operating index
          </p>
          <p className="mt-2 max-w-[30ch] text-small text-text-secondary">
            {health.headline}
          </p>
        </div>

        {/* Score dial — arc length is the score, nothing else moves.
            When there isn't enough data we render a neutral "—" instead
            of a fabricated 100. */}
        <div
          className="relative flex size-[92px] shrink-0 items-center justify-center"
          role="img"
          aria-label={
            empty
              ? "Operating index unavailable — not enough tracked work"
              : `Operating index ${health.score} out of 100, ${tone.label}`
          }
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
              {empty ? "—" : health.score}
            </span>
            <span className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-quaternary">
              {empty ? "n/a" : "/100"}
            </span>
          </div>
        </div>
      </div>

      {empty ? (
        <p className="mt-4 border-t border-border-subtle pt-3 text-caption text-text-tertiary">
          The index updates once you have a few active tasks (and at least one project) with real dates.
        </p>
      ) : (
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
      )}
    </section>
  );
}

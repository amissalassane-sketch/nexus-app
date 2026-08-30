import Link from "next/link";
import { Crosshair } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PrioritizedTask } from "@/lib/intelligence/advanced";

// ============================================================
// NEXUS INTELLIGENCE — PRIORITY FOCUS
//
// The triage queue: every open task scored on urgency, friction,
// weight and staleness. The reasons are rendered next to the rank,
// so the ordering is auditable rather than oracular.
// ============================================================

export function PriorityFocusPanel({
  priorities,
}: {
  priorities: PrioritizedTask[];
}) {
  if (priorities.length === 0) {
    return (
      <section
        aria-label="Focus list"
        className="rounded-card border border-border-subtle bg-bg-subtle/60 p-5"
      >
        <PanelHeader />
        <p className="mt-3 text-small text-text-secondary">
          No open tasks to triage. Add work and NEXUS will rank what deserves
          your attention first.
        </p>
      </section>
    );
  }

  const top = priorities[0]?.score ?? 1;

  return (
    <section
      aria-label="Focus list"
      className="overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/60"
    >
      <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
        <PanelHeader />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary">
          triaged · top {priorities.length}
        </span>
      </div>

      <ol className="mt-2">
        {priorities.map((entry, index) => (
          <li key={entry.task.id} className="border-t border-border-subtle first:border-t-0">
            <Link
              href={entry.href}
              className="group flex items-center gap-4 px-5 py-3 transition-colors duration-150 ease-nexus hover:bg-white/[0.02]"
            >
              <span className="w-6 shrink-0 font-mono text-[13px] tabular-nums text-text-quaternary">
                {String(index + 1).padStart(2, "0")}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-medium text-text-primary">
                  {entry.task.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  {entry.reasons.slice(0, 3).map((reason) => (
                    <span
                      key={reason}
                      className="inline-flex items-center rounded-pill border border-border-subtle bg-bg-surface px-2 py-px text-[10.5px] text-text-tertiary"
                    >
                      {reason}
                    </span>
                  ))}
                </span>
              </span>

              <span
                className="hidden h-1 w-20 shrink-0 overflow-hidden rounded-pill bg-white/[0.06] sm:block"
                aria-hidden="true"
              >
                <span
                  className={cn(
                    "block h-full rounded-pill",
                    index === 0 && entry.score >= 60 ? "bg-danger/70" : "bg-white/30"
                  )}
                  style={{
                    width: `${Math.max((entry.score / Math.max(top, 1)) * 100, 6)}%`,
                  }}
                />
              </span>

              <span className="w-8 shrink-0 text-right font-mono text-[11.5px] tabular-nums text-text-secondary">
                {entry.score}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PanelHeader() {
  return (
    <p className="eyebrow flex items-center gap-1.5 text-text-quaternary">
      <Crosshair size={12} strokeWidth={1.75} aria-hidden="true" />
      Focus list: what NEXUS would do first
    </p>
  );
}

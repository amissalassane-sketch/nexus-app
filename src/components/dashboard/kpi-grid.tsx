import Link from "next/link";
import type { TablerIcon } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — KPI GRID
// Template-grade stat cards, NEXUS design language. Every value is a
// real Supabase count passed by the page — the grid itself never
// computes, invents or defaults a number.
// ============================================================

export type KpiTone = "default" | "danger" | "warning" | "success" | "accent";

export type KpiItem = {
  label: string;
  value: number;
  icon: TablerIcon;
  /** Where the number leads — a filtered view of the real data. */
  href: string;
  tone?: KpiTone;
  hint?: string;
};

const TONE_ICON: Record<KpiTone, string> = {
  default: "border-border-subtle bg-bg-surface-2 text-text-tertiary",
  danger: "border-danger-border bg-danger-bg text-danger",
  warning: "border-warning-border bg-warning-bg text-warning",
  success: "border-success-border bg-success-bg text-success",
  accent: "border-lavender-border bg-lavender-subtle text-lavender",
};

const TONE_VALUE: Record<KpiTone, string> = {
  default: "text-text-primary",
  danger: "text-danger",
  warning: "text-warning",
  success: "text-success",
  accent: "text-lavender",
};

export function KpiGrid({
  items,
  className,
  reveal = true,
}: {
  items: KpiItem[];
  className?: string;
  /** Entrance motion for a screen's first paint (staggered, ≤6 items). */
  reveal?: boolean;
}) {
  return (
    <section
      aria-label="Key metrics"
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6",
        className
      )}
    >
      {items.map((item, index) => {
        const tone = item.tone ?? "default";
        return (
          <Link
            key={item.label}
            href={item.href}
            style={{ animationDelay: `${index * 40}ms` }}
            className={cn(
              "group rounded-surface border border-border-subtle bg-bg-surface p-4",
              "transition-[border-color,background-color] duration-[160ms] ease-nexus",
              "hover:border-border-strong hover:bg-bg-surface-2",
              "outline-none focus-visible:ring-1 focus-visible:ring-lavender-border",
              reveal && "reveal"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-control border transition-colors duration-200 ease-nexus",
                  TONE_ICON[tone]
                )}
              >
                <NexusIcon icon={item.icon} />
              </span>
              {item.hint ? (
                <span className="mono-meta min-w-0 truncate text-text-quaternary">
                  {item.hint}
                </span>
              ) : null}
            </div>
            <p className={cn("metric mt-3", TONE_VALUE[tone])}>
              {item.value}
            </p>
            <p className="mt-1.5 truncate text-caption text-text-secondary transition-colors duration-150 ease-nexus group-hover:text-text-primary">
              {item.label}
            </p>
          </Link>
        );
      })}
    </section>
  );
}

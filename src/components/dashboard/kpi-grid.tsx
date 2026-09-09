import Link from "next/link";
import type { LucideIcon } from "lucide-react";
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
  icon: LucideIcon;
  /** Where the number leads — a filtered view of the real data. */
  href: string;
  tone?: KpiTone;
  hint?: string;
};

const TONE_ICON: Record<KpiTone, string> = {
  default: "border-border-subtle bg-bg-surface text-text-tertiary",
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
}: {
  items: KpiItem[];
  className?: string;
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
            className="group animate-[intelligence-state-in_280ms_var(--ease-nexus)_both] rounded-card border border-border-subtle bg-bg-subtle p-4 transition-[border-color,background-color,transform,box-shadow] duration-200 ease-nexus hover:-translate-y-[1px] hover:border-border-default hover:bg-bg-surface hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lavender-border"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-input border transition-colors duration-200 ease-nexus",
                  TONE_ICON[tone]
                )}
              >
                <item.icon size={15} strokeWidth={1.75} />
              </span>
              {item.hint ? (
                <span className="eyebrow min-w-0 truncate text-text-quaternary">
                  {item.hint}
                </span>
              ) : null}
            </div>
            <p
              className={cn(
                "mt-3 font-mono text-[26px] leading-none tabular-nums",
                TONE_VALUE[tone]
              )}
            >
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

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS V3 — BADGE
// Mono, small, desaturated. Used for status, priority, counters.
// ============================================================

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "lavender"
  | "solid";

const tones: Record<BadgeTone, string> = {
  neutral: "border-border-default bg-bg-surface text-text-secondary",
  success: "border-success-border bg-success-bg text-success",
  warning: "border-warning-border bg-warning-bg text-warning",
  danger: "border-danger-border bg-danger-bg text-danger",
  info: "border-info-border bg-info-bg text-info",
  lavender: "border-lavender-border bg-lavender-subtle text-lavender",
  solid: "border-transparent bg-accent text-accent-fg",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center rounded-pill border px-2 font-mono text-mono uppercase tracking-[0.04em] whitespace-nowrap",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Mono counter used next to page titles (Tasks 12, Projects 3, ...). */
export function CountBadge({
  value,
  label,
  className,
}: {
  value: number | string;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-pill border border-border-default bg-bg-surface px-2 font-mono text-mono tabular-nums text-text-secondary",
        className
      )}
      aria-label={label}
    >
      {value}
    </span>
  );
}

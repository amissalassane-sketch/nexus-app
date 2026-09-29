import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — BADGES & TAGS (canonical)
// ============================================================
// Two objects, two jobs — they used to be one, which is why every chip
// in the product was monospace:
//
//   Badge  a human-readable state ("Blocked", "On track", "3 blocked").
//          Sans, 11px, medium, 20px tall, 4px radius, hairline + tint.
//          Colour never carries state alone: the word does.
//   Tag    a machine token ("P0", "INFRA", "12", "SHA 4f2c"). Mono,
//          10.5px uppercase, tabular, tracking 0.06em. Never prose.
//
// Both are exactly 20px tall so they align with each other in a row.
// Status colours come from the semantic tokens only.
// ============================================================

export type BadgeTone =
  | "neutral"
  | "quiet"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "lavender"
  | "solid";

const tones: Record<BadgeTone, string> = {
  neutral: "border-border-subtle bg-bg-surface-2 text-text-secondary",
  quiet: "border-transparent bg-transparent text-text-tertiary",
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
  icon,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-xs border px-1.5 text-[11px] leading-none font-medium transition-[background-color,border-color,color] duration-[160ms] ease-nexus",
        tones[tone],
        className
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children}
    </span>
  );
}

/**
 * Machine-token chip: identifiers, codes, counts, uppercase keys.
 * Always monospace, never a sentence.
 */
export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "quiet" | "lavender" | "success" | "danger" | "warning";
  className?: string;
}) {
  const tones = {
    neutral: "border-border-subtle bg-bg-surface-2 text-text-tertiary",
    quiet: "border-border-subtle bg-transparent text-text-quaternary",
    lavender: "border-lavender-border bg-lavender-subtle text-lavender",
    success: "border-success-border bg-success-bg text-success",
    danger: "border-danger-border bg-danger-bg text-danger",
    warning: "border-warning-border bg-warning-bg text-warning",
  } as const;

  return (
    <span
      className={cn(
        "mono-token inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-xs border px-1.5",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Mono counter used next to page titles (Tasks 12, Projects 3, …). */
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
        "mono-meta inline-flex h-5 items-center rounded-xs border border-border-subtle bg-bg-surface-2 px-1.5 text-text-tertiary",
        className
      )}
      aria-label={label}
    >
      {value}
    </span>
  );
}

/** Status dot + label. Colour is redundant with the text, never alone. */
export function StatusDot({
  tone,
  children,
  className,
}: {
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  children: ReactNode;
  className?: string;
}) {
  const dot = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
    neutral: "bg-text-quaternary",
  }[tone];

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 rounded-pill", dot)}
      />
      <span className="truncate text-caption text-text-secondary">
        {children}
      </span>
    </span>
  );
}

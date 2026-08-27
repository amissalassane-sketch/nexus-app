import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — BADGE
// Enhanced with smooth transitions for status/priority changes.
// Never teleport — always transition. GPU-friendly.
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
  neutral: "border-border-default bg-bg-surface text-text-secondary",
  quiet: "border-transparent bg-transparent text-text-quaternary",
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
        "inline-flex h-[20px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] border px-1.5 font-mono text-[10.5px] uppercase leading-none tracking-[0.06em] transition-[background-color,border-color,color,transform,opacity] duration-[200ms] ease-nexus will-change-transform",
        tones[tone],
        "animate-[badge-in_180ms_var(--ease-nexus)_both]",
        className
      )}
    >
      {icon ? (
        <span className="shrink-0 transition-transform duration-150 ease-nexus">
          {icon}
        </span>
      ) : null}
      <span className="transition-opacity duration-150 ease-nexus">{children}</span>
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
        "inline-flex h-[20px] items-center rounded-[5px] border border-border-subtle bg-bg-surface px-1.5 font-mono text-[10.5px] leading-none tabular-nums text-text-tertiary transition-[transform,opacity] duration-[200ms] ease-nexus will-change-transform",
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
        className={cn(
          "h-1.5 w-1.5 rounded-pill transition-[transform,opacity,background-color] duration-[200ms] ease-nexus",
          dot
        )}
      />
      <span className="truncate text-caption text-text-secondary transition-colors duration-150 ease-nexus">
        {children}
      </span>
    </span>
  );
}

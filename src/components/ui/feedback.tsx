import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — STATE COMPONENTS
// Every data-driven surface in NEXUS must be able to express:
// loading · success · empty · error · partial · refreshing.
// These are the shared primitives for the states that are not "success".
// ============================================================

/**
 * Empty state. Always answers three questions:
 *   what is missing · why it matters · what to do about it.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-empty border border-dashed border-border-default bg-bg-subtle/40 px-6 py-10 text-center",
        className
      )}
    >
      {icon ? (
        <div className="mb-3.5 flex h-9 w-9 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-tertiary">
          {icon}
        </div>
      ) : null}
      <p className="text-h3 text-text-primary">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-[42ch] text-small text-text-secondary">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/**
 * Error state. Human-readable, never a stack trace, always recoverable.
 */
export function ErrorState({
  title = "Something didn't load",
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-card border border-border-subtle bg-bg-subtle/60 px-5 py-6 text-center",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-input border border-danger-border bg-danger-bg text-danger"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        >
          <path d="M12 8v5" />
          <path d="M12 16.5h.01" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </span>
      <p className="text-h3 text-text-primary">{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-[46ch] text-small text-text-secondary">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ListRow({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  return (
    <Tag
      className={cn(
        "group flex min-h-10 items-center gap-3 rounded-row px-2.5 transition-colors duration-150 ease-nexus hover:bg-bg-surface",
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function Progress({
  value,
  label,
  className,
  tone = "white",
}: {
  value: number;
  label?: string;
  className?: string;
  tone?: "white" | "lavender" | "danger" | "success";
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const fill =
    tone === "lavender"
      ? "bg-lavender"
      : tone === "danger"
        ? "bg-danger"
        : tone === "success"
          ? "bg-success"
          : "bg-accent";

  return (
    <div
      className={cn(
        "h-[3px] w-full overflow-hidden rounded-pill bg-white/[0.07]",
        className
      )}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-pill transition-[width] duration-500 ease-nexus", fill)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function Alert({
  tone,
  title,
  children,
  action,
  className,
}: {
  tone: "danger" | "success" | "warning" | "info";
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const tones = {
    danger: "border-danger-border bg-danger-bg text-danger",
    success: "border-success-border bg-success-bg text-success",
    warning: "border-warning-border bg-warning-bg text-warning",
    info: "border-info-border bg-info-bg text-info",
  } as const;

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-input border px-3.5 py-2.5 text-small",
        tones[tone],
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        <div className={cn(title && "mt-0.5 opacity-90")}>{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Skeleton block. Always shaped like the content it replaces. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("skeleton rounded-row", className)}
      style={style}
      aria-hidden="true"
    />
  );
}

/** Skeleton for a list of rows — matches the real row height (40px). */
export function SkeletonRows({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex h-11 items-center gap-3 border-b border-border-subtle px-4 last:border-b-0"
        >
          <Skeleton className="h-[15px] w-[15px] rounded-[5px]" />
          {/* Varying widths read as content, not as a progress bar. */}
          <Skeleton
            className="h-2.5 rounded-pill"
            style={{ width: `${38 + ((index * 17) % 34)}%` }}
          />
          <div className="flex-1" />
          <Skeleton className="h-2.5 w-10 rounded-pill" />
        </div>
      ))}
    </div>
  );
}

/** Inline "refreshing" marker: data is on screen, an update is in flight. */
export function RefreshingDot({ label = "Refreshing" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="status">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-pill bg-text-tertiary signal-pulse"
      />
      <span className="eyebrow text-text-quaternary">{label}</span>
    </span>
  );
}

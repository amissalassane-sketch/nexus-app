import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { DataErrorDetail } from "@/lib/data-errors";

// ============================================================
// NEXUS — STATE COMPONENTS
// Enhanced with motion: progress animates, skeletons preserve layout,
// alerts enter gracefully, refreshing communicates live state.
// ============================================================

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
        "flex flex-col items-center justify-center rounded-empty border border-dashed border-border-default bg-bg-subtle/40 px-6 py-10 text-center animate-[intelligence-state-in_320ms_var(--ease-nexus)_both]",
        className
      )}
    >
      {icon ? (
        <div className="mb-3.5 flex h-9 w-9 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-tertiary animate-[badge-in_200ms_var(--ease-nexus)_both]">
          {icon}
        </div>
      ) : null}
      <p className="text-h3 text-text-primary animate-[intelligence-state-in_240ms_var(--ease-nexus)_60ms_both]">
        {title}
      </p>
      {description ? (
        <p className="mt-1.5 max-w-[42ch] text-small text-text-secondary animate-[intelligence-state-in_240ms_var(--ease-nexus)_120ms_both]">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-4 animate-[intelligence-state-in_240ms_var(--ease-nexus)_180ms_both]">
          {action}
        </div>
      ) : null}
    </div>
  );
}

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
        "rounded-card border border-border-subtle bg-bg-subtle/60 px-5 py-6 text-center animate-[intelligence-state-in_280ms_var(--ease-nexus)_both]",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-input border border-danger-border bg-danger-bg text-danger animate-[badge-in_200ms_var(--ease-nexus)_both]"
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
        "group flex min-h-10 items-center gap-3 rounded-row px-2.5 transition-[background-color,transform] duration-[160ms] ease-nexus hover:bg-bg-surface active:scale-[0.99] will-change-transform",
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
  tone?: "white" | "lavender" | "danger" | "success" | "warning";
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const fill =
    tone === "lavender"
      ? "bg-lavender"
      : tone === "danger"
        ? "bg-danger"
        : tone === "success"
          ? "bg-success"
          : tone === "warning"
            ? "bg-warning"
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
        className={cn(
          "h-full rounded-pill transition-[width] duration-[600ms] ease-nexus will-change-transform mission-progress-fill",
          fill
        )}
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
    danger: "border-danger-border bg-danger-bg text-text-primary",
    success: "border-success-border bg-success-bg text-text-primary",
    warning: "border-warning-border bg-warning-bg text-text-primary",
    info: "border-info-border bg-info-bg text-text-primary",
  } as const;

  const titleTones = {
    danger: "text-danger",
    success: "text-success",
    warning: "text-warning",
    info: "text-info",
  } as const;

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-input border px-3.5 py-2.5 text-small animate-[intelligence-state-in_260ms_var(--ease-nexus)_both] transition-[transform,opacity] duration-200 ease-nexus",
        tones[tone],
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {title ? <p className={cn("font-medium", titleTones[tone])}>{title}</p> : null}
        <div className={cn("text-text-secondary", title && "mt-0.5")}>{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Diagnostic line under a friendly error: the real SQLSTATE / PGRST code,
 * the bounded raw message and the hint the database answered with (see
 * describeDataError). It exists so an operator can read and copy the
 * cause from the screen instead of opening the devtools — `select-all`
 * makes one click select the whole line. Renders nothing when there is
 * no diagnostic (validation copy, plain product messages).
 */
export function ErrorDiagnostic({
  detail,
  className,
}: {
  detail: DataErrorDetail | null | undefined;
  className?: string;
}) {
  if (!detail) return null;
  return (
    <p
      data-error-code={detail.code}
      className={cn(
        "mt-1.5 select-all break-words font-mono text-caption text-text-tertiary",
        className
      )}
    >
      <span className="text-text-secondary">code {detail.code}</span>
      {detail.message ? ` — ${detail.message}` : null}
      {detail.hint ? <span className="block">hint: {detail.hint}</span> : null}
    </p>
  );
}

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("skeleton rounded-row skeleton-shimmer", className)}
      style={style}
      aria-hidden="true"
    />
  );
}

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
          className="flex h-11 items-center gap-3 border-b border-border-subtle px-4 last:border-b-0 animate-[list-in_240ms_var(--ease-nexus)_both]"
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <Skeleton className="h-[15px] w-[15px] rounded-[5px]" />
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

export function RefreshingDot({ label = "Refreshing" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="status">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-pill bg-text-tertiary animate-[signal-pulse_2.6s_var(--ease-nexus)_infinite]"
      />
      <span className="eyebrow text-text-quaternary animate-[intelligence-thinking_1.2s_var(--ease-nexus)_infinite]">
        {label}
      </span>
    </span>
  );
}

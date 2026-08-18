import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS V3 — EMPTY STATE / LIST ROW / PROGRESS / ALERT
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
        "flex flex-col items-center justify-center rounded-empty border border-dashed border-border-default bg-bg-subtle/60 px-6 py-10 text-center",
        className
      )}
    >
      {icon ? (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-input border border-border-default bg-bg-surface text-text-secondary">
          {icon}
        </div>
      ) : null}
      <p className="text-h3 text-text-primary">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-small text-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
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
        "group flex min-h-11 items-center gap-3 rounded-row px-2.5 transition-colors duration-150 ease-nexus hover:bg-bg-surface",
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
  tone?: "white" | "lavender";
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div
      className={cn("h-1 w-full overflow-hidden rounded-pill bg-bg-surface-3", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full rounded-pill transition-[width] duration-500 ease-nexus",
          tone === "lavender" ? "bg-lavender" : "bg-accent"
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function Alert({
  tone,
  children,
  className,
}: {
  tone: "danger" | "success" | "warning" | "info";
  children: ReactNode;
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
        "rounded-input border px-3.5 py-2.5 text-small",
        tones[tone],
        className
      )}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-row bg-bg-surface", className)}
      aria-hidden="true"
    />
  );
}

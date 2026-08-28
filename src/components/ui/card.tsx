import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — SURFACES
// Enhanced with motion: cards lift subtly, panels enter gracefully,
// metrics animate value changes. Calm, premium, intentional.
// ============================================================

export function Card({
  children,
  className,
  as: Tag = "div",
  interactive,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "rounded-card border border-border-subtle bg-bg-subtle transition-[border-color,background-color,transform,box-shadow] duration-[200ms] ease-nexus will-change-transform",
        interactive &&
          "hover:border-border-default hover:bg-bg-surface hover:-translate-y-[1px] hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.5)] active:translate-y-0 active:scale-[0.99] cursor-pointer",
        "animate-[intelligence-state-in_280ms_var(--ease-nexus)_both]",
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex items-end justify-between gap-3 border-b border-border-subtle pb-2.5 animate-[intelligence-state-in_240ms_var(--ease-nexus)_both]",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="eyebrow mb-1 text-text-quaternary">{eyebrow}</p>
        ) : null}
        <h2 className="truncate text-h3 text-text-primary">{title}</h2>
        {description ? (
          <p className="mt-0.5 truncate text-caption text-text-tertiary">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
  bodyClassName,
  footer,
  as: Tag = "section",
}: {
  title?: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  as?: "section" | "div";
}) {
  return (
    <Tag
      className={cn(
        "overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/70 transition-[border-color,transform] duration-[200ms] ease-nexus will-change-transform animate-[intelligence-state-in_300ms_var(--ease-nexus)_both]",
        className
      )}
    >
      {title ? (
        <div className="flex min-h-[46px] items-center justify-between gap-3 border-b border-border-subtle px-4 py-2.5">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="eyebrow text-text-quaternary">{eyebrow}</p>
            ) : null}
            <h2 className="truncate text-h3 text-text-primary">{title}</h2>
            {description ? (
              <p className="mt-0.5 truncate text-caption text-text-tertiary">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
      {footer ? (
        <div className="border-t border-border-subtle px-4 py-2.5">{footer}</div>
      ) : null}
    </Tag>
  );
}

export function PanelLink({ children }: { children: ReactNode }) {
  return (
    <span className="text-caption text-text-tertiary transition-[color,transform] duration-150 ease-nexus hover:text-text-primary hover:translate-x-[1px] inline-flex items-center gap-1">
      {children}
    </span>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "danger" | "warning" | "accent";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-4 py-3.5 transition-colors duration-200 ease-nexus hover:bg-white/[0.01] group">
      <span className="eyebrow truncate text-text-quaternary group-hover:text-text-tertiary transition-colors duration-150">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[21px] leading-none tabular-nums transition-[color,transform] duration-[300ms] ease-nexus will-change-transform",
          tone === "danger"
            ? "text-danger"
            : tone === "warning"
              ? "text-warning"
              : tone === "accent"
                ? "text-lavender"
                : "text-text-primary"
        )}
      >
        {value}
      </span>
      {hint ? (
        <span className="truncate text-caption text-text-tertiary">{hint}</span>
      ) : null}
    </div>
  );
}

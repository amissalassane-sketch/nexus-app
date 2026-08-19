import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS V3 — SURFACES
// Cards: radius 16px, bg #111111, border 6-8%. No glass, no glow.
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
        "rounded-card border border-border-subtle bg-bg-subtle",
        interactive &&
          "transition-colors duration-150 ease-nexus hover:border-border-default hover:bg-bg-surface",
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
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex items-center justify-between gap-3 border-b border-border-subtle pb-2",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {eyebrow ? (
          <>
            <span className="font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary">
              {eyebrow}
            </span>
            <span className="font-mono text-mono text-text-quaternary">/</span>
          </>
        ) : null}
        <h2 className="truncate text-h3 text-text-primary">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ============================================================
// PANEL — the main content surface of the application.
// A panel is a titled region with an optional action slot and a divider,
// used to structure pages instead of scattering standalone cards.
// ============================================================

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  as: Tag = "section",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag
      className={cn(
        "overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/60",
        className
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-h3 text-text-primary">{title}</h2>
            {description ? (
              <p className="mt-0.5 truncate text-caption text-text-tertiary">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </Tag>
  );
}

/** Dense metric used in the dashboard strip: mono value + quiet label. */
export function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "danger" | "accent";
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[22px] leading-none tabular-nums",
          tone === "danger"
            ? "text-danger"
            : tone === "accent"
              ? "text-lavender"
              : "text-text-primary"
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-caption text-text-tertiary">{hint}</span> : null}
    </div>
  );
}

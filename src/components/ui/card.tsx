import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — SURFACES (canonical)
// ============================================================
// Two containers, one surface language:
//
//   Card   a panel-shaped container with no chrome — the surface you
//          drop content into directly.
//   Panel  the product's workhorse: eyebrow / title / description header
//          + hairline-separated body (+ optional footer).
//
// Both sit on the L2 panel surface with a 1px hairline. Elevation is
// surface + hairline, never a shadow or a lift: a card that jumps on
// hover makes a dense screen feel unstable.
//
// Entrance motion is opt-in (`reveal`), applied by pages and boards —
// not by every card on every render.
// ============================================================

export function Card({
  children,
  className,
  as: Tag = "div",
  interactive,
  reveal,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
  interactive?: boolean;
  reveal?: boolean;
  padded?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "rounded-surface border border-border-subtle bg-bg-surface transition-[border-color,background-color] duration-[160ms] ease-nexus",
        padded && "p-4",
        interactive &&
          "hover:border-border-default hover:bg-bg-surface-2 active:bg-bg-surface-2 cursor-pointer",
        reveal && "reveal",
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
        "mb-3 flex items-end justify-between gap-3 border-b border-border-subtle pb-3",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="eyebrow mb-1 text-text-quaternary">{eyebrow}</p>
        ) : null}
        <h2 className="truncate text-h3 text-text-primary">{title}</h2>
        {description ? (
          <p className="mt-1 truncate text-caption text-text-tertiary">
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
  reveal,
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
  /** Entrance motion, opt-in — for a screen's first paint or a board. */
  reveal?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "overflow-hidden rounded-surface border border-border-subtle bg-bg-surface transition-[border-color] duration-[160ms] ease-nexus",
        reveal && "reveal",
        className
      )}
    >
      {title ? (
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border-subtle px-4 py-2">
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
        <div className="border-t border-border-subtle px-4 py-3">{footer}</div>
      ) : null}
    </Tag>
  );
}

/** Inline "view all" style link used in panel headers. */
export function PanelLink({ children }: { children: ReactNode }) {
  return (
    <span className="text-caption text-text-tertiary transition-colors duration-150 ease-nexus hover:text-text-primary inline-flex items-center gap-1">
      {children}
    </span>
  );
}

/**
 * Metric — a bordered strip of numbers (In progress · Completed · Avg).
 * Label is an ordinary label (sans eyebrow), the value is data (mono,
 * tabular). Colour is semantic only: danger/warning mean something is
 * actually wrong, `accent` means the number belongs to the AI layer.
 */
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
    <div className="flex min-w-0 flex-col gap-1.5 px-4 py-3 transition-colors duration-[160ms] ease-nexus group hover:bg-bg-surface-2">
      <span className="eyebrow truncate text-text-quaternary">{label}</span>
      <span
        className={cn(
          "metric text-[21px] leading-none",
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

/**
 * PanelBody — flushes the padding so a list of Rows can span the full
 * panel width with hairline separators. The canonical pairing is
 * `<Panel bodyClassName="p-0"><DataList>…`.
 */
export function PanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("p-0", className)}>{children}</div>;
}

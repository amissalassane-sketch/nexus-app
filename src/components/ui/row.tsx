import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — DENSE ROWS & DATA LISTS (canonical)
// ============================================================
// Every list in the product (priority queue, projects, upcoming,
// activity, settings entries, search results) is the same object:
//
//   DataList  the container: hairline separators, no outer padding,
//             designed to sit inside <Panel bodyClassName="p-0">.
//   Row       one line of the system: 40px tall (44 on touch), a leading
//             slot (icon / marker / checkbox), a title, an optional
//             context line, and a trailing slot (mono value, badge,
//             chevron, action).
//
// Geometry: 40px row = 8px vertical padding around a 24px line box. The
// hairline is the last child's border removed, never a wrapper divider.
// ============================================================

export function DataList({
  children,
  className,
  label,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  as?: "div" | "ul" | "ol";
}) {
  return (
    <Tag aria-label={label} className={cn("flex flex-col", className)}>
      {children}
    </Tag>
  );
}

type RowProps = {
  title: ReactNode;
  /** Second line: context, state, reason. Never a second title. */
  context?: ReactNode;
  /** Leading slot — icon, marker, checkbox. Rendered in a fixed box. */
  leading?: ReactNode;
  /** Trailing slot — mono value, badge, chevron, action. */
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  /** Emphasised row (the one row that matters on this screen). */
  emphasis?: boolean;
  as?: "div" | "li";
  ariaLabel?: string;
};

export function Row({
  title,
  context,
  leading,
  trailing,
  href,
  onClick,
  className,
  emphasis,
  as: Tag = "div",
  ariaLabel,
}: RowProps) {
  const body = (
    <>
      {leading ? (
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center text-text-tertiary"
        >
          {leading}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-small",
            emphasis ? "font-medium text-text-primary" : "text-text-primary"
          )}
        >
          {title}
        </span>
        {context ? (
          <span className="mt-0.5 block truncate text-caption text-text-tertiary">
            {context}
          </span>
        ) : null}
      </span>
      {trailing ? (
        <span className="flex shrink-0 items-center gap-2">{trailing}</span>
      ) : null}
    </>
  );

  const classes = cn(
    "group flex min-h-11 w-full items-center gap-3 border-b border-border-subtle px-3 py-2 text-left transition-[background-color,border-color] duration-[160ms] ease-nexus last:border-b-0 sm:min-h-10",
    (href || onClick) &&
      "hover:bg-bg-surface-2 focus-visible:bg-bg-surface-2 outline-none",
    emphasis && "bg-bg-surface-2",
    className
  );

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={classes}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={classes}>
        {body}
      </button>
    );
  }

  return (
    <Tag className={classes} aria-label={ariaLabel}>
      {body}
    </Tag>
  );
}

/** Right-aligned mono value used in rows and tables (counts, dates, %). */
export function RowValue({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "strong" | "success" | "warning" | "danger" | "lavender";
  className?: string;
}) {
  const tones = {
    muted: "text-text-tertiary",
    strong: "text-text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    lavender: "text-lavender",
  } as const;

  return (
    <span className={cn("mono-meta", tones[tone], className)}>{children}</span>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CountBadge } from "./badge";

// ============================================================
// NEXUS — PAGE HEADER
// One title, one counter, one line of context, one primary action.
// Every application screen opens the same way.
// ============================================================

export function PageHeader({
  title,
  count,
  description,
  actions,
  className,
  meta,
  eyebrow,
}: {
  title: string;
  count?: number | string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  meta?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 pb-6 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="eyebrow mb-2 text-text-quaternary">{eyebrow}</p>
        ) : null}
        <div className="flex items-center gap-2.5">
          <h1 className="text-h1 text-text-primary">{title}</h1>
          {count !== undefined ? (
            <CountBadge value={count} label={`${count} items`} />
          ) : null}
        </div>
        {description ? (
          <p className="mt-1.5 max-w-[70ch] text-small text-text-secondary">
            {description}
          </p>
        ) : null}
        {meta}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** Compact stats line: "3 due today · 1 overdue · 12 total" */
export function StatLine({
  items,
  className,
}: {
  items: {
    value: number | string;
    label: string;
    tone?: "default" | "danger" | "warning";
  }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-1 border-y border-border-subtle py-2.5 text-small text-text-secondary",
        className
      )}
    >
      {items.map((item, index) => (
        <span key={item.label} className="flex items-center gap-2.5">
          {index > 0 ? (
            <span className="text-text-quaternary" aria-hidden="true">
              ·
            </span>
          ) : null}
          <span>
            <span
              className={cn(
                "font-mono tabular-nums",
                item.tone === "danger"
                  ? "text-danger"
                  : item.tone === "warning"
                    ? "text-warning"
                    : "text-text-primary"
              )}
            >
              {item.value}
            </span>{" "}
            {item.label}
          </span>
        </span>
      ))}
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS V3 — PAGE HEADER
// H1 + mono counter + description + actions (Create pill).
// ============================================================

export function PageHeader({
  title,
  count,
  description,
  actions,
  className,
  meta,
}: {
  title: string;
  count?: number | string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  meta?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-h1 text-text-primary">{title}</h1>
          {count !== undefined ? (
            <span className="font-mono text-mono tabular-nums text-text-tertiary">
              {count}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-1 text-small text-text-secondary">{description}</p>
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
  items: { value: number | string; label: string; tone?: "default" | "danger" }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-border-subtle py-2.5 text-small text-text-secondary",
        className
      )}
    >
      {items.map((item, index) => (
        <span key={item.label} className="flex items-center gap-2">
          {index > 0 ? (
            <span className="font-mono text-text-quaternary" aria-hidden="true">
              ·
            </span>
          ) : null}
          <span>
            <span
              className={cn(
                "font-mono tabular-nums",
                item.tone === "danger" ? "text-danger" : "text-text-primary"
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

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AdminEyebrow } from "./panel";

// ============================================================
// NEXUS ADMIN — KPI TILES
// ============================================================
// Four numbers across the top, separated by hairlines rather than boxed
// into cards. Every tile carries its own definition: on a control plane,
// an unlabelled "Active Users" is how an operator ends up quoting the
// wrong number in a meeting.
//
// A tile never invents a value. `value` accepts the pre-formatted string
// so the caller decides — and the formatters in lib/admin/format.ts turn
// a missing measurement into "Not available", never into 0.
//
// The value rides the canonical numeric step (`.metric`: mono 24, tabular,
// −0.02em) and the label rides the technical token layer, so a KPI here
// and a metric in the product are the same typographic object.
// ============================================================

export function KpiTile({
  label,
  value,
  definition,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  /** What the number actually counts. Always rendered. */
  definition: string;
  /** Secondary line: a real delta, a window, or a status. */
  hint?: ReactNode;
  tone?: "default" | "accent" | "success" | "warning" | "danger";
  className?: string;
}) {
  const unavailable = value === "Not available";

  const valueTone = unavailable
    ? "text-admin-text-3"
    : tone === "accent"
      ? "text-admin-accent"
      : tone === "success"
        ? "text-admin-success"
        : tone === "warning"
          ? "text-admin-warning"
          : tone === "danger"
            ? "text-admin-danger"
            : "text-admin-text";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 bg-admin-surface px-4 py-4",
        className
      )}
    >
      <AdminEyebrow>{label}</AdminEyebrow>
      <span className={cn("metric", valueTone)}>{value}</span>
      <span className="text-caption text-admin-text-2">{definition}</span>
      {hint ? (
        <span className="mt-0.5 text-caption text-admin-text-3">{hint}</span>
      ) : null}
    </div>
  );
}

/** The KPI strip: one bordered region with hairline separators.
 *
 *  The hairlines come from a 1px gap over a border-coloured background,
 *  not from per-child border rules. That is deliberate: a 4-up grid that
 *  collapses to 2-up on a phone needs separators that are correct at both
 *  column counts without any nth-child arithmetic, and this is the only
 *  technique that gives that for free. */
export function KpiGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-surface border border-admin-border",
        className
      )}
    >
      <div className="grid grid-cols-2 gap-px bg-admin-border sm:grid-cols-4">
        {children}
      </div>
    </div>
  );
}

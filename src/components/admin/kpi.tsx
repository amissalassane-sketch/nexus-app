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
  tone?: "default" | "accent";
  className?: string;
}) {
  const unavailable = value === "Not available";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 bg-admin-surface px-4 py-4",
        className
      )}
    >
      <AdminEyebrow>{label}</AdminEyebrow>
      <span
        className={cn(
          "font-mono text-[26px] font-medium leading-[30px] tabular-nums tracking-[-0.02em]",
          unavailable
            ? "text-admin-text-3"
            : tone === "accent"
              ? "text-admin-accent"
              : "text-admin-text"
        )}
      >
        {value}
      </span>
      <span className="text-[11.5px] leading-[16px] text-admin-text-2">
        {definition}
      </span>
      {hint ? (
        <span className="mt-0.5 text-[11.5px] leading-[16px] text-admin-text-3">
          {hint}
        </span>
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
        "overflow-hidden rounded-[10px] border border-admin-border",
        className
      )}
    >
      <div className="grid grid-cols-2 gap-px bg-admin-border sm:grid-cols-4">
        {children}
      </div>
    </div>
  );
}

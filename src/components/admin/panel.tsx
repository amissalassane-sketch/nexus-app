import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS ADMIN — SURFACES
// ============================================================
// The control plane is built from sections and hairlines, not from a
// grid of floating cards. A panel is a labelled region with one border;
// a row is a line of dense data. That keeps a screen with twelve
// numbers readable where twelve cards would shout.
// ============================================================

/** Small caps label that introduces a region. Never decorative: if a
 *  region needs no label, it needs no eyebrow either. */
export function AdminEyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-mono text-[10.5px] uppercase leading-[14px] tracking-[0.12em] text-admin-text-3",
        className
      )}
    >
      {children}
    </p>
  );
}

export function AdminSectionTitle({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-4 gap-y-2",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold leading-[22px] tracking-[-0.011em] text-admin-text">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-[70ch] text-[12.5px] leading-[18px] text-admin-text-2">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** A bordered region. `padded={false}` lets a table or a list run edge to
 *  edge inside it, which is how dense data should sit. */
export function AdminPanel({
  children,
  className,
  padded = true,
  as: Tag = "section",
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: "section" | "div" | "article";
  labelledBy?: string;
}) {
  return (
    <Tag
      aria-labelledby={labelledBy}
      className={cn(
        "rounded-[10px] border border-admin-border bg-admin-surface",
        padded && "p-4 sm:p-5",
        className
      )}
    >
      {children}
    </Tag>
  );
}

/** Hairline separator. Preferred over spacing alone when two regions
 *  belong to the same panel. */
export function AdminDivider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-px w-full bg-admin-border", className)}
    />
  );
}

/** A label/value line. The workhorse of the inspectors: it keeps a value
 *  aligned with its label at any width and never truncates the value. */
export function AdminField({
  label,
  value,
  hint,
  mono = true,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 border-b border-admin-border py-2 last:border-b-0",
        className
      )}
    >
      <dt className="shrink-0 text-[12.5px] leading-[18px] text-admin-text-2">
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 text-right text-[13px] leading-[18px] text-admin-text",
          mono && "font-mono tabular-nums"
        )}
      >
        {value}
        {hint ? (
          <span className="ml-2 text-[11.5px] text-admin-text-3">{hint}</span>
        ) : null}
      </dd>
    </div>
  );
}

export function AdminFieldList({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <dl className={cn("min-w-0", className)}>
      {title ? <AdminEyebrow className="mb-1">{title}</AdminEyebrow> : null}
      {children}
    </dl>
  );
}

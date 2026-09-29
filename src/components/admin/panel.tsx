import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS ADMIN — SURFACES
// ============================================================
// The control plane is built from sections and hairlines, not from a
// grid of floating cards. Every recipe here is the canonical NEXUS one,
// expressed through the admin namespace:
//
//   panel   L2 surface + hairline + radius 12 (rounded-surface)
//   header  44px row, hairline below, title + action slot
//   field   32px minimum row, hairline, label sans / value mono
//   eyebrow the technical monospace layer (.mono-token)
//
// Elevation is a surface step plus a border — never a shadow and never a
// different colour. That is what keeps a screen with twelve numbers
// readable where twelve cards would shout.
// ============================================================

/** Small caps label that introduces a region. Never decorative: if a
 *  region needs no label, it needs no eyebrow either.
 *  Mono by rule — this is a machine-facing token, not prose. */
export function AdminEyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("mono-token text-admin-text-3", className)}>{children}</p>
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
        <h2 className="text-h2 text-admin-text">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-[70ch] text-small text-admin-text-2">
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
        "rounded-surface border border-admin-border bg-admin-surface",
        padded && "p-4 sm:p-5",
        className
      )}
    >
      {children}
    </Tag>
  );
}

/** The 44px header row of a panel that owns a table or a list. One
 *  recipe, so a header in Subscriptions and a header in Audit Log are the
 *  same object at the same height. */
export function AdminPanelHeader({
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
        "flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-admin-border px-4 py-2.5 sm:px-5",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-h2 text-admin-text">{title}</h2>
        {description ? (
          <p className="mt-0.5 max-w-[80ch] text-small text-admin-text-2">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
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
 *  aligned with its label at any width and never truncates the value.
 *  Technical values (ids, counts, timestamps) ride the monospace layer. */
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
        "flex min-h-8 items-baseline justify-between gap-4 border-b border-admin-border py-2 last:border-b-0",
        className
      )}
    >
      <dt className="shrink-0 text-small text-admin-text-2">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-right text-body text-admin-text",
          mono && "mono-meta"
        )}
      >
        {value}
        {hint ? (
          <span className="ml-2 text-caption text-admin-text-3">{hint}</span>
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
      {title ? <AdminEyebrow className="mb-1.5">{title}</AdminEyebrow> : null}
      {children}
    </dl>
  );
}

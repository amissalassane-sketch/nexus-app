import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { AdminIcon } from "./admin-icons";
import { nextSortHref, type AdminListQuery } from "@/lib/admin/query";

// ============================================================
// NEXUS ADMIN — DATA TABLE
// ============================================================
// Dense rows, hairlines, one frame — the only table implementation in the
// control plane. Every list (users, workspaces, subscriptions, activity,
// audit log) renders through these primitives, which is why a column
// header in Audit Log and a column header in Users are the same object.
//
// The properties that matter:
//
//   * Horizontal scroll, never clipping: narrow screens scroll the table
//     inside its frame; no cell content is cut off at any width.
//   * Real <table> semantics — caption, th scope, aria-sort — because a
//     "table" built from divs is unreadable with assistive technology.
//   * One link per row. The title cell's link is stretched over the row
//     (after:absolute after:inset-0), so the whole row is the target while
//     the tab order stays at one stop per line. Rows therefore carry no
//     nested controls — the detail screen owns everything else.
//   * Sorting is a GET link, not JS state: the URL is the single source of
//     truth, refresh / share / back all work, and the server re-validates
//     every parameter through lib/admin/query.
//
// Geometry: 40px rows, 32px header, hairlines owned by the row (so the
// last line never doubles up with the frame), 120ms hover feedback.
// ============================================================

export function AdminTableShell({
  caption,
  children,
  minWidthClass = "min-w-[860px]",
  className,
}: {
  /** Rendered as the table's accessible name. */
  caption: string;
  children: ReactNode;
  minWidthClass?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className={cn("w-full border-collapse text-left", minWidthClass)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function AdminTh({
  children,
  className,
  ariaSort,
}: {
  children: ReactNode;
  className?: string;
  ariaSort?: "ascending" | "descending" | "none";
}) {
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        "whitespace-nowrap border-b border-admin-border px-3 py-2 text-left mono-token font-medium text-admin-text-3",
        className
      )}
    >
      {children}
    </th>
  );
}

/** Sortable header: same query, new sort, direction flipped when the
 *  column is already active. The arrow carries the direction; aria-sort
 *  carries the state for assistive technology. */
export function AdminSortTh({
  label,
  sortKey,
  pathname,
  query,
  className,
}: {
  label: string;
  sortKey: string;
  pathname: string;
  query: AdminListQuery;
  className?: string;
}) {
  const { href, state } = nextSortHref(pathname, query, sortKey);
  return (
    <AdminTh
      className={cn("p-0", className)}
      ariaSort={state === "asc" ? "ascending" : state === "desc" ? "descending" : "none"}
    >
      <Link
        href={href}
        className={cn(
          "flex min-h-8 items-center gap-1 whitespace-nowrap px-3 py-2 no-underline transition-colors duration-[120ms] hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-admin-accent",
          state === "none" ? "text-admin-text-3" : "text-admin-text-2"
        )}
        title={`Sort by ${label.toLowerCase()}`}
      >
        {label}
        {state !== "none" ? (
          <AdminIcon
            name={state === "asc" ? "arrowUp" : "arrowDown"}
            size="action"
            className="text-admin-accent"
          />
        ) : null}
      </Link>
    </AdminTh>
  );
}

/** A dense cell. The row owns the hairline, so a cell never has to know
 *  whether it is the last one. */
export function AdminTd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-3 py-2.5 align-middle text-body", className)}>
      {children}
    </td>
  );
}

/** The row's single link: visible on the title, hit-area across the row. */
export function AdminRowLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "font-medium text-admin-text no-underline after:absolute after:inset-0 after:content-['']",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent hover:text-admin-accent",
        className
      )}
    >
      {children}
    </Link>
  );
}

/** A clickable table row: position context for the stretched link,
 *  hover / focus surfaces, trailing chevron that hints the target. */
export function AdminTableRow({ children }: { children: ReactNode }) {
  return (
    <tr className="group relative border-b border-admin-border transition-colors duration-[120ms] last:border-b-0 hover:bg-admin-surface-2 focus-within:bg-admin-surface-2">
      {children}
      <td className="w-9 px-3 py-2.5 text-right align-middle">
        <span
          aria-hidden="true"
          className="inline-flex h-6 w-6 items-center justify-center rounded-control text-admin-text-3 transition-colors duration-[120ms] group-hover:text-admin-text-2"
        >
          <AdminIcon name="chevronRight" size="action" />
        </span>
      </td>
    </tr>
  );
}

/** A flat row inside a table that is NOT navigable (audit events, activity
 *  rows): hairlines and hover belong to the row, the cells stay plain. */
export function AdminStaticRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "border-b border-admin-border transition-colors duration-[120ms] last:border-b-0 hover:bg-admin-surface-2/60",
        className
      )}
    >
      {children}
    </tr>
  );
}

// ------------------------------------------------------------
// The narrow-screen form of a table
// ------------------------------------------------------------
// Below md a dense table is not readable at any font size, and shrinking
// it destroys exactly the alignment that makes it scannable. The rule is
// therefore structural, not cosmetic: the table keeps its columns from md
// up, and the same rows are rendered as stacked items underneath — same
// primitives, same fields, same order of information, one column instead
// of eight. Critical values stay in the first line; secondary metadata
// moves down rather than out.
//
// Pages pair these with their table:
//   <AdminTableShell className="hidden md:block" …>
//   <AdminCardList>…</AdminCardList>
// which keeps the reading order identical at every width.

/** The stacked form of a table body. Hidden from md up. */
export function AdminCardList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-admin-border md:hidden">{children}</ul>;
}

/** One stacked item. Position context for a stretched link, same hover
 *  and focus surfaces as the desktop row. */
export function AdminCardItem({ children }: { children: ReactNode }) {
  return (
    <li className="relative px-4 py-3 transition-colors duration-[120ms] hover:bg-admin-surface-2 focus-within:bg-admin-surface-2">
      {children}
    </li>
  );
}

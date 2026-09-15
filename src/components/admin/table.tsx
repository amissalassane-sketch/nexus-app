import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { AdminIcon } from "./admin-icons";
import { nextSortHref, type UsersListQuery, type WorkspacesListQuery } from "@/lib/admin/query";

// ============================================================
// NEXUS ADMIN — DATA TABLE (PR 2: USERS / WORKSPACES)
// ============================================================
// Dense rows, hairlines, one frame — the Overview's list language
// extended to full tables. The properties that matter:
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
// ============================================================

export function AdminTableShell({
  caption,
  children,
  minWidthClass = "min-w-[860px]",
}: {
  /** Rendered as the table's accessible name. */
  caption: string;
  children: ReactNode;
  minWidthClass?: string;
}) {
  return (
    <div className="overflow-x-auto">
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
        "whitespace-nowrap border-b border-admin-border px-3 py-2 font-mono text-[10px] font-medium uppercase leading-[14px] tracking-[0.12em] text-admin-text-3",
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
  query: UsersListQuery | WorkspacesListQuery;
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
          "flex items-center gap-1 whitespace-nowrap px-3 py-2 no-underline transition-colors duration-150 hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-admin-accent",
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

export function AdminTd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("border-b border-admin-border/60 px-3 py-2.5 align-middle", className)}>
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
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent hover:text-white",
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
    <tr className="group relative transition-colors duration-150 hover:bg-admin-surface-2/50 focus-within:bg-admin-surface-2/50">
      {children}
      <td className="w-9 border-b border-admin-border/60 px-3 py-2.5 text-right align-middle">
        <span
          aria-hidden="true"
          className="inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-admin-text-3 transition-colors duration-150 group-hover:text-admin-text-2"
        >
          <AdminIcon name="chevronRight" size="action" />
        </span>
      </td>
    </tr>
  );
}

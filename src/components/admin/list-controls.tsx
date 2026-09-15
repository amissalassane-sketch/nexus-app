import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { AdminIcon } from "./admin-icons";
import { listHref, type UsersListQuery, type WorkspacesListQuery } from "@/lib/admin/query";
import { formatCount } from "@/lib/admin/format";

// ============================================================
// NEXUS ADMIN — LIST CONTROLS (PR 2)
// ============================================================
// Search, filters and pagination for the directory lists — all
// server-rendered, zero client JavaScript. The mechanism:
//
//   * The toolbar is a GET <form>. Submitting it navigates; the page
//     re-parses the URL through lib/admin/query. A browser without JS
//     gets the identical experience, and "share this filtered view"
//     works because the state lives in the address bar.
//   * Non-form values that must survive a submit (sort, direction, page
//     size) travel as hidden inputs — the visible fields own the rest.
//   * Pagination is plain links. Page 1 has no ?page=, so every "clear"
//     path returns to the canonical URL instead of accumulating params.
// ============================================================

export function AdminListToolbar({
  pathname,
  query,
  children,
  hasActiveFilters,
}: {
  pathname: string;
  query: UsersListQuery | WorkspacesListQuery;
  /** Select controls rendered inside the form (status / view). */
  children?: ReactNode;
  hasActiveFilters: boolean;
}) {
  return (
    <form
      action={pathname}
      method="get"
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      {/* Sort, direction and page size are not visible fields here; hidden
          inputs carry them through submit so searching never resets the
          ordering you were already reading. Page resets on search — a new
          query is a new first page. */}
      <input type="hidden" name="sort" value={query.sort} />
      <input type="hidden" name="dir" value={query.direction} />
      {query.pageSize !== 25 ? (
        <input type="hidden" name="size" value={String(query.pageSize)} />
      ) : null}

      <div className="relative min-w-0 flex-1">
        <label htmlFor="admin-list-search" className="sr-only">
          Search
        </label>
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-admin-text-3">
          <AdminIcon name="search" size="action" />
        </span>
        <input
          id="admin-list-search"
          type="search"
          name="q"
          defaultValue={query.search ?? ""}
          placeholder="Search…"
          maxLength={200}
          className="h-9 w-full rounded-[8px] border border-admin-border bg-admin-surface pl-8 pr-3 text-[13px] leading-[18px] text-admin-text placeholder:text-admin-text-3 focus-visible:border-admin-accent-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-admin-accent"
        />
      </div>

      {children}

      <button
        type="submit"
        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[8px] border border-admin-border bg-admin-surface px-3 text-[12.5px] leading-[18px] text-admin-text-2 transition-colors duration-150 hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
      >
        <AdminIcon name="search" size="action" />
        Apply
      </button>

      {hasActiveFilters ? (
        <Link
          href={pathname}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] px-2 text-[12.5px] leading-[18px] text-admin-text-2 no-underline transition-colors duration-150 hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
        >
          <AdminIcon name="close" size="action" />
          Clear
        </Link>
      ) : null}
    </form>
  );
}

/** Server-rendered native select. No custom dropdown: a native control is
 *  keyboard- and screen-reader-correct for free, which matters more on an
 *  internal tool than looking bespoke. */
export function AdminSelectFilter({
  id,
  name,
  label,
  value,
  options,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <span className="inline-flex h-9 items-center gap-2">
      <label
        htmlFor={id}
        className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-admin-text-3"
      >
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={value}
        className="h-9 rounded-[8px] border border-admin-border bg-admin-surface px-2 text-[12.5px] leading-[18px] text-admin-text-2 focus-visible:border-admin-accent-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-admin-accent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  );
}

export function AdminPagination({
  pathname,
  query,
  page,
  total,
  pageSize,
  unitLabel,
}: {
  pathname: string;
  query: UsersListQuery | WorkspacesListQuery;
  page: number;
  total: number;
  pageSize: number;
  /** "accounts" / "workspaces" — the sentence reads honestly per list. */
  unitLabel: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1 && total <= pageSize) {
    return (
      <p className="font-mono text-[11px] leading-[16px] text-admin-text-3">
        {formatCount(total)} {unitLabel} · all on one page
      </p>
    );
  }

  const hasPrev = page > 1;
  const hasNext = page < pages;

  const edge = (
    href: string | null,
    dir: "prev" | "next",
    enabled: boolean
  ): ReactNode => {
    const content = (
      <>
        <AdminIcon name={dir === "prev" ? "chevronLeft" : "chevronRight"} size="action" />
        {dir === "prev" ? "Prev" : "Next"}
      </>
    );
    const shape =
      "inline-flex h-8 items-center gap-1 rounded-[8px] border px-2.5 text-[12px] leading-[16px] no-underline";
    if (!enabled || !href) {
      return (
        <span aria-hidden="true" className={cn(shape, "border-admin-border/60 text-admin-text-3 opacity-50")}>
          {content}
        </span>
      );
    }
    return (
      <Link
        href={href}
        rel={dir === "prev" ? "prev" : "next"}
        aria-label={dir === "prev" ? "Previous page" : "Next page"}
        className={cn(
          shape,
          "border-admin-border bg-admin-surface text-admin-text-2 transition-colors duration-150 hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
        )}
      >
        {content}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="font-mono text-[11px] leading-[16px] text-admin-text-3">
        {formatCount(total)} {unitLabel} · page {page} / {pages}
      </p>
      <div className="flex items-center gap-2">
        {edge(hasPrev ? listHref(pathname, query, { page: page - 1 }) : null, "prev", hasPrev)}
        {edge(hasNext ? listHref(pathname, query, { page: page + 1 }) : null, "next", hasNext)}
      </div>
    </nav>
  );
}

/** One-line data provenance for a list: what was read, when, and under
 *  which filters. Keeps "0 results" a statement about the data, visible
 *  next to the timestamp that produced it. */
export function AdminListSummary({
  generatedAt,
  children,
}: {
  generatedAt: string;
  children?: ReactNode;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] leading-[16px] text-admin-text-3">
      {children}
      {children ? <span aria-hidden="true">·</span> : null}
      <span>read {generatedAt.replace("T", " ").replace("Z", " UTC")}</span>
    </p>
  );
}

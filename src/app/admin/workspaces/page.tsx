import type { Metadata } from "next";
import Link from "next/link";
import { AdminRefreshButton } from "@/components/admin/admin-refresh-button";
import { AdminIcon } from "@/components/admin/admin-icons";
import { AdminPlanBadge } from "@/components/admin/badges";
import { AdminSubject, AdminTimeCell } from "@/components/admin/directory";
import {
  AdminListSummary,
  AdminListToolbar,
  AdminPagination,
  AdminSelectFilter,
} from "@/components/admin/list-controls";
import { AdminPanel, AdminSectionTitle } from "@/components/admin/panel";
import { AdminEmptyState, AdminErrorState } from "@/components/admin/states";
import {
  AdminRowLink,
  AdminSortTh,
  AdminTableShell,
  AdminTableRow,
  AdminTd,
  AdminTh,
} from "@/components/admin/table";
import { getAdminWorkspacesList } from "@/lib/admin/directory";
import { formatCount } from "@/lib/admin/format";
import { hasActiveListFilters, parseWorkspacesListQuery } from "@/lib/admin/query";

// ============================================================
// NEXUS ADMIN — WORKSPACES (PR 2)
// ============================================================
// One row per workspace, with its owner, membership, plan (from
// workspace_subscriptions, the documented default for a row-less tenant)
// and content counts — all from the single admin_workspaces_list() read.
//
// What is deliberately NOT here:
//   * A "status" column. workspaces has no status field; inventing one
//     would be a fabricated KPI. Health is shown for what it is — the
//     missing-active-owner condition the Overview also flags.
//   * Revenue figures. Plan ≠ money: no payment provider is connected,
//     so the plan label is the only billing fact that exists.
// ============================================================

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspaces",
  robots: { index: false, follow: false },
};

const PATHNAME = "/admin/workspaces";

const VIEW_OPTIONS = [
  { value: "all", label: "All" },
  { value: "attention", label: "Needs attention" },
  { value: "FREE", label: "Free" },
  { value: "PRO", label: "Pro" },
  { value: "TEAM", label: "Team" },
];

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseWorkspacesListQuery(await searchParams);
  const result = await getAdminWorkspacesList(query);
  const filtersActive = hasActiveListFilters(query);

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-5">
      {/* -------------------------------------------------- header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="sr-only">NEXUS Admin — Workspaces</h1>
          <p className="max-w-[76ch] text-[13px] leading-[20px] text-admin-text-2">
            Every tenant on the platform, read live from the database:
            ownership, membership, plan rows and content counts. A
            workspace has no status column — the only health signal shown
            is the real one, “active owner present or not”.
          </p>
          <p className="mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-[18px] text-admin-text-3">
            <span>
              Workspaces:{" "}
              {result.state === "unavailable" ? (
                <span className="font-mono text-admin-danger">read failed</span>
              ) : (
                <span className="font-mono text-admin-text">
                  {formatCount(result.payload.total)}
                </span>
              )}
            </span>
            <span aria-hidden="true">·</span>
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1 text-admin-text-2 no-underline transition-colors duration-150 hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
            >
              Users
              <AdminIcon name="chevronRight" size="action" />
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {result.state !== "unavailable" ? (
            <AdminListSummary generatedAt={result.payload.generated_at} />
          ) : (
            <span className="font-mono text-[11px] text-admin-danger">Read failed</span>
          )}
          <AdminRefreshButton />
        </div>
      </header>

      {/* ------------------------------------------- search + filters */}
      <AdminListToolbar
        pathname={PATHNAME}
        query={query}
        hasActiveFilters={filtersActive}
      >
        <AdminSelectFilter
          id="workspaces-view"
          name="view"
          label="View"
          value={query.view}
          options={VIEW_OPTIONS}
        />
      </AdminListToolbar>

      {/* ---------------------------------------------------- results */}
      {result.state === "unavailable" ? (
        <AdminPanel>
          <AdminErrorState error={result.error} />
          <div className="mt-3 flex justify-end">
            <AdminRefreshButton />
          </div>
        </AdminPanel>
      ) : result.state === "empty" ? (
        <AdminPanel>
          {result.payload.total === 0 ? (
            <AdminEmptyState
              icon="building"
              title={
                filtersActive
                  ? "No workspaces match this query"
                  : "No workspaces exist yet"
              }
              description={
                filtersActive
                  ? "The read succeeded and found nothing behind these filters. Widen the search or clear the filters — a successful zero is a fact about the query, not a failure of the panel."
                  : "The read succeeded: this database has zero rows in public.workspaces. A brand-new project looks exactly like this."
              }
            />
          ) : (
            <AdminEmptyState
              icon="building"
              title="Nothing on this page"
              description={`There ${
                result.payload.total === 1
                  ? "is 1 matching workspace"
                  : `are ${formatCount(result.payload.total)} matching workspaces`
              }, but none on page ${result.payload.page}.`}
              action={
                <Link
                  href={PATHNAME}
                  className="inline-flex h-8 items-center rounded-[8px] border border-admin-border bg-admin-surface-2 px-3 text-[12.5px] text-admin-text-2 no-underline transition-colors duration-150 hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
                >
                  Back to the first page
                </Link>
              }
            />
          )}
        </AdminPanel>
      ) : (
        <>
          <AdminPanel padded={false}>
            <AdminSectionTitle
              className="px-4 pt-4 sm:px-5"
              title="Tenants"
              description="Click any row for the full inspector: members, projects, tasks, activity."
            />
            <div className="mt-3">
              <AdminTableShell caption="Workspaces, one row per public.workspaces entry">
                <thead>
                  <tr>
                    <AdminSortTh label="Workspace" sortKey="name" pathname={PATHNAME} query={query} />
                    <AdminTh>Owner</AdminTh>
                    <AdminSortTh
                      label="Members"
                      sortKey="members"
                      pathname={PATHNAME}
                      query={query}
                    />
                    <AdminTh>Plan</AdminTh>
                    <AdminSortTh
                      label="Content"
                      sortKey="projects"
                      pathname={PATHNAME}
                      query={query}
                    />
                    <AdminSortTh
                      label="Last activity"
                      sortKey="last_activity"
                      pathname={PATHNAME}
                      query={query}
                    />
                    <AdminSortTh
                      label="Created"
                      sortKey="created_at"
                      pathname={PATHNAME}
                      query={query}
                    />
                    <th scope="col" className="sr-only">
                      Open workspace
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.payload.items.map((row) => (
                    <AdminTableRow key={row.workspace_id}>
                      <AdminTd>
                        <AdminRowLink href={`${PATHNAME}/${row.workspace_id}`}>
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span
                              aria-hidden="true"
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border border-admin-border bg-admin-surface-2 text-admin-text-2"
                            >
                              <AdminIcon name="building" size="action" />
                            </span>
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-x-2">
                                <span className="block max-w-full truncate text-[13px] font-medium leading-[18px] text-admin-text">
                                  {row.name}
                                </span>
                                {!row.has_active_owner ? (
                                  <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.06em] text-admin-danger">
                                    <AdminIcon name="warning" size="action" />
                                    no owner
                                  </span>
                                ) : null}
                              </span>
                              <span className="block truncate font-mono text-[11px] leading-[15px] text-admin-text-3">
                                {row.slug}
                              </span>
                            </span>
                          </span>
                        </AdminRowLink>
                      </AdminTd>
                      <AdminTd className="max-w-[220px]">
                        <AdminSubject
                          displayName={row.owner.display_name}
                          username={row.owner.username}
                          email={row.owner.email}
                          id={row.owner.user_id}
                        />
                      </AdminTd>
                      <AdminTd>
                        <span className="font-mono text-[12.5px] tabular-nums text-admin-text">
                          {formatCount(row.members.total)}
                        </span>
                        <span className="ml-1.5 font-mono text-[11px] text-admin-text-3">
                          {row.members.active} active
                        </span>
                      </AdminTd>
                      <AdminTd>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <AdminPlanBadge plan={row.plan} />
                          {!row.has_subscription ? (
                            <span
                              className="font-mono text-[10px] uppercase tracking-[0.06em] text-admin-text-3"
                              title="No workspace_subscriptions row: this is get_workspace_plan()'s default, not a measured plan"
                            >
                              default
                            </span>
                          ) : null}
                        </span>
                      </AdminTd>
                      <AdminTd>
                        <span className="font-mono text-[12.5px] tabular-nums text-admin-text-2">
                          {formatCount(row.projects)}{" "}
                          <span className="text-admin-text-3">projects</span> ·{" "}
                          {formatCount(row.tasks)}{" "}
                          <span className="text-admin-text-3">tasks</span>
                        </span>
                      </AdminTd>
                      <AdminTd>
                        <AdminTimeCell iso={row.last_activity_at} />
                      </AdminTd>
                      <AdminTd>
                        <AdminTimeCell iso={row.created_at} />
                      </AdminTd>
                    </AdminTableRow>
                  ))}
                </tbody>
              </AdminTableShell>
            </div>
          </AdminPanel>

          <AdminPagination
            pathname={PATHNAME}
            query={query}
            page={result.payload.page}
            total={result.payload.total}
            pageSize={result.payload.page_size}
            unitLabel="workspaces"
          />
        </>
      )}

      {/* ------------------------------------------------- footnotes */}
      <p className="max-w-[92ch] text-[11.5px] leading-[16px] text-admin-text-3">
        Definitions: <span className="font-mono">Plan</span> comes from the
        workspace&apos;s active row in{" "}
        <span className="font-mono">workspace_subscriptions</span>; tenants
        without a row show the default plan the application applies (
        <span className="font-mono">FREE</span>), marked{" "}
        <span className="font-mono">default</span>.{" "}
        <span className="font-mono">Last activity</span> is the newest row
        in <span className="font-mono">activities</span> for that workspace,
        written by the 015 triggers. “Needs attention” flags exactly one
        measured condition — no active owner membership — the same
        condition the Overview reports. No payment provider is connected,
        so plan is a label, not money.
      </p>
    </div>
  );
}

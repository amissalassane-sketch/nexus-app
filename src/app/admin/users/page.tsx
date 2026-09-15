import type { Metadata } from "next";
import Link from "next/link";
import { AdminRefreshButton } from "@/components/admin/admin-refresh-button";
import { AdminIcon } from "@/components/admin/admin-icons";
import {
  AdminAccountBadge,
  AdminPlatformRoleBadge,
} from "@/components/admin/badges";
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
import { getAdminUsersList } from "@/lib/admin/directory";
import { formatCount, NOT_AVAILABLE } from "@/lib/admin/format";
import { hasActiveListFilters, parseUsersListQuery } from "@/lib/admin/query";

// ============================================================
// NEXUS ADMIN — USERS (PR 2)
// ============================================================
// The platform directory: one row per auth.users account, enriched from
// profiles, workspace_members, activities and platform_admins — all in
// the single admin_users_list() read. No client fetches, no pagination
// arithmetic on the client, no value that the database did not return.
//
// What is deliberately NOT here:
//   * "Last login IP", device or session data — GoTrue rows are not
//     readable without the service key this app does not hold.
//   * Revenue / plan per user — subscriptions are workspace-scoped, not
//     user-scoped; attributing money to an account would be a guess.
//   * Any write action. This page, and the RPC behind it, cannot change a
//     row. (See the inspector for the actions policy.)
// ============================================================

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

const PATHNAME = "/admin/users";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Awaiting email" },
  { value: "banned", label: "Banned" },
  { value: "no_profile", label: "Missing profile" },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseUsersListQuery(await searchParams);
  const result = await getAdminUsersList(query);
  const filtersActive = hasActiveListFilters(query);

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-5">
      {/* -------------------------------------------------- header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="sr-only">NEXUS Admin — Users</h1>
          <p className="max-w-[76ch] text-[13px] leading-[20px] text-admin-text-2">
            Every NEXUS account, read live from the platform database.
            Status is derived from real GoTrue state — the schema has no
            account-status column to display.
          </p>
          <p className="mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-[18px] text-admin-text-3">
            <span>
              Accounts:{" "}
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
              href="/admin/workspaces"
              className="inline-flex items-center gap-1 text-admin-text-2 no-underline transition-colors duration-150 hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
            >
              Workspaces
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
          id="users-status"
          name="status"
          label="Status"
          value={query.status}
          options={STATUS_OPTIONS}
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
              icon="users"
              title={
                filtersActive
                  ? "No accounts match this query"
                  : "No accounts exist yet"
              }
              description={
                filtersActive
                  ? "The read succeeded and found nothing behind these filters. Widen the search or clear the filters — a successful zero is a fact about the query, not a failure of the panel."
                  : "The read succeeded: this database has zero rows in auth.users. A brand-new project looks exactly like this."
              }
            />
          ) : (
            // total > 0 but this page has no rows: pagination went past
            // the end. That is a navigation state, not an empty platform.
            <AdminEmptyState
              icon="users"
              title="Nothing on this page"
              description={`There ${
                result.payload.total === 1 ? "is 1 matching account" : `are ${formatCount(result.payload.total)} matching accounts`
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
              title="Accounts"
              description="Newest-first by default; click any row for the full inspector."
            />
            <div className="mt-3">
              <AdminTableShell caption="Platform accounts, one row per auth.users entry">
                <thead>
                  <tr>
                    <AdminSortTh label="User" sortKey="name" pathname={PATHNAME} query={query} />
                    <AdminSortTh label="Email" sortKey="email" pathname={PATHNAME} query={query} />
                    <AdminTh>Status</AdminTh>
                    <AdminTh>Role / context</AdminTh>
                    <AdminSortTh
                      label="Workspaces"
                      sortKey="workspaces"
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
                      Open user
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.payload.items.map((row) => (
                    <AdminTableRow key={row.user_id}>
                      <AdminTd>
                        <AdminRowLink href={`${PATHNAME}/${row.user_id}`}>
                          <AdminSubject
                            displayName={row.display_name}
                            username={row.username}
                            email={row.email}
                            id={row.user_id}
                          />
                        </AdminRowLink>
                      </AdminTd>
                      <AdminTd className="max-w-[240px]">
                        {row.email ? (
                          <span className="block truncate font-mono text-[12px] leading-[16px] text-admin-text-2">
                            {row.email}
                          </span>
                        ) : (
                          <span className="text-admin-text-3">{NOT_AVAILABLE}</span>
                        )}
                      </AdminTd>
                      <AdminTd>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <AdminAccountBadge status={row.account_status} />
                          {row.has_profile ? null : (
                            <span
                              className="font-mono text-[10px] uppercase tracking-[0.06em] text-admin-warning"
                              title="No profiles row for this account — the signup trigger did not complete. The app self-repairs on next load."
                            >
                              no profile
                            </span>
                          )}
                        </span>
                      </AdminTd>
                      <AdminTd>
                        {row.platform_role ? (
                          <AdminPlatformRoleBadge role={row.platform_role} />
                        ) : row.memberships.owned > 0 ? (
                          <span className="text-[12px] leading-[16px] text-admin-text-3">
                            Workspace owner
                          </span>
                        ) : row.memberships.total > 0 ? (
                          <span className="text-[12px] leading-[16px] text-admin-text-3">
                            Workspace member
                          </span>
                        ) : (
                          <span className="text-[12px] leading-[16px] text-admin-text-3">
                            No workspace context
                          </span>
                        )}
                      </AdminTd>
                      <AdminTd>
                        <span className="font-mono text-[12.5px] tabular-nums text-admin-text">
                          {formatCount(row.memberships.total)}
                        </span>
                        <span className="ml-1.5 font-mono text-[11px] text-admin-text-3">
                          {row.memberships.active} active · {row.memberships.owned} owned
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
            unitLabel="accounts"
          />
        </>
      )}

      {/* ------------------------------------------------- footnotes */}
      <p className="max-w-[92ch] text-[11.5px] leading-[16px] text-admin-text-3">
        Definitions, stated so numbers cannot be over-read:{" "}
        <span className="font-mono">Status</span> is banned / awaiting-email
        / active from GoTrue&apos;s <span className="font-mono">banned_until</span>{" "}
        and <span className="font-mono">email_confirmed_at</span> — there is
        no other account flag in the schema.{" "}
        <span className="font-mono">Last activity</span> is the later of the
        last sign-in and the most recent workspace event this account caused
        (the <span className="font-mono">activities</span> stream, filled by
        database triggers). Counts of workspaces are memberships rows, active
        and owned included. Sign-in sessions, IPs and device data are not
        listed: GoTrue keeps them behind the service role key this
        application does not hold.
      </p>
    </div>
  );
}

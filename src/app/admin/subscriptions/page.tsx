import type { Metadata } from "next";
import Link from "next/link";
import { AdminRefreshButton } from "@/components/admin/admin-refresh-button";
import { AdminIcon } from "@/components/admin/admin-icons";
import {
  AdminPlanBadge,
  AdminSubscriptionStatusBadge,
} from "@/components/admin/badges";
import { AdminSubject, AdminTimeCell } from "@/components/admin/directory";
import { KpiGrid, KpiTile } from "@/components/admin/kpi";
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
import { getAdminSubscriptionsList } from "@/lib/admin/subscriptions";
import { formatCount, NOT_AVAILABLE } from "@/lib/admin/format";
import {
  hasActiveListFilters,
  parseSubscriptionsListQuery,
} from "@/lib/admin/query";

// ============================================================
// NEXUS ADMIN — SUBSCRIPTIONS (PR 6)
// ============================================================
// One row per workspace: the effective plan, the live subscription row
// (the active row when one exists, else the latest row), the owner,
// live usage and the enforced limits — all in the single
// admin_subscriptions_list() read. No client fetches, no value the
// database did not return.
//
// What is deliberately NOT here:
//   * Money. No payment provider is connected (/api/billing/upgrade
//     returns PAYMENT_PROVIDER_NOT_CONFIGURED), so there is no MRR,
//     no invoice and no charge to show. The `billing_wired` column
//     states per row whether a provider ever wrote here.
//   * Per-user plans. Subscriptions are workspace-scoped; the owner
//     is shown as a contact, never as a payer.
//   * A detail screen. Rows link to the workspace inspector, which
//     already shows the plan rows — a second inspector would be a
//     duplicate surface.
// ============================================================

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subscriptions",
  robots: { index: false, follow: false },
};

const PATHNAME = "/admin/subscriptions";

const PLAN_OPTIONS = [
  { value: "all", label: "All" },
  { value: "FREE", label: "Free" },
  { value: "PRO", label: "Pro" },
  { value: "TEAM", label: "Team" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trialing" },
  { value: "past_due", label: "Past due" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
  { value: "implicit_free", label: "Implicit free" },
];

function UsageCell({ used, limit }: { used: number; limit: number }) {
  const over = used > limit;
  return (
    <span className="font-mono text-[12.5px] tabular-nums text-admin-text">
      {formatCount(used)}
      <span className="text-admin-text-3"> / {formatCount(limit)}</span>
      {over ? (
        <span
          className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-admin-warning"
          title="Usage exceeds the effective plan's enforced limit. The write guards stop new rows; existing rows stay readable."
        >
          over
        </span>
      ) : null}
    </span>
  );
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseSubscriptionsListQuery(await searchParams);
  const result = await getAdminSubscriptionsList(query);
  const filtersActive = hasActiveListFilters(query);
  const summary =
    result.state === "unavailable" ? null : result.payload.summary;

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-5">
      {/* -------------------------------------------------- header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="sr-only">NEXUS Admin — Subscriptions</h1>
          <p className="max-w-[76ch] text-[13px] leading-[20px] text-admin-text-2">
            Every workspace&apos;s effective plan, read live from the
            platform database. A workspace without a subscription row is
            on the documented default FREE plan — shown as{" "}
            <span className="font-mono text-admin-text">implicit free</span>,
            never as a subscription that was read.
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
          id="subscriptions-plan"
          name="plan"
          label="Plan"
          value={query.plan}
          options={PLAN_OPTIONS}
        />
        <AdminSelectFilter
          id="subscriptions-status"
          name="status"
          label="Status"
          value={query.status}
          options={STATUS_OPTIONS}
        />
      </AdminListToolbar>

      {/* ---------------------------------------------------- summary */}
      {summary ? (
        <KpiGrid>
          <KpiTile
            label="Paid workspaces"
            value={formatCount(summary.plans.pro + summary.plans.team)}
            definition="Workspaces on an effective PRO or TEAM plan, in this query."
            hint={`${formatCount(summary.plans.pro)} Pro · ${formatCount(summary.plans.team)} Team · ${formatCount(summary.plans.free)} Free`}
          />
          <KpiTile
            label="Active rows"
            value={formatCount(summary.statuses.active)}
            definition="Live rows with status active, in this query."
            hint={`${formatCount(summary.statuses.trialing)} trialing · ${formatCount(summary.statuses.implicit_free)} implicit free`}
          />
          <KpiTile
            label="Past due"
            value={formatCount(summary.statuses.past_due)}
            definition="Live rows with status past_due, in this query."
            hint={`${formatCount(summary.statuses.cancelled)} cancelled · ${formatCount(summary.statuses.expired)} expired`}
          />
          <KpiTile
            label="Needs attention"
            value={formatCount(summary.attention)}
            definition="Past-due, cancelled or expired live rows, plus workspaces with no active owner."
            tone={summary.attention > 0 ? "accent" : "default"}
          />
        </KpiGrid>
      ) : null}

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
              icon="creditCard"
              title={
                filtersActive
                  ? "No subscriptions match this query"
                  : "No workspaces exist yet"
              }
              description={
                filtersActive
                  ? "The read succeeded and found nothing behind these filters. Widen the search or clear the filters — a successful zero is a fact about the query, not a failure of the panel."
                  : "The read succeeded: this database has zero workspaces, so there is nothing to bill. A brand-new project looks exactly like this."
              }
            />
          ) : (
            <AdminEmptyState
              icon="creditCard"
              title="Nothing on this page"
              description={`There ${
                result.payload.total === 1 ? "is 1 matching workspace" : `are ${formatCount(result.payload.total)} matching workspaces`
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
              title="Subscriptions"
              description="One row per workspace, paid plans first; click any row for the workspace inspector."
            />
            <div className="mt-3">
              <AdminTableShell caption="Workspace subscriptions, one row per workspace">
                <thead>
                  <tr>
                    <AdminSortTh label="Workspace" sortKey="name" pathname={PATHNAME} query={query} />
                    <AdminSortTh label="Plan" sortKey="plan" pathname={PATHNAME} query={query} />
                    <AdminSortTh label="Status" sortKey="status" pathname={PATHNAME} query={query} />
                    <AdminTh>Usage</AdminTh>
                    <AdminSortTh
                      label="Period end"
                      sortKey="period_end"
                      pathname={PATHNAME}
                      query={query}
                    />
                    <AdminTh>Owner</AdminTh>
                    <th scope="col" className="sr-only">
                      Open workspace
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.payload.items.map((row) => (
                    <AdminTableRow key={row.workspace_id}>
                      <AdminTd>
                        <AdminRowLink href={`/admin/workspaces/${row.workspace_id}`}>
                          <AdminSubject
                            displayName={row.name}
                            username={row.slug}
                            email={null}
                            id={row.workspace_id}
                          />
                        </AdminRowLink>
                      </AdminTd>
                      <AdminTd>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <AdminPlanBadge plan={row.plan} />
                          {row.has_subscription ? null : (
                            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-admin-text-3">
                              implicit
                            </span>
                          )}
                        </span>
                      </AdminTd>
                      <AdminTd>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <AdminSubscriptionStatusBadge
                            status={row.subscription_status}
                          />
                          {row.previous_rows > 0 ? (
                            <span
                              className="font-mono text-[10px] text-admin-text-3"
                              title="Non-active subscription rows kept as history for this workspace."
                            >
                              +{row.previous_rows} prior
                            </span>
                          ) : null}
                        </span>
                      </AdminTd>
                      <AdminTd>
                        <span className="flex flex-col gap-1">
                          <span className="flex items-center gap-1.5">
                            <span className="w-[52px] shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-admin-text-3">
                              Proj
                            </span>
                            <UsageCell
                              used={row.usage.projects}
                              limit={row.limits.projects}
                            />
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-[52px] shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-admin-text-3">
                              Tasks
                            </span>
                            <UsageCell
                              used={row.usage.active_tasks}
                              limit={row.limits.active_tasks}
                            />
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-[52px] shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-admin-text-3">
                              Goals
                            </span>
                            <UsageCell
                              used={row.usage.goals}
                              limit={row.limits.goals}
                            />
                          </span>
                        </span>
                      </AdminTd>
                      <AdminTd>
                        <AdminTimeCell iso={row.current_period_end} />
                      </AdminTd>
                      <AdminTd className="max-w-[220px]">
                        {row.owner.email ? (
                          <span className="block truncate font-mono text-[12px] leading-[16px] text-admin-text-2">
                            {row.owner.email}
                          </span>
                        ) : row.owner.display_name ? (
                          <span className="block truncate text-[12.5px] text-admin-text-2">
                            {row.owner.display_name}
                          </span>
                        ) : (
                          <span className="text-admin-text-3">{NOT_AVAILABLE}</span>
                        )}
                        {row.has_active_owner ? null : (
                          <span
                            className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.06em] text-admin-warning"
                            title="No workspace_members row with role owner and status active. Nobody can currently administer this workspace."
                          >
                            no active owner
                          </span>
                        )}
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
        Definitions, stated so numbers cannot be over-read:{" "}
        <span className="font-mono">Plan</span> is the active row&apos;s plan,
        or FREE when no active row exists (
        <span className="font-mono">implicit</span>) — the identical predicate
        the workspaces screen uses, so the two can never disagree.{" "}
        <span className="font-mono">Status</span> is the live row: the active
        row when one exists, otherwise the most recently updated row — a
        cancelled subscription stays visible as cancelled until replaced.{" "}
        <span className="font-mono">Usage</span> is live counts against the
        limits for <span className="font-mono">get_workspace_plan()</span>,
        the period-aware resolution the write guards enforce: a lapsed paid
        row shows its paid plan with FREE limits, and that mismatch is the
        signal. <span className="font-mono">Tasks</span> counts active tasks
        only (neither done nor cancelled). No money is shown anywhere on
        this screen: no payment provider is connected, so there is no
        revenue to report and none is estimated.
      </p>
    </div>
  );
}

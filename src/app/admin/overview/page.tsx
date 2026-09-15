import type { Metadata } from "next";
import { ActivityCount, ActivityList } from "@/components/admin/activity-list";
import { AdminRefreshButton } from "@/components/admin/admin-refresh-button";
import { HealthList } from "@/components/admin/health-list";
import { KpiGrid, KpiTile } from "@/components/admin/kpi";
import {
  AdminDivider,
  AdminEyebrow,
  AdminField,
  AdminFieldList,
  AdminPanel,
  AdminSectionTitle,
} from "@/components/admin/panel";
import {
  AdminEmptyState,
  AdminErrorState,
  AdminNotMeasured,
} from "@/components/admin/states";
import { AdminSeverityIcon } from "@/components/admin/status";
import { getAdminOverview } from "@/lib/admin/data";
import {
  formatCompact,
  formatCount,
  formatDateTime,
  formatRelativeTime,
  formatShare,
  NOT_AVAILABLE,
} from "@/lib/admin/format";
import { getPlatformHealth, summariseHealth } from "@/lib/admin/health";

// ============================================================
// NEXUS ADMIN — OVERVIEW
// ============================================================
// The first question a control plane has to answer: what is happening
// right now? Every figure on this page is produced by admin_overview()
// over real tables, or measured live by a health probe. Where a figure
// does not exist, the tile says so.
//
// The two absences worth naming explicitly, because both look like bugs
// until you know why they are there:
//
//   MRR is "Not available" — there is no payment provider in this
//   codebase (/api/billing/upgrade returns PAYMENT_PROVIDER_NOT_CONFIGURED),
//   so there is no revenue to report and inventing one would poison every
//   decision made from this screen.
//
//   "Active Users" counts GoTrue sign-ins, not in-product activity. The
//   tile states its own definition so the number cannot be over-read.
// ============================================================

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overview",
  robots: { index: false, follow: false },
};

export default async function AdminOverviewPage() {
  // Independent measurements: a failing aggregate must not blank the
  // health panel, and a slow probe must not hide the business numbers.
  const [result, services] = await Promise.all([
    getAdminOverview(),
    getPlatformHealth(),
  ]);

  const health = summariseHealth(services);
  const overview = result.ok ? result.overview : null;
  const generatedAt = overview?.generated_at ?? new Date().toISOString();

  // When the aggregate itself failed there is no activity read to show
  // either — but that is reported as unavailable, never as an empty feed.
  const activity = result.ok
    ? result.activity
    : { state: "unavailable" as const, error: result.error };

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-6">
      {/* -------------------------------------------------- header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <AdminEyebrow>Control</AdminEyebrow>
          <h1 className="mt-1.5 text-[22px] font-semibold leading-[28px] tracking-[-0.025em] text-admin-text">
            Overview
          </h1>
          <p className="mt-1.5 max-w-[70ch] text-[13px] leading-[20px] text-admin-text-2">
            Platform performance and business health, read from the live
            database. Nothing here is estimated or cached.
          </p>
          <p className="mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11.5px] leading-[16px] text-admin-text-3">
            <span>Updated {formatRelativeTime(generatedAt)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDateTime(generatedAt)}</span>
            <span aria-hidden="true">·</span>
            <span>Period: last 30 days</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-admin-border bg-admin-surface px-2.5 font-mono text-[11px] uppercase leading-none tracking-[0.06em] text-admin-text-2">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${
                health.status === "operational"
                  ? "bg-admin-success"
                  : health.status === "degraded"
                    ? "bg-admin-warning"
                    : health.status === "down"
                      ? "bg-admin-danger"
                      : "bg-admin-text-3"
              }`}
            />
            {health.label}
          </span>
          <AdminRefreshButton />
        </div>
      </header>

      {/* ------------------------------------------- headline KPIs */}
      <KpiGrid>
        <KpiTile
          label="Total Users"
          value={formatCount(overview?.users.total)}
          definition="Accounts in auth.users"
          hint={
            overview
              ? `${formatCount(overview.users.email_confirmed)} confirmed email${
                  formatShare(overview.users.email_confirmed, overview.users.total)
                    ? ` · ${formatShare(overview.users.email_confirmed, overview.users.total)}`
                    : ""
                }`
              : undefined
          }
        />
        <KpiTile
          label="Active Users"
          value={formatCount(overview?.users.active_30d)}
          definition="Signed in during the last 30 days"
          hint="GoTrue sign-ins, not in-product activity"
        />
        <KpiTile
          label="Workspaces"
          value={formatCount(overview?.workspaces.total)}
          definition="Workspaces created"
          hint={
            overview
              ? `${formatCount(overview.workspaces.new_30d)} in the last 30 days`
              : undefined
          }
        />
        <KpiTile
          label="MRR"
          value={NOT_AVAILABLE}
          definition="No payment provider is connected"
          hint="Revenue appears here the moment billing is wired up"
        />
      </KpiGrid>

      {/* The aggregate read is the single point where platform data can
          fail; when it does, say so loudly instead of rendering zeros. */}
      {result.ok ? null : <AdminErrorState error={result.error} />}

      {/* ------------------------------------- health + attention */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <AdminPanel labelledBy="platform-health-title">
          <AdminSectionTitle
            title="Platform Health"
            description="Measured on this request. A service with nothing to measure is reported as Unknown, never as healthy."
          />
          <div className="mt-4">
            <HealthList services={services} />
          </div>
          <AdminDivider className="my-4" />
          <p className="font-mono text-[11px] leading-[16px] text-admin-text-3">
            Latency is the round trip of a real probe. Above 1500 ms a
            measured service is reported as Degraded. No uptime percentage
            is shown: this application keeps no time-series history to
            compute one from.
          </p>
        </AdminPanel>

        <AdminPanel labelledBy="needs-attention-title">
          <AdminSectionTitle
            title="Needs Attention"
            description="Computed from conditions in the data, not from a static checklist."
          />
          <div className="mt-4">
            {overview && overview.needs_attention.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {overview.needs_attention.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2.5 rounded-[8px] border border-admin-border bg-admin-surface-2 px-3 py-2.5"
                  >
                    <span className="mt-0.5 shrink-0">
                      <AdminSeverityIcon severity={item.severity} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-2 text-[13px] font-medium leading-[18px] text-admin-text">
                        {item.title}
                        <span className="font-mono text-[11.5px] tabular-nums text-admin-text-2">
                          {formatCount(item.count)}
                        </span>
                      </p>
                      <p className="mt-1 text-[12px] leading-[17px] text-admin-text-2">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : overview ? (
              <AdminEmptyState
                compact
                icon="check"
                title="Nothing needs attention"
                description="No workspace is missing an owner, every account has a profile row, and no subscription is past due."
              />
            ) : (
              <AdminNotMeasured reason="The platform aggregate could not be read." />
            )}
          </div>
        </AdminPanel>
      </div>

      {/* --------------------------------------- growth + usage */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminPanel>
          <AdminSectionTitle
            title="Growth"
            description="New accounts and workspaces, from created_at."
          />
          <AdminFieldList className="mt-3">
            <AdminField
              label="New accounts · 7 days"
              value={formatCount(overview?.users.new_7d)}
            />
            <AdminField
              label="New accounts · 30 days"
              value={formatCount(overview?.users.new_30d)}
            />
            <AdminField
              label="New workspaces · 7 days"
              value={formatCount(overview?.workspaces.new_7d)}
            />
            <AdminField
              label="New workspaces · 30 days"
              value={formatCount(overview?.workspaces.new_30d)}
            />
            <AdminField
              label="Active memberships"
              value={formatCount(overview?.memberships.active)}
              hint={`of ${formatCount(overview?.memberships.total)} total`}
            />
            <AdminField
              label="Signed in · 30 days"
              value={formatCount(overview?.users.active_30d)}
            />
          </AdminFieldList>
          <AdminDivider className="my-3" />
          <p className="text-[12px] leading-[17px] text-admin-text-2">
            Plan mix today:{" "}
            <span className="font-mono tabular-nums text-admin-text">
              {formatCount(overview?.plans.free)} Free
            </span>
            {" · "}
            <span className="font-mono tabular-nums text-admin-text">
              {formatCount(overview?.plans.pro)} Pro
            </span>
            {" · "}
            <span className="font-mono tabular-nums text-admin-text">
              {formatCount(overview?.plans.team)} Team
            </span>
            . Conversion and churn are not shown: without a payment
            provider there are no paid transitions to measure.
          </p>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle
            title="Product Usage"
            description="Rows that exist in the product tables, counted across every workspace."
          />
          <AdminFieldList className="mt-3">
            <AdminField label="Projects" value={formatCount(overview?.usage.projects)} />
            <AdminField label="Goals" value={formatCount(overview?.usage.goals)} />
            <AdminField
              label="Tasks"
              value={formatCount(overview?.usage.tasks)}
              hint={`${formatCount(overview?.usage.tasks_open)} open · ${formatCount(
                overview?.usage.tasks_blocked
              )} blocked · ${formatCount(overview?.usage.tasks_done)} done`}
            />
            <AdminField
              label="Unread notifications"
              value={formatCount(overview?.usage.notifications_unread)}
            />
            <AdminField
              label="Intelligence signals"
              value={
                overview?.usage.intelligence_signals === undefined ||
                overview === null
                  ? NOT_AVAILABLE
                  : formatCompact(overview.usage.intelligence_signals)
              }
            />
            <AdminField
              label="Intelligence missions"
              value={
                overview?.usage.intelligence_missions === undefined ||
                overview === null
                  ? NOT_AVAILABLE
                  : formatCompact(overview.usage.intelligence_missions)
              }
            />
            <AdminField
              label="Workspace events"
              value={formatCount(overview?.activity.events_total)}
              hint={`${formatCount(overview?.activity.events_7d)} in the last 7 days`}
            />
          </AdminFieldList>
          <AdminDivider className="my-3" />
          <p className="text-[12px] leading-[17px] text-admin-text-2">
            Sessions are not listed: GoTrue session rows are only readable
            with the service role key, which this application deliberately
            does not hold.
          </p>
        </AdminPanel>
      </div>

      {/* --------------------------------------- recent activity */}
      <AdminPanel>
        <AdminSectionTitle
          title="Recent Activity"
          description="Newest first, assembled from real rows. Each entry names the table it came from."
          action={
            <ActivityCount
              activity={activity}
              recordedEvents={
                overview ? formatCount(overview.activity.events_total) : null
              }
            />
          }
        />
        <div className="mt-4">
          <ActivityList activity={activity} />
        </div>
      </AdminPanel>
    </div>
  );
}

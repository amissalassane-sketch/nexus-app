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
import {
  getAdminOverview,
  getAutomationHealth,
  getIntelligenceHealth,
  getIntegrationHealth,
  type HealthPanelResult,
} from "@/lib/admin/data";
import { attentionActionFor } from "@/lib/admin/attention";
import {
  formatBoolean,
  formatCompact,
  formatCount,
  formatDateTime,
  formatMs,
  formatRelativeOr,
  formatRelativeTime,
  formatShare,
  formatSucceededFailed,
  formatTokens,
  NOT_AVAILABLE,
} from "@/lib/admin/format";
import { getPlatformHealth, summariseHealth } from "@/lib/admin/health";

// ============================================================
// NEXUS ADMIN — OVERVIEW (CONTROL PLANE)
// ============================================================
// The first question a control plane has to answer: what is happening
// right now? The page is organised as nine sections, each answering
// one operator question:
//
//   1. Platform status    — is NEXUS healthy?
//   2. Business health    — is NEXUS being used / paid for?
//   3. Product usage      — what exists in the product tables?
//   4. Intelligence       — is Intelligence healthy and used?
//   5. Integrations       — are external connections healthy?
//   6. Data integrity     — is the data itself sound?
//   7. Background jobs    — did automated work run?
//   8. Needs attention    — is there something to fix? (with actions)
//   9. Recent activity    — what just happened?
//
// Every figure is produced by a real RPC over real tables, or
// measured live by a health probe. Where a figure does not exist,
// the tile says so. Two absences are worth naming explicitly:
//
//   MRR is "Not available" — there is no payment provider in this
//   codebase (/api/billing/upgrade returns PAYMENT_PROVIDER_NOT_CONFIGURED),
//   so there is no revenue to report and inventing one would poison
//   every decision made from this screen.
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
  const [result, services, intelligence, integrations, automations] =
    await Promise.all([
      getAdminOverview(),
      getPlatformHealth(),
      getIntelligenceHealth().catch(() => null),
      getIntegrationHealth().catch(() => null),
      getAutomationHealth().catch(() => null),
    ]);

  const health = summariseHealth(services);
  const overview = result.ok ? result.overview : null;
  const generatedAt = overview?.generated_at ?? new Date().toISOString();

  // When the aggregate itself failed there is no activity read to show
  // either — but that is reported as unavailable, never as an empty feed.
  const activity = result.ok
    ? result.activity
    : { state: "unavailable" as const, error: result.error };

  const aiRequests24h = panelValue(intelligence, (d) => d.requests_24h);
  const aiFallbacks24h = panelValue(intelligence, (d) => d.fallbacks_24h);
  const connectionTotals = integrations?.state === "ok" ? integrations.data.connections : null;
  const executionTotals = automations?.state === "ok" ? automations.data.executions : null;

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
            Platform status, business health and product usage, read from the
            live database. Nothing here is estimated or cached.
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
                  : health.status === "degraded" || health.status === "stale"
                    ? "bg-admin-warning"
                    : health.status === "error"
                      ? "bg-admin-danger"
                      : "bg-admin-text-3"
              }`}
            />
            {health.label}
          </span>
          <AdminRefreshButton />
        </div>
      </header>

      {/* The aggregate read is the single point where platform data can
          fail; when it does, say so loudly instead of rendering zeros. */}
      {result.ok ? null : <AdminErrorState error={result.error} />}

      {/* ------------------------------- 1. platform status */}
      <AdminPanel labelledBy="platform-health-title">
        <AdminSectionTitle
          title="Platform Status"
          description="Measured on this request. A subsystem that is absent by deployment decision is Not configured; a subsystem nothing can check is Not measured. Neither is ever shown as healthy."
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

      {/* ------------------------------- 2. business health */}
      <section aria-labelledby="business-health-title">
        <h2
          id="business-health-title"
          className="text-[15px] font-semibold leading-[20px] tracking-[-0.01em] text-admin-text"
        >
          Business health
        </h2>
        <KpiGrid className="mt-3">
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

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
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

          {/* --------------------------- 3. product usage */}
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
                  overview?.usage.intelligence_signals === undefined || overview === null
                    ? NOT_AVAILABLE
                    : formatCompact(overview.usage.intelligence_signals)
                }
              />
              <AdminField
                label="Intelligence missions"
                value={
                  overview?.usage.intelligence_missions === undefined || overview === null
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
      </section>

      {/* ------------------------------- 4. intelligence health */}
      <div id="intelligence-health" className="scroll-mt-6">
        <AdminPanel labelledBy="intelligence-health-title">
        <AdminSectionTitle
          title="Intelligence Health"
          description="Every request Intelligence served, from the request log. No request has ever been logged until the numbers below say so."
        />
        <div className="mt-3">
          {intelligence?.state === "ok" ? (
            <>
              <AdminFieldList>
                <AdminField
                  label="Requests · 24 hours"
                  value={formatCount(aiRequests24h)}
                  hint={
                    intelligence.data.requests_30d !== null
                      ? `${formatCount(intelligence.data.requests_30d)} in the last 30 days`
                      : undefined
                  }
                />
                <AdminField
                  label="Distinct users · 7 days"
                  value={formatCount(intelligence.data.distinct_users_7d)}
                />
                <AdminField
                  label="Average latency · 24 hours"
                  value={formatMs(intelligence.data.avg_latency_ms_24h)}
                />
                <AdminField
                  label="Errors · 24 hours"
                  value={formatCount(intelligence.data.errors_24h)}
                />
                <AdminField
                  label="Deterministic fallbacks · 24 hours"
                  value={formatCount(aiFallbacks24h)}
                  hint="Requests answered by the built-in engine because the model was unavailable — honest degradation, not failure"
                />
                <AdminField
                  label="Tokens · 30 days"
                  value={formatTokens(
                    intelligence.data.input_tokens_30d,
                    intelligence.data.output_tokens_30d
                  )}
                  hint="Token counts come from provider responses; cost is not shown because no price table is connected"
                />
                <AdminField
                  label="Last request"
                  value={formatRelativeOr(intelligence.data.last_request_at, "No request logged yet")}
                />
              </AdminFieldList>
              <AdminDivider className="my-3" />
              <p className="text-[12px] leading-[17px] text-admin-text-2">
                Provider reachability is not probed from this panel; the
                provider column in Platform status states whether a model
                key is configured at all.
              </p>
            </>
          ) : intelligence?.state === "unavailable" ? (
            <AdminErrorState error={intelligence.error} />
          ) : (
            <AdminNotMeasured reason="Intelligence metrics could not be read." />
          )}
        </div>
        </AdminPanel>
      </div>

      {/* ------------------------------- 5. integration health */}
      <AdminPanel>
        <AdminSectionTitle
          title="Integration Health"
          description="Real connections from integration_connections. A provider with no connection row is absent by user choice, not by failure."
        />
        <div className="mt-3">
          {integrations?.state === "ok" ? (
            <>
              <AdminFieldList>
                <AdminField
                  label="Connected"
                  value={formatCount(connectionTotals?.connected)}
                  hint={
                    connectionTotals?.total
                      ? `of ${formatCount(connectionTotals.total)} connections`
                      : "No workspace has connected a provider yet"
                  }
                />
                <AdminField label="Stale" value={formatCount(connectionTotals?.stale)} />
                <AdminField
                  label="Errors"
                  value={formatCount(connectionTotals?.error)}
                />
                <AdminField
                  label="Reconnection required"
                  value={formatCount(connectionTotals?.reauth_required)}
                  hint="The provider rejected the stored token; the user must reconnect"
                />
                <AdminField
                  label="Failed sync runs · 7 days"
                  value={formatCount(integrations.data.failed_sync_runs_7d)}
                />
                <AdminField
                  label="Last sync"
                  value={formatRelativeOr(integrations.data.last_sync_at, "No sync has run yet")}
                />
              </AdminFieldList>
              <AdminDivider className="my-3" />
              <p className="text-[12px] leading-[17px] text-admin-text-2">
                Tokens are sealed at rest (AES-256-GCM) and never leave the
                server. A connection that loses provider access is reported
                here the moment a sync fails, never silently.
              </p>
            </>
          ) : integrations?.state === "unavailable" ? (
            <AdminErrorState error={integrations.error} />
          ) : (
            <AdminNotMeasured reason="Integration metrics could not be read." />
          )}
        </div>
      </AdminPanel>

      {/* ------------------------------- 6. data integrity */}
      <AdminPanel>
        <AdminSectionTitle
          title="Data Integrity"
          description="Structural checks between tables that must agree: every account a profile, every workspace an owner."
        />
        <div className="mt-3">
          <AdminFieldList>
            <AdminField
              label="Accounts without a profile row"
              value={formatCount(overview?.users.without_profile)}
              hint="The signup trigger missed these; the app self-repairs on next load"
            />
            <AdminField
              label="Workspaces without an active owner"
              value={formatCount(overview?.workspaces.without_active_owner)}
              hint="Nobody can open these workspaces"
            />
            <AdminField
              label="Activity stream instrumented"
              value={formatBoolean(overview?.activity.instrumented, { yes: "Yes", no: "Not yet" })}
              hint="Filled by database triggers on task/project/goal changes"
            />
          </AdminFieldList>
        </div>
      </AdminPanel>

      {/* ------------------------------- 7. background jobs */}
      <AdminPanel>
        <AdminSectionTitle
          title="Background Jobs & Automations"
          description="Automation definitions and their executions. There is no queue deployment: executions are produced by database triggers and recorded in automation_executions."
        />
        <div className="mt-3">
          {automations?.state === "ok" ? (
            <AdminFieldList>
              <AdminField
                label="Automations"
                value={formatCount(automations.data.automations.total)}
                hint={
                  automations.data.automations.total
                    ? `${formatCount(automations.data.automations.active)} active · ${formatCount(
                        automations.data.automations.paused
                      )} paused · ${formatCount(automations.data.automations.disabled)} disabled`
                    : "No automation has been created yet"
                }
              />
              <AdminField
                label="Executions · 24 hours"
                value={formatSucceededFailed(executionTotals?.success_24h, executionTotals?.failed_24h)}
              />
              <AdminField
                label="Executions · 7 days"
                value={formatSucceededFailed(executionTotals?.success_7d, executionTotals?.failed_7d)}
              />
              <AdminField
                label="Queued"
                value={formatCount(executionTotals?.queued)}
                hint="A persistent queue means a worker is not consuming — no worker is deployed"
              />
              <AdminField
                label="Last execution"
                value={formatRelativeOr(executionTotals?.last_execution_at, "No execution recorded")}
              />
            </AdminFieldList>
          ) : automations?.state === "unavailable" ? (
            <AdminErrorState error={automations.error} />
          ) : (
            <AdminNotMeasured reason="Automation metrics could not be read." />
          )}
        </div>
      </AdminPanel>

      {/* ------------------------------- 8. needs attention */}
      <AdminPanel labelledBy="needs-attention-title">
        <AdminSectionTitle
          title="Needs Attention"
          description="Computed from conditions in the data, not from a static checklist. Each item names its source and the recommended action."
        />
        <div className="mt-4">
          {overview && overview.needs_attention.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {overview.needs_attention.map((item) => {
                const action = attentionActionFor(item.id);
                return (
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
                      <p className="mt-1 font-mono text-[11px] leading-[15px] text-admin-text-3">
                        Source · admin_overview() · {item.id}
                      </p>
                      {action ? (
                        <a
                          href={action.href}
                          className="mt-1.5 inline-flex min-h-[28px] items-center rounded-[6px] border border-admin-accent-border bg-admin-accent-bg px-2.5 text-[12px] font-medium text-admin-accent transition-colors hover:bg-admin-accent-bg hover:brightness-125"
                        >
                          {action.label}
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
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

      {/* ------------------------------- 9. recent activity */}
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

function panelValue<T>(
  panel: HealthPanelResult<T> | null,
  pick: (data: T) => number | null
): number | null {
  if (!panel || panel.state !== "ok") return null;
  return pick(panel.data);
}

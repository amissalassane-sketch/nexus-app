import { AdminEyebrow, AdminPanel, AdminSectionTitle } from "@/components/admin/panel";
import { KpiGrid, KpiTile } from "@/components/admin/kpi";

// ============================================================
// NEXUS ADMIN — OVERVIEW, LOADING BOUNDARY
// ============================================================
// Loading skeleton replicating the density and geometry of Overview 2.0.
// Hairline grid for KPIs, split panels for Platform Health & Attention,
// dual panels for Growth & Product Usage, followed by Activity list.
// ============================================================

export default function AdminOverviewLoading() {
  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" aria-hidden="true">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-16 animate-pulse rounded bg-admin-surface-2 motion-reduce:animate-none" />
          <div className="h-7 w-44 animate-pulse rounded-[6px] bg-admin-surface-2 motion-reduce:animate-none" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-admin-surface motion-reduce:animate-none" />
          <div className="h-3.5 w-60 max-w-full animate-pulse rounded bg-admin-surface motion-reduce:animate-none" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 animate-pulse rounded-[8px] border border-admin-border bg-admin-surface motion-reduce:animate-none" />
          <div className="h-9 w-24 animate-pulse rounded-[8px] border border-admin-border bg-admin-surface motion-reduce:animate-none" />
        </div>
      </div>

      {/* KPI 4-grid skeleton */}
      <KpiGrid>
        <KpiTile
          label="Total Users"
          value="—"
          definition="Accounts in auth.users"
          hint="Reading database…"
        />
        <KpiTile
          label="Active Users"
          value="—"
          definition="Signed in during the last 30 days"
          hint="Reading database…"
        />
        <KpiTile
          label="Workspaces"
          value="—"
          definition="Workspaces created"
          hint="Reading database…"
        />
        <KpiTile
          label="MRR"
          value="—"
          definition="No payment provider connected"
          hint="Checking billing status…"
        />
      </KpiGrid>

      {/* Health + Attention skeleton */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]" aria-hidden="true">
        <AdminPanel>
          <AdminSectionTitle
            title="Platform Health"
            description="Measuring platform services and latency…"
          />
          <div className="mt-4 flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-[8px] border border-admin-border/60 bg-admin-surface-2/40 px-3 py-2.5"
              >
                <div className="h-4 w-32 animate-pulse rounded bg-admin-surface-2 motion-reduce:animate-none" />
                <div className="h-4 w-20 animate-pulse rounded bg-admin-surface-2 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle
            title="Needs Attention"
            description="Evaluating database anomalies and invariants…"
          />
          <div className="mt-4 flex flex-col gap-2.5">
            <div className="h-16 w-full animate-pulse rounded-[8px] border border-admin-border bg-admin-surface-2/30 motion-reduce:animate-none" />
            <div className="h-16 w-full animate-pulse rounded-[8px] border border-admin-border bg-admin-surface-2/30 motion-reduce:animate-none" />
          </div>
        </AdminPanel>
      </div>

      {/* Growth + Usage skeleton */}
      <div className="grid gap-4 lg:grid-cols-2" aria-hidden="true">
        <AdminPanel>
          <AdminSectionTitle title="Growth" description="Reading account creation timestamps…" />
          <div className="mt-3 flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between border-b border-admin-border/50 py-1.5">
                <div className="h-3.5 w-36 animate-pulse rounded bg-admin-surface-2 motion-reduce:animate-none" />
                <div className="h-3.5 w-16 animate-pulse rounded bg-admin-surface motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle title="Product Usage" description="Counting table rows across workspaces…" />
          <div className="mt-3 flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between border-b border-admin-border/50 py-1.5">
                <div className="h-3.5 w-36 animate-pulse rounded bg-admin-surface-2 motion-reduce:animate-none" />
                <div className="h-3.5 w-16 animate-pulse rounded bg-admin-surface motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>

      {/* Recent Activity skeleton */}
      <AdminPanel>
        <AdminSectionTitle title="Recent Activity" description="Reading workspace event stream…" />
        <div aria-hidden="true" className="mt-4 flex flex-col">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-admin-border/60 py-2.5 last:border-b-0"
            >
              <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-admin-surface-2 motion-reduce:animate-none" />
              <div className="h-3.5 w-48 animate-pulse rounded bg-admin-surface-2 motion-reduce:animate-none" />
              <div className="ml-auto h-3 w-24 animate-pulse rounded bg-admin-surface motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </AdminPanel>

      <AdminEyebrow>Assembling live platform telemetry…</AdminEyebrow>
    </div>
  );
}

import type { Metadata } from "next";
import { getAdminSecurity } from "@/lib/admin/activity-security";
import { AdminRefreshButton } from "@/components/admin/admin-refresh-button";
import { AdminPanel, AdminSectionTitle } from "@/components/admin/panel";
import { AdminErrorState, AdminUnavailableState } from "@/components/admin/states";
import { formatCount, NOT_AVAILABLE } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Security", robots: { index: false, follow: false } };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-[13.5px] leading-5">
      <dt className="text-admin-text-2">{label}</dt>
      <dd className="font-mono tabular-nums text-admin-text">{value}</dd>
    </div>
  );
}

export default async function AdminSecurityPage() {
  const result = await getAdminSecurity();
  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold leading-[36px] tracking-[-0.02em] text-admin-text">Security</h1>
          <p className="mt-1.5 max-w-[68ch] text-[14px] leading-[20px] text-admin-text-2">
            Measured platform-admin context and security-relevant audit events. GoTrue sessions are not exposed without a service key.
          </p>
        </div>
        <AdminRefreshButton />
      </header>
      {result.state === "unavailable" ? (
        <AdminErrorState error={result.error} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <AdminPanel>
            <AdminSectionTitle title="Platform admin context" description="Resolved from the current JWT and platform_admins." />
            <dl className="mt-4 divide-y divide-admin-border border-t border-admin-border">
              <Row label="Role" value={String(result.payload.platform_admin.role ?? "Unavailable")} />
              <Row label="Status" value={String(result.payload.platform_admin.status ?? "Unavailable")} />
            </dl>
          </AdminPanel>
          <AdminPanel>
            <AdminSectionTitle title="Audit signal" description="Counts from the append-only audit log." />
            <dl className="mt-4 divide-y divide-admin-border border-t border-admin-border">
              <Row label="Recorded events" value={formatCount(result.payload.audit.events_total)} />
              <Row label="Denied events" value={formatCount(result.payload.audit.denied_total)} />
            </dl>
          </AdminPanel>
          <AdminPanel className="md:col-span-2">
            <AdminSectionTitle title="Sessions" />
            <AdminUnavailableState
              className="mt-4 border-t border-admin-border pt-4"
              icon="sessions"
              title={NOT_AVAILABLE + ": sessions"}
              description={result.payload.sessions.reason}
            />
          </AdminPanel>
        </div>
      )}
    </div>
  );
}

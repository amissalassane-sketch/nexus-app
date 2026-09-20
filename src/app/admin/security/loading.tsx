import { AdminEyebrow, AdminPanel, AdminSectionTitle } from "@/components/admin/panel";

// ============================================================
// NEXUS ADMIN — SECURITY, LOADING BOUNDARY
// ============================================================

export default function AdminSecurityLoading() {
  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-5">
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className="h-6 w-36 animate-pulse rounded-[6px] bg-admin-surface-2 motion-reduce:animate-none" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-admin-surface motion-reduce:animate-none" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2" aria-hidden="true">
        <AdminPanel>
          <AdminSectionTitle
            title="Platform admin context"
            description="Reading current platform privilege…"
          />
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex justify-between border-b border-admin-border/50 py-2">
              <div className="h-3.5 w-24 animate-pulse rounded bg-admin-surface-2 motion-reduce:animate-none" />
              <div className="h-3.5 w-28 animate-pulse rounded bg-admin-surface motion-reduce:animate-none" />
            </div>
            <div className="flex justify-between py-2">
              <div className="h-3.5 w-24 animate-pulse rounded bg-admin-surface-2 motion-reduce:animate-none" />
              <div className="h-3.5 w-20 animate-pulse rounded bg-admin-surface motion-reduce:animate-none" />
            </div>
          </div>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle
            title="Audit signal"
            description="Reading audit event totals…"
          />
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex justify-between border-b border-admin-border/50 py-2">
              <div className="h-3.5 w-32 animate-pulse rounded bg-admin-surface-2 motion-reduce:animate-none" />
              <div className="h-3.5 w-16 animate-pulse rounded bg-admin-surface motion-reduce:animate-none" />
            </div>
            <div className="flex justify-between py-2">
              <div className="h-3.5 w-32 animate-pulse rounded bg-admin-surface-2 motion-reduce:animate-none" />
              <div className="h-3.5 w-16 animate-pulse rounded bg-admin-surface motion-reduce:animate-none" />
            </div>
          </div>
        </AdminPanel>

        <AdminPanel className="lg:col-span-2">
          <div className="h-20 w-full animate-pulse rounded bg-admin-surface-2/40 motion-reduce:animate-none" />
        </AdminPanel>
      </div>

      <AdminEyebrow>Resolving security credentials…</AdminEyebrow>
    </div>
  );
}

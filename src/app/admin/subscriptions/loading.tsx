import { AdminEyebrow, AdminPanel } from "@/components/admin/panel";

// ============================================================
// NEXUS ADMIN — SUBSCRIPTIONS, LOADING BOUNDARY
// ============================================================
// The list pages read on the server, so "loading" is Next's own streaming
// boundary. The skeleton mirrors the table's rhythm (row hairlines) so the
// layout does not jump when data arrives — and it renders nothing that
// could be mistaken for content. No fake rows, no shimmer numbers.
// ============================================================

export default function AdminSubscriptionsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-5">
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className="h-5 w-56 animate-pulse rounded-[6px] bg-admin-surface-2 motion-reduce:animate-none" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-[6px] bg-admin-surface motion-reduce:animate-none" />
      </div>
      <div className="h-9 w-full max-w-md animate-pulse rounded-[8px] border border-admin-border bg-admin-surface motion-reduce:animate-none" aria-hidden="true" />
      <AdminPanel padded={false}>
        <span className="sr-only" role="status" aria-live="polite">
          Loading workspace subscriptions
        </span>
        <div aria-hidden="true" className="flex flex-col">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 border-b border-admin-border/60 px-4 py-3 last:border-b-0"
            >
              <span className="h-6 w-6 shrink-0 animate-pulse rounded-[7px] bg-admin-surface-2 motion-reduce:animate-none" />
              <span className="h-3.5 w-40 animate-pulse rounded-[4px] bg-admin-surface-2 motion-reduce:animate-none" />
              <span className="ml-auto h-3.5 w-24 animate-pulse rounded-[4px] bg-admin-surface motion-reduce:animate-none" />
              <span className="h-3.5 w-16 animate-pulse rounded-[4px] bg-admin-surface motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </AdminPanel>
      <AdminEyebrow>Reading workspace_subscriptions…</AdminEyebrow>
    </div>
  );
}

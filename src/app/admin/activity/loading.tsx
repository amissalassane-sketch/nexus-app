import { AdminEyebrow, AdminPanel } from "@/components/admin/panel";

// ============================================================
// NEXUS ADMIN — ACTIVITY, LOADING BOUNDARY
// ============================================================

export default function AdminActivityLoading() {
  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-5">
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className="h-6 w-36 animate-pulse rounded-[6px] bg-admin-surface-2 motion-reduce:animate-none" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-admin-surface motion-reduce:animate-none" />
      </div>

      <div className="h-9 w-full max-w-md animate-pulse rounded-[8px] border border-admin-border bg-admin-surface motion-reduce:animate-none" aria-hidden="true" />

      <AdminPanel padded={false}>
        <span className="sr-only" role="status" aria-live="polite">
          Loading workspace activity
        </span>
        <div aria-hidden="true" className="flex flex-col">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 border-b border-admin-border/60 px-4 py-3 last:border-b-0"
            >
              <span className="h-4 w-28 animate-pulse rounded bg-admin-surface-2 motion-reduce:animate-none" />
              <span className="h-3.5 w-32 animate-pulse rounded bg-admin-surface motion-reduce:animate-none" />
              <span className="ml-auto h-3.5 w-36 animate-pulse rounded bg-admin-surface motion-reduce:animate-none" />
              <span className="h-3 w-28 animate-pulse rounded bg-admin-surface motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </AdminPanel>

      <AdminEyebrow>Reading public.activities…</AdminEyebrow>
    </div>
  );
}

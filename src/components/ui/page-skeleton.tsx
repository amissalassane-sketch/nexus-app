import { Skeleton } from "@/components/ui/feedback";

// ============================================================
// NEXUS — ROUTE LOADING STATE (canonical)
// ============================================================
// A skeleton is a promise about layout: it must mirror the real grid so
// nothing moves when the data lands. It is NOT an animation opportunity —
// the only motion is the surface breath inside `.skeleton`, which is
// already gated by prefers-reduced-motion.
//
//   header    eyebrow · title · description
//   metrics   one bordered strip, N cells sharing hairlines (KpiGrid)
//   panels    header row + 4 list rows, matching Panel/DataList geometry
// ============================================================

export function PageSkeleton({
  metrics = 5,
  panels = 2,
}: {
  metrics?: number;
  panels?: number;
}) {
  return (
    <div className="space-y-6" aria-busy="true">
      <p className="sr-only" role="status">
        Loading workspace: structure appears immediately, details resolve progressively
      </p>

      <div className="space-y-2 border-b border-border-subtle pb-6">
        <Skeleton className="h-2.5 w-28 rounded-pill" />
        <Skeleton className="h-5 w-56 rounded-pill" />
        <Skeleton className="h-2.5 w-80 max-w-full rounded-pill" />
      </div>

      {metrics > 0 ? (
        <div className="grid grid-cols-2 overflow-hidden rounded-surface border border-border-subtle bg-bg-surface sm:grid-cols-3 lg:grid-cols-5 [&>*]:border-r [&>*]:border-b [&>*]:border-border-subtle">
          {Array.from({ length: metrics }).map((_, index) => (
            <div key={index} className="space-y-3 px-4 py-3">
              <Skeleton className="h-2 w-16 rounded-pill" />
              <Skeleton className="h-4 w-10 rounded-pill" />
            </div>
          ))}
        </div>
      ) : null}

      {Array.from({ length: panels }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-surface border border-border-subtle bg-bg-surface layout-preserve"
        >
          <div className="flex min-h-11 items-center justify-between border-b border-border-subtle px-4 py-2">
            <Skeleton className="h-2.5 w-32 rounded-pill" />
            <Skeleton className="h-2.5 w-16 rounded-pill" />
          </div>
          <div className="flex flex-col">
            {Array.from({ length: 4 }).map((__, row) => (
              <div
                key={row}
                className="flex min-h-10 items-center gap-3 border-b border-border-subtle px-3 py-2 last:border-b-0"
              >
                <Skeleton className="size-4 rounded-xs" />
                <Skeleton
                  className="h-2.5 rounded-pill"
                  style={{ width: `${34 + ((row * 19) % 38)}%` }}
                />
                <div className="flex-1" />
                <Skeleton className="h-2.5 w-10 rounded-pill" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

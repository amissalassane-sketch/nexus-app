import { Skeleton } from "@/components/ui/feedback";

// ============================================================
// NEXUS — ROUTE LOADING STATE
// Shaped like the page it replaces: header, metric strip, panels.
// Never a centred spinner, never a blank screen.
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
        Loading
      </p>

      <div className="space-y-3 border-b border-border-subtle pb-6">
        <Skeleton className="h-2.5 w-28 rounded-pill" />
        <Skeleton className="h-5 w-56 rounded-pill" />
        <Skeleton className="h-2.5 w-80 max-w-full rounded-pill" />
      </div>

      {metrics > 0 ? (
        <div className="grid grid-cols-2 overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/50 sm:grid-cols-3 lg:grid-cols-5 [&>*]:border-b [&>*]:border-r [&>*]:border-border-subtle">
          {Array.from({ length: metrics }).map((_, index) => (
            <div key={index} className="space-y-3 px-4 py-3.5">
              <Skeleton className="h-2 w-16 rounded-pill" />
              <Skeleton className="h-4 w-10 rounded-pill" />
            </div>
          ))}
        </div>
      ) : null}

      {Array.from({ length: panels }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/70"
        >
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <Skeleton className="h-2.5 w-32 rounded-pill" />
            <Skeleton className="h-2.5 w-16 rounded-pill" />
          </div>
          <div className="flex flex-col">
            {Array.from({ length: 4 }).map((__, row) => (
              <div
                key={row}
                className="flex h-11 items-center gap-3 border-b border-border-subtle px-4 last:border-b-0"
              >
                <Skeleton className="h-[15px] w-[15px] rounded-[5px]" />
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

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { AdminIcon } from "./admin-icons";

/**
 * Re-runs the server components for the current route.
 *
 * It calls router.refresh() rather than fetching a JSON endpoint: the
 * numbers on this page are produced by server components reading the
 * database, so the honest way to "update" them is to re-run those reads.
 * There is no client cache to invalidate and no stale value to patch.
 *
 * One secondary-action recipe for the whole control plane: 32px on a
 * pointer device, 40px on touch, hairline border, no fill change on hover
 * beyond the surface step the product uses everywhere.
 */
export function AdminRefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function refresh() {
    // startTransition keeps the previous render on screen while the new
    // one is produced, so the page never blanks mid-refresh.
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={isPending}
      aria-label={isPending ? "Refreshing platform data" : "Refresh platform data"}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-control border border-admin-border bg-admin-surface px-2.5 text-small text-admin-text-2 transition-colors duration-[120ms] hover:border-admin-border-strong hover:text-admin-text disabled:opacity-60 sm:h-8",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent",
        className
      )}
    >
      <AdminIcon
        name="refresh"
        size="action"
        className={isPending ? "motion-safe:animate-spin" : undefined}
      />
      <span className="hidden sm:inline">
        {isPending ? "Refreshing" : "Refresh"}
      </span>
    </button>
  );
}

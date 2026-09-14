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
        "inline-flex h-9 items-center gap-2 rounded-[8px] border border-admin-border bg-admin-surface px-2.5 text-[12.5px] leading-[18px] text-admin-text-2 transition-colors duration-150 hover:text-admin-text disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent",
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

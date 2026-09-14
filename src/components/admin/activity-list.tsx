import type { AdminActivityEntry } from "@/lib/admin/types";
import { formatDateTime, formatRelativeTime } from "@/lib/admin/format";
import { AdminEmptyState } from "./states";

// ============================================================
// NEXUS ADMIN — RECENT ACTIVITY
// ============================================================
// Every row names the table it came from. On a control plane that is not
// decoration: "Subscription active" means something different depending
// on whether it came from workspace_subscriptions or from a payment
// provider, and the operator needs to be able to tell which.
// ============================================================

const KIND_LABEL: Record<string, string> = {
  account_created: "Account created",
  workspace_created: "Workspace created",
  subscription_changed: "Subscription changed",
  created: "Created",
  updated: "Updated",
  completed: "Completed",
  deleted: "Deleted",
};

function labelFor(entry: AdminActivityEntry): string {
  return KIND_LABEL[entry.kind] ?? entry.title ?? "Activity";
}

export function ActivityList({ entries }: { entries: AdminActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <AdminEmptyState
        compact
        icon="activity"
        title="No recorded activity"
        description="Nothing has been written to the platform activity stream yet. It is filled from real rows — accounts, workspaces, subscriptions and workspace events — so an empty list means the platform genuinely has no recent history, not that the feed is broken."
      />
    );
  }

  return (
    <ol className="divide-y divide-admin-border">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] leading-[18px] text-admin-text">
              {labelFor(entry)}
              {entry.subject ? (
                <span className="text-admin-text-2">
                  {" · "}
                  <span className="font-mono text-[12px]">{entry.subject}</span>
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] leading-[16px] text-admin-text-3">
              {entry.source}
            </p>
          </div>

          <time
            dateTime={entry.occurred_at}
            title={formatDateTime(entry.occurred_at)}
            className="shrink-0 font-mono text-[11.5px] leading-[16px] text-admin-text-2"
          >
            {formatRelativeTime(entry.occurred_at)}
          </time>
        </li>
      ))}
    </ol>
  );
}

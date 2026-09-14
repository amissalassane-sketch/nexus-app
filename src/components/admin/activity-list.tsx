import type { AdminActivityEntry, AdminActivityResult } from "@/lib/admin/types";
import { formatDateTime, formatRelativeTime } from "@/lib/admin/format";
import { AdminRefreshButton } from "./admin-refresh-button";
import { AdminIcon } from "./admin-icons";
import { AdminEmptyState } from "./states";

// ============================================================
// NEXUS ADMIN — RECENT ACTIVITY
// ============================================================
// Three outcomes, three renderings. They are deliberately not collapsed
// into one another:
//
//   ok + entries  → the list, with a real count in the panel header
//   ok + []       → "No recent activity" — a measurement that came back
//                   empty. The platform genuinely has no history.
//   unavailable   → "Activity unavailable" + Retry — we could not read
//                   it. This is NOT an empty platform, and it must never
//                   look like one.
//
// Every row names the table it came from, because "Subscription active"
// means different things depending on whether it came from
// workspace_subscriptions or from a payment provider.
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

export function ActivityList({ activity }: { activity: AdminActivityResult }) {
  if (activity.state === "unavailable") {
    return (
      <AdminEmptyState
        compact
        icon="alert"
        title="Activity unavailable"
        description={`The activity read failed, so nothing is listed. This is not an empty platform — it means the control plane could not observe it. ${activity.error.message}`}
        action={<AdminRefreshButton />}
      />
    );
  }

  if (activity.entries.length === 0) {
    return (
      <AdminEmptyState
        compact
        icon="activity"
        title="No recent activity"
        description="The read succeeded and returned nothing. The platform has no recorded account, workspace, subscription or workspace-event rows yet — which is a fact about the platform, not a failure of this panel."
      />
    );
  }

  return (
    <ol className="divide-y divide-admin-border">
      {activity.entries.map((entry) => (
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

/** Header counter for the panel. Shows the event count only when the read
 *  actually succeeded — never a number sourced from somewhere else. */
export function ActivityCount({
  activity,
  recordedEvents,
}: {
  activity: AdminActivityResult;
  /** events_total from the aggregate, when it is available. */
  recordedEvents: string | null;
}) {
  if (activity.state === "unavailable") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] leading-[16px] text-admin-danger">
        <AdminIcon name="alert" size="action" />
        Read failed
      </span>
    );
  }

  if (activity.entries.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] leading-[16px] text-admin-text-3">
        <AdminIcon name="activity" size="action" />
        {recordedEvents ? `${recordedEvents} events recorded` : "No events"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] leading-[16px] text-admin-text-3">
      <AdminIcon name="activity" size="action" />
      {activity.entries.length} shown
      {recordedEvents ? ` · ${recordedEvents} recorded` : ""}
    </span>
  );
}

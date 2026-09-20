import Link from "next/link";
import { IconCalendarClock } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";

// ============================================================
// NEXUS — UPCOMING
// Open tasks whose real due date lands inside the next seven days,
// computed from the workspace snapshot on the server. No estimates,
// no placeholders: when nothing is scheduled, the panel says so.
// ============================================================

export type UpcomingItem = {
  id: string;
  title: string;
  dueAt: string;
  projectName?: string | null;
};

function dueLabel(value: string): string {
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "scheduled";
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const startOfDue = new Date(
    due.getFullYear(),
    due.getMonth(),
    due.getDate()
  ).getTime();
  const days = Math.round((startOfDue - startOfToday) / 86_400_000);
  if (days <= 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days < 7) return `due in ${days} days`;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
  }).format(due);
}

export function UpcomingPanel({ items }: { items: UpcomingItem[] }) {
  return (
    <Panel
      title="Upcoming"
      description="Open work with a deadline inside 7 days"
      bodyClassName="p-0"
      actions={
        <Link
          href="/tasks"
          className="text-caption text-text-tertiary transition-colors duration-150 ease-nexus hover:text-text-primary"
        >
          All tasks
        </Link>
      }
    >
      {items.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="Nothing due this week"
            description="No open task carries a deadline in the next seven days."
            icon={<NexusIcon icon={IconCalendarClock} size="state" />}
          />
        </div>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href="/tasks"
                className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 transition-colors duration-150 ease-nexus last:border-b-0 hover:bg-white/[0.02]"
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-tertiary"
                >
                  <NexusIcon icon={IconCalendarClock} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-medium text-text-primary">
                    {item.title}
                  </span>
                  {item.projectName ? (
                    <span className="eyebrow mt-0.5 block truncate text-text-quaternary">
                      {item.projectName}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-secondary">
                  {dueLabel(item.dueAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

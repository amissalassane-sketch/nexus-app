import Link from "next/link";
import { IconListCheck } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import type { PrioritizedTask } from "@/lib/intelligence/advanced";

// ============================================================
// NEXUS — PRIORITY QUEUE
// Renders `rankPriorities()` from the existing Intelligence engine:
// open tasks triaged on urgency, friction, weight and staleness.
// The reasons come from the engine, so every position is auditable.
// ============================================================

export function PriorityQueuePanel({ items }: { items: PrioritizedTask[] }) {
  return (
    <Panel
      eyebrow="INTELLIGENCE"
      title="Priority queue"
      description="What NEXUS would do first — and why"
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
            title="Nothing in the queue"
            description="No open tasks to triage. NEXUS will rank them the moment work exists."
            icon={<NexusIcon icon={IconListCheck} size="state" />}
            action={
              <Link
                href="/tasks?create=1"
                className="inline-flex h-8 items-center rounded-input border border-border-default px-3 text-caption text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                Create a task
              </Link>
            }
          />
        </div>
      ) : (
        <ol>
          {items.map((entry, index) => (
            <li
              key={entry.task.id}
              className="border-b border-border-subtle last:border-b-0"
            >
              <Link
                href={entry.href}
                className="flex items-start gap-3 px-4 py-3 transition-colors duration-150 ease-nexus hover:bg-white/[0.02]"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border border-border-subtle bg-bg-surface font-mono text-[11px] text-text-secondary"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-medium text-text-primary">
                    {entry.task.title}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {entry.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-pill border border-border-subtle bg-bg-surface px-2 py-0.5 text-[10.5px] leading-[1.5] text-text-tertiary"
                      >
                        {reason}
                      </span>
                    ))}
                  </span>
                </span>
                <span
                  className="shrink-0 font-mono text-mono tabular-nums text-text-tertiary"
                  title={`Priority score: ${entry.score}/100`}
                >
                  {entry.score}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

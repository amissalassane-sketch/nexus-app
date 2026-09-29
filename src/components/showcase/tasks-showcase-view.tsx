"use client";

import { useState } from "react";
import {
  IconAlertTriangle,
  IconCalendar,
  IconCheck,
  IconPlus,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { Tag } from "@/components/ui/badge";
import { CreateButton } from "@/components/ui/create-button";
import { SegmentedControl, type TabItem } from "@/components/ui/tabs";
import { SearchField } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  SHOWCASE_KANBAN_TASKS,
  type ShowcaseTask,
} from "@/lib/showcase/mock-data";

// ============================================================
// SHOWCASE 04 — TASKS KANBAN
// ============================================================
// Four columns of execution, built from the ladder:
//   column  L1 chrome surface + hairline (a lane, not a card)
//   card    L2 panel surface + hairline, hover = hairline strong
//   meta    Tag (machine token) + mono date
//   blocked danger hairline + spelled-out reason (never colour alone)
//
// Responsive: 4 columns on xl, 2 × 2 on md, horizontal snap-scroll with
// 260px lanes below md — a board is not a stacked list, and shrinking it
// into one column hides the whole point of a kanban.
// ============================================================

const COLUMNS = [
  { id: "todo", title: "To do", accent: "bg-text-quaternary" },
  { id: "in_progress", title: "In progress", accent: "bg-info" },
  { id: "blocked", title: "Blocked", accent: "bg-danger" },
  { id: "done", title: "Done", accent: "bg-success" },
] as const;

const PRIORITY_TONE: Record<
  ShowcaseTask["priorityCode"],
  "danger" | "warning" | "neutral"
> = {
  P0: "danger",
  P1: "warning",
  P2: "neutral",
  P3: "neutral",
};

const VIEW_ITEMS: TabItem<string>[] = [
  { id: "all", label: "All · 24" },
  { id: "today", label: "Today · 6" },
  { id: "overdue", label: "Overdue · 1" },
  { id: "blocked", label: "Blocked · 3" },
  { id: "unscheduled", label: "No date · 2" },
];

export function TasksShowcaseView() {
  const [activeView, setActiveView] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const tasks = SHOWCASE_KANBAN_TASKS;

  const filteredTasks = tasks.filter((task) => {
    if (!searchQuery.trim()) return true;
    const needle = searchQuery.toLowerCase();
    return (
      task.title.toLowerCase().includes(needle) ||
      task.projectName.toLowerCase().includes(needle) ||
      task.priorityCode.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-5">
      {/* ---------- Header ---------- */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow text-text-quaternary">Execution</p>
          <h1 className="mt-2 flex items-center gap-2 text-h1 text-text-primary">
            Tasks
            <Tag tone="quiet">24</Tag>
          </h1>
          <p className="mt-1 text-small text-text-secondary">
            3 blocked · 8 completed this week · 1 overdue
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SearchField
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Filter tasks"
            aria-label="Filter tasks"
            className="w-40 sm:w-56"
          />
          <CreateButton label="New task" onClick={() => {}} />
        </div>
      </header>

      {/* ---------- View switch ---------- */}
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3">
        <SegmentedControl
          items={VIEW_ITEMS}
          value={activeView}
          onChange={setActiveView}
          label="Task view filter"
          className="min-w-0"
        />
        <span className="mono-meta hidden shrink-0 text-text-quaternary sm:block">
          kanban · grouped by status
        </span>
      </div>

      {/* ---------- Board ---------- */}
      <div className="grid snap-x snap-mandatory grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3 overflow-x-auto pb-2 md:grid-flow-row md:auto-cols-auto md:grid-cols-2 md:overflow-visible md:pb-0 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const columnTasks = filteredTasks.filter(
            (task) => task.status === column.id
          );

          return (
            <section
              key={column.id}
              aria-label={`${column.title} column`}
              className="flex snap-start flex-col rounded-surface border border-border-subtle bg-bg-subtle p-3"
            >
              {/* Column header */}
              <div className="mb-3 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 rounded-pill", column.accent)}
                />
                <h2 className="eyebrow text-text-secondary">{column.title}</h2>
                <Tag tone="quiet" className="ml-auto">
                  {columnTasks.length}
                </Tag>
                <button
                  type="button"
                  aria-label={`Add task to ${column.title}`}
                  className="flex size-6 items-center justify-center rounded-control text-text-quaternary outline-none transition-colors duration-[120ms] hover:bg-accent-ghost hover:text-text-secondary focus-visible:ring-1 focus-visible:ring-lavender-border"
                >
                  <NexusIcon icon={IconPlus} className="size-3.5" />
                </button>
              </div>

              {/* Cards */}
              <div className="flex min-h-[420px] flex-col gap-2">
                {columnTasks.length === 0 ? (
                  <p className="rounded-control border border-dashed border-border-default px-3 py-6 text-center text-caption text-text-quaternary">
                    No tasks
                  </p>
                ) : null}

                {columnTasks.map((task) => {
                  const isDone = task.status === "done";
                  const isBlocked = task.status === "blocked";

                  return (
                    <article
                      key={task.id}
                      className={cn(
                        "rounded-control border bg-bg-surface p-3 transition-colors duration-[120ms] ease-nexus",
                        isBlocked
                          ? "border-danger-border"
                          : "border-border-subtle hover:border-border-strong"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                          className={cn(
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-xs border transition-colors duration-[120ms]",
                            isDone
                              ? "border-success bg-success text-bg-base"
                              : "border-border-strong bg-transparent hover:border-border-focus"
                          )}
                        >
                          {isDone ? (
                            <NexusIcon icon={IconCheck} className="size-2.5 stroke-[3]" />
                          ) : null}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-small font-medium",
                              isDone
                                ? "text-text-tertiary line-through"
                                : "text-text-primary"
                            )}
                          >
                            {task.title}
                          </p>

                          {isBlocked && task.blockedReason ? (
                            <p className="mt-2 flex items-start gap-1.5 rounded-xs border border-danger-border bg-danger-bg px-1.5 py-1 text-caption text-danger">
                              <NexusIcon
                                icon={IconAlertTriangle}
                                className="mt-px size-3 shrink-0"
                              />
                              <span>{task.blockedReason}</span>
                            </p>
                          ) : null}

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <Tag tone={PRIORITY_TONE[task.priorityCode]}>
                              {task.priorityCode}
                            </Tag>
                            <Tag tone="quiet">{task.projectName}</Tag>
                            <span className="mono-meta ml-auto flex items-center gap-1 text-text-quaternary">
                              <NexusIcon icon={IconCalendar} className="size-3" />
                              {task.dueDate}
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* ---------- Footer context ---------- */}
      <p className="mono-meta text-text-quaternary">
        {filteredTasks.length} of {tasks.length} tasks shown ·{" "}
        {activeView === "all" ? "no filter" : `filter: ${activeView}`}
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  IconAlertTriangle,
  IconCalendar,
  IconCheck,
  IconFilter,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { CreateButton } from "@/components/ui/create-button";
import { PillTabs, type TabItem } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import {
  SHOWCASE_KANBAN_TASKS,
  type ShowcaseTask,
} from "@/lib/showcase/mock-data";

const COLUMNS = [
  { id: "todo", title: "TO DO", status: "todo" },
  { id: "in_progress", title: "IN PROGRESS", status: "in_progress" },
  { id: "blocked", title: "BLOCKED", status: "blocked" },
  { id: "done", title: "DONE", status: "done" },
];

const PRIORITY_BADGE: Record<
  ShowcaseTask["priorityCode"],
  { label: string; tone: BadgeTone }
> = {
  P0: { label: "P0 · Urgent", tone: "danger" },
  P1: { label: "P1 · High", tone: "warning" },
  P2: { label: "P2 · Normal", tone: "neutral" },
  P3: { label: "P3 · Low", tone: "neutral" },
};

const VIEW_ITEMS: TabItem<string>[] = [
  { id: "all", label: "All tasks (24)" },
  { id: "today", label: "Today (6)" },
  { id: "overdue", label: "Overdue (1)" },
  { id: "blocked", label: "Blocked (3)" },
  { id: "unscheduled", label: "No date (2)" },
];

export function TasksShowcaseView() {
  const [activeView, setActiveView] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const tasks = SHOWCASE_KANBAN_TASKS;

  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.projectName.toLowerCase().includes(q) ||
      t.priorityCode.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-text-primary">
            Tasks
          </h1>
          <p className="text-[13px] text-text-secondary mt-0.5">
            24 open tasks · 3 blocked · 8 completed in last 7 days
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative flex items-center rounded-input border border-border-default bg-bg-surface px-3 py-1.5 text-caption">
            <NexusIcon icon={IconSearch} className="size-3.5 text-text-tertiary mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks..."
              className="bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-quaternary w-36 sm:w-48"
            />
          </div>

          <CreateButton label="New task" onClick={() => {}} />
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <PillTabs
          items={VIEW_ITEMS}
          value={activeView}
          onChange={setActiveView}
          label="Task view filter"
        />
        <span className="hidden sm:inline-flex items-center gap-1 text-caption text-text-tertiary font-mono">
          <NexusIcon icon={IconFilter} className="size-3" />
          <span>Kanban View</span>
        </span>
      </div>

      {/* 4-Column Nexus Kanban Board */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.status);

          return (
            <div
              key={col.id}
              className="flex flex-col rounded-panel border border-border-subtle bg-bg-subtle/50 p-3 min-h-[560px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-2 py-1 mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="eyebrow text-text-secondary font-semibold">
                    {col.title}
                  </h2>
                  <span className="flex size-5 items-center justify-center rounded-full bg-bg-surface text-[11px] font-mono font-medium text-text-tertiary border border-border-subtle">
                    {colTasks.length}
                  </span>
                </div>

                <button
                  type="button"
                  className="size-6 flex items-center justify-center rounded-md text-text-tertiary hover:bg-bg-surface hover:text-text-primary transition-colors"
                  aria-label={`Add task to ${col.title}`}
                >
                  <NexusIcon icon={IconPlus} className="size-3.5" />
                </button>
              </div>

              {/* Cards Container */}
              <div className="space-y-2.5 flex-1">
                {colTasks.map((task) => {
                  const pBadge = PRIORITY_BADGE[task.priorityCode];
                  const isDone = task.status === "done";
                  const isBlocked = task.status === "blocked";

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "group relative rounded-card border bg-bg-surface p-3.5 transition-all duration-150",
                        isBlocked
                          ? "border-danger/30 hover:border-danger/50 shadow-[0_2px_8px_rgba(255,122,122,0.06)]"
                          : "border-border-default hover:border-border-strong hover:bg-bg-surface-2 shadow-xs"
                      )}
                    >
                      {/* Top Row: Checkbox + Title */}
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          className={cn(
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                            isDone
                              ? "border-success bg-success text-black"
                              : "border-border-strong hover:border-text-primary bg-bg-base"
                          )}
                          aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                        >
                          {isDone && <NexusIcon icon={IconCheck} className="size-2.5 stroke-[3]" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-[13.5px] font-medium leading-snug",
                              isDone ? "text-text-tertiary line-through" : "text-text-primary"
                            )}
                          >
                            {task.title}
                          </p>

                          {/* Blocked Reason Callout */}
                          {isBlocked && task.blockedReason && (
                            <div className="mt-2 flex items-center gap-1.5 rounded-[4px] bg-danger/10 border border-danger/20 px-2 py-1 text-[11px] text-danger">
                              <NexusIcon icon={IconAlertTriangle} className="size-3 shrink-0" />
                              <span className="truncate">{task.blockedReason}</span>
                            </div>
                          )}

                          {/* Meta Row: Priority + Project Pill + Due Date */}
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-caption">
                            <Badge tone={pBadge.tone} className="text-[10px] px-1.5 py-0.5">
                              {pBadge.label}
                            </Badge>

                            <span className="inline-flex items-center rounded-pill border border-border-subtle bg-bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] text-text-secondary">
                              {task.projectName}
                            </span>

                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-text-tertiary ml-auto">
                              <NexusIcon icon={IconCalendar} className="size-3" />
                              <span>{task.dueDate}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, ChevronDown, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export type TaskStatus = "todo" | "in_progress" | "in_review" | "blocked" | "done" | "cancelled";
export type Priority = "low" | "medium" | "high" | "urgent";

export type KanbanTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

const STATUSES: TaskStatus[] = ["todo", "in_progress", "in_review", "blocked", "done", "cancelled"];
const PRIORITY_TONE: Record<Priority, "neutral" | "warning" | "danger"> = {
  low: "neutral",
  medium: "neutral",
  high: "warning",
  urgent: "danger",
};

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
};

export function NexusKanban({
  tasks,
  onStatusChange,
  onEdit,
  onDelete,
  onAddTask,
}: {
  tasks: KanbanTask[];
  onStatusChange: (task: KanbanTask, status: TaskStatus) => void;
  onEdit: (task: KanbanTask) => void;
  onDelete: (task: KanbanTask) => void;
  onAddTask: () => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ status: TaskStatus; index: number } | null>(null);
  const [order, setOrder] = useState<Record<TaskStatus, string[]>>(() => buildOrder(tasks));

  useEffect(() => {
    // The order is a local projection of the server task collection. It must
    // reconcile when a persisted status mutation completes or filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder((current) => {
      const next = buildOrder(tasks);
      return Object.fromEntries(
        STATUSES.map((status) => [
          status,
          [...current[status]?.filter((id) => next[status].includes(id)) ?? [], ...next[status].filter((id) => !current[status]?.includes(id))],
        ])
      ) as Record<TaskStatus, string[]>;
    });
  }, [tasks]);

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const moveTo = (status: TaskStatus, index: number) => {
    if (!draggedId) return;
    const task = taskById.get(draggedId);
    if (!task) return;
    const next = { ...order };
    for (const key of STATUSES) next[key] = next[key].filter((id) => id !== draggedId);
    next[status].splice(Math.min(index, next[status].length), 0, draggedId);
    setOrder(next);
    setDropTarget(null);
    setDraggedId(null);
    if (task.status !== status) onStatusChange(task, status);
  };

  const moveWithinColumn = (task: KanbanTask, direction: -1 | 1) => {
    const ids = order[task.status];
    const currentIndex = ids.indexOf(task.id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ids.length) return;
    const next = { ...order, [task.status]: [...ids] };
    [next[task.status][currentIndex], next[task.status][nextIndex]] = [
      next[task.status][nextIndex],
      next[task.status][currentIndex],
    ];
    setOrder(next);
  };

  return (
    <div className="space-y-3" aria-label="Task kanban board">
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption text-text-tertiary">Drag to move work between NEXUS statuses.</p>
        <Button size="sm" variant="secondary" onClick={onAddTask}>
          <Plus size={14} aria-hidden="true" />
          New task
        </Button>
      </div>

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3">
        {STATUSES.map((status) => {
          const ids = order[status].filter((id) => taskById.has(id));
          return (
            <section
              key={status}
              className={cn(
                "flex w-[min(82vw,280px)] min-w-[min(82vw,280px)] snap-start flex-col rounded-card border bg-bg-base/40 p-2 transition-colors duration-150 sm:w-[280px] sm:min-w-[280px]",
                dropTarget?.status === status ? "border-border-focus bg-accent-ghost/40" : "border-border-subtle"
              )}
              onDragOver={(event) => {
                event.preventDefault();
                if (draggedId) setDropTarget({ status, index: ids.length });
              }}
              onDrop={(event) => {
                event.preventDefault();
                moveTo(status, dropTarget?.status === status ? dropTarget.index : ids.length);
              }}
              aria-label={`${STATUS_LABELS[status]} column`}
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <h3 className="text-h4 text-text-primary">{STATUS_LABELS[status]}</h3>
                <span className="font-mono text-mono tabular-nums text-text-quaternary">{ids.length}</span>
              </div>

              <div className="min-h-24 space-y-2 rounded-input p-1">
                {ids.map((id, index) => {
                  const task = taskById.get(id);
                  if (!task) return null;
                  const overdue = task.due_at && task.status !== "done" && new Date(task.due_at) < new Date();
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDraggedId(task.id)}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDropTarget(null);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDropTarget({ status, index });
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        moveTo(status, index);
                      }}
                      className={cn(
                        "group relative cursor-grab active:cursor-grabbing",
                        draggedId === task.id && "opacity-45"
                      )}
                    >
                      {dropTarget?.status === status && dropTarget.index === index && draggedId !== task.id ? (
                        <div className="mb-1 h-0.5 rounded-pill bg-lavender" aria-hidden="true" />
                      ) : null}
                      <Card as="article" className="p-3" interactive>
                        <div className="flex items-start gap-2">
                          <GripVertical size={14} className="mt-0.5 shrink-0 text-text-quaternary" aria-hidden="true" />
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                            onClick={() => onEdit(task)}
                            aria-label={`Edit ${task.title}`}
                          >
                            <span className="block text-body-medium text-text-primary">{task.title}</span>
                            {task.description ? <span className="mt-1 block line-clamp-2 text-caption text-text-tertiary">{task.description}</span> : null}
                          </button>
                          <div className="flex shrink-0 items-center opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                            <Button variant="icon" aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}>
                              <Pencil size={14} aria-hidden="true" />
                            </Button>
                            <Button variant="icon" aria-label={`Delete ${task.title}`} className="hover:text-danger" onClick={() => onDelete(task)}>
                              <Trash2 size={14} aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-6">
                          <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
                          {task.due_at ? (
                            <span className={cn("inline-flex items-center gap-1 text-caption", overdue ? "text-danger" : "text-text-tertiary")}>
                              <CalendarDays size={12} aria-hidden="true" />
                              {formatDate(task.due_at)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex items-center gap-2 pl-6">
                          <label className="sr-only" htmlFor={`move-${task.id}`}>Move {task.title}</label>
                          <select
                            id={`move-${task.id}`}
                            value={task.status}
                            onChange={(event) => onStatusChange(task, event.target.value as TaskStatus)}
                            className="h-7 min-w-0 flex-1 rounded-input border border-border-subtle bg-bg-surface px-2 text-caption text-text-secondary outline-none focus:border-border-focus"
                          >
                            {STATUSES.map((option) => <option key={option} value={option}>{STATUS_LABELS[option]}</option>)}
                          </select>
                          <ChevronDown size={13} className="-ml-6 pointer-events-none text-text-quaternary" aria-hidden="true" />
                          <Button
                            variant="icon"
                            className="h-7 w-7"
                            aria-label={`Move ${task.title} up`}
                            onClick={() => moveWithinColumn(task, -1)}
                          >
                            <ArrowUp size={13} aria-hidden="true" />
                          </Button>
                          <Button
                            variant="icon"
                            className="h-7 w-7"
                            aria-label={`Move ${task.title} down`}
                            onClick={() => moveWithinColumn(task, 1)}
                          >
                            <ArrowDown size={13} aria-hidden="true" />
                          </Button>
                        </div>
                      </Card>
                    </div>
                  );
                })}
                {ids.length === 0 ? (
                  <button
                    type="button"
                    onClick={onAddTask}
                    className="flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded-input border border-dashed border-border-subtle px-3 text-caption text-text-quaternary transition-colors hover:border-border-default hover:bg-bg-surface hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (draggedId) setDropTarget({ status, index: 0 });
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      moveTo(status, 0);
                    }}
                  >
                    <span>No tasks here</span>
                    <span className="inline-flex items-center gap-1 text-text-secondary"><Plus size={12} aria-hidden="true" /> Add task</span>
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function buildOrder(tasks: KanbanTask[]): Record<TaskStatus, string[]> {
  return Object.fromEntries(STATUSES.map((status) => [status, tasks.filter((task) => task.status === status).map((task) => task.id)])) as Record<TaskStatus, string[]>;
}

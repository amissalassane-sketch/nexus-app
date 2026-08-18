"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { canCreateTask } from "@/lib/access";
import { FeatureGate } from "@/components/feature-gate";
import { useFeatureGate } from "@/hooks/use-feature-gate";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/ui/create-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { PageHeader, StatLine } from "@/components/ui/page-header";

type TaskStatus = "todo" | "in_progress" | "in_review" | "blocked" | "done" | "cancelled";
type Priority = "low" | "medium" | "high" | "urgent";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

type TaskForm = {
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  due_at: string;
};

const blankTaskForm = (): TaskForm => ({
  title: "",
  description: "",
  priority: "medium",
  status: "todo",
  due_at: "",
});

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_TONE: Record<Priority, "neutral" | "warning" | "danger"> = {
  low: "neutral",
  medium: "neutral",
  high: "warning",
  urgent: "danger",
};

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(date);
};

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function TaskManagerInner({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filters, setFilters] = useState({ status: "all", priority: "all" });
  const [form, setForm] = useState<TaskForm>(blankTaskForm());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(searchParams.get("create") === "1");
  const titleRef = useRef<HTMLInputElement>(null);

  const activeTaskCount = useMemo(
    () => tasks.filter((task) => task.status !== "done" && task.status !== "cancelled").length,
    [tasks]
  );

  const { limitResult, guardCreate, handleMutationError, dismiss } = useFeatureGate(
    workspaceId,
    canCreateTask,
    activeTaskCount
  );

  const fetchTasks = async (activeWorkspaceId: string | null) => {
    if (!activeWorkspaceId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const { data, error: loadError } = await supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", activeWorkspaceId)
      .order("due_at", { ascending: true });

    if (loadError) {
      setError(loadError.message);
      setTasks([]);
      setLoading(false);
      return;
    }

    setTasks((data as Task[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const loadWorkspace = async () => {
      const { membership, error: membershipError } = await getActiveMembership(
        supabase,
        userId
      );

      if (membershipError) {
        setError(membershipError);
      }

      const nextWorkspaceId = membership?.workspaceId ?? null;
      setWorkspaceId(nextWorkspaceId);
      await fetchTasks(nextWorkspaceId);
    };

    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  useEffect(() => {
    if (formOpen) titleRef.current?.focus();
  }, [formOpen]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const statusMatch = filters.status === "all" || task.status === filters.status;
      const priorityMatch = filters.priority === "all" || task.priority === filters.priority;
      return statusMatch && priorityMatch;
    });
  }, [filters, tasks]);

  const resetForm = () => {
    setForm(blankTaskForm());
    setEditingTaskId(null);
    setSuccess("");
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

  const createTask = async () => {
    if (!workspaceId || !form.title.trim()) {
      setError("Please provide a task title.");
      return;
    }

    const allowed = await guardCreate();
    if (!allowed) {
      setError(
        "You have reached your plan limit for tasks. See the upgrade options above."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      workspace_id: workspaceId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      assignee_id: userId,
      created_by: userId,
    };

    const { error: createError } = await supabase.from("tasks").insert(payload);

    setSaving(false);

    if (createError) {
      if (await handleMutationError(createError.message)) return;
      setError(createError.message);
      return;
    }

    setSuccess("Task created successfully.");
    resetForm();
    await fetchTasks(workspaceId);
  };

  const updateTask = async () => {
    if (!editingTaskId || !workspaceId || !form.title.trim()) {
      setError("Please provide a valid task title.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingTaskId)
      .eq("workspace_id", workspaceId);

    setSaving(false);

    if (updateError) {
      if (await handleMutationError(updateError.message)) return;
      setError(updateError.message);
      return;
    }

    setSuccess("Task updated successfully.");
    resetForm();
    await fetchTasks(workspaceId);
  };

  const submitTask = async () => {
    if (editingTaskId) {
      await updateTask();
      return;
    }

    await createTask();
  };

  const populateEditForm = (task: Task) => {
    setEditingTaskId(task.id);
    setFormOpen(true);
    setForm({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      status: task.status,
      due_at: task.due_at ? new Date(task.due_at).toISOString().slice(0, 10) : "",
    });
    setError("");
    setSuccess("");
  };

  const toggleTaskStatus = async (task: Task) => {
    const nextStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        status: nextStatus,
        completed_at: nextStatus === "done" ? new Date().toISOString() : null,
      })
      .eq("id", task.id)
      .eq("workspace_id", workspaceId ?? "");

    if (updateError) {
      if (await handleMutationError(updateError.message)) return;
      setError(updateError.message);
      return;
    }

    setSuccess("Task status updated.");
    await fetchTasks(workspaceId);
  };

  const deleteTask = async (taskId: string) => {
    const confirmed = window.confirm("Delete this task?");
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("workspace_id", workspaceId ?? "");

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSuccess("Task deleted.");
    if (editingTaskId === taskId) {
      resetForm();
    }
    await fetchTasks(workspaceId);
  };

  const today = new Date();

  const todayTasks = tasks.filter((task) => {
    if (!task.due_at) return false;
    return isSameDay(new Date(task.due_at), today);
  });

  const overdueTasks = tasks.filter((task) => {
    if (!task.due_at || task.status === "done") return false;
    return new Date(task.due_at) < today;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        count={tasks.length}
        description="Track your priorities and execution."
        actions={
          <CreateButton
            label="New Task"
            onClick={() => {
              if (formOpen && !editingTaskId) {
                closeForm();
                return;
              }
              resetForm();
              setFormOpen(true);
            }}
          />
        }
      />

      <StatLine
        items={[
          { value: todayTasks.length, label: "due today" },
          {
            value: overdueTasks.length,
            label: "overdue",
            tone: overdueTasks.length > 0 ? "danger" : "default",
          },
          { value: tasks.length, label: "total" },
        ]}
      />

      {!editingTaskId && limitResult ? (
        <FeatureGate limitResult={limitResult} onDismiss={dismiss} />
      ) : null}

      {formOpen ? (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-h2 text-text-primary">
              {editingTaskId ? "Edit task" : "New task"}
            </h2>
            <Button variant="icon" onClick={closeForm} aria-label="Close task form">
              <X size={16} strokeWidth={1.75} />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" htmlFor="task-title">
              <Input
                id="task-title"
                ref={titleRef}
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="What needs to be done?"
              />
            </Field>

            <Field label="Due date" htmlFor="task-due">
              <Input
                id="task-due"
                type="date"
                value={form.due_at}
                onChange={(event) =>
                  setForm((current) => ({ ...current, due_at: event.target.value }))
                }
              />
            </Field>

            <Field label="Priority" htmlFor="task-priority">
              <Select
                id="task-priority"
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value as Priority,
                  }))
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>

            <Field label="Status" htmlFor="task-status">
              <Select
                id="task-status"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as TaskStatus,
                  }))
                }
              >
                {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notes" htmlFor="task-notes" className="mt-4">
            <Textarea
              id="task-notes"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Add context for this task"
              rows={3}
            />
          </Field>

          {error ? (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          ) : null}
          {success ? (
            <Alert tone="success" className="mt-4">
              {success}
            </Alert>
          ) : null}

          <div className="mt-4 flex items-center gap-2">
            <Button
              onClick={submitTask}
              disabled={saving || !workspaceId}
            >
              {saving
                ? editingTaskId
                  ? "Saving..."
                  : "Creating..."
                : editingTaskId
                  ? "Save task"
                  : "Add task"}
            </Button>
            <Button variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {!formOpen && error ? <Alert tone="danger">{error}</Alert> : null}
      {!formOpen && success ? <Alert tone="success">{success}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          size="sm"
          aria-label="Filter by status"
          value={filters.status}
          onChange={(event) =>
            setFilters((current) => ({ ...current, status: event.target.value }))
          }
          className="w-auto min-w-[140px]"
        >
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>

        <Select
          size="sm"
          aria-label="Filter by priority"
          value={filters.priority}
          onChange={(event) =>
            setFilters((current) => ({ ...current, priority: event.target.value }))
          }
          className="w-auto min-w-[140px]"
        >
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </Select>

        {(filters.status !== "all" || filters.priority !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ status: "all", priority: "all" })}
          >
            Reset filters
          </Button>
        )}

        <span className="ml-auto font-mono text-mono tabular-nums text-text-tertiary">
          {filteredTasks.length} shown
        </span>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      ) : !workspaceId ? (
        <EmptyState
          title="No active workspace"
          description="This account is not linked to an active workspace yet."
        />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          title={tasks.length === 0 ? "No tasks yet" : "No tasks match these filters"}
          description={
            tasks.length === 0
              ? "Create your first task to start tracking execution."
              : "Adjust or reset the filters to see more tasks."
          }
          action={
            tasks.length === 0 ? (
              <CreateButton
                label="New Task"
                onClick={() => {
                  resetForm();
                  setFormOpen(true);
                }}
              />
            ) : null
          }
        />
      ) : (
        <ul className="flex flex-col">
          {filteredTasks.map((task) => {
            const done = task.status === "done";
            const overdue =
              !done && task.due_at ? new Date(task.due_at) < today : false;

            return (
              <li
                key={task.id}
                className="group flex min-h-11 items-center gap-3 rounded-row px-2.5 py-1.5 transition-colors duration-150 ease-nexus hover:bg-bg-surface"
              >
                <Checkbox
                  checked={done}
                  onChange={() => void toggleTaskStatus(task)}
                  label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                />

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-body text-text-primary",
                      done && "text-text-tertiary line-through"
                    )}
                  >
                    {task.title}
                  </p>
                  {task.description ? (
                    <p className="truncate text-caption text-text-tertiary">
                      {task.description}
                    </p>
                  ) : null}
                </div>

                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
                  <Badge tone={done ? "success" : "neutral"}>
                    {STATUS_LABELS[task.status]}
                  </Badge>
                </div>

                <span
                  className={cn(
                    "w-14 shrink-0 text-right font-mono text-mono tabular-nums",
                    overdue ? "text-danger" : "text-text-tertiary"
                  )}
                >
                  {formatDate(task.due_at) ?? "—"}
                </span>

                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 ease-nexus focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    variant="icon"
                    aria-label={`Edit ${task.title}`}
                    onClick={() => populateEditForm(task)}
                  >
                    <Pencil size={15} strokeWidth={1.75} />
                  </Button>
                  <Button
                    variant="icon"
                    aria-label={`Delete ${task.title}`}
                    onClick={() => void deleteTask(task.id)}
                    className="hover:text-danger"
                  >
                    <Trash2 size={15} strokeWidth={1.75} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TaskManager({ userId }: { userId: string }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      }
    >
      <TaskManagerInner userId={userId} />
    </Suspense>
  );
}

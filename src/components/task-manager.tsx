"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { canCreateTask } from "@/lib/access";
import { FeatureGate } from "@/components/feature-gate";
import { useFeatureGate } from "@/hooks/use-feature-gate";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/ui/create-button";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";

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

/** Groups shown in the list, in execution order. */
const GROUPS: { id: "active" | "done"; label: string }[] = [
  { id: "active", label: "Open" },
  { id: "done", label: "Completed" },
];

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
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filters, setFilters] = useState({ status: "all", priority: "all" });
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<TaskForm>(blankTaskForm());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(searchParams.get("create") === "1");
  const submitting = useRef(false);

  // Quick create ("+ Add task" inline) + inline title editing.
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState("");
  const [toast, setToast] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (tone: "success" | "danger", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ tone, message });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

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
      try {
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
      } catch (cause) {
        // Network/config failure: surface it instead of spinning forever.
        setError(
          cause instanceof Error
            ? `Could not load data from Supabase: ${cause.message}`
            : "Could not load data from Supabase."
        );
        setLoading(false);
      }
    };

    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  /** Keeps the sidebar counters and the dashboard in sync after a write. */
  const syncServerViews = () => router.refresh();

  const filteredTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return tasks.filter((task) => {
      const statusMatch = filters.status === "all" || task.status === filters.status;
      const priorityMatch = filters.priority === "all" || task.priority === filters.priority;
      const queryMatch =
        needle.length === 0 ||
        task.title.toLowerCase().includes(needle) ||
        (task.description ?? "").toLowerCase().includes(needle);
      return statusMatch && priorityMatch && queryMatch;
    });
  }, [filters, query, tasks]);

  const grouped = useMemo(() => {
    return {
      active: filteredTasks.filter(
        (task) => task.status !== "done" && task.status !== "cancelled"
      ),
      done: filteredTasks.filter(
        (task) => task.status === "done" || task.status === "cancelled"
      ),
    };
  }, [filteredTasks]);

  const resetForm = () => {
    setForm(blankTaskForm());
    setEditingTaskId(null);
    setSuccess("");
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

  const openCreateForm = () => {
    resetForm();
    setError("");
    setFormOpen(true);
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
      setFormOpen(false);
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
      if (await handleMutationError(createError.message)) {
        setFormOpen(false);
        return;
      }
      setError(createError.message);
      return;
    }

    setSuccess("Task created.");
    closeForm();
    await fetchTasks(workspaceId);
    syncServerViews();
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

    setSuccess("Task updated.");
    closeForm();
    await fetchTasks(workspaceId);
    syncServerViews();
  };

  const submitTask = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      if (editingTaskId) await updateTask();
      else await createTask();
    } finally {
      submitting.current = false;
    }
  };

  const populateEditForm = (task: Task) => {
    setEditingTaskId(task.id);
    setFormOpen(true);
    setError("");
    setSuccess("");
    setForm({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      status: task.status,
      due_at: task.due_at ? new Date(task.due_at).toISOString().slice(0, 10) : "",
    });
  };

  const toggleTaskStatus = async (task: Task) => {
    const previousStatus = task.status;
    const nextStatus: TaskStatus = previousStatus === "done" ? "todo" : "done";

    // Optimistic update — the row flips immediately.
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: nextStatus,
              completed_at: nextStatus === "done" ? new Date().toISOString() : null,
            }
          : item
      )
    );

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        status: nextStatus,
        completed_at: nextStatus === "done" ? new Date().toISOString() : null,
      })
      .eq("id", task.id)
      .eq("workspace_id", workspaceId ?? "");

    if (updateError) {
      if (await handleMutationError(updateError.message)) {
        // Rollback the optimistic change on a plan-limit rejection.
        setTasks((current) =>
          current.map((item) =>
            item.id === task.id ? { ...item, status: previousStatus } : item
          )
        );
        return;
      }
      // Rollback + surface the error as a toast.
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, status: previousStatus } : item
        )
      );
      showToast("danger", `Could not update task: ${updateError.message}`);
      return;
    }

    showToast(
      "success",
      nextStatus === "done" ? "Task completed." : "Task reopened."
    );
    syncServerViews();
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
    if (editingTaskId === taskId) closeForm();
    await fetchTasks(workspaceId);
    syncServerViews();
  };

  // Quick create — inline "+ Add task" at the head of the list.
  const createQuickTask = async () => {
    if (!workspaceId || !quickTitle.trim()) return;

    const allowed = await guardCreate();
    if (!allowed) {
      showToast("danger", "Plan limit reached for tasks.");
      setQuickOpen(false);
      setQuickTitle("");
      return;
    }

    setQuickSaving(true);
    const { error: createError } = await supabase.from("tasks").insert({
      workspace_id: workspaceId,
      title: quickTitle.trim(),
      status: "todo",
      priority: "medium",
      assignee_id: userId,
      created_by: userId,
    });
    setQuickSaving(false);

    if (createError) {
      if (await handleMutationError(createError.message)) {
        setQuickOpen(false);
        setQuickTitle("");
        return;
      }
      showToast("danger", createError.message);
      return;
    }

    showToast("success", "Task added.");
    setQuickTitle("");
    setQuickOpen(false);
    await fetchTasks(workspaceId);
    syncServerViews();
  };

  // Inline title editing — double-click the title to rename in place.
  const beginInlineEdit = (task: Task) => {
    setInlineEditId(task.id);
    setInlineTitle(task.title);
  };

  const saveInlineTitle = async () => {
    const taskId = inlineEditId;
    const title = inlineTitle.trim();
    if (!taskId || !title) {
      setInlineEditId(null);
      return;
    }

    const previous = tasks.find((task) => task.id === taskId)?.title ?? title;
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, title } : task))
    );
    setInlineEditId(null);

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("workspace_id", workspaceId ?? "");

    if (updateError) {
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? { ...task, title: previous } : task))
      );
      showToast("danger", `Could not rename task: ${updateError.message}`);
      return;
    }

    showToast("success", "Task renamed.");
    syncServerViews();
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
    setInlineTitle("");
  };

  const today = new Date();

  const dueToday = tasks.filter(
    (task) => task.due_at && isSameDay(new Date(task.due_at), today)
  ).length;

  const overdue = tasks.filter(
    (task) => task.due_at && task.status !== "done" && new Date(task.due_at) < today
  ).length;

  const filtersActive =
    filters.status !== "all" || filters.priority !== "all" || query.trim().length > 0;

  const renderRow = (task: Task) => {
    const done = task.status === "done";
    const isOverdue = !done && task.due_at ? new Date(task.due_at) < today : false;

    return (
      <li
        key={task.id}
        className="group flex min-h-11 items-center gap-3 border-b border-border-subtle px-4 py-1.5 last:border-b-0 transition-colors duration-150 ease-nexus hover:bg-bg-surface/60"
      >
        <Checkbox
          checked={done}
          onChange={() => void toggleTaskStatus(task)}
          label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        />

        {inlineEditId === task.id ? (
          <input
            autoFocus
            value={inlineTitle}
            onChange={(event) => setInlineTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveInlineTitle();
              if (event.key === "Escape") cancelInlineEdit();
            }}
            onBlur={() => void saveInlineTitle()}
            className="h-8 min-w-0 flex-1 rounded-input border border-border-focus bg-bg-surface px-2.5 text-body text-text-primary outline-none"
            aria-label={`Rename ${task.title}`}
          />
        ) : (
          <button
            type="button"
            onClick={() => populateEditForm(task)}
            onDoubleClick={() => beginInlineEdit(task)}
            className="min-w-0 flex-1 text-left"
            title="Double-click to rename"
          >
            <span
              className={cn(
                "block truncate text-body text-text-primary",
                done && "strike text-text-tertiary"
              )}
            >
              {task.title}
            </span>
            {task.description ? (
              <span className="block truncate text-caption text-text-tertiary">
                {task.description}
              </span>
            ) : null}
          </button>
        )}

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
          <Badge tone={done ? "success" : "neutral"}>{STATUS_LABELS[task.status]}</Badge>
        </div>

        <span
          className={cn(
            "w-14 shrink-0 text-right font-mono text-mono tabular-nums",
            isOverdue ? "text-danger" : "text-text-tertiary"
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
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        count={tasks.length}
        description="Everything you are executing in this workspace."
        actions={<CreateButton label="New Task" onClick={openCreateForm} />}
      />

      {/* Metrics strip */}
      <div className="grid grid-cols-3 divide-x divide-border-subtle rounded-card border border-border-subtle bg-bg-subtle/60">
        <div className="px-4 py-3">
          <p className="font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary">
            Open
          </p>
          <p className="mt-1 font-mono text-[20px] leading-none tabular-nums text-text-primary">
            {activeTaskCount}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary">
            Due today
          </p>
          <p className="mt-1 font-mono text-[20px] leading-none tabular-nums text-text-primary">
            {dueToday}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary">
            Overdue
          </p>
          <p
            className={cn(
              "mt-1 font-mono text-[20px] leading-none tabular-nums",
              overdue > 0 ? "text-danger" : "text-text-primary"
            )}
          >
            {overdue}
          </p>
        </div>
      </div>

      {!editingTaskId && limitResult ? (
        <FeatureGate limitResult={limitResult} onDismiss={dismiss} />
      ) : null}

      {error && !formOpen ? <Alert tone="danger">{error}</Alert> : null}
      {success && !formOpen ? <Alert tone="success">{success}</Alert> : null}

      <Panel
        title="All tasks"
        description={`${filteredTasks.length} shown`}
        bodyClassName="p-0"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative">
              <Search
                size={14}
                strokeWidth={1.75}
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
              />
              <Input
                aria-label="Search tasks"
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-8 w-[150px] pl-7 text-small"
              />
            </div>

            <Select
              size="sm"
              aria-label="Filter by status"
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
              className="w-auto min-w-[128px]"
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
              className="w-auto min-w-[120px]"
            >
              <option value="all">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>

            {filtersActive ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters({ status: "all", priority: "all" });
                  setQuery("");
                }}
              >
                Reset
              </Button>
            ) : null}
          </div>
        }
      >
        {loading ? (
          <div className="space-y-1.5 p-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : !workspaceId ? (
          <div className="p-4">
            <EmptyState
              title="No active workspace"
              description="This account is not linked to an active workspace yet."
            />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={tasks.length === 0 ? "No tasks yet" : "Nothing matches these filters"}
              description={
                tasks.length === 0
                  ? "Create your first task to start tracking execution."
                  : "Adjust the search or reset the filters."
              }
              action={
                tasks.length === 0 ? (
                  <CreateButton label="New Task" onClick={openCreateForm} />
                ) : null
              }
            />
          </div>
        ) : (
          GROUPS.map((group) => {
            const rows = grouped[group.id];
            const isActiveGroup = group.id === "active";
            if (rows.length === 0 && !isActiveGroup) return null;

            return (
              <div key={group.id}>
                <div className="flex items-center justify-between border-b border-border-subtle bg-bg-base/40 px-4 py-1.5">
                  <span className="font-mono text-mono uppercase tracking-[0.1em] text-text-quaternary">
                    {group.label}
                  </span>
                  <span className="font-mono text-mono tabular-nums text-text-quaternary">
                    {rows.length}
                  </span>
                </div>

                {isActiveGroup ? (
                  quickOpen ? (
                    <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2">
                      <input
                        autoFocus
                        disabled={quickSaving}
                        value={quickTitle}
                        onChange={(event) => setQuickTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void createQuickTask();
                          if (event.key === "Escape") {
                            setQuickOpen(false);
                            setQuickTitle("");
                          }
                        }}
                        placeholder="Task title — Enter to create, Esc to cancel"
                        className="h-9 min-w-0 flex-1 rounded-input border border-border-focus bg-bg-surface px-3 text-body text-text-primary outline-none placeholder:text-text-quaternary"
                        aria-label="New task title"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setQuickOpen(true)}
                      className="flex h-9 w-full items-center gap-2 px-4 text-small text-text-tertiary transition-colors duration-150 ease-nexus hover:bg-bg-surface/60 hover:text-text-secondary"
                    >
                      <Plus size={14} strokeWidth={1.75} />
                      Add task
                    </button>
                  )
                ) : null}

                {rows.length > 0 ? <ul>{rows.map(renderRow)}</ul> : null}
              </div>
            );
          })
        )}
      </Panel>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingTaskId ? "Edit task" : "New task"}
        description={
          editingTaskId
            ? "Update the details of this task."
            : "Add a task to your workspace."
        }
        footer={
          <>
            <Button onClick={submitTask} disabled={saving || !workspaceId}>
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
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Title" htmlFor="task-title">
            <Input
              id="task-title"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="What needs to be done?"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
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
          </div>

          <Field label="Notes" htmlFor="task-notes">
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

          {error ? <Alert tone="danger">{error}</Alert> : null}
        </div>
      </Modal>

      {toast ? (
        <div
          role="status"
          className={cn(
            "fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 animate-toast-in rounded-pill border px-4 py-2.5 text-small shadow-dropdown",
            toast.tone === "success"
              ? "border-success-border bg-bg-surface text-success"
              : "border-danger-border bg-bg-surface text-danger"
          )}
        >
          {toast.message}
        </div>
      ) : null}
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

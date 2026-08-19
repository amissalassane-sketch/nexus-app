"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, Plus, SquarePen, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { canCreateTask } from "@/lib/access";
import { FeatureGate } from "@/components/feature-gate";
import { useFeatureGate } from "@/hooks/use-feature-gate";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  InlineEdit,
  Select,
  SkeletonList,
  StatCard,
  TaskCheckbox,
  TextArea,
} from "@/components/ui";

// ============================================================
// NEXUS — TASK MANAGER (P2: alive)
//  - Quick create: "+ Add task" on top of the list (Enter/Escape)
//  - Optimistic complete / reopen with rollback + toast
//  - Inline title editing (double-click)
//  - Skeletons at real dimensions, staggered list, animated checkbox
// ============================================================

type TaskStatus = "todo" | "in_progress" | "in_review" | "blocked" | "done" | "cancelled";
type Priority = "low" | "medium" | "high" | "urgent";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due_at: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectOption = { id: string; name: string };

type TaskForm = {
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  due_at: string;
  projectId: string;
};


const blankTaskForm = (): TaskForm => ({
  title: "",
  description: "",
  priority: "medium",
  status: "todo",
  due_at: "",
  projectId: "",
});

const PRIORITY_TONES: Record<Priority, "neutral" | "info" | "warning" | "danger"> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

const isToday = (value: string | null) => {
  if (!value) return false;
  return new Date(value).toDateString() === new Date().toDateString();
};

const isOverdue = (task: Task) => {
  if (!task.due_at || task.status === "done" || task.status === "cancelled") return false;
  return new Date(task.due_at) < new Date();
};

const formatDue = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
};

// Capability probe (P7): tasks.project_id may be absent — hide the
// project UI entirely instead of erroring.
async function probeProjectColumn(
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  const { error } = await supabase.from("tasks").select("project_id").limit(1);
  return !error;
}

async function loadProjectOptions(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<ProjectOption[]> {
  const { data } = await supabase
    .from("projects")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });
  return ((data as ProjectOption[]) ?? []).filter((project) => project.id && project.name);
}

// Module-level loader (setState stays behind an await — pitfall #5).
async function loadTasksForWorkspace(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<{ data: Task[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("due_at", { ascending: true, nullsFirst: false });

  return { data: (data as Task[]) ?? null, error: error as { message: string } | null };
}

export function TaskManager({
  userId,
  workspaceId,
  initialNew = false,
}: {
  userId: string;
  /** Resolved server-side by the (app) layout — never null in practice. */
  workspaceId: string | null;
  initialNew?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const quickAddRef = useRef<HTMLInputElement>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "all", priority: "all" });
  const [form, setForm] = useState<TaskForm>(blankTaskForm());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState("");
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [projectCapable, setProjectCapable] = useState(false);
  const [projectFilter, setProjectFilter] = useState("all");

  const activeTaskCount = useMemo(
    () => tasks.filter((task) => task.status !== "done" && task.status !== "cancelled").length,
    [tasks]
  );
  const { limitResult, guardCreate, handleMutationError, dismiss } = useFeatureGate(
    workspaceId,
    canCreateTask,
    activeTaskCount
  );

  useEffect(() => {
    const load = async () => {
      if (!workspaceId) return;

      const capable = await probeProjectColumn(supabase);
      setProjectCapable(capable);

      const { data, error: loadError } = await loadTasksForWorkspace(supabase, workspaceId);
      if (loadError) {
        setError(loadError.message);
        setTasks([]);
        setLoading(false);
        return;
      }
      setTasks(data ?? []);
      setLoading(false);

      if (capable) {
        const projects = await loadProjectOptions(supabase, workspaceId);
        setProjectOptions(projects);
      }
    };
    void load();
  }, [supabase, workspaceId]);

  // /tasks?new=1 (Create dropdown) → focus the quick-add field.
  useEffect(() => {
    if (initialNew) quickAddRef.current?.focus();
  }, [initialNew]);

  const projectNameById = useMemo(
    () => new Map(projectOptions.map((project) => [project.id, project.name])),
    [projectOptions]
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const statusMatch = filters.status === "all" || task.status === filters.status;
      const priorityMatch = filters.priority === "all" || task.priority === filters.priority;
      const projectMatch =
        !projectCapable ||
        projectFilter === "all" ||
        (projectFilter === "none" ? !task.project_id : task.project_id === projectFilter);
      return statusMatch && priorityMatch && projectMatch;
    });
  }, [filters, tasks, projectCapable, projectFilter]);

  // -- Quick create (optimistic) -------------------------------

  const submitQuickAdd = async () => {
    const title = quickAdd.trim();
    if (!workspaceId || !title) return;

    const allowed = await guardCreate();
    if (!allowed) return;

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Task = {
      id: tempId,
      title,
      description: null,
      status: "todo",
      priority: "medium",
      due_at: null,
      project_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const snapshot = tasks;
    setTasks((current) => [optimistic, ...current]);
    setQuickAdd("");

    const { data: created, error: createError } = await supabase
      .from("tasks")
      .insert({
        workspace_id: workspaceId,
        title,
        description: null,
        status: "todo",
        priority: "medium",
        due_at: null,
        assignee_id: userId,
        created_by: userId,
      })
      .select("*")
      .single();

    if (createError) {
      setTasks(snapshot); // rollback
      setQuickAdd(title); // field keeps what the user typed
      if (await handleMutationError(createError.message)) return;
      toast.error(`Task not created — ${createError.message}`);
      return;
    }

    setTasks((current) =>
      current.map((task) => (task.id === tempId ? ((created as Task) ?? optimistic) : task))
    );
  };

  // -- Optimistic complete / reopen ----------------------------

  const toggleTaskStatus = async (task: Task) => {
    const nextStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    const snapshot = tasks;

    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: nextStatus,
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
      setTasks(snapshot); // rollback — the row returns to its real state
      if (await handleMutationError(updateError.message)) return;
      toast.error(`Change not saved — ${updateError.message}`);
    }
  };

  // -- Inline title edit (double-click) ------------------------

  const saveInlineTitle = async (task: Task, nextTitle: string) => {
    setInlineEditingId(null);
    if (nextTitle === task.title) return;

    const snapshot = tasks;
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, title: nextTitle } : item))
    );

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ title: nextTitle, updated_at: new Date().toISOString() })
      .eq("id", task.id)
      .eq("workspace_id", workspaceId ?? "");

    if (updateError) {
      setTasks(snapshot);
      toast.error(`Title not saved — ${updateError.message}`);
    }
  };

  // -- Editor (create / edit) ----------------------------------

  const resetForm = () => {
    setForm(blankTaskForm());
    setEditingTaskId(null);
  };

  const createTask = async () => {
    if (!workspaceId || !form.title.trim()) {
      setError("Please provide a task title.");
      return;
    }

    const allowed = await guardCreate();
    if (!allowed) return;

    setSaving(true);
    setError("");

    const { error: createError } = await supabase.from("tasks").insert({
      workspace_id: workspaceId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      assignee_id: userId,
      created_by: userId,
      ...(projectCapable && form.projectId ? { project_id: form.projectId } : {}),
    });

    setSaving(false);

    if (createError) {
      if (await handleMutationError(createError.message)) return;
      setError(createError.message);
      return;
    }

    toast.success("Task created.");
    resetForm();
    const { data } = await loadTasksForWorkspace(supabase, workspaceId);
    setTasks(data ?? []);
  };

  const updateTask = async () => {
    if (!editingTaskId || !workspaceId || !form.title.trim()) {
      setError("Please provide a valid task title.");
      return;
    }

    setSaving(true);
    setError("");

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        updated_at: new Date().toISOString(),
        ...(projectCapable ? { project_id: form.projectId || null } : {}),
      })
      .eq("id", editingTaskId)
      .eq("workspace_id", workspaceId);

    setSaving(false);

    if (updateError) {
      if (await handleMutationError(updateError.message)) return;
      setError(updateError.message);
      return;
    }

    toast.success("Task updated.");
    resetForm();
    const { data } = await loadTasksForWorkspace(supabase, workspaceId);
    setTasks(data ?? []);
  };

  const populateEditForm = (task: Task) => {
    setEditingTaskId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      status: task.status,
      due_at: task.due_at ? new Date(task.due_at).toISOString().slice(0, 10) : "",
      projectId: task.project_id ?? "",
    });
    setError("");
  };

  const deleteTask = async (taskId: string) => {
    if (!window.confirm("Delete this task?")) return;

    const snapshot = tasks;
    setTasks((current) => current.filter((task) => task.id !== taskId));

    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("workspace_id", workspaceId ?? "");

    if (deleteError) {
      setTasks(snapshot);
      toast.error(`Task not deleted — ${deleteError.message}`);
      return;
    }

    toast.success("Task deleted.");
    if (editingTaskId === taskId) resetForm();
  };

  const todayCount = tasks.filter((task) => isToday(task.due_at)).length;
  const overdueCount = tasks.filter(isOverdue).length;
  const doneCount = tasks.filter((task) => task.status === "done").length;

  return (
    <div className="space-y-6">
      {!editingTaskId && limitResult ? (
        <FeatureGate limitResult={limitResult} onDismiss={dismiss} />
      ) : null}

      {/* STATS */}
      <div className="stagger-list grid gap-4 sm:grid-cols-3">
        <StatCard label="Today" value={todayCount} hint="Tasks due today" />
        <StatCard
          label="Overdue"
          value={overdueCount}
          hint={overdueCount > 0 ? "The oldest needs you first" : "Nothing late"}
          tone={overdueCount > 0 ? "danger" : "default"}
        />
        <StatCard label="Done" value={doneCount} hint={`${activeTaskCount} active now`} />
      </div>

      {/* EDITOR */}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-body font-semibold text-text-primary">
            {editingTaskId ? "Edit task" : "Create task"}
          </h3>
          {editingTaskId ? (
            <Button variant="ghost" onClick={resetForm} className="min-h-0 px-2 py-1">
              <X size={14} strokeWidth={2} /> Cancel
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Task title"
          />
          <Field
            label="Due date"
            type="date"
            value={form.due_at}
            onChange={(event) => setForm((current) => ({ ...current, due_at: event.target.value }))}
          />
          <Select
            label="Priority"
            value={form.priority}
            onChange={(event) =>
              setForm((current) => ({ ...current, priority: event.target.value as Priority }))
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
          <Select
            label="Status"
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({ ...current, status: event.target.value as TaskStatus }))
            }
          >
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="in_review">In review</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          {projectCapable ? (
            <Select
              label="Project"
              value={form.projectId}
              onChange={(event) =>
                setForm((current) => ({ ...current, projectId: event.target.value }))
              }
            >
              <option value="">No project</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        <div className="mt-4">
          <TextArea
            label="Notes"
            rows={3}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Add notes for this task"
          />
        </div>

        {error ? <div className="mt-4">{<ErrorBox message={error} />}</div> : null}

        <div className="mt-4">
          <Button
            variant="primary"
            onClick={() => (editingTaskId ? void updateTask() : void createTask())}
            disabled={saving || !workspaceId || (!editingTaskId && Boolean(limitResult))}
          >
            {saving ? "Saving…" : editingTaskId ? "Save task" : "Add task"}
          </Button>
        </div>
      </Card>

      {/* LIST */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-body font-semibold text-text-primary">Tasks</h2>
          <div className="flex flex-wrap gap-2">
            <Select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
              className="min-h-9 w-auto py-1"
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="in_review">In review</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </Select>
            <Select
              value={filters.priority}
              onChange={(event) =>
                setFilters((current) => ({ ...current, priority: event.target.value }))
              }
              className="min-h-9 w-auto py-1"
              aria-label="Filter by priority"
            >
              <option value="all">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
            {projectCapable ? (
              <Select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                className="min-h-9 w-auto py-1"
                aria-label="Filter by project"
              >
                <option value="all">All projects</option>
                <option value="none">No project</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
        </div>

        {/* QUICK CREATE — Enter creates, Escape cancels */}
        <div className="mb-3 flex min-h-11 items-center gap-3 rounded-lg border border-dashed border-border-default bg-bg-subtle px-4 transition-colors duration-[160ms] focus-within:border-border-focus">
          <Plus size={16} strokeWidth={2} className="shrink-0 text-volt" />
          <input
            ref={quickAddRef}
            value={quickAdd}
            onChange={(event) => setQuickAdd(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitQuickAdd();
              } else if (event.key === "Escape") {
                setQuickAdd("");
              }
            }}
            placeholder="Add task — Enter to create, Escape to cancel"
            aria-label="Quick add task"
            className="w-full bg-transparent py-3 text-body text-text-primary outline-none placeholder:text-text-quaternary"
          />
        </div>

        {loading ? (
          <SkeletonList rows={4} />
        ) : error && tasks.length === 0 ? (
          <ErrorBox message={error} />
        ) : !workspaceId ? (
          <EmptyState
            icon={<CheckSquare size={16} strokeWidth={1.75} />}
            title="No active workspace"
            hint="Your workspace link is being verified — reload in a moment."
          />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<CheckSquare size={16} strokeWidth={1.75} />}
            title="No tasks yet"
            hint="Type your first task in the field above — Enter is enough."
          />
        ) : filteredTasks.length === 0 ? (
          <EmptyState title="Nothing matches these filters" hint="Adjust status or priority above." />
        ) : (
          <div className="stagger-list space-y-2">
            {filteredTasks.map((task) => {
              const done = task.status === "done";
              const overdue = isOverdue(task);
              const due = formatDue(task.due_at);
              const editingInline = inlineEditingId === task.id;

              return (
                <div
                  key={task.id}
                  className={`group flex min-h-11 items-center gap-3 rounded-lg border px-4 transition-all duration-[160ms] ease-out ${
                    done
                      ? "border-border-subtle bg-bg-subtle/60"
                      : "border-border-subtle bg-bg-surface hover:border-border-strong hover:bg-bg-surface-2"
                  }`}
                >
                  <TaskCheckbox
                    checked={done}
                    onChange={() => void toggleTaskStatus(task)}
                    label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                  />

                  <div className="min-w-0 flex-1">
                    {editingInline ? (
                      <InlineEdit
                        value={task.title}
                        onSave={(next) => void saveInlineTitle(task, next)}
                        ariaLabel="Edit task title"
                        className="w-full text-body"
                      />
                    ) : (
                      <div
                        onDoubleClick={() => setInlineEditingId(task.id)}
                        title="Double-click to rename"
                        className={`truncate text-body transition-all duration-[160ms] ease-out ${
                          done ? "text-text-quaternary line-through" : "text-text-primary"
                        }`}
                      >
                        {task.title}
                      </div>
                    )}
                    {task.description && !editingInline ? (
                      <p className="truncate text-caption text-text-tertiary">{task.description}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {projectCapable && task.project_id && projectNameById.has(task.project_id) ? (
                      <Badge>{projectNameById.get(task.project_id)}</Badge>
                    ) : null}
                    <Badge tone={PRIORITY_TONES[task.priority]}>{task.priority}</Badge>
                    {task.status !== "todo" && task.status !== "done" ? (
                      <Badge tone={task.status === "blocked" ? "warning" : "info"}>
                        {task.status.replace("_", " ")}
                      </Badge>
                    ) : null}
                    {due ? (
                      <span
                        className={`font-mono text-mono-small ${
                          overdue ? "text-danger-fg" : "text-text-tertiary"
                        }`}
                      >
                        {overdue ? "↑ " : ""}
                        {due}
                      </span>
                    ) : null}

                    <div className="flex items-center gap-1 opacity-0 transition-opacity duration-[160ms] group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        aria-label={`Edit ${task.title}`}
                        onClick={() => populateEditForm(task)}
                        className="rounded p-1.5 text-text-tertiary transition-colors duration-[120ms] hover:bg-bg-surface-3 hover:text-text-primary"
                      >
                        <SquarePen size={14} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${task.title}`}
                        onClick={() => void deleteTask(task.id)}
                        className="rounded p-1.5 text-text-tertiary transition-colors duration-[120ms] hover:bg-danger-bg hover:text-danger-fg"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

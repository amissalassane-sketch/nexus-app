"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { canCreateTask } from "@/lib/access";
import { FeatureGate } from "@/components/feature-gate";
import { useFeatureGate } from "@/hooks/use-feature-gate";

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

export function TaskManager({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filters, setFilters] = useState({ status: "all", priority: "all" });
  const [form, setForm] = useState<TaskForm>(blankTaskForm());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
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
      const { data: memberships } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      const nextWorkspaceId = memberships?.[0]?.workspace_id ?? null;
      setWorkspaceId(nextWorkspaceId);
      await fetchTasks(nextWorkspaceId);
    };

    void loadWorkspace();
  }, [supabase, userId]);

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

  const createTask = async () => {
    if (!workspaceId || !form.title.trim()) {
      setError("Please provide a task title.");
      return;
    }

    const allowed = await guardCreate();
    if (!allowed) return;

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

    const { error: deleteError } = await supabase.from("tasks").delete().eq("id", taskId).eq("workspace_id", workspaceId ?? "");

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
    const dueDate = new Date(task.due_at);
    return dueDate.toDateString() === today.toDateString();
  });

  const overdueTasks = tasks.filter((task) => {
    if (!task.due_at || task.status === "done") return false;
    const dueDate = new Date(task.due_at);
    return dueDate < today;
  });

  return (
    <div className="space-y-6">
      {!editingTaskId && limitResult ? (
        <FeatureGate limitResult={limitResult} onDismiss={dismiss} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-sm text-zinc-500">Today</div>
          <div className="mt-3 text-3xl font-semibold">{todayTasks.length}</div>
          <div className="mt-2 text-xs text-zinc-600">Tasks due today</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-sm text-zinc-500">Overdue</div>
          <div className="mt-3 text-3xl font-semibold">{overdueTasks.length}</div>
          <div className="mt-2 text-xs text-zinc-600">Tasks requiring attention</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-sm text-zinc-500">Total</div>
          <div className="mt-3 text-3xl font-semibold">{tasks.length}</div>
          <div className="mt-2 text-xs text-zinc-600">Tracked tasks</div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{editingTaskId ? "Edit task" : "Create task"}</h2>
          {editingTaskId ? (
            <button type="button" onClick={resetForm} className="text-sm text-zinc-400 hover:text-white">
              Cancel
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Task title"
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-zinc-700 focus:border-white/30"
          />
          <input
            type="date"
            value={form.due_at}
            onChange={(event) => setForm((current) => ({ ...current, due_at: event.target.value }))}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
          <select
            value={form.priority}
            onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as Priority }))}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          >
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
            <option value="urgent">Urgent</option>
          </select>
          <select
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TaskStatus }))}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          >
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="in_review">In review</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <textarea
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          placeholder="Add notes for this task"
          rows={3}
          className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-zinc-700 focus:border-white/30"
        />

        {error ? <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div> : null}
        {success ? <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">{success}</div> : null}

        <button
          type="button"
          onClick={submitTask}
          disabled={saving || !workspaceId || (!editingTaskId && Boolean(limitResult))}
          className="mt-4 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (editingTaskId ? "Saving task..." : "Creating task...") : editingTaskId ? "Save task" : "Add task"}
        </button>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-semibold">Tasks</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/30"
            >
              <option value="all">All statuses</option>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="in_review">In review</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={filters.priority}
              onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/30"
            >
              <option value="all">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-zinc-500">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">
            No tasks yet. Create your first task above.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{task.title}</h3>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-zinc-400">
                        {task.priority}
                      </span>
                    </div>
                    {task.description ? <p className="mt-1 text-sm text-zinc-400">{task.description}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => populateEditForm(task)}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleTaskStatus(task)}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
                    >
                      {task.status === "done" ? "Reopen" : "Mark done"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTask(task.id)}
                      className="rounded-xl border border-red-500/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span>Status: {task.status}</span>
                  {task.due_at ? <span>Due: {new Date(task.due_at).toLocaleDateString()}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


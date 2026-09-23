"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconChecklist,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { canCreateTask } from "@/lib/access";
import { FeatureGate } from "@/components/feature-gate";
import { useFeatureGate } from "@/hooks/use-feature-gate";
import { cn } from "@/lib/cn";
import { humanizeDataError, logDataError, type DataErrorLike } from "@/lib/data-errors";
import { useDataError } from "@/hooks/use-data-error";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/ui/create-button";
import { Badge } from "@/components/ui/badge";
import { Metric, Panel } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, ErrorDiagnostic, Skeleton, SkeletonRows } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { PillTabs } from "@/components/ui/tabs";
import { NexusKanban, STATUS_LABELS, type KanbanTask, type Priority, type TaskStatus } from "@/components/tasks/nexus-kanban";
import { useWorkspaceRealtime } from "@/hooks/use-workspace-realtime";

type Task = KanbanTask;

/** Saved views — the same vocabulary the Intelligence signals use. */
type TaskView = "all" | "today" | "overdue" | "blocked" | "unscheduled";

const VIEWS: { id: TaskView; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "overdue", label: "Overdue" },
  { id: "blocked", label: "Blocked" },
  { id: "unscheduled", label: "No date" },
];

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
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", timeZone: "UTC" }).format(date);
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
  // Friendly sentence + database diagnostic (code/message/hint) in one
  // slot — see useDataError (same contract as the project manager).
  const { error, errorDetail, setError, reportDataError } = useDataError();
  const [success, setSuccess] = useState("");
  const [filters, setFilters] = useState({ status: "all", priority: "all" });
  // Saved views. Intelligence signals deep-link here (?filter=overdue etc.),
  // so a recommended action lands on exactly the work it described.
  const [view, setView] = useState<TaskView>(
    (searchParams.get("filter") as TaskView) ?? "all"
  );
  const [query, setQuery] = useState("");
  const [boardView, setBoardView] = useState<"list" | "kanban">(
    searchParams.get("view") === "kanban" ? "kanban" : "list"
  );
  const [form, setForm] = useState<TaskForm>(blankTaskForm());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(searchParams.get("create") === "1");
  // Deep link (?create=1): open the form even when the manager is already
  // mounted on this route — the onboarding tour CTA and the checklist both
  // navigate here in place, where a mount-only initializer would miss it.
  // Derive-on-prop-change (not an effect) so it never re-opens the form on
  // unrelated URL edits (e.g. a view change that keeps ?create=1).
  const [prevCreateParam, setPrevCreateParam] = useState(
    searchParams.get("create") === "1"
  );
  if (searchParams.get("create") === "1" && !prevCreateParam) {
    setPrevCreateParam(true);
    setFormOpen(true);
  } else if (searchParams.get("create") !== "1" && prevCreateParam) {
    setPrevCreateParam(false);
  }
  const submitting = useRef(false);

  // Quick create ("+ Add task" inline) + inline title editing.
  // Destructive confirmation — the ConfirmDialog gates the delete; the
  // mutation itself is unchanged.
  const [confirmingDelete, setConfirmingDelete] = useState<Task | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState("");
  // Motion states — task interactions should communicate transition
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const [exitingTasks, setExitingTasks] = useState<Set<string>>(new Set());
  const [newTaskIds, setNewTaskIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const showToast = (tone: "success" | "danger", message: string) =>
    toast(tone, message);
  /**
   * Toast counterpart of reportDataError for the inline mutations
   * (kanban move, quick add, inline rename, completion toggle): the same
   * console.error line, and the code — plus the bounded raw message when
   * the toast text is friendly copy — as the toast's small description.
   * The toast text itself is unchanged.
   */
  const toastDataError = (
    context: string,
    cause: DataErrorLike,
    message: string,
    { withMessage = false }: { withMessage?: boolean } = {}
  ) => {
    const detail = logDataError(context, cause);
    const description = detail
      ? `code ${detail.code}${withMessage && detail.message ? ` — ${detail.message}` : ""}${
          detail.hint ? ` · hint: ${detail.hint}` : ""
        }`
      : undefined;
    toast("danger", message, description ? { description } : undefined);
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
      reportDataError("tasks.load", loadError);
      setTasks([]);
      setLoading(false);
      return;
    }

    const nextTasks = (data as Task[]) ?? [];
    setTasks((prev) => {
      const prevIds = new Set(prev.map((t) => t.id));
      const newIds = nextTasks.filter((t) => !prevIds.has(t.id)).map((t) => t.id);
      if (newIds.length > 0) {
        setNewTaskIds(new Set(newIds));
        setTimeout(() => setNewTaskIds(new Set()), 500);
      }
      return nextTasks;
    });
    setLoading(false);
    // Ground truth for the onboarding layer — see project-manager.
    window.dispatchEvent(
      new CustomEvent("nexus:counts", { detail: { tasks: nextTasks.length } })
    );
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

  useWorkspaceRealtime<Task>({
    supabase,
    workspaceId,
    table: "tasks",
    onInsert: (newTask) => {
      setTasks((current) => {
        if (current.some((t) => t.id === newTask.id)) return current;
        const next = [newTask, ...current];
        window.dispatchEvent(
          new CustomEvent("nexus:counts", { detail: { tasks: next.length } })
        );
        return next;
      });
    },
    onUpdate: (updatedTask) => {
      setTasks((current) =>
        current.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
      );
    },
    onDelete: (deletedTask) => {
      if (!deletedTask.id) return;
      setTasks((current) => {
        const next = current.filter((t) => t.id !== deletedTask.id);
        window.dispatchEvent(
          new CustomEvent("nexus:counts", { detail: { tasks: next.length } })
        );
        return next;
      });
    },
  });


  const filteredTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const now = new Date();
    const open = (task: Task) =>
      task.status !== "done" && task.status !== "cancelled";

    return tasks.filter((task) => {
      const statusMatch = filters.status === "all" || task.status === filters.status;
      const priorityMatch =
        filters.priority === "all" || task.priority === filters.priority;
      const queryMatch =
        needle.length === 0 ||
        task.title.toLowerCase().includes(needle) ||
        (task.description ?? "").toLowerCase().includes(needle);

      const viewMatch =
        view === "all"
          ? true
          : view === "overdue"
            ? open(task) && Boolean(task.due_at) && new Date(task.due_at!) < now
            : view === "today"
              ? open(task) &&
                Boolean(task.due_at) &&
                isSameDay(new Date(task.due_at!), now)
              : view === "blocked"
                ? task.status === "blocked"
                : open(task) && !task.due_at;

      return statusMatch && priorityMatch && queryMatch && viewMatch;
    });
  }, [filters, query, tasks, view]);

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

  // The global "C" shortcut creates in the context of the current page.
  useEffect(() => {
    const onCreate = () => openCreateForm();
    window.addEventListener("nexus:create", onCreate);
    return () => window.removeEventListener("nexus:create", onCreate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      reportDataError("tasks.create", createError);
      return;
    }

    setSuccess("Task created.");
    window.dispatchEvent(
      new CustomEvent("nexus:activation", { detail: { type: "task_created" } })
    );
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
      reportDataError("tasks.update", updateError);
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
    const isCompleting = nextStatus === "done";

    if (isCompleting) {
      setCompletingTasks((prev) => new Set(prev).add(task.id));
      // Delay the status change slightly to show checkbox pop animation
      setTimeout(() => {
        setTasks((current) =>
          current.map((item) =>
            item.id === task.id
              ? {
                  ...item,
                  status: "done" as TaskStatus,
                  completed_at: new Date().toISOString(),
                }
              : item
          )
        );
        setTimeout(() => {
          setCompletingTasks((prev) => {
            const next = new Set(prev);
            next.delete(task.id);
            return next;
          });
        }, 300);
      }, 180);
    } else {
      // Reopening — immediate
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: "todo" as TaskStatus,
                completed_at: null,
              }
            : item
        )
      );
    }

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        status: nextStatus,
        completed_at: nextStatus === "done" ? new Date().toISOString() : null,
      })
      .eq("id", task.id)
      .eq("workspace_id", workspaceId ?? "");

    if (updateError) {
      setCompletingTasks((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      if (await handleMutationError(updateError.message)) {
        setTasks((current) =>
          current.map((item) =>
            item.id === task.id ? { ...item, status: previousStatus } : item
          )
        );
        return;
      }
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, status: previousStatus } : item
        )
      );
      toastDataError(
        "tasks.toggle",
        updateError,
        `Could not update task: ${updateError.message}`
      );
      return;
    }

    showToast(
      "success",
      nextStatus === "done" ? "Task completed." : "Task reopened."
    );
    syncServerViews();
  };

  const updateTaskStatus = async (task: Task, nextStatus: TaskStatus) => {
    if (!workspaceId || task.status === nextStatus) return;
    const previousStatus = task.status;
    const completedAt = nextStatus === "done" ? new Date().toISOString() : null;

    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? { ...item, status: nextStatus, completed_at: completedAt }
          : item
      )
    );

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        status: nextStatus,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, status: previousStatus } : item
        )
      );
      if (!(await handleMutationError(updateError.message))) {
        toastDataError(
          "tasks.move",
          updateError,
          `Could not move task: ${humanizeDataError(updateError)}`,
          { withMessage: true }
        );
      }
      return;
    }

    showToast("success", `Task moved to ${STATUS_LABELS[nextStatus]}.`);
    syncServerViews();
  };

  const deleteTask = async (taskId: string) => {
    // Motion: deliberate but fast exit animation before removal
    setExitingTasks((prev) => new Set(prev).add(taskId));
    await new Promise((resolve) => setTimeout(resolve, 180));
    const previous = tasks;
    setTasks((current) => current.filter((item) => item.id !== taskId));
    setExitingTasks((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    if (editingTaskId === taskId) closeForm();

    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("workspace_id", workspaceId ?? "");

    if (deleteError) {
      setTasks(previous);
      reportDataError("tasks.delete", deleteError);
      return;
    }

    setSuccess("Task deleted.");
    await fetchTasks(workspaceId);
    syncServerViews();
  };

  const NEXT_PRIORITY: Record<Priority, Priority> = {
    low: "medium",
    medium: "high",
    high: "urgent",
    urgent: "low",
  };

  const cyclePriority = async (task: Task, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!workspaceId) return;
    const previousPriority = task.priority;
    const nextPriority = NEXT_PRIORITY[previousPriority];

    // Optimistic update
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, priority: nextPriority } : item
      )
    );

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ priority: nextPriority, updated_at: new Date().toISOString() })
      .eq("id", task.id)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      // Rollback
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, priority: previousPriority } : item
        )
      );
      toastDataError("tasks.priority", updateError, "Could not update priority.");
      return;
    }

    showToast("success", `Priority set to ${nextPriority}.`);
    syncServerViews();
  };

  // Quick create — inline "+ Add task" at the head of the list.
  const createQuickTask = async () => {
    const title = quickTitle.trim();
    if (!workspaceId || !title) return;

    const allowed = await guardCreate();
    if (!allowed) {
      showToast("danger", "Plan limit reached for tasks.");
      setQuickOpen(false);
      setQuickTitle("");
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimisticTask: Task = {
      id: tempId,
      title,
      description: null,
      status: "todo",
      priority: "medium",
      due_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistic insert: immediate 0ms UX
    setTasks((current) => [optimisticTask, ...current]);
    setNewTaskIds(new Set([tempId]));
    setTimeout(() => setNewTaskIds(new Set()), 500);
    setQuickTitle("");
    setQuickOpen(false);

    setQuickSaving(true);
    const { data, error: createError } = await supabase
      .from("tasks")
      .insert({
        workspace_id: workspaceId,
        title,
        status: "todo",
        priority: "medium",
        assignee_id: userId,
        created_by: userId,
      })
      .select()
      .single();
    setQuickSaving(false);

    if (createError) {
      // Rollback on error
      setTasks((current) => current.filter((t) => t.id !== tempId));
      setQuickTitle(title);
      setQuickOpen(true);
      if (await handleMutationError(createError.message)) {
        return;
      }
      toastDataError("tasks.quickCreate", createError, createError.message);
      return;
    }

    if (data) {
      setTasks((current) =>
        current.map((t) => (t.id === tempId ? (data as Task) : t))
      );
    }

    showToast("success", "Task added.");
    window.dispatchEvent(
      new CustomEvent("nexus:activation", { detail: { type: "task_created" } })
    );
    window.dispatchEvent(
      new CustomEvent("nexus:counts", { detail: { tasks: tasks.length + 1 } })
    );
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
      toastDataError(
        "tasks.rename",
        updateError,
        `Could not rename task: ${updateError.message}`
      );
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

  const blockedCount = tasks.filter((task) => task.status === "blocked").length;

  const filtersActive =
    filters.status !== "all" ||
    filters.priority !== "all" ||
    view !== "all" ||
    query.trim().length > 0;

  const renderRow = (task: Task, index: number) => {
    const done = task.status === "done";
    const isOverdue = !done && task.due_at ? new Date(task.due_at) < today : false;
    const isCompleting = completingTasks.has(task.id);
    const isExiting = exitingTasks.has(task.id);
    const isNew = newTaskIds.has(task.id);

    return (
      <li
        key={task.id}
        data-task-id={task.id}
        className={cn(
          "group flex min-h-11 items-center gap-3 border-b border-border-subtle px-4 py-2 last:border-b-0 transition-[background-color,transform,opacity,border-color] duration-[200ms] ease-nexus will-change-transform task-row",
          "hover:bg-bg-surface/60",
          isCompleting && "task-row-completing bg-accent-ghost/30",
          isExiting && "task-row-exit",
          isNew && "task-row-enter",
          !isNew && !isCompleting && !isExiting && "animate-[task-enter_260ms_var(--ease-nexus)_both]",
          done && "opacity-75"
        )}
        style={{
          animationDelay: isNew || isCompleting || isExiting ? undefined : `${Math.min(index, 12) * 24}ms`,
        }}
      >
        <div
          className={cn(
            "transition-transform duration-150 ease-nexus",
            isCompleting && "animate-[check-pop_280ms_var(--ease-nexus)_both]"
          )}
        >
          <Checkbox
            checked={done || isCompleting}
            onChange={() => void toggleTaskStatus(task)}
            label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
            className={cn(
              "task-checkbox",
              isCompleting && "task-checkbox-checked border-success bg-success text-white"
            )}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center self-stretch">
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
              className="h-8 min-w-0 w-full rounded-input border border-border-focus bg-bg-surface px-2.5 text-body text-text-primary outline-none"
              aria-label={`Rename ${task.title}`}
            />
          ) : (
            <button
              type="button"
              onClick={() => populateEditForm(task)}
              onDoubleClick={() => beginInlineEdit(task)}
              className="min-w-0 text-left"
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

          {/* Mobile meta line */}
          <div className="mt-1 flex flex-wrap items-center gap-1.5 md:hidden">
            <button
              type="button"
              onClick={(e) => void cyclePriority(task, e)}
              className="cursor-pointer transition-transform active:scale-95"
              aria-label={`Change priority for ${task.title}, currently ${task.priority}`}
              title="Click to cycle priority"
            >
              <Badge tone={PRIORITY_TONE[task.priority]} className="task-priority-badge">
                {task.priority}
              </Badge>
            </button>
            <Badge tone={done ? "success" : "neutral"} className="task-status-badge task-status-badge-enter">
              {STATUS_LABELS[task.status]}
            </Badge>
            <span
              className={cn(
                "font-mono text-mono tabular-nums transition-colors duration-200 ease-nexus",
                isOverdue ? "text-danger" : "text-text-tertiary"
              )}
            >
              {formatDate(task.due_at) ?? "No date"}
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <button
            type="button"
            onClick={(e) => void cyclePriority(task, e)}
            className="cursor-pointer transition-transform active:scale-95"
            aria-label={`Change priority for ${task.title}, currently ${task.priority}`}
            title="Click to cycle priority"
          >
            <Badge tone={PRIORITY_TONE[task.priority]} className="task-priority-badge">
              {task.priority}
            </Badge>
          </button>
          <Badge tone={done ? "success" : "neutral"} className="task-status-badge task-status-badge-enter">
            {STATUS_LABELS[task.status]}
          </Badge>
        </div>

        <span
          className={cn(
            "hidden w-14 shrink-0 text-right font-mono text-mono tabular-nums md:block",
            isOverdue ? "text-danger" : "text-text-tertiary"
          )}
        >
          {formatDate(task.due_at) ?? "–"}
        </span>

        <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-150 sm:ease-nexus sm:focus-within:opacity-100 sm:group-hover:opacity-100">
          <Button
            variant="icon"
            aria-label={`Edit ${task.title}`}
            onClick={() => populateEditForm(task)}
          >
            <NexusIcon icon={IconPencil} />
          </Button>
          <Button
            variant="icon"
            aria-label={`Delete ${task.title}`}
            onClick={() => setConfirmingDelete(task)}
            className="hover:text-danger"
          >
            <NexusIcon icon={IconTrash} />
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
        actions={
          <CreateButton
            label="New Task"
            onClick={openCreateForm}
            data-guide="new-task"
          />
        }
      />

      {/* Workspace state — real counts, not decoration */}
      <div className="grid grid-cols-2 overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/50 xs:grid-cols-4 [&>*]:border-b [&>*]:border-r [&>*]:border-border-subtle">
        <Metric label="Open" value={activeTaskCount} />
        <Metric label="Due today" value={dueToday} />
        <Metric
          label="Overdue"
          value={overdue}
          tone={overdue > 0 ? "danger" : "default"}
        />
        <Metric label="Blocked" value={blockedCount} tone={blockedCount > 0 ? "warning" : "default"} />
      </div>

      {!editingTaskId && limitResult ? (
        <FeatureGate limitResult={limitResult} onDismiss={dismiss} />
      ) : null}

      {error && !formOpen ? (
        <Alert tone="danger">
          {error}
          <ErrorDiagnostic detail={errorDetail} />
        </Alert>
      ) : null}
      {success && !formOpen ? <Alert tone="success">{success}</Alert> : null}

      <PillTabs
        label="Task layout"
        value={boardView}
        onChange={(nextView) => {
          setBoardView(nextView);
          const params = new URLSearchParams(searchParams.toString());
          if (nextView === "kanban") params.set("view", "kanban");
          else params.delete("view");
          router.replace(`/tasks${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
        }}
        items={[
          { id: "list", label: "List" },
          { id: "kanban", label: "Kanban" },
        ]}
      />

      {/* Saved views — the destinations Intelligence recommendations link to */}
      {boardView === "list" ? <div
        role="tablist"
        aria-label="Task views"
        className="flex flex-wrap items-center gap-1"
      >
        {VIEWS.map((entry) => {
          const active = view === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(entry.id)}
              className={cn(
                "inline-flex h-9 items-center rounded-input border px-2.5 text-caption transition-colors duration-150 ease-nexus sm:h-7",
                active
                  ? "border-border-strong bg-accent-ghost-hover text-text-primary"
                  : "border-transparent text-text-tertiary hover:bg-accent-ghost hover:text-text-secondary"
              )}
            >
              {entry.label}
            </button>
          );
        })}
      </div> : null}

      {boardView === "list" ? <Panel
        title={VIEWS.find((entry) => entry.id === view)?.label ?? "All"}
        description={`${filteredTasks.length} of ${tasks.length} tasks`}
        bodyClassName="p-0"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative">
              <NexusIcon
                icon={IconSearch}
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
                  setView("all");
                }}
              >
                Reset
              </Button>
            ) : null}
          </div>
        }
      >
        {loading ? (
          <SkeletonRows rows={6} />
        ) : !workspaceId ? (
          <div className="p-4">
            <EmptyState
              title="Workspace connecting"
              description="Your personal workspace is being prepared. Tasks will appear here once connected."
              action={
                <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
                  Retry connection
                </Button>
              }
            />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={
                tasks.length === 0
                  ? "No tasks yet"
                  : view !== "all"
                    ? `Nothing in ${VIEWS.find((entry) => entry.id === view)?.label}`
                    : "No tasks match these filters"
              }
              description={
                tasks.length === 0
                  ? "Create a task to get moving. NEXUS tracks deadlines, priorities and blockers automatically."
                  : view !== "all"
                    ? "This view has no matching tasks. Switch back to All to see everything in your workspace."
                    : "Adjust your search or reset the filters to see the other tasks."
              }
              icon={<NexusIcon icon={IconChecklist} size="state" />}
              action={
                tasks.length === 0 ? (
                  <CreateButton label="New Task" onClick={openCreateForm} data-guide="new-task" />
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
                  <span className="eyebrow text-text-quaternary">
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
                        placeholder="Task title. Enter to create, Esc to cancel"
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
                      <NexusIcon icon={IconPlus} />
                      Add task
                    </button>
                  )
                ) : null}

                {rows.length > 0 ? <ul>{rows.map((task, idx) => renderRow(task, idx))}</ul> : null}
              </div>
            );
          })
        )}
      </Panel> : (
        <NexusKanban
          tasks={filteredTasks}
          onStatusChange={(task, status) => void updateTaskStatus(task, status)}
          onEdit={populateEditForm}
          onDelete={setConfirmingDelete}
          onAddTask={openCreateForm}
        />
      )}

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
            <Button
              onClick={submitTask}
              disabled={saving || !workspaceId}
              data-guide="create-task"
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

          {error ? (
            <Alert tone="danger">
              {error}
              <ErrorDiagnostic detail={errorDetail} />
            </Alert>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmingDelete !== null}
        onClose={() => setConfirmingDelete(null)}
        title={confirmingDelete ? `Delete “${confirmingDelete.title}”?` : "Delete task?"}
        description="This task will be permanently removed from the workspace."
        confirmLabel="Delete task"
        onConfirm={() => {
          const task = confirmingDelete;
          setConfirmingDelete(null);
          if (task) void deleteTask(task.id);
        }}
      />
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

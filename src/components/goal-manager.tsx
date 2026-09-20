"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Target, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { canCreateGoal } from "@/lib/access";
import { FeatureGate } from "@/components/feature-gate";
import { useFeatureGate } from "@/hooks/use-feature-gate";
import { cn } from "@/lib/cn";
import { humanizeDataError } from "@/lib/data-errors";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/ui/create-button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, Progress, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Metric } from "@/components/ui/card";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  target_date: string | null;
  created_at: string;
};

type GoalForm = {
  title: string;
  description: string;
  status: string;
  progress: number;
  target_date: string;
};

const blankGoalForm = (): GoalForm => ({
  title: "",
  description: "",
  status: "active",
  progress: 0,
  target_date: "",
});

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_track", label: "On track" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const daysLeft = (value: string | null) => {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const diff = Math.ceil((target.getTime() - Date.now()) / 86_400_000);
  return diff;
};

function GoalManagerInner({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<GoalForm>(blankGoalForm());
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(searchParams.get("create") === "1");
  // Deep link (?create=1): open the form even when the manager is already
  // mounted on this route — the checklist links here in place, where a
  // mount-only initializer would miss it. Derive-on-prop-change (not an
  // effect) so it never re-opens the form on unrelated URL edits.
  const [prevCreateParam, setPrevCreateParam] = useState(
    searchParams.get("create") === "1"
  );
  if (searchParams.get("create") === "1" && !prevCreateParam) {
    setPrevCreateParam(true);
    setFormOpen(true);
  } else if (searchParams.get("create") !== "1" && prevCreateParam) {
    setPrevCreateParam(false);
  }
  // Destructive confirmation — the ConfirmDialog gates the delete; the
  // mutation itself is unchanged.
  const [confirmingDelete, setConfirmingDelete] = useState<Goal | null>(null);
  const submitting = useRef(false);

  const { limitResult, guardCreate, handleMutationError, dismiss } = useFeatureGate(
    workspaceId,
    canCreateGoal,
    goals.length
  );

  const fetchGoals = async (activeWorkspaceId: string | null) => {
    if (!activeWorkspaceId) {
      setGoals([]);
      setLoading(false);
      return;
    }

    const { data, error: loadError } = await supabase
      .from("goals")
      .select("*")
      .eq("workspace_id", activeWorkspaceId)
      .order("target_date", { ascending: true });

    if (loadError) {
      setError(humanizeDataError(loadError));
      setGoals([]);
      setLoading(false);
      return;
    }

    setGoals((data as Goal[]) ?? []);
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
        await fetchGoals(nextWorkspaceId);
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

  const syncServerViews = () => router.refresh();

  const resetForm = () => {
    setForm(blankGoalForm());
    setEditingGoalId(null);
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

  const createGoal = async () => {
    if (!workspaceId || !form.title.trim()) {
      setError("Please provide a goal title.");
      return;
    }

    const allowed = await guardCreate();
    if (!allowed) {
      setError(
        "You have reached your plan limit for goals. See the upgrade options above."
      );
      setFormOpen(false);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: createError } = await supabase.from("goals").insert({
      workspace_id: workspaceId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      progress: Math.min(100, Math.max(0, Number(form.progress))),
      target_date: form.target_date || null,
      created_by: userId,
    });

    setSaving(false);

    if (createError) {
      if (await handleMutationError(createError.message)) {
        setFormOpen(false);
        return;
      }
      setError(humanizeDataError(createError));
      return;
    }

    setSuccess("Goal created.");
    window.dispatchEvent(
      new CustomEvent("nexus:activation", { detail: { type: "goal_created" } })
    );
    closeForm();
    await fetchGoals(workspaceId);
    syncServerViews();
  };

  const updateGoal = async () => {
    if (!editingGoalId || !workspaceId || !form.title.trim()) {
      setError("Please provide a valid goal title.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("goals")
      .update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        progress: Math.min(100, Math.max(0, Number(form.progress))),
        target_date: form.target_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingGoalId)
      .eq("workspace_id", workspaceId);

    setSaving(false);

    if (updateError) {
      setError(humanizeDataError(updateError));
      return;
    }

    setSuccess("Goal updated.");
    closeForm();
    await fetchGoals(workspaceId);
    syncServerViews();
  };

  const submitGoal = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      if (editingGoalId) await updateGoal();
      else await createGoal();
    } finally {
      submitting.current = false;
    }
  };

  const populateEditForm = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setFormOpen(true);
    setError("");
    setSuccess("");
    setForm({
      title: goal.title,
      description: goal.description ?? "",
      status: goal.status,
      progress: goal.progress,
      target_date: goal.target_date
        ? new Date(goal.target_date).toISOString().slice(0, 10)
        : "",
    });
  };

  const handleProgress = async (goalId: string, progress: number) => {
    const { error: updateError } = await supabase
      .from("goals")
      .update({
        progress: Math.min(100, Math.max(0, progress)),
        updated_at: new Date().toISOString(),
      })
      .eq("id", goalId)
      .eq("workspace_id", workspaceId ?? "");

    if (updateError) {
      setError(humanizeDataError(updateError));
      return;
    }

    await fetchGoals(workspaceId);
    syncServerViews();
  };

  const deleteGoal = async (goalId: string) => {
    // Entry is gated by the ConfirmDialog — the mutation is unchanged.
    // Instant optimistic update
    const previous = goals;
    setGoals((current) => current.filter((item) => item.id !== goalId));
    if (editingGoalId === goalId) closeForm();

    const { error: deleteError } = await supabase
      .from("goals")
      .delete()
      .eq("id", goalId)
      .eq("workspace_id", workspaceId ?? "");

    if (deleteError) {
      setGoals(previous);
      setError(humanizeDataError(deleteError));
      return;
    }

    setSuccess("Goal deleted.");
    await fetchGoals(workspaceId);
    syncServerViews();
  };

  const completedCount = goals.filter((goal) => goal.status === "completed").length;
  const averageProgress =
    goals.length > 0
      ? Math.round(
          goals.reduce((sum, goal) => sum + Number(goal.progress ?? 0), 0) / goals.length
        )
      : 0;

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Goals"
        count={goals.length}
        description="The outcomes this workspace is working towards, and how far along they are."
        actions={<CreateButton label="New Goal" onClick={openCreateForm} />}
      />

      {/* Two columns on phones, three from `sm` up — see the same
          note in project-manager: three-up at 320px truncates
          "Avg. progress" into an unreadable stub. */}
      <div className="grid grid-cols-2 overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/50 xs:grid-cols-3 [&>*]:border-r [&>*]:border-border-subtle [&>*:last-child]:border-r-0">
        <Metric label="In progress" value={goals.length - completedCount} />
        <Metric label="Completed" value={completedCount} />
        <Metric label="Avg. progress" value={`${averageProgress}%`} />
      </div>

      {!editingGoalId && limitResult ? (
        <FeatureGate limitResult={limitResult} onDismiss={dismiss} />
      ) : null}

      {error && !formOpen ? <Alert tone="danger">{error}</Alert> : null}
      {success && !formOpen ? <Alert tone="success">{success}</Alert> : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-hidden="true">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-40 w-full rounded-card" />
          ))}
        </div>
      ) : !workspaceId ? (
        <EmptyState
          title="Workspace connecting"
          description="Your personal workspace is being prepared. Goals will appear here once connected."
          icon={<Target size={17} strokeWidth={1.75} />}
          action={
            <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
              Retry connection
            </Button>
          }
        />
      ) : goals.length === 0 ? (
        <EmptyState
          title="No goals set yet"
          description="Define key outcomes to measure whether your projects and tasks are making real progress. NEXUS monitors progress and alerts you if work falls behind."
          icon={<Target size={17} strokeWidth={1.75} />}
          action={<CreateButton label="Set a goal" onClick={openCreateForm} />}
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {goals.map((goal) => {
            const progress = Math.min(100, Math.max(0, Number(goal.progress ?? 0)));
            const remaining = daysLeft(goal.target_date);
            const completed = goal.status === "completed";

            return (
              <li
                key={goal.id}
                className="group rounded-card border border-border-subtle bg-bg-subtle/70 p-5 transition-colors duration-150 ease-nexus hover:border-border-default"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => populateEditForm(goal)}
                      className="block min-w-0 max-w-full truncate text-h3 text-text-primary"
                    >
                      {goal.title}
                    </button>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone={completed ? "success" : "neutral"}>
                        {goal.status.replace("_", " ")}
                      </Badge>
                      {goal.target_date ? (
                        <span className="font-mono text-mono tabular-nums text-text-tertiary">
                          {formatDate(goal.target_date)}
                          {remaining !== null && !completed
                            ? ` · ${remaining >= 0 ? `${remaining}d left` : `${Math.abs(remaining)}d late`}`
                            : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-150 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
                    <Button
                      variant="icon"
                      aria-label={`Edit ${goal.title}`}
                      onClick={() => populateEditForm(goal)}
                    >
                      <Pencil size={15} strokeWidth={1.75} />
                    </Button>
                    <Button
                      variant="icon"
                      aria-label={`Delete ${goal.title}`}
                      onClick={() => setConfirmingDelete(goal)}
                      className="hover:text-danger"
                    >
                      <Trash2 size={15} strokeWidth={1.75} />
                    </Button>
                  </div>
                </div>

                {goal.description ? (
                  <p className="mt-3 line-clamp-2 text-small text-text-secondary">
                    {goal.description}
                  </p>
                ) : null}

                <div className="mt-5">
                  <div className="flex items-end justify-between gap-3">
                    <span
                      className={cn(
                        "font-mono text-[28px] leading-none tabular-nums",
                        completed ? "text-success" : "text-text-primary"
                      )}
                    >
                      {Math.round(progress)}
                      <span className="text-[16px] text-text-tertiary">%</span>
                    </span>
                    <span className="eyebrow text-text-quaternary">
                      Progress
                    </span>
                  </div>
                  <Progress
                    value={progress}
                    label={`${goal.title} progress`}
                    className="mt-2.5"
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={progress}
                    onChange={(event) =>
                      void handleProgress(goal.id, Number(event.target.value))
                    }
                    aria-label={`Set ${goal.title} progress`}
                    className="mt-3 h-1 w-full cursor-pointer accent-white"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingGoalId ? "Edit goal" : "New goal"}
        description={
          editingGoalId ? "Update this goal." : "Define an outcome and track it."
        }
        footer={
          <>
            <Button onClick={submitGoal} disabled={saving || !workspaceId}>
              {saving
                ? editingGoalId
                  ? "Saving..."
                  : "Creating..."
                : editingGoalId
                  ? "Save goal"
                  : "Add goal"}
            </Button>
            <Button variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Title" htmlFor="goal-title">
            <Input
              id="goal-title"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="What do you want to achieve?"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Status" htmlFor="goal-status">
              <Select
                id="goal-status"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({ ...current, status: event.target.value }))
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Progress (%)" htmlFor="goal-progress">
              <Input
                id="goal-progress"
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    progress: Number(event.target.value),
                  }))
                }
              />
            </Field>

            <Field label="Target date" htmlFor="goal-target">
              <Input
                id="goal-target"
                type="date"
                value={form.target_date}
                onChange={(event) =>
                  setForm((current) => ({ ...current, target_date: event.target.value }))
                }
              />
            </Field>
          </div>

          <Field label="Description" htmlFor="goal-description">
            <Textarea
              id="goal-description"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Why does this goal matter?"
              rows={3}
            />
          </Field>

          {error ? <Alert tone="danger">{error}</Alert> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmingDelete !== null}
        onClose={() => setConfirmingDelete(null)}
        title={confirmingDelete ? `Delete “${confirmingDelete.title}”?` : "Delete goal?"}
        description="This goal will be permanently removed from the workspace."
        confirmLabel="Delete goal"
        onConfirm={() => {
          const goal = confirmingDelete;
          setConfirmingDelete(null);
          if (goal) void deleteGoal(goal.id);
        }}
      />
    </div>
  );
}

export function GoalManager({ userId }: { userId: string }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      }
    >
      <GoalManagerInner userId={userId} />
    </Suspense>
  );
}

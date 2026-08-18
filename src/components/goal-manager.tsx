"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Target, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { canCreateGoal } from "@/lib/access";
import { FeatureGate } from "@/components/feature-gate";
import { useFeatureGate } from "@/hooks/use-feature-gate";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/ui/create-button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, Progress, Skeleton } from "@/components/ui/feedback";
import { Card } from "@/components/ui/card";
import { PageHeader, StatLine } from "@/components/ui/page-header";

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

function GoalManagerInner({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<GoalForm>(blankGoalForm());
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(searchParams.get("create") === "1");
  const titleRef = useRef<HTMLInputElement>(null);

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
      setError(loadError.message);
      setGoals([]);
      setLoading(false);
      return;
    }

    setGoals((data as Goal[]) ?? []);
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
      await fetchGoals(nextWorkspaceId);
    };

    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  useEffect(() => {
    if (formOpen) titleRef.current?.focus();
  }, [formOpen]);

  const resetForm = () => {
    setForm(blankGoalForm());
    setEditingGoalId(null);
    setSuccess("");
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

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
      if (await handleMutationError(createError.message)) return;
      setError(createError.message);
      return;
    }

    setSuccess("Goal created successfully.");
    resetForm();
    await fetchGoals(workspaceId);
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
      setError(updateError.message);
      return;
    }

    setSuccess("Goal updated successfully.");
    resetForm();
    await fetchGoals(workspaceId);
  };

  const submitGoal = async () => {
    if (editingGoalId) {
      await updateGoal();
      return;
    }

    await createGoal();
  };

  const populateEditForm = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setFormOpen(true);
    setForm({
      title: goal.title,
      description: goal.description ?? "",
      status: goal.status,
      progress: goal.progress,
      target_date: goal.target_date
        ? new Date(goal.target_date).toISOString().slice(0, 10)
        : "",
    });
    setError("");
    setSuccess("");
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
      setError(updateError.message);
      return;
    }

    setSuccess("Goal progress updated.");
    await fetchGoals(workspaceId);
  };

  const deleteGoal = async (goalId: string) => {
    const confirmed = window.confirm("Delete this goal?");
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("goals")
      .delete()
      .eq("id", goalId)
      .eq("workspace_id", workspaceId ?? "");

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSuccess("Goal deleted.");
    if (editingGoalId === goalId) {
      resetForm();
    }
    await fetchGoals(workspaceId);
  };

  const completedCount = goals.filter((goal) => goal.status === "completed").length;
  const averageProgress =
    goals.length > 0
      ? Math.round(
          goals.reduce((sum, goal) => sum + Number(goal.progress ?? 0), 0) / goals.length
        )
      : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Goals"
        count={goals.length}
        description="Keep your long-term progress visible and measurable."
        actions={
          <CreateButton
            label="New Goal"
            onClick={() => {
              if (formOpen && !editingGoalId) {
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
          { value: `${averageProgress}%`, label: "average progress" },
          { value: completedCount, label: "completed" },
          { value: goals.length, label: "total" },
        ]}
      />

      {!editingGoalId && limitResult ? (
        <FeatureGate limitResult={limitResult} onDismiss={dismiss} />
      ) : null}

      {formOpen ? (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-h2 text-text-primary">
              {editingGoalId ? "Edit goal" : "New goal"}
            </h2>
            <Button variant="icon" onClick={closeForm} aria-label="Close goal form">
              <X size={16} strokeWidth={1.75} />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" htmlFor="goal-title">
              <Input
                id="goal-title"
                ref={titleRef}
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="What do you want to achieve?"
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
          </div>

          <Field label="Description" htmlFor="goal-description" className="mt-4">
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
          </div>
        </Card>
      ) : null}

      {!formOpen && error ? <Alert tone="danger">{error}</Alert> : null}
      {!formOpen && success ? <Alert tone="success">{success}</Alert> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-32 w-full rounded-[20px]" />
          ))}
        </div>
      ) : !workspaceId ? (
        <EmptyState
          title="No active workspace"
          description="This account is not linked to an active workspace yet."
        />
      ) : goals.length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="Define the outcomes you are working towards."
          icon={<Target size={18} strokeWidth={1.75} />}
          action={
            <CreateButton
              label="New Goal"
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
            />
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const progress = Math.min(100, Math.max(0, Number(goal.progress ?? 0)));

            return (
              <li
                key={goal.id}
                className="rounded-[20px] border border-border-subtle bg-bg-subtle p-5 transition-colors duration-150 ease-nexus hover:border-border-default"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-h3 text-text-primary">{goal.title}</h3>
                    {goal.target_date ? (
                      <p className="mt-1 font-mono text-mono uppercase tabular-nums text-text-tertiary">
                        Target · {formatDate(goal.target_date)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
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
                      onClick={() => void deleteGoal(goal.id)}
                      className="hover:text-danger"
                    >
                      <Trash2 size={15} strokeWidth={1.75} />
                    </Button>
                  </div>
                </div>

                {goal.description ? (
                  <p className="mt-2 line-clamp-2 text-small text-text-secondary">
                    {goal.description}
                  </p>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-2">
                  <Badge tone={goal.status === "completed" ? "success" : "neutral"}>
                    {goal.status.replace("_", " ")}
                  </Badge>
                  <span className="font-mono text-mono tabular-nums text-text-primary">
                    {Math.round(progress)}%
                  </span>
                </div>

                <Progress
                  value={progress}
                  label={`${goal.title} progress`}
                  className="mt-2"
                />

                <label className="mt-3 flex items-center gap-2">
                  <span className="sr-only">Update {goal.title} progress</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={progress}
                    onChange={(event) =>
                      void handleProgress(goal.id, Number(event.target.value))
                    }
                    aria-label={`Set ${goal.title} progress`}
                    className="h-1 w-full cursor-pointer accent-white"
                  />
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function GoalManager({ userId }: { userId: string }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 w-full rounded-[20px]" />
        </div>
      }
    >
      <GoalManagerInner userId={userId} />
    </Suspense>
  );
}

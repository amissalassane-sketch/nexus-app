"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Plus, SquarePen, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { canCreateGoal } from "@/lib/access";
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
  ProgressBar,
  Select,
  SkeletonList,
  StatCard,
  TextArea,
} from "@/components/ui";

// ============================================================
// NEXUS — GOAL MANAGER (P2: alive)
//  - Optimistic progress with rollback + toast
//  - Skeletons, staggered cards, animated progress (500ms)
// ============================================================

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

const formatTarget = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
};

type LinkedProject = { id: string; name: string; progress: number; goal_id: string | null };

// P7: projects.goal_id may be absent until migration 014 — degrade by
// hiding the linkage section instead of erroring.
async function probeGoalColumn(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const { error } = await supabase.from("projects").select("goal_id").limit(1);
  return !error;
}

async function loadLinkedProjects(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<LinkedProject[]> {
  const { data } = await supabase
    .from("projects")
    .select("id, name, progress, goal_id")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });
  return ((data as LinkedProject[]) ?? []).filter((project) => project.id && project.name);
}

async function loadGoalsForWorkspace(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<{ data: Goal[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("target_date", { ascending: true, nullsFirst: false });

  return { data: (data as Goal[]) ?? null, error: error as { message: string } | null };
}

export function GoalManager({
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
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<GoalForm>(blankGoalForm());
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [linkedProjects, setLinkedProjects] = useState<LinkedProject[]>([]);
  const [linkCapable, setLinkCapable] = useState(false);

  const { limitResult, guardCreate, handleMutationError, dismiss } = useFeatureGate(
    workspaceId,
    canCreateGoal,
    goals.length
  );

  useEffect(() => {
    const load = async () => {
      if (!workspaceId) return;
      const { data, error: loadError } = await loadGoalsForWorkspace(supabase, workspaceId);
      if (loadError) {
        setError(loadError.message);
        setGoals([]);
        setLoading(false);
        return;
      }
      setGoals(data ?? []);
      setLoading(false);

      const capable = await probeGoalColumn(supabase);
      setLinkCapable(capable);
      if (capable) {
        const projects = await loadLinkedProjects(supabase, workspaceId);
        setLinkedProjects(projects);
      }
    };
    void load();
  }, [supabase, workspaceId]);

  // /goals?new=1 (Create dropdown) → focus the editor.
  useEffect(() => {
    if (initialNew) titleInputRef.current?.focus();
  }, [initialNew]);

  const resetForm = () => {
    setForm(blankGoalForm());
    setEditingGoalId(null);
  };

  const createGoal = async () => {
    if (!workspaceId || !form.title.trim()) {
      setError("Please provide a goal title.");
      return;
    }

    const allowed = await guardCreate();
    if (!allowed) return;

    setSaving(true);
    setError("");

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

    toast.success("Goal created.");
    resetForm();
    const { data } = await loadGoalsForWorkspace(supabase, workspaceId);
    setGoals(data ?? []);
  };

  const updateGoal = async () => {
    if (!editingGoalId || !workspaceId || !form.title.trim()) {
      setError("Please provide a valid goal title.");
      return;
    }

    setSaving(true);
    setError("");

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
      if (await handleMutationError(updateError.message)) return;
      setError(updateError.message);
      return;
    }

    toast.success("Goal updated.");
    resetForm();
    const { data } = await loadGoalsForWorkspace(supabase, workspaceId);
    setGoals(data ?? []);
  };

  const populateEditForm = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setForm({
      title: goal.title,
      description: goal.description ?? "",
      status: goal.status,
      progress: goal.progress,
      target_date: goal.target_date ? new Date(goal.target_date).toISOString().slice(0, 10) : "",
    });
    setError("");
  };

  // OPTIMISTIC progress change — the bar moves instantly.
  const handleProgress = async (goal: Goal, rawProgress: number) => {
    const progress = Math.min(100, Math.max(0, rawProgress));
    if (progress === goal.progress) return;

    const snapshot = goals;
    setGoals((current) =>
      current.map((item) => (item.id === goal.id ? { ...item, progress } : item))
    );

    const { error: updateError } = await supabase
      .from("goals")
      .update({ progress, updated_at: new Date().toISOString() })
      .eq("id", goal.id)
      .eq("workspace_id", workspaceId ?? "");

    if (updateError) {
      setGoals(snapshot); // rollback
      toast.error(`Progress not saved — ${updateError.message}`);
    }
  };

  const deleteGoal = async (goalId: string) => {
    if (!window.confirm("Delete this goal?")) return;

    const snapshot = goals;
    setGoals((current) => current.filter((goal) => goal.id !== goalId));

    const { error: deleteError } = await supabase
      .from("goals")
      .delete()
      .eq("id", goalId)
      .eq("workspace_id", workspaceId ?? "");

    if (deleteError) {
      setGoals(snapshot);
      toast.error(`Goal not deleted — ${deleteError.message}`);
      return;
    }

    toast.success("Goal deleted.");
    if (editingGoalId === goalId) resetForm();
  };

  const projectsOf = (goal: Goal) =>
    linkedProjects.filter((project) => project.goal_id === goal.id);

  const averageProgress =
    goals.length > 0
      ? Math.round(goals.reduce((sum, goal) => sum + Number(goal.progress ?? 0), 0) / goals.length)
      : 0;

  return (
    <div className="space-y-6">
      {!editingGoalId && limitResult ? (
        <FeatureGate limitResult={limitResult} onDismiss={dismiss} />
      ) : null}

      {/* STATS */}
      <div className="stagger-list grid gap-4 sm:grid-cols-3">
        <StatCard label="Goals" value={goals.length} hint="In this workspace" />
        <StatCard label="Average progress" value={`${averageProgress}%`} hint="Across all goals" />
        <StatCard
          label="Active"
          value={goals.filter((goal) => goal.status === "active").length}
          hint="Currently pursued"
        />
      </div>

      {/* EDITOR */}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-body font-semibold text-text-primary">
            {editingGoalId ? "Edit goal" : "Create goal"}
          </h3>
          {editingGoalId ? (
            <Button variant="ghost" onClick={resetForm} className="min-h-0 px-2 py-1">
              <X size={14} strokeWidth={2} /> Cancel
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            ref={titleInputRef}
            label="Title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Goal title"
          />
          <Field
            label="Target date"
            type="date"
            value={form.target_date}
            onChange={(event) =>
              setForm((current) => ({ ...current, target_date: event.target.value }))
            }
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="done">Done</option>
            <option value="abandoned">Abandoned</option>
          </Select>
          <Field
            label={`Progress — ${Math.round(form.progress)}%`}
            type="range"
            min={0}
            max={100}
            value={form.progress}
            onChange={(event) =>
              setForm((current) => ({ ...current, progress: Number(event.target.value) }))
            }
            className="py-3.5"
          />
        </div>

        <div className="mt-4">
          <TextArea
            label="Description"
            rows={3}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="What does success look like?"
          />
        </div>

        {error ? <div className="mt-4">{<ErrorBox message={error} />}</div> : null}

        <div className="mt-4">
          <Button
            variant="primary"
            onClick={() => (editingGoalId ? void updateGoal() : void createGoal())}
            disabled={saving || !workspaceId || (!editingGoalId && Boolean(limitResult))}
          >
            {saving ? "Saving…" : editingGoalId ? "Save goal" : "Create goal"}
          </Button>
        </div>
      </Card>

      {/* LIST */}
      <div>
        <h2 className="mb-4 text-body font-semibold text-text-primary">Goals</h2>

        {loading ? (
          <SkeletonList rows={3} />
        ) : error && goals.length === 0 ? (
          <ErrorBox message={error} />
        ) : !workspaceId ? (
          <EmptyState
            icon={<Crosshair size={16} strokeWidth={1.75} />}
            title="No active workspace"
            hint="Your workspace link is being verified — reload in a moment."
          />
        ) : goals.length === 0 ? (
          <EmptyState
            icon={<Plus size={16} strokeWidth={1.75} />}
            title="No goals yet"
            hint="Set the outcome first — projects and tasks will hang from it."
          />
        ) : (
          <div className="stagger-list space-y-3">
            {goals.map((goal) => {
              const progress = Math.min(100, Math.max(0, Number(goal.progress ?? 0)));
              const target = formatTarget(goal.target_date);
              return (
                <div
                  key={goal.id}
                  className="group rounded-xl border border-border-default bg-bg-surface p-5 transition-all duration-[160ms] ease-out hover:-translate-y-px hover:border-border-strong hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-body font-medium text-text-primary">
                        {goal.title}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge tone={goal.status === "active" ? "volt" : "neutral"}>
                          {goal.status}
                        </Badge>
                        {target ? (
                          <span className="font-mono text-mono-small text-text-tertiary">
                            Target: {target}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-small font-semibold text-text-primary">
                        {Math.round(progress)}%
                      </span>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity duration-[160ms] group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          aria-label={`Edit ${goal.title}`}
                          onClick={() => populateEditForm(goal)}
                          className="rounded p-1.5 text-text-tertiary transition-colors duration-[120ms] hover:bg-bg-surface-3 hover:text-text-primary"
                        >
                          <SquarePen size={14} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${goal.title}`}
                          onClick={() => void deleteGoal(goal.id)}
                          className="rounded p-1.5 text-text-tertiary transition-colors duration-[120ms] hover:bg-danger-bg hover:text-danger-fg"
                        >
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* P7 — what moves toward this goal? */}
                  {linkCapable ? (
                    <div className="mt-4 border-t border-border-subtle pt-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-quaternary">
                          What advances this goal
                        </span>
                        {projectsOf(goal).length === 0 ? (
                          <Badge tone="warning">No project attached</Badge>
                        ) : (
                          <Badge tone="success">
                            {projectsOf(goal).length} project
                            {projectsOf(goal).length === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </div>
                      {projectsOf(goal).length === 0 ? (
                        <p className="text-caption text-text-tertiary">
                          A goal without a project stays a wish — attach one from Projects → goal
                          selector.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <div className="mb-1 flex items-center justify-between text-caption">
                            <span className="text-text-tertiary">Aggregated project progress</span>
                            <span className="font-mono text-text-secondary">
                              {Math.round(
                                projectsOf(goal).reduce(
                                  (sum, project) =>
                                    sum + Math.min(100, Math.max(0, Number(project.progress ?? 0))),
                                  0
                                ) / projectsOf(goal).length
                              )}
                              %
                            </span>
                          </div>
                          {projectsOf(goal).map((project) => {
                            const projectProgress = Math.min(
                              100,
                              Math.max(0, Number(project.progress ?? 0))
                            );
                            return (
                              <div key={project.id}>
                                <div className="mb-1 flex items-center justify-between text-caption">
                                  <span className="truncate text-text-secondary">{project.name}</span>
                                  <span className="font-mono text-text-quaternary">
                                    {Math.round(projectProgress)}%
                                  </span>
                                </div>
                                <ProgressBar value={projectProgress} className="h-0.5" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Optimistic progress: ±10 steps, instant bar */}
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Decrease progress"
                          onClick={() => void handleProgress(goal, progress - 10)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-border-default font-mono text-text-secondary transition-colors duration-[120ms] hover:border-border-strong hover:text-text-primary active:scale-90"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          aria-label="Increase progress"
                          onClick={() => void handleProgress(goal, progress + 10)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-border-default font-mono text-text-secondary transition-colors duration-[120ms] hover:border-border-strong hover:text-text-primary active:scale-90"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <ProgressBar value={progress} />
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

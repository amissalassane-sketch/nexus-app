"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { canCreateGoal } from "@/lib/access";
import { FeatureGate } from "@/components/feature-gate";
import { useFeatureGate } from "@/hooks/use-feature-gate";

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


// Module-level loader: setState stays behind an await (React Compiler rule
// react-hooks/set-state-in-effect — known pitfall #5).
async function loadGoalsForWorkspace(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("target_date", { ascending: true });

  return {
    data: (data as Array<Record<string, unknown>>) ?? null,
    error: error as { message: string } | null,
  };
}

export function GoalManager({
  userId,
  workspaceId,
}: {
  userId: string;
  /** Resolved server-side by the (app) layout — never null in practice. */
  workspaceId: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<GoalForm>(blankGoalForm());
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const { limitResult, guardCreate, handleMutationError, dismiss } = useFeatureGate(
    workspaceId,
    canCreateGoal,
    goals.length
  );

  const fetchGoals = async (activeWorkspaceId: string | null) => {
    if (!activeWorkspaceId) {
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
    const load = async () => {
      if (!workspaceId) return;
      const { data, error: loadError } = await loadGoalsForWorkspace(supabase, workspaceId);
      if (loadError) {
        setError(loadError.message);
        setGoals([]);
        setLoading(false);
        return;
      }
      setGoals((data as never[]) ?? []);
      setLoading(false);
    };
    void load();
  }, [supabase, workspaceId]);

  const resetForm = () => {
    setForm(blankGoalForm());
    setEditingGoalId(null);
    setSuccess("");
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
    setForm({
      title: goal.title,
      description: goal.description ?? "",
      status: goal.status,
      progress: goal.progress,
      target_date: goal.target_date ? new Date(goal.target_date).toISOString().slice(0, 10) : "",
    });
    setError("");
    setSuccess("");
  };

  const handleProgress = async (goalId: string, progress: number) => {
    const { error: updateError } = await supabase
      .from("goals")
      .update({ progress: Math.min(100, Math.max(0, progress)), updated_at: new Date().toISOString() })
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

    const { error: deleteError } = await supabase.from("goals").delete().eq("id", goalId).eq("workspace_id", workspaceId ?? "");

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

  return (
    <div className="space-y-6">
      {!editingGoalId && limitResult ? (
        <FeatureGate limitResult={limitResult} onDismiss={dismiss} />
      ) : null}

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="mb-4 text-xl font-semibold">{editingGoalId ? "Edit goal" : "Create goal"}</h2>
          {editingGoalId ? (
            <button type="button" onClick={resetForm} className="text-sm text-zinc-400 hover:text-white">
              Cancel
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Goal title"
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-zinc-700 focus:border-white/30"
          />
          <input
            type="date"
            value={form.target_date}
            onChange={(event) => setForm((current) => ({ ...current, target_date: event.target.value }))}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
          <select
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          >
            <option value="active">Active</option>
            <option value="on_track">On track</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
          <input
            type="number"
            min={0}
            max={100}
            value={form.progress}
            onChange={(event) => setForm((current) => ({ ...current, progress: Number(event.target.value) }))}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
        </div>

        <textarea
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          placeholder="Goal description"
          rows={3}
          className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-zinc-700 focus:border-white/30"
        />

        {error ? <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div> : null}
        {success ? <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">{success}</div> : null}

        <button
          type="button"
          onClick={submitGoal}
          disabled={saving || !workspaceId || (!editingGoalId && Boolean(limitResult))}
          className="mt-4 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (editingGoalId ? "Saving goal..." : "Creating goal...") : editingGoalId ? "Save goal" : "Add goal"}
        </button>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 text-xl font-semibold">Goals</h2>

        {loading ? (
          <div className="text-sm text-zinc-500">Loading goals...</div>
        ) : goals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">
            No goals yet.
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <div key={goal.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-white">{goal.title}</h3>
                    {goal.description ? <p className="mt-1 text-sm text-zinc-400">{goal.description}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => populateEditForm(goal)}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteGoal(goal.id)}
                      className="rounded-xl border border-red-500/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                    <span>Progress</span>
                    <span>{Math.round(goal.progress)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={goal.progress}
                    onChange={(event) => handleProgress(goal.id, Number(event.target.value))}
                    className="w-full max-w-xs accent-white"
                  />
                  <span className="text-xs text-zinc-500">{goal.status}</span>
                  {goal.target_date ? <span className="text-xs text-zinc-500">Due {new Date(goal.target_date).toLocaleDateString()}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


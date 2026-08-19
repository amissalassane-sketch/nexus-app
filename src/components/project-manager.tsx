"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { canCreateProject } from "@/lib/access";
import { FeatureGate } from "@/components/feature-gate";
import { useFeatureGate } from "@/hooks/use-feature-gate";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  due_date: string | null;
  created_at: string;
};

type ProjectForm = {
  name: string;
  description: string;
  status: string;
  progress: number;
  due_date: string;
};

const blankProjectForm = (): ProjectForm => ({
  name: "",
  description: "",
  status: "planning",
  progress: 0,
  due_date: "",
});


// Module-level loader: setState stays behind an await (React Compiler rule
// react-hooks/set-state-in-effect — known pitfall #5).
async function loadProjectsForWorkspace(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("due_date", { ascending: true });

  return {
    data: (data as Array<Record<string, unknown>>) ?? null,
    error: error as { message: string } | null,
  };
}

export function ProjectManager({
  userId,
  workspaceId,
}: {
  userId: string;
  /** Resolved server-side by the (app) layout — never null in practice. */
  workspaceId: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<ProjectForm>(blankProjectForm());
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const { limitResult, guardCreate, handleMutationError, dismiss } = useFeatureGate(
    workspaceId,
    canCreateProject,
    projects.length
  );

  const fetchProjects = async (activeWorkspaceId: string | null) => {
    if (!activeWorkspaceId) {
      return;
    }

    const { data, error: loadError } = await supabase
      .from("projects")
      .select("*")
      .eq("workspace_id", activeWorkspaceId)
      .order("due_date", { ascending: true });

    if (loadError) {
      setError(loadError.message);
      setProjects([]);
      setLoading(false);
      return;
    }

    setProjects((data as Project[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const load = async () => {
      if (!workspaceId) return;
      const { data, error: loadError } = await loadProjectsForWorkspace(supabase, workspaceId);
      if (loadError) {
        setError(loadError.message);
        setProjects([]);
        setLoading(false);
        return;
      }
      setProjects((data as never[]) ?? []);
      setLoading(false);
    };
    void load();
  }, [supabase, workspaceId]);

  const resetForm = () => {
    setForm(blankProjectForm());
    setEditingProjectId(null);
    setSuccess("");
  };

  const createProject = async () => {
    if (!workspaceId || !form.name.trim()) {
      setError("Please provide a project name.");
      return;
    }

    const allowed = await guardCreate();
    if (!allowed) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const slug = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);

    const { error: createError } = await supabase.from("projects").insert({
      workspace_id: workspaceId,
      name: form.name.trim(),
      slug,
      description: form.description.trim() || null,
      status: form.status,
      progress: Math.min(100, Math.max(0, Number(form.progress))),
      due_date: form.due_date || null,
      owner_id: userId,
    });

    setSaving(false);

    if (createError) {
      if (await handleMutationError(createError.message)) return;
      setError(createError.message);
      return;
    }

    setSuccess("Project created successfully.");
    resetForm();
    await fetchProjects(workspaceId);
  };

  const updateProject = async () => {
    if (!editingProjectId || !workspaceId || !form.name.trim()) {
      setError("Please provide a valid project name.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const slug = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);

    const { error: updateError } = await supabase
      .from("projects")
      .update({
        name: form.name.trim(),
        slug,
        description: form.description.trim() || null,
        status: form.status,
        progress: Math.min(100, Math.max(0, Number(form.progress))),
        due_date: form.due_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingProjectId)
      .eq("workspace_id", workspaceId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess("Project updated successfully.");
    resetForm();
    await fetchProjects(workspaceId);
  };

  const submitProject = async () => {
    if (editingProjectId) {
      await updateProject();
      return;
    }

    await createProject();
  };

  const populateEditForm = (project: Project) => {
    setEditingProjectId(project.id);
    setForm({
      name: project.name,
      description: project.description ?? "",
      status: project.status,
      progress: project.progress,
      due_date: project.due_date ? new Date(project.due_date).toISOString().slice(0, 10) : "",
    });
    setError("");
    setSuccess("");
  };

  const handleProgress = async (projectId: string, progress: number) => {
    const { error: updateError } = await supabase
      .from("projects")
      .update({ progress: Math.min(100, Math.max(0, progress)), updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .eq("workspace_id", workspaceId ?? "");

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess("Project progress updated.");
    await fetchProjects(workspaceId);
  };

  const deleteProject = async (projectId: string) => {
    const confirmed = window.confirm("Delete this project?");
    if (!confirmed) return;

    const { error: deleteError } = await supabase.from("projects").delete().eq("id", projectId).eq("workspace_id", workspaceId ?? "");

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSuccess("Project deleted.");
    if (editingProjectId === projectId) {
      resetForm();
    }
    await fetchProjects(workspaceId);
  };

  return (
    <div className="space-y-6">
      {!editingProjectId && limitResult ? (
        <FeatureGate limitResult={limitResult} onDismiss={dismiss} />
      ) : null}

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="mb-4 text-xl font-semibold">{editingProjectId ? "Edit project" : "Create project"}</h2>
          {editingProjectId ? (
            <button type="button" onClick={resetForm} className="text-sm text-zinc-400 hover:text-white">
              Cancel
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Project name"
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-zinc-700 focus:border-white/30"
          />
          <input
            type="date"
            value={form.due_date}
            onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
          <select
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          >
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
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
          placeholder="Project summary"
          rows={3}
          className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-zinc-700 focus:border-white/30"
        />

        {error ? <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div> : null}
        {success ? <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">{success}</div> : null}

        <button
          type="button"
          onClick={submitProject}
          disabled={saving || !workspaceId || (!editingProjectId && Boolean(limitResult))}
          className="mt-4 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (editingProjectId ? "Saving project..." : "Creating project...") : editingProjectId ? "Save project" : "Add project"}
        </button>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 text-xl font-semibold">Projects</h2>

        {loading ? (
          <div className="text-sm text-zinc-500">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">
            No projects yet.
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div key={project.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-white">{project.name}</h3>
                    {project.description ? <p className="mt-1 text-sm text-zinc-400">{project.description}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => populateEditForm(project)}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProject(project.id)}
                      className="rounded-xl border border-red-500/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                    <span>Progress</span>
                    <span>{Math.round(project.progress)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={project.progress}
                    onChange={(event) => handleProgress(project.id, Number(event.target.value))}
                    className="w-full max-w-xs accent-white"
                  />
                  <span className="text-xs text-zinc-500">{project.status}</span>
                  {project.due_date ? <span className="text-xs text-zinc-500">Due {new Date(project.due_date).toLocaleDateString()}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


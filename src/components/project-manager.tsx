"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FolderKanban, Plus, SquarePen, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { canCreateProject } from "@/lib/access";
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
// NEXUS — PROJECT MANAGER (P2: alive)
//  - Quick create, optimistic progress with rollback + toast
//  - Skeletons, staggered cards, animated progress (500ms)
// ============================================================

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  due_date: string | null;
  goal_id: string | null;
  created_at: string;
};

type GoalOption = { id: string; title: string };

type ProjectTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
};

type ProjectForm = {
  name: string;
  description: string;
  status: string;
  progress: number;
  due_date: string;
  goalId: string;
};

const blankProjectForm = (): ProjectForm => ({
  name: "",
  description: "",
  status: "planning",
  progress: 0,
  due_date: "",
  goalId: "",
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "project";

const formatDue = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
};

// Capability probe (P7): projects.goal_id may be absent until
// migration 014 — the goal selector hides itself instead of erroring.
async function probeGoalColumn(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const { error } = await supabase.from("projects").select("goal_id").limit(1);
  return !error;
}

async function loadGoalOptions(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<GoalOption[]> {
  const { data } = await supabase
    .from("goals")
    .select("id, title")
    .eq("workspace_id", workspaceId)
    .order("title", { ascending: true });
  return ((data as GoalOption[]) ?? []).filter((goal) => goal.id && goal.title);
}

async function loadTasksForProject(
  supabase: ReturnType<typeof createClient>,
  projectId: string
): Promise<ProjectTask[]> {
  const { data } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_at")
    .eq("project_id", projectId)
    .order("due_at", { ascending: true, nullsFirst: false });
  return ((data as ProjectTask[]) ?? []).filter((task) => task.id);
}

async function loadProjectTaskCounts(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("workspace_id", workspaceId)
    .limit(1000);
  const counts = new Map<string, number>();
  for (const row of (data as Array<{ project_id: string | null }> | null) ?? []) {
    if (row.project_id) {
      counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1);
    }
  }
  return counts;
}

async function loadProjectsForWorkspace(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<{ data: Project[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("due_date", { ascending: true, nullsFirst: false });

  return { data: (data as Project[]) ?? null, error: error as { message: string } | null };
}

export function ProjectManager({
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
  const nameFieldRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProjectForm>(blankProjectForm());
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [goalOptions, setGoalOptions] = useState<GoalOption[]>([]);
  const [goalCapable, setGoalCapable] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<ProjectTask[]>([]);
  const [expanding, setExpanding] = useState(false);
  const [projectTaskCounts, setProjectTaskCounts] = useState<Map<string, number>>(new Map());

  const { limitResult, guardCreate, handleMutationError, dismiss } = useFeatureGate(
    workspaceId,
    canCreateProject,
    projects.length
  );

  useEffect(() => {
    const load = async () => {
      if (!workspaceId) return;

      const capable = await probeGoalColumn(supabase);
      setGoalCapable(capable);

      const { data, error: loadError } = await loadProjectsForWorkspace(supabase, workspaceId);
      if (loadError) {
        setError(loadError.message);
        setProjects([]);
        setLoading(false);
        return;
      }
      setProjects(data ?? []);
      setLoading(false);

      const counts = await loadProjectTaskCounts(supabase, workspaceId);
      setProjectTaskCounts(counts);

      if (capable) {
        const goals = await loadGoalOptions(supabase, workspaceId);
        setGoalOptions(goals);
      }
    };
    void load();
  }, [supabase, workspaceId]);

  // /projects?new=1 (Create dropdown) → open the editor.
  useEffect(() => {
    if (initialNew) nameInputRef.current?.focus();
  }, [initialNew]);

  const resetForm = () => {
    setForm(blankProjectForm());
    setEditingProjectId(null);
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

    const { error: createError } = await supabase.from("projects").insert({
      workspace_id: workspaceId,
      name: form.name.trim(),
      slug: slugify(form.name.trim()),
      description: form.description.trim() || null,
      status: form.status,
      progress: Math.min(100, Math.max(0, Number(form.progress))),
      due_date: form.due_date || null,
      owner_id: userId,
      ...(goalCapable && form.goalId ? { goal_id: form.goalId } : {}),
    });

    setSaving(false);

    if (createError) {
      if (await handleMutationError(createError.message)) return;
      setError(createError.message);
      return;
    }

    toast.success("Project created.");
    resetForm();
    const { data } = await loadProjectsForWorkspace(supabase, workspaceId);
    setProjects(data ?? []);
  };

  const updateProject = async () => {
    if (!editingProjectId || !workspaceId || !form.name.trim()) {
      setError("Please provide a valid project name.");
      return;
    }

    setSaving(true);
    setError("");

    const { error: updateError } = await supabase
      .from("projects")
      .update({
        name: form.name.trim(),
        slug: slugify(form.name.trim()),
        description: form.description.trim() || null,
        status: form.status,
        progress: Math.min(100, Math.max(0, Number(form.progress))),
        due_date: form.due_date || null,
        updated_at: new Date().toISOString(),
        ...(goalCapable ? { goal_id: form.goalId || null } : {}),
      })
      .eq("id", editingProjectId)
      .eq("workspace_id", workspaceId);

    setSaving(false);

    if (updateError) {
      if (await handleMutationError(updateError.message)) return;
      setError(updateError.message);
      return;
    }

    toast.success("Project updated.");
    resetForm();
    const { data } = await loadProjectsForWorkspace(supabase, workspaceId);
    setProjects(data ?? []);
  };

  const populateEditForm = (project: Project) => {
    setEditingProjectId(project.id);
    setForm({
      name: project.name,
      description: project.description ?? "",
      status: project.status,
      progress: project.progress,
      due_date: project.due_date ? new Date(project.due_date).toISOString().slice(0, 10) : "",
      goalId: project.goal_id ?? "",
    });
    setError("");
    nameFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // OPTIMISTIC progress change — the bar moves instantly.
  const handleProgress = async (project: Project, rawProgress: number) => {
    const progress = Math.min(100, Math.max(0, rawProgress));
    if (progress === project.progress) return;

    const snapshot = projects;
    setProjects((current) =>
      current.map((item) => (item.id === project.id ? { ...item, progress } : item))
    );

    const { error: updateError } = await supabase
      .from("projects")
      .update({ progress, updated_at: new Date().toISOString() })
      .eq("id", project.id)
      .eq("workspace_id", workspaceId ?? "");

    if (updateError) {
      setProjects(snapshot); // rollback — the bar snaps back
      toast.error(`Progress not saved — ${updateError.message}`);
    }
  };

  // P7: expandable project tasks — next action, blockers, due date.
  const toggleExpand = async (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      setExpandedTasks([]);
      return;
    }
    setExpandedProjectId(projectId);
    setExpanding(true);
    const tasks = await loadTasksForProject(supabase, projectId);
    setExpandedTasks(tasks);
    setExpanding(false);
  };

  const deleteProject = async (projectId: string) => {
    if (!window.confirm("Delete this project?")) return;

    const snapshot = projects;
    setProjects((current) => current.filter((project) => project.id !== projectId));

    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("workspace_id", workspaceId ?? "");

    if (deleteError) {
      setProjects(snapshot);
      toast.error(`Project not deleted — ${deleteError.message}`);
      return;
    }

    toast.success("Project deleted.");
    if (editingProjectId === projectId) resetForm();
  };

  const goalTitleById = useMemo(
    () => new Map(goalOptions.map((goal) => [goal.id, goal.title])),
    [goalOptions]
  );

  const averageProgress =
    projects.length > 0
      ? Math.round(projects.reduce((sum, project) => sum + Number(project.progress ?? 0), 0) / projects.length)
      : 0;

  return (
    <div className="space-y-6">
      {!editingProjectId && limitResult ? (
        <FeatureGate limitResult={limitResult} onDismiss={dismiss} />
      ) : null}

      {/* STATS */}
      <div className="stagger-list grid gap-4 sm:grid-cols-3">
        <StatCard label="Projects" value={projects.length} hint="In this workspace" />
        <StatCard label="Average progress" value={`${averageProgress}%`} hint="Across all projects" />
        <StatCard
          label="Planning"
          value={projects.filter((project) => project.status === "planning").length}
          hint="Not started yet"
        />
      </div>

      {/* EDITOR */}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-body font-semibold text-text-primary">
            {editingProjectId ? "Edit project" : "Create project"}
          </h3>
          {editingProjectId ? (
            <Button variant="ghost" onClick={resetForm} className="min-h-0 px-2 py-1">
              <X size={14} strokeWidth={2} /> Cancel
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div ref={nameFieldRef}>
            <Field
              ref={nameInputRef}
              label="Name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Project name"
            />
          </div>
          <Field
            label="Due date"
            type="date"
            value={form.due_date}
            onChange={(event) =>
              setForm((current) => ({ ...current, due_date: event.target.value }))
            }
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({ ...current, status: event.target.value }))
            }
          >
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
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
          {goalCapable ? (
            <Select
              label="Goal (what this project serves)"
              value={form.goalId}
              onChange={(event) =>
                setForm((current) => ({ ...current, goalId: event.target.value }))
              }
            >
              <option value="">No goal</option>
              {goalOptions.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        <div className="mt-4">
          <TextArea
            label="Description"
            rows={3}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="What is this project about?"
          />
        </div>

        {error ? <div className="mt-4">{<ErrorBox message={error} />}</div> : null}

        <div className="mt-4">
          <Button
            variant="primary"
            onClick={() => (editingProjectId ? void updateProject() : void createProject())}
            disabled={saving || !workspaceId || (!editingProjectId && Boolean(limitResult))}
          >
            {saving ? "Saving…" : editingProjectId ? "Save project" : "Create project"}
          </Button>
        </div>
      </Card>

      {/* LIST */}
      <div>
        <h2 className="mb-4 text-body font-semibold text-text-primary">Projects</h2>

        {loading ? (
          <SkeletonList rows={3} />
        ) : error && projects.length === 0 ? (
          <ErrorBox message={error} />
        ) : !workspaceId ? (
          <EmptyState
            icon={<FolderKanban size={16} strokeWidth={1.75} />}
            title="No active workspace"
            hint="Your workspace link is being verified — reload in a moment."
          />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<Plus size={16} strokeWidth={1.75} />}
            title="No projects yet"
            hint="Create your first project above — NEXUS never invents one for you."
          />
        ) : (
          <div className="stagger-list grid gap-4 md:grid-cols-2">
            {projects.map((project) => {
              const progress = Math.min(100, Math.max(0, Number(project.progress ?? 0)));
              const due = formatDue(project.due_date);
              return (
                <div
                  key={project.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border-default bg-bg-surface p-5 transition-all duration-[160ms] ease-out hover:-translate-y-px hover:border-border-strong hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-body font-medium text-text-primary">
                        {project.name}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge>{project.status.replace("_", " ")}</Badge>
                        {goalCapable && project.goal_id && goalTitleById.has(project.goal_id) ? (
                          <Badge tone="volt">→ {goalTitleById.get(project.goal_id)}</Badge>
                        ) : null}
                        {due ? (
                          <span className="font-mono text-mono-small text-text-tertiary">{due}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-[160ms] group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        aria-label={`Edit ${project.name}`}
                        onClick={() => populateEditForm(project)}
                        className="rounded p-1.5 text-text-tertiary transition-colors duration-[120ms] hover:bg-bg-surface-3 hover:text-text-primary"
                      >
                        <SquarePen size={14} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${project.name}`}
                        onClick={() => void deleteProject(project.id)}
                        className="rounded p-1.5 text-text-tertiary transition-colors duration-[120ms] hover:bg-danger-bg hover:text-danger-fg"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>

                  {project.description ? (
                    <p className="mt-3 line-clamp-2 text-small text-text-secondary">
                      {project.description}
                    </p>
                  ) : null}

                  {/* Optimistic progress: ±10 steps, instant bar */}
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Decrease progress"
                          onClick={() => void handleProgress(project, progress - 10)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-border-default font-mono text-text-secondary transition-colors duration-[120ms] hover:border-border-strong hover:text-text-primary active:scale-90"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          aria-label="Increase progress"
                          onClick={() => void handleProgress(project, progress + 10)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-border-default font-mono text-text-secondary transition-colors duration-[120ms] hover:border-border-strong hover:text-text-primary active:scale-90"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-mono text-small text-text-secondary">
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <ProgressBar value={progress} />
                  </div>

                  {/* P7: project task drill-down — next action + blockers */}
                  <button
                    type="button"
                    onClick={() => void toggleExpand(project.id)}
                    aria-expanded={expandedProjectId === project.id}
                    className="mt-3 flex min-h-9 w-full items-center justify-between rounded-md border border-border-subtle px-3 text-caption text-text-secondary transition-colors duration-[120ms] hover:border-border-strong hover:text-text-primary"
                  >
                    <span>
                      {expandedProjectId === project.id ? "Hide tasks" : "Show tasks"}
                      {projectTaskCounts.get(project.id) !== undefined
                        ? ` · ${projectTaskCounts.get(project.id)}`
                        : ""}
                    </span>
                    <span className="font-mono">{expandedProjectId === project.id ? "−" : "+"}</span>
                  </button>

                  {expandedProjectId === project.id ? (
                    expanding ? (
                      <div className="skeleton mt-3 min-h-11 w-full rounded-lg" aria-hidden="true" />
                    ) : (
                      <div className="animate-fade-in mt-3 space-y-1.5 border-t border-border-subtle pt-3">
                        {expandedTasks.length === 0 ? (
                          <p className="text-caption text-text-tertiary">
                            No task in this project yet — give it its first one.
                          </p>
                        ) : (
                          <>
                            {(() => {
                              const blockedCount = expandedTasks.filter(
                                (task) => task.status === "blocked"
                              ).length;
                              const nextAction = expandedTasks
                                .filter((task) => !["done", "cancelled", "blocked"].includes(task.status))
                                .sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"))[0];
                              return (
                                <div className="mb-2 flex flex-wrap items-center gap-2 text-caption">
                                  {nextAction ? (
                                    <span className="text-text-secondary">
                                      Next action:{" "}
                                      <span className="text-text-primary">{nextAction.title}</span>
                                      {nextAction.due_at
                                        ? ` · ${formatDue(nextAction.due_at)}`
                                        : ""}
                                    </span>
                                  ) : (
                                    <span className="text-text-tertiary">No next action</span>
                                  )}
                                  {blockedCount > 0 ? (
                                    <Badge tone="warning">{blockedCount} blocked</Badge>
                                  ) : null}
                                </div>
                              );
                            })()}
                            {expandedTasks.slice(0, 6).map((task) => (
                              <div
                                key={task.id}
                                className="flex min-h-9 items-center justify-between gap-2 rounded-md bg-bg-subtle px-3"
                              >
                                <span
                                  className={`truncate text-caption ${
                                    task.status === "done"
                                      ? "text-text-quaternary line-through"
                                      : "text-text-secondary"
                                  }`}
                                >
                                  {task.title}
                                </span>
                                <span className="shrink-0 font-mono text-[10px] text-text-quaternary">
                                  {task.status.replace("_", " ")}
                                </span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

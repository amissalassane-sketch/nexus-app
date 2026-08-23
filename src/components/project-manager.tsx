"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FolderKanban, Pencil, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { canCreateProject } from "@/lib/access";
import { FeatureGate } from "@/components/feature-gate";
import { useFeatureGate } from "@/hooks/use-feature-gate";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/ui/create-button";
import { Badge } from "@/components/ui/badge";
import { Metric, Panel } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, Progress, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";

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

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "info"> = {
  planning: "info",
  active: "success",
  paused: "warning",
  completed: "neutral",
  archived: "neutral",
};

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(date);
};

function ProjectManagerInner({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number> | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState<ProjectForm>(blankProjectForm());
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(searchParams.get("create") === "1");
  const submitting = useRef(false);

  const { limitResult, guardCreate, handleMutationError, dismiss } = useFeatureGate(
    workspaceId,
    canCreateProject,
    projects.length
  );

  /**
   * Task counts per project are only shown when the schema actually links
   * tasks to projects. If the column is absent the query errors and we
   * simply omit the metric — never a fabricated zero.
   */
  const fetchTaskCounts = async (activeWorkspaceId: string) => {
    const { data, error: countError } = await supabase
      .from("tasks")
      .select("project_id")
      .eq("workspace_id", activeWorkspaceId)
      .not("project_id", "is", null);

    if (countError || !data) {
      setTaskCounts(null);
      return;
    }

    const counts: Record<string, number> = {};
    for (const row of data as { project_id: string | null }[]) {
      if (!row.project_id) continue;
      counts[row.project_id] = (counts[row.project_id] ?? 0) + 1;
    }
    setTaskCounts(counts);
  };

  const fetchProjects = async (activeWorkspaceId: string | null) => {
    if (!activeWorkspaceId) {
      setProjects([]);
      setLoading(false);
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
    await fetchTaskCounts(activeWorkspaceId);
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
        await fetchProjects(nextWorkspaceId);
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
    setForm(blankProjectForm());
    setEditingProjectId(null);
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

  const createProject = async () => {
    if (!workspaceId || !form.name.trim()) {
      setError("Please provide a project name.");
      return;
    }

    const allowed = await guardCreate();
    if (!allowed) {
      setError(
        "You have reached your plan limit for projects. See the upgrade options above."
      );
      setFormOpen(false);
      return;
    }

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
      if (await handleMutationError(createError.message)) {
        setFormOpen(false);
        return;
      }
      setError(createError.message);
      return;
    }

    setSuccess("Project created.");
    closeForm();
    await fetchProjects(workspaceId);
    syncServerViews();
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

    setSuccess("Project updated.");
    closeForm();
    await fetchProjects(workspaceId);
    syncServerViews();
  };

  const submitProject = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      if (editingProjectId) await updateProject();
      else await createProject();
    } finally {
      submitting.current = false;
    }
  };

  const populateEditForm = (project: Project) => {
    setEditingProjectId(project.id);
    setFormOpen(true);
    setError("");
    setSuccess("");
    setForm({
      name: project.name,
      description: project.description ?? "",
      status: project.status,
      progress: project.progress,
      due_date: project.due_date
        ? new Date(project.due_date).toISOString().slice(0, 10)
        : "",
    });
  };

  const handleProgress = async (projectId: string, progress: number) => {
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        progress: Math.min(100, Math.max(0, progress)),
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("workspace_id", workspaceId ?? "");

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await fetchProjects(workspaceId);
    syncServerViews();
  };

  const deleteProject = async (projectId: string) => {
    const confirmed = window.confirm("Delete this project?");
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("workspace_id", workspaceId ?? "");

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSuccess("Project deleted.");
    if (editingProjectId === projectId) closeForm();
    await fetchProjects(workspaceId);
    syncServerViews();
  };

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      const statusMatch = statusFilter === "all" || project.status === statusFilter;
      const queryMatch =
        needle.length === 0 ||
        project.name.toLowerCase().includes(needle) ||
        (project.description ?? "").toLowerCase().includes(needle);
      return statusMatch && queryMatch;
    });
  }, [projects, query, statusFilter]);

  const activeCount = projects.filter((project) => project.status === "active").length;
  const completedCount = projects.filter((p) => p.status === "completed").length;
  const averageProgress =
    projects.length > 0
      ? Math.round(
          projects.reduce((sum, p) => sum + Number(p.progress ?? 0), 0) / projects.length
        )
      : 0;

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Projects"
        count={projects.length}
        description="The initiatives NEXUS tracks for risk, momentum and deadlines."
        actions={<CreateButton label="New Project" onClick={openCreateForm} />}
      />

      <div className="grid grid-cols-3 overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/50 [&>*]:border-r [&>*]:border-border-subtle [&>*:last-child]:border-r-0">
        <Metric label="Active" value={activeCount} />
        <Metric label="Completed" value={completedCount} />
        <Metric label="Avg. progress" value={`${averageProgress}%`} />
      </div>

      {!editingProjectId && limitResult ? (
        <FeatureGate limitResult={limitResult} onDismiss={dismiss} />
      ) : null}

      {error && !formOpen ? <Alert tone="danger">{error}</Alert> : null}
      {success && !formOpen ? <Alert tone="success">{success}</Alert> : null}

      <Panel
        title="All projects"
        description={`${filteredProjects.length} shown`}
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
                aria-label="Search projects"
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-8 w-[150px] pl-7 text-small"
              />
            </div>
            <Select
              size="sm"
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-auto min-w-[128px]"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {loading ? (
          <div className="flex flex-col" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="flex items-center gap-3 border-b border-border-subtle px-4 py-3.5 last:border-b-0"
              >
                <Skeleton className="h-8 w-8 rounded-input" />
                <div className="flex-1 space-y-2">
                  <Skeleton
                    className="h-2.5 rounded-pill"
                    style={{ width: `${40 + index * 12}%` }}
                  />
                  <Skeleton className="h-[3px] w-full rounded-pill" />
                </div>
                <Skeleton className="h-2.5 w-8 rounded-pill" />
              </div>
            ))}
          </div>
        ) : !workspaceId ? (
          <div className="p-4">
            <EmptyState
              title="No active workspace"
              description="This account is not linked to an active workspace yet, so projects cannot be created."
              icon={<FolderKanban size={17} strokeWidth={1.75} />}
            />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={
                projects.length === 0 ? "No projects yet" : "Nothing matches those filters"
              }
              description={
                projects.length === 0
                  ? "Create your first project to give NEXUS the context it needs to detect drift, deadline pressure and stalled work."
                  : "Adjust the search or the status filter to see the rest of the workspace."
              }
              icon={<FolderKanban size={17} strokeWidth={1.75} />}
              action={
                projects.length === 0 ? (
                  <CreateButton label="New Project" onClick={openCreateForm} />
                ) : null
              }
            />
          </div>
        ) : (
          <ul>
            {filteredProjects.map((project) => {
              const progress = Math.min(100, Math.max(0, Number(project.progress ?? 0)));
              const taskCount = taskCounts?.[project.id];

              return (
                <li
                  key={project.id}
                  className="group border-b border-border-subtle px-4 py-3 last:border-b-0 transition-colors duration-150 ease-nexus hover:bg-bg-surface/60"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-tertiary">
                      <FolderKanban size={16} strokeWidth={1.75} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => populateEditForm(project)}
                          className="min-w-0 truncate text-body-medium text-text-primary"
                        >
                          {project.name}
                        </button>
                        <Badge tone={STATUS_TONE[project.status] ?? "neutral"}>
                          {project.status}
                        </Badge>
                        {taskCount !== undefined ? (
                          <span className="font-mono text-mono tabular-nums text-text-quaternary">
                            {taskCount} tasks
                          </span>
                        ) : null}
                      </div>

                      {project.description ? (
                        <p className="mt-0.5 line-clamp-1 text-caption text-text-tertiary">
                          {project.description}
                        </p>
                      ) : null}

                      <div className="mt-2.5 flex items-center gap-3">
                        <Progress
                          value={progress}
                          label={`${project.name} progress`}
                          className="max-w-sm"
                        />
                        <span className="shrink-0 font-mono text-mono tabular-nums text-text-secondary">
                          {Math.round(progress)}%
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={progress}
                          onChange={(event) =>
                            void handleProgress(project.id, Number(event.target.value))
                          }
                          aria-label={`Set ${project.name} progress`}
                          className="hidden h-1 w-24 cursor-pointer accent-white sm:block"
                        />
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "hidden w-14 text-right font-mono text-mono tabular-nums text-text-tertiary sm:block"
                        )}
                      >
                        {formatDate(project.due_date) ?? "—"}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
                        <Button
                          variant="icon"
                          aria-label={`Edit ${project.name}`}
                          onClick={() => populateEditForm(project)}
                        >
                          <Pencil size={15} strokeWidth={1.75} />
                        </Button>
                        <Button
                          variant="icon"
                          aria-label={`Delete ${project.name}`}
                          onClick={() => void deleteProject(project.id)}
                          className="hover:text-danger"
                        >
                          <Trash2 size={15} strokeWidth={1.75} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingProjectId ? "Edit project" : "New project"}
        description={
          editingProjectId
            ? "Update this project."
            : "Create a project to group related work."
        }
        footer={
          <>
            <Button onClick={submitProject} disabled={saving || !workspaceId}>
              {saving
                ? editingProjectId
                  ? "Saving..."
                  : "Creating..."
                : editingProjectId
                  ? "Save project"
                  : "Add project"}
            </Button>
            <Button variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name" htmlFor="project-name">
            <Input
              id="project-name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Project name"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Status" htmlFor="project-status">
              <Select
                id="project-status"
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

            <Field label="Progress (%)" htmlFor="project-progress">
              <Input
                id="project-progress"
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

            <Field label="Due date" htmlFor="project-due">
              <Input
                id="project-due"
                type="date"
                value={form.due_date}
                onChange={(event) =>
                  setForm((current) => ({ ...current, due_date: event.target.value }))
                }
              />
            </Field>
          </div>

          <Field label="Summary" htmlFor="project-summary">
            <Textarea
              id="project-summary"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="What is this project about?"
              rows={3}
            />
          </Field>

          {error ? <Alert tone="danger">{error}</Alert> : null}
        </div>
      </Modal>
    </div>
  );
}

export function ProjectManager({ userId }: { userId: string }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-16 w-full" />
        </div>
      }
    >
      <ProjectManagerInner userId={userId} />
    </Suspense>
  );
}

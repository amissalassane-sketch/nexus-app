"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconLayoutKanban,
  IconPencil,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { canCreateProject } from "@/lib/access";
import { FeatureGate } from "@/components/feature-gate";
import { useFeatureGate } from "@/hooks/use-feature-gate";
import { cn } from "@/lib/cn";
import { useDataError } from "@/hooks/use-data-error";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/ui/create-button";
import { Badge } from "@/components/ui/badge";
import { Metric, Panel } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, ErrorDiagnostic, Progress, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { useWorkspaceRealtime } from "@/hooks/use-workspace-realtime";

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

/** New projects start with NO due date (empty string → NULL in the
 *  database). No default is invented: a deadline is a fact about the
 *  work, and an empty form must not claim one. */
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

/**
 * Slug base derived from the project name. Diacritics are folded
 * ("Café" → "cafe") so French names keep readable, collision-free slugs
 * instead of collapsing accented letters into bare dashes. Never empty.
 */
const slugBase = (name: string): string => {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "project";
};

/**
 * Creation slugs carry a random suffix: two projects may legitimately
 * share a name ("Website", "Website"), and without the suffix the second
 * insert dies on the unique(workspace_id, slug) constraint with a
 * confusing "already exists" error.
 */
const uniqueSlug = (name: string): string => {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slugBase(name)}-${suffix}`;
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
  const [reconnecting, setReconnecting] = useState(false);
  // Friendly sentence + database diagnostic (code/message/hint) in one
  // slot — see useDataError. The diagnostic is rendered under the
  // sentence and logged with console.error so a failed read/write can
  // be reported from the screen, without the devtools.
  const { error, errorDetail, setError, reportDataError } = useDataError();
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState<ProjectForm>(blankProjectForm());
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(searchParams.get("create") === "1");
  // Deep link (?create=1): open the form even when the manager is already
  // mounted on this route — the onboarding tour CTA and the checklist both
  // navigate here in place, where a mount-only initializer would miss it.
  // Derive-on-prop-change (not an effect) so it never re-opens the form on
  // unrelated URL edits (e.g. a filter change that keeps ?create=1).
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
  const [confirmingDelete, setConfirmingDelete] = useState<Project | null>(null);
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
      reportDataError("projects.load", loadError);
      setProjects([]);
      setLoading(false);
      return;
    }

    const nextProjects = (data as Project[]) ?? [];
    setProjects(nextProjects);
    setLoading(false);
    // Tell the onboarding layer the ground truth: the guide's create step
    // must complete for work that already exists, even though the counts
    // injected by the server layout are stale after client-side nav.
    window.dispatchEvent(
      new CustomEvent("nexus:counts", { detail: { projects: nextProjects.length } })
    );
    await fetchTaskCounts(activeWorkspaceId);
  };

  const resolveWorkspace = async (): Promise<string | null> => {
    const { membership, error: membershipError } = await getActiveMembership(
      supabase,
      userId
    );

    if (membershipError) {
      setError(membershipError);
    }

    const nextWorkspaceId = membership?.workspaceId ?? null;
    setWorkspaceId(nextWorkspaceId);
    return nextWorkspaceId;
  };

  const retryWorkspace = async () => {
    if (reconnecting) return;
    setReconnecting(true);
    setError("");
    try {
      const nextWorkspaceId = await resolveWorkspace();
      if (nextWorkspaceId) {
        await fetchProjects(nextWorkspaceId);
      } else {
        setError(
          "Your workspace is still connecting. Wait a moment, then retry — your form content is kept."
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Could not reach your workspace: ${cause.message}`
          : "Could not reach your workspace. Check your connection and retry."
      );
    } finally {
      setReconnecting(false);
    }
  };

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const nextWorkspaceId = await resolveWorkspace();
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

  useWorkspaceRealtime<Project>({
    supabase,
    workspaceId,
    table: "projects",
    onInsert: (newProject) => {
      setProjects((current) => {
        if (current.some((p) => p.id === newProject.id)) return current;
        const next = [newProject, ...current];
        window.dispatchEvent(
          new CustomEvent("nexus:counts", { detail: { projects: next.length } })
        );
        return next;
      });
    },
    onUpdate: (updatedProject) => {
      setProjects((current) =>
        current.map((p) => (p.id === updatedProject.id ? { ...p, ...updatedProject } : p))
      );
    },
    onDelete: (deletedProject) => {
      if (!deletedProject.id) return;
      setProjects((current) => {
        const next = current.filter((p) => p.id !== deletedProject.id);
        window.dispatchEvent(
          new CustomEvent("nexus:counts", { detail: { projects: next.length } })
        );
        return next;
      });
    },
  });

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
    const name = form.name.trim();
    if (!name) {
      setError("Please provide a project name.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    // Never a dead submit: when the workspace id is missing (slow
    // bootstrap, transient membership read), re-resolve it right here
    // instead of failing — and say so plainly if it stays unreachable.
    let activeWorkspaceId = workspaceId;
    if (!activeWorkspaceId) {
      try {
        activeWorkspaceId = await resolveWorkspace();
      } catch {
        activeWorkspaceId = null;
      }
      if (!activeWorkspaceId) {
        setSaving(false);
        setError(
          "Your workspace is not connected yet, so this project cannot be saved. Retry in a moment — your form content is kept."
        );
        return;
      }
    }

    let allowed = true;
    try {
      allowed = await guardCreate();
    } catch {
      setSaving(false);
      setError(
        "NEXUS could not verify your plan limit. Check your connection and try again."
      );
      return;
    }
    if (!allowed) {
      setSaving(false);
      setError(
        "You have reached your plan limit for projects. See the upgrade options above."
      );
      setFormOpen(false);
      return;
    }

    const { error: createError } = await supabase.from("projects").insert({
      workspace_id: activeWorkspaceId,
      name,
      slug: uniqueSlug(name),
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
      reportDataError("projects.create", createError);
      return;
    }

    // closeForm() resets the form state (including any success text), so the
    // confirmation is set after it — otherwise the user never sees it.
    window.dispatchEvent(
      new CustomEvent("nexus:activation", { detail: { type: "project_created" } })
    );
    closeForm();
    setSuccess("Project created.");
    await fetchProjects(activeWorkspaceId);
    syncServerViews();
  };

  const updateProject = async () => {
    const name = form.name.trim();
    if (!editingProjectId || !name) {
      setError("Please provide a valid project name.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    let activeWorkspaceId = workspaceId;
    if (!activeWorkspaceId) {
      try {
        activeWorkspaceId = await resolveWorkspace();
      } catch {
        activeWorkspaceId = null;
      }
      if (!activeWorkspaceId) {
        setSaving(false);
        setError(
          "Your workspace is not connected yet, so this change cannot be saved. Retry in a moment — your form content is kept."
        );
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("projects")
      .update({
        name,
        slug: slugBase(name),
        description: form.description.trim() || null,
        status: form.status,
        progress: Math.min(100, Math.max(0, Number(form.progress))),
        due_date: form.due_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingProjectId)
      .eq("workspace_id", activeWorkspaceId);

    setSaving(false);

    if (updateError) {
      reportDataError("projects.update", updateError);
      return;
    }

    closeForm();
    setSuccess("Project updated.");
    await fetchProjects(activeWorkspaceId);
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

  const progressDebounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const handleProgress = (projectId: string, rawProgress: number) => {
    const progress = Math.min(100, Math.max(0, rawProgress));
    // Instant optimistic update for 60fps responsive UI
    setProjects((current) =>
      current.map((p) => (p.id === projectId ? { ...p, progress } : p))
    );

    if (progressDebounceTimers.current[projectId]) {
      clearTimeout(progressDebounceTimers.current[projectId]);
    }

    progressDebounceTimers.current[projectId] = setTimeout(async () => {
      const { error: updateError } = await supabase
        .from("projects")
        .update({
          progress,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
        .eq("workspace_id", workspaceId ?? "");

      if (updateError) {
        reportDataError("projects.progress", updateError);
        await fetchProjects(workspaceId);
        return;
      }
      syncServerViews();
    }, 280);
  };

  const deleteProject = async (projectId: string) => {
    // Entry is gated by the ConfirmDialog — the mutation is unchanged.
    // Instant optimistic update
    const previous = projects;
    setProjects((current) => current.filter((p) => p.id !== projectId));
    if (editingProjectId === projectId) closeForm();

    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("workspace_id", workspaceId ?? "");

    if (deleteError) {
      setProjects(previous);
      reportDataError("projects.delete", deleteError);
      return;
    }

    setSuccess("Project deleted.");
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
        actions={
          <CreateButton
            label="New Project"
            onClick={openCreateForm}
            data-guide="new-project"
          />
        }
      />

      {/* Two columns on phones, three from `sm` up. At 320px a
          three-up grid gives each cell ~64px of content width after
          padding, which truncates "Avg. progress" to "Avg. pro…" —
          a label that no longer says anything. Matches the
          task manager metric row. */}
      <div className="grid grid-cols-2 overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/50 xs:grid-cols-3 [&>*]:border-r [&>*]:border-border-subtle [&>*:last-child]:border-r-0">
        <Metric label="Active" value={activeCount} />
        <Metric label="Completed" value={completedCount} />
        <Metric label="Avg. progress" value={`${averageProgress}%`} />
      </div>

      {!editingProjectId && limitResult ? (
        <FeatureGate limitResult={limitResult} onDismiss={dismiss} />
      ) : null}

      {error && !formOpen ? (
        <Alert tone="danger">
          {error}
          <ErrorDiagnostic detail={errorDetail} />
        </Alert>
      ) : null}
      {success && !formOpen ? <Alert tone="success">{success}</Alert> : null}

      <Panel
        title="All projects"
        description={`${filteredProjects.length} shown`}
        bodyClassName="p-0"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative">
              <NexusIcon
                icon={IconSearch}
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
              title="Workspace connecting"
              description="Your personal workspace is being prepared. Projects will appear here once connected."
              icon={<NexusIcon icon={IconLayoutKanban} size="state" />}
              action={
                <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
                  Retry connection
                </Button>
              }
            />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={
                projects.length === 0 ? "No projects yet" : "No projects match these filters"
              }
              description={
                projects.length === 0
                  ? "Create a project to organize related tasks. NEXUS tracks momentum and detects risks as deadlines approach."
                  : "Adjust your search keywords or status filter to see other projects."
              }
              icon={<NexusIcon icon={IconLayoutKanban} size="state" />}
              action={
                projects.length === 0 ? (
                  <CreateButton label="New Project" onClick={openCreateForm} data-guide="new-project" />
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
                      <NexusIcon icon={IconLayoutKanban} />
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

                    <div className="flex shrink-0 items-center gap-1 sm:gap-0.5">
                      <span
                        className={cn(
                          "hidden w-14 text-right font-mono text-mono tabular-nums text-text-tertiary sm:block"
                        )}
                      >
                        {formatDate(project.due_date) ?? "–"}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-150 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
                        <Button
                          variant="icon"
                          aria-label={`Edit ${project.name}`}
                          onClick={() => populateEditForm(project)}
                        >
                          <NexusIcon icon={IconPencil} />
                        </Button>
                        <Button
                          variant="icon"
                          aria-label={`Delete ${project.name}`}
                          onClick={() => setConfirmingDelete(project)}
                          className="hover:text-danger"
                        >
                          <NexusIcon icon={IconTrash} />
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
            <Button
              onClick={submitProject}
              disabled={saving || reconnecting}
              data-guide="create-project"
            >
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
          {!workspaceId && !loading ? (
            <Alert tone="warning">
              Your workspace is not connected yet. You can fill in this form —
              it is kept — then{" "}
              <button
                type="button"
                onClick={() => void retryWorkspace()}
                disabled={reconnecting}
                className="font-medium text-text-primary underline underline-offset-2 hover:text-text-primary disabled:opacity-50"
              >
                {reconnecting ? "retrying the connection…" : "retry the connection"}
              </button>{" "}
              before saving.
            </Alert>
          ) : null}
          <Field label="Name" htmlFor="project-name">
            <Input
              id="project-name"
              data-guide="project-name"
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
              {/* The default is intentionally EMPTY (null due date): a
                  project without a deadline is a valid state, and the
                  code never pre-fills a date. Browsers (Chrome in
                  particular) remember the last value typed into a date
                  field per origin — a "pre-filled yesterday" observed in
                  the UI is that autofill memory, not application logic.
                  autoComplete="off" keeps the field honest. */}
              <Input
                id="project-due"
                type="date"
                autoComplete="off"
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
        title={confirmingDelete ? `Delete “${confirmingDelete.name}”?` : "Delete project?"}
        description="This project and its link to workspace activity will be permanently removed."
        confirmLabel="Delete project"
        onConfirm={() => {
          const project = confirmingDelete;
          setConfirmingDelete(null);
          if (project) void deleteProject(project.id);
        }}
      />
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

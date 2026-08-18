"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FolderKanban, Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { canCreateProject } from "@/lib/access";
import { FeatureGate } from "@/components/feature-gate";
import { useFeatureGate } from "@/hooks/use-feature-gate";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/ui/create-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, Progress, Skeleton } from "@/components/ui/feedback";
import { PageHeader, StatLine } from "@/components/ui/page-header";

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

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(date);
};

function ProjectManagerInner({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<ProjectForm>(blankProjectForm());
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(searchParams.get("create") === "1");
  const nameRef = useRef<HTMLInputElement>(null);

  const { limitResult, guardCreate, handleMutationError, dismiss } = useFeatureGate(
    workspaceId,
    canCreateProject,
    projects.length
  );

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
      await fetchProjects(nextWorkspaceId);
    };

    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  useEffect(() => {
    if (formOpen) nameRef.current?.focus();
  }, [formOpen]);

  const resetForm = () => {
    setForm(blankProjectForm());
    setEditingProjectId(null);
    setSuccess("");
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

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
    setFormOpen(true);
    setForm({
      name: project.name,
      description: project.description ?? "",
      status: project.status,
      progress: project.progress,
      due_date: project.due_date
        ? new Date(project.due_date).toISOString().slice(0, 10)
        : "",
    });
    setError("");
    setSuccess("");
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

    setSuccess("Project progress updated.");
    await fetchProjects(workspaceId);
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
    if (editingProjectId === projectId) {
      resetForm();
    }
    await fetchProjects(workspaceId);
  };

  const activeCount = projects.filter((project) => project.status === "active").length;
  const completedCount = projects.filter(
    (project) => project.status === "completed"
  ).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects"
        count={projects.length}
        description="Prioritize work across initiatives and milestones."
        actions={
          <CreateButton
            label="New Project"
            onClick={() => {
              if (formOpen && !editingProjectId) {
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
          { value: activeCount, label: "active" },
          { value: completedCount, label: "completed" },
          { value: projects.length, label: "total" },
        ]}
      />

      {!editingProjectId && limitResult ? (
        <FeatureGate limitResult={limitResult} onDismiss={dismiss} />
      ) : null}

      {formOpen ? (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-h2 text-text-primary">
              {editingProjectId ? "Edit project" : "New project"}
            </h2>
            <Button variant="icon" onClick={closeForm} aria-label="Close project form">
              <X size={16} strokeWidth={1.75} />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" htmlFor="project-name">
              <Input
                id="project-name"
                ref={nameRef}
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Project name"
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
          </div>

          <Field label="Summary" htmlFor="project-summary" className="mt-4">
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
          </div>
        </Card>
      ) : null}

      {!formOpen && error ? <Alert tone="danger">{error}</Alert> : null}
      {!formOpen && success ? <Alert tone="success">{success}</Alert> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-36 w-full rounded-card" />
          ))}
        </div>
      ) : !workspaceId ? (
        <EmptyState
          title="No active workspace"
          description="This account is not linked to an active workspace yet."
        />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Group your work into projects to keep execution readable."
          icon={<FolderKanban size={18} strokeWidth={1.75} />}
          action={
            <CreateButton
              label="New Project"
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
            />
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const progress = Math.min(100, Math.max(0, Number(project.progress ?? 0)));

            return (
              <Card as="li" key={project.id} className="p-5" interactive>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-bg-surface text-text-secondary">
                    <FolderKanban size={17} strokeWidth={1.75} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-h3 text-text-primary">
                        {project.name}
                      </h3>
                      <div className="flex shrink-0 items-center gap-0.5">
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

                    {project.description ? (
                      <p className="mt-1 line-clamp-2 text-small text-text-secondary">
                        {project.description}
                      </p>
                    ) : null}

                    <div className="mt-3 flex items-center gap-2">
                      <Badge tone={project.status === "active" ? "success" : "neutral"}>
                        {project.status}
                      </Badge>
                      {project.due_date ? (
                        <span className="font-mono text-mono tabular-nums text-text-tertiary">
                          {formatDate(project.due_date)}
                        </span>
                      ) : null}
                      <span className="ml-auto font-mono text-mono tabular-nums text-text-secondary">
                        {Math.round(progress)}%
                      </span>
                    </div>

                    <Progress
                      value={progress}
                      label={`${project.name} progress`}
                      className="mt-2"
                    />

                    <label className="mt-3 flex items-center gap-2">
                      <span className="sr-only">Update {project.name} progress</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={progress}
                        onChange={(event) =>
                          void handleProgress(project.id, Number(event.target.value))
                        }
                        aria-label={`Set ${project.name} progress`}
                        className="h-1 w-full cursor-pointer accent-white"
                      />
                    </label>
                  </div>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ProjectManager({ userId }: { userId: string }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-36 w-full rounded-card" />
        </div>
      }
    >
      <ProjectManagerInner userId={userId} />
    </Suspense>
  );
}

"use client";

// ============================================================
// NEXUS — NOTES MANAGER
// ============================================================
// Lightweight operational knowledge: notes that explain the work.
// Real rows under RLS, linked to projects and tasks, searchable,
// with types that match how work actually happens (decision,
// meeting, research…). Not a Notion clone — no nested pages, no
// blocks; just the knowledge Intelligence needs to reason with.

import { useEffect, useMemo, useState } from "react";
import {
  IconArchive,
  IconFileText,
  IconPencil,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { useDataError } from "@/hooks/use-data-error";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/ui/create-button";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";

export type NoteType = "standard" | "idea" | "meeting" | "research" | "decision" | "reference";

type Note = {
  id: string;
  title: string;
  content: string | null;
  note_type: NoteType;
  project_id: string | null;
  task_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectOption = { id: string; name: string };

const NOTE_TYPES: { id: NoteType; label: string }[] = [
  { id: "standard", label: "Note" },
  { id: "idea", label: "Idea" },
  { id: "meeting", label: "Meeting" },
  { id: "research", label: "Research" },
  { id: "decision", label: "Decision" },
  { id: "reference", label: "Reference" },
];

const TYPE_TONE: Record<NoteType, "neutral" | "info" | "lavender" | "success" | "warning"> = {
  standard: "neutral",
  idea: "lavender",
  meeting: "info",
  research: "neutral",
  decision: "success",
  reference: "warning",
};

type NoteForm = { title: string; content: string; note_type: NoteType; project_id: string };
const blankForm = (): NoteForm => ({ title: "", content: "", note_type: "standard", project_id: "" });

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", year: "numeric" }).format(
    new Date(value)
  );

export function NotesManager({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { error, setError, reportDataError } = useDataError();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NoteForm>(blankForm());
  const [deleting, setDeleting] = useState<Note | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    (async () => {
      const { membership } = await getActiveMembership(supabase, userId);
      if (!active || !membership?.workspaceId) {
        setLoading(false);
        return;
      }
      setWorkspaceId(membership.workspaceId);
    })();
    return () => {
      active = false;
    };
  }, [supabase, userId]);


  const fetchNotes = async (workspace: string) => {
    const { data, error: readError } = await supabase
      .from("notes")
      .select("id, title, content, note_type, project_id, task_id, archived_at, created_at, updated_at")
      .eq("workspace_id", workspace)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (readError) {
      reportDataError("notes.read", readError);
      return;
    }
    setNotes((data ?? []) as Note[]);
    setLoading(false);
  };

  const fetchProjects = async (workspace: string) => {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("workspace_id", workspace)
      .order("name")
      .limit(100);
    setProjects((data ?? []) as ProjectOption[]);
  };
  useEffect(() => {
    const load = async () => {
      if (!workspaceId) return;
      await fetchNotes(workspaceId);
      await fetchProjects(workspaceId);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return notes
      .filter((note) => (showArchived ? note.archived_at !== null : note.archived_at === null))
      .filter(
        (note) =>
          !needle ||
          note.title.toLowerCase().includes(needle) ||
          (note.content ?? "").toLowerCase().includes(needle)
      );
  }, [notes, query, showArchived]);

  const openCreate = () => {
    setEditingId(null);
    setForm(blankForm());
    setError("");
    setFormOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditingId(note.id);
    setError("");
    setForm({
      title: note.title,
      content: note.content ?? "",
      note_type: note.note_type,
      project_id: note.project_id ?? "",
    });
    setFormOpen(true);
  };

  const submit = async () => {
    if (!workspaceId || !form.title.trim()) return;
    setSaving(true);
    const payload = {
      workspace_id: workspaceId,
      title: form.title.trim(),
      content: form.content.trim() || null,
      note_type: form.note_type,
      project_id: form.project_id || null,
      created_by: userId,
    };

    const response = editingId
      ? await supabase
          .from("notes")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingId)
          .eq("workspace_id", workspaceId)
      : await supabase.from("notes").insert(payload);

    setSaving(false);

    if (response.error) {
      reportDataError("notes.write", response.error);
      return;
    }

    setFormOpen(false);
    toast("success", editingId ? "Note updated" : "Note created");
    await fetchNotes(workspaceId);
  };

  const archive = async (note: Note, archived: boolean) => {
    if (!workspaceId) return;
    const { error: updateError } = await supabase
      .from("notes")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", note.id)
      .eq("workspace_id", workspaceId);
    if (updateError) {
      reportDataError("notes.archive", updateError);
      return;
    }
    await fetchNotes(workspaceId);
  };

  const remove = async (note: Note) => {
    if (!workspaceId) return;
    const { error: deleteError } = await supabase
      .from("notes")
      .delete()
      .eq("id", note.id)
      .eq("workspace_id", workspaceId);
    setDeleting(null);
    if (deleteError) {
      reportDataError("notes.delete", deleteError);
      return;
    }
    toast("success", "Note deleted");
    await fetchNotes(workspaceId);
  };

  return (
    <div className="page-enter">
      <PageHeader
        title="Notes"
        count={loading ? undefined : `${visible.length}${showArchived ? " · archived" : ""}`}
        description="Operational knowledge attached to your work — decisions, meetings, research. Intelligence reads these when it reasons about your projects."
        actions={<CreateButton label="Create note" onClick={openCreate} />}
      />

      {error ? <Alert tone="danger" title="Notes could not be saved">{error}</Alert> : null}

      <Panel bodyClassName="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <NexusIcon
              icon={IconSearch}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
              className="pl-8"
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowArchived((value) => !value)}
            aria-pressed={showArchived}
          >
            {showArchived ? "Show active notes" : "Show archived"}
          </Button>
        </div>
      </Panel>

      <div className="mt-4">
        {loading ? (
          <Panel>
            <SkeletonRows rows={4} />
          </Panel>
        ) : visible.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<NexusIcon icon={IconFileText} size="state" />}
              title={query || showArchived ? "No notes match" : "No notes yet"}
              description={
                query || showArchived
                  ? "Try a different search, or clear the filters to see all notes."
                  : "Notes hold the knowledge behind your work — a decision, what a meeting concluded, where research lives. Create the first one, and Intelligence will use it as context."
              }
              action={
                query || showArchived ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      setShowArchived(false);
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" onClick={openCreate}>
                    Create note
                  </Button>
                )
              }
            />
          </Panel>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((note) => (
              <article
                key={note.id}
                className="flex flex-col rounded-card border border-border-subtle bg-bg-subtle/70 p-4 transition-colors hover:border-border-default"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-h3 text-text-primary">{note.title}</h2>
                    <p className="mt-0.5 font-mono text-caption text-text-quaternary">
                      Updated {formatDate(note.updated_at)}
                    </p>
                  </div>
                  <Badge tone={TYPE_TONE[note.note_type]}>
                    {NOTE_TYPES.find((t) => t.id === note.note_type)?.label ?? note.note_type}
                  </Badge>
                </div>
                {note.content ? (
                  <p className="mt-2.5 mb-3 line-clamp-3 whitespace-pre-wrap text-small text-text-secondary">
                    {note.content}
                  </p>
                ) : (
                  <p className="mt-2.5 mb-3 text-small text-text-quaternary">No content yet.</p>
                )}
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
                  <span className="truncate text-caption text-text-quaternary">
                    {projects.find((p) => p.id === note.project_id)?.name ?? "Not linked"}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="icon" title="Edit note" aria-label={`Edit ${note.title}`} onClick={() => openEdit(note)}>
                      <NexusIcon icon={IconPencil} />
                    </Button>
                    <Button
                      variant="icon"
                      title={note.archived_at ? "Restore note" : "Archive note"}
                      aria-label={`${note.archived_at ? "Restore" : "Archive"} ${note.title}`}
                      onClick={() => archive(note, !note.archived_at)}
                    >
                      <NexusIcon icon={IconArchive} />
                    </Button>
                    <Button variant="icon" title="Delete note" aria-label={`Delete ${note.title}`} onClick={() => setDeleting(note)}>
                      <NexusIcon icon={IconTrash} className="text-danger-text" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? "Edit note" : "Create note"}
        description="Notes are workspace knowledge. Link one to a project so Intelligence can connect it to the work it explains."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={saving} disabled={!form.title.trim()}>
              {editingId ? "Save note" : "Create note"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" htmlFor="note-title">
            <Input
              id="note-title"
              value={form.title}
              onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
              placeholder="What is this about?"
              autoFocus
            />
          </Field>
          <Field label="Type" htmlFor="note-type">
            <Select
              id="note-type"
              value={form.note_type}
              onChange={(event) => setForm((f) => ({ ...f, note_type: event.target.value as NoteType }))}
            >
              {NOTE_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Project (optional)" htmlFor="note-project">
            <Select
              id="note-project"
              value={form.project_id}
              onChange={(event) => setForm((f) => ({ ...f, project_id: event.target.value }))}
            >
              <option value="">Not linked</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Content" htmlFor="note-content">
            <Textarea
              id="note-content"
              value={form.content}
              onChange={(event) => setForm((f) => ({ ...f, content: event.target.value }))}
              placeholder="Write what future-you needs to know."
              rows={6}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete “${deleting.title}”` : ""}
        description="This note will be removed for everyone in the workspace. There is no undo."
        confirmLabel="Delete note"
        onConfirm={() => {
          if (deleting) void remove(deleting);
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

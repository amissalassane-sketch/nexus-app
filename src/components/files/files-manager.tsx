"use client";

// ============================================================
// NEXUS — FILES MANAGER
// ============================================================
// A real file foundation: private bucket (RLS-scoped), metadata
// rows linking files to projects, honest plan limits enforced by
// the database trigger (migration 20260922130000), download and
// delete. Files are references, not model context — Intelligence
// sees metadata, never a blind upload into a prompt.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconDownload,
  IconFile,
  IconFileText,
  IconFileTypePdf,
  IconPhoto,
  IconPlugConnected,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { useDataError } from "@/hooks/use-data-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/input";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";

type FileRow = {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  project_id: string | null;
  created_at: string;
};

type ProjectOption = { id: string; name: string };

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per file
const BUCKET = "nexus-files";

const formatSize = (bytes: number | null) => {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", year: "numeric" }).format(
    new Date(value)
  );

function fileIcon(mime: string | null) {
  if (mime?.startsWith("image/")) return IconPhoto;
  if (mime === "application/pdf") return IconFileTypePdf;
  if (mime?.startsWith("text/")) return IconFileText;
  return IconFile;
}

export function FilesManager({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [planLimit, setPlanLimit] = useState<string | null>(null);
  const { error, setError, reportDataError } = useDataError();
  const [deleting, setDeleting] = useState<FileRow | null>(null);
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


  const fetchFiles = async (workspace: string) => {
    const { data, error: readError } = await supabase
      .from("files")
      .select("id, name, storage_path, mime_type, size_bytes, project_id, created_at")
      .eq("workspace_id", workspace)
      .order("created_at", { ascending: false })
      .limit(200);
    if (readError) {
      reportDataError("files.read", readError);
      setLoading(false);
      return;
    }
    setFiles((data ?? []) as FileRow[]);
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
      await fetchFiles(workspaceId);
      await fetchProjects(workspaceId);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const pickFiles = () => inputRef.current?.click();

  const upload = async (selected: FileList | null) => {
    if (!selected || selected.length === 0 || !workspaceId) return;
    setUploading(true);
    setPlanLimit(null);
    setError("");

    for (const file of Array.from(selected)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(`“${file.name}” is larger than 10 MB and was not uploaded.`);
        continue;
      }
      setUploadProgress(`Uploading ${file.name}…`);

      // Path convention: {workspace_id}/{uuid}-{name} (bucket RLS reads
      // the workspace from the first path segment).
      const path = `${workspaceId}/${crypto.randomUUID()}-${file.name.replace(/[/\\]/g, "_")}`;
      const { error: storageError } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined,
      });
      if (storageError) {
        reportDataError("files.upload", storageError);
        continue;
      }

      const { error: metadataError } = await supabase.from("files").insert({
        workspace_id: workspaceId,
        name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: userId,
      });

      if (metadataError) {
        // The row was refused (e.g. plan limit): remove the orphan object
        // so storage never holds data the product cannot see.
        await supabase.storage.from(BUCKET).remove([path]);
        if (metadataError.message.includes("PLAN_LIMIT_EXCEEDED")) {
          setPlanLimit(
            "This workspace reached its file limit. Upgrade the plan to upload more files."
          );
        } else {
          reportDataError("files.metadata", metadataError);
        }
        continue;
      }
      toast("success", `Uploaded ${file.name}`);
    }

    setUploadProgress(null);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    await fetchFiles(workspaceId);
  };

  const download = async (file: FileRow) => {
    const { data, error: downloadError } = await supabase.storage.from(BUCKET).download(file.storage_path);
    if (downloadError || !data) {
      reportDataError("files.download", downloadError ?? { message: "No data returned" });
      return;
    }
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const remove = async (file: FileRow) => {
    if (!workspaceId) return;
    const { error: objectError } = await supabase.storage.from(BUCKET).remove([file.storage_path]);
    if (objectError) {
      reportDataError("files.delete-storage", objectError);
      setDeleting(null);
      return;
    }
    const { error: deleteError } = await supabase
      .from("files")
      .delete()
      .eq("id", file.id)
      .eq("workspace_id", workspaceId);
    if (deleteError) {
      reportDataError("files.delete", deleteError);
      setDeleting(null);
      return;
    }
    // Storage deletion was acknowledged before reporting successful deletion.
    setDeleting(null);
    toast("success", `Deleted ${file.name}`);
    await fetchFiles(workspaceId);
  };

  const linkProject = async (file: FileRow, projectId: string) => {
    if (!workspaceId) return;
    const { error: updateError } = await supabase
      .from("files")
      .update({ project_id: projectId || null })
      .eq("id", file.id)
      .eq("workspace_id", workspaceId);
    if (updateError) {
      reportDataError("files.link", updateError);
      return;
    }
    setFiles((current) =>
      current.map((row) => (row.id === file.id ? { ...row, project_id: projectId || null } : row))
    );
  };

  return (
    <div className="page-enter">
      <PageHeader
        title="Files"
        count={loading ? undefined : `${files.length} file${files.length === 1 ? "" : "s"}`}
        description="Documents attached to your work, stored in a private workspace bucket. Content extraction and AI document analysis are not implemented."
        actions={
          <Button variant="primary" onClick={pickFiles} loading={uploading}>
            <NexusIcon icon={IconUpload} />
            Upload files
          </Button>
        }
      />

      {error ? <Alert tone="danger" title="File operation could not be completed">{error}</Alert> : null}
      {planLimit ? (
        <Alert tone="warning" title="File limit reached">
          {planLimit}{" "}
          <a href="/upgrade" className="font-medium underline underline-offset-2">
            See plans
          </a>
        </Alert>
      ) : null}
      {uploadProgress ? (
        <p className="text-caption text-text-tertiary" role="status">
          {uploadProgress}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void upload(event.target.files)}
        aria-label="Choose files to upload"
      />

      {loading ? (
        <Panel>
          <SkeletonRows rows={3} />
        </Panel>
      ) : files.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<NexusIcon icon={IconUpload} size="state" />}
            title="No files yet"
            description="Files make the context behind your work retrievable — specs, designs, exports. Upload the first one and link it to a project."
            action={
              <Button size="sm" variant="primary" onClick={pickFiles}>
                Upload files
              </Button>
            }
          />
        </Panel>
      ) : (
        <Panel bodyClassName="p-0">
          <ul className="divide-y divide-border-subtle">
            {files.map((file) => {
              const Icon = fileIcon(file.mime_type);
              return (
                <li
                  key={file.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-secondary">
                      <NexusIcon icon={Icon} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-small font-medium text-text-primary">{file.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">
                        {formatSize(file.size_bytes)}
                        {file.mime_type ? ` · ${file.mime_type}` : ""} · {formatDate(file.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-3">
                    <span className="sr-only" aria-hidden="true">
                      Link to project
                    </span>
                    <div className="flex items-center gap-1.5">
                      <NexusIcon
                        icon={IconPlugConnected}
                        className="h-3.5 w-3.5 text-text-quaternary"
                      />
                      <Select
                        value={file.project_id ?? ""}
                        onChange={(event) => void linkProject(file, event.target.value)}
                        aria-label={`Link ${file.name} to a project`}
                        className="h-8 py-0 text-caption"
                      >
                        <option value="">Not linked</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button
                      variant="icon"
                      title={`Download ${file.name}`}
                      aria-label={`Download ${file.name}`}
                      onClick={() => void download(file)}
                    >
                      <NexusIcon icon={IconDownload} />
                    </Button>
                    <Button
                      variant="icon"
                      title={`Delete ${file.name}`}
                      aria-label={`Delete ${file.name}`}
                      onClick={() => setDeleting(file)}
                    >
                      <NexusIcon icon={IconTrash} className="text-danger-text" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <Panel title="How files are protected" description="The rules, not promises">
        <ul className="space-y-1.5 text-small text-text-secondary">
          <li>
            <Badge tone="neutral">Private</Badge> Files live in a private bucket; only active
            workspace members can read them (RLS on the storage path).
          </li>
          <li>
            <Badge tone="neutral">Limited</Badge> Each plan caps the number of files (FREE 20 · PRO
            200 · TEAM 1000), enforced by the database, not the UI.
          </li>
          <li>
            <Badge tone="neutral">Referenced</Badge> Intelligence sees file metadata — name, type,
            project. It never reads file contents into a model without an explicit, confirmed action.
          </li>
          <li>
            <Badge tone="neutral">Honest</Badge> An upload that exceeds the limit is refused with the
            exact reason; nothing is silently dropped.
          </li>
        </ul>
      </Panel>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete “${deleting.name}”` : ""}
        description="The file and its metadata will be removed for everyone in the workspace. There is no undo."
        confirmLabel="Delete file"
        onConfirm={() => {
          if (deleting) void remove(deleting);
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

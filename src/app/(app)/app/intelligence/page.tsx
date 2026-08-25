import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import {
  computeInsights,
  describeWorkspace,
  type WorkspaceSnapshot,
} from "@/lib/intelligence/engine";
import { IntelligenceView } from "@/components/intelligence/intelligence-view";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";

export const metadata = {
  title: "Intelligence — NEXUS",
  description:
    "NEXUS continuously analyses your workspace and surfaces what matters next.",
};

export default async function IntelligencePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { membership } = await getActiveMembership(supabase, user.id);
  const workspaceId = membership?.workspaceId ?? null;

  let snapshot: WorkspaceSnapshot = { tasks: [], projects: [], goals: [] };
  let error: string | null = null;

  if (workspaceId) {
    const [tasks, projects, goals] = await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, title, status, priority, due_at, completed_at, project_id, updated_at, created_at"
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("projects")
        .select(
          "id, name, status, due_date, progress, updated_at, created_at"
        )
        .eq("workspace_id", workspaceId),
      supabase
        .from("goals")
        .select("id, title, status, progress, target_date, updated_at")
        .eq("workspace_id", workspaceId),
    ]);

    if (tasks.error && projects.error && goals.error) {
      error =
        tasks.error?.message ??
        projects.error?.message ??
        goals.error?.message ??
        null;
    } else {
      snapshot = {
        tasks: (tasks.data ?? []) as WorkspaceSnapshot["tasks"],
        projects: (projects.data ?? []) as WorkspaceSnapshot["projects"],
        goals: (goals.data ?? []) as WorkspaceSnapshot["goals"],
      };
    }
  }

  const insights = computeInsights(snapshot);
  const context = describeWorkspace(snapshot);
  const critical = insights.filter(
    (insight) => insight.severity === "critical"
  ).length;

  return (
    <div className="page-enter">
      <PageHeader
        title="Intelligence"
        count={insights.length}
        description="NEXUS continuously analyses your workspace and surfaces what matters next. Every signal is derived from your own data and shows the evidence behind it."
        actions={
          critical > 0 ? (
            <span className="inline-flex h-8 items-center gap-2 rounded-input border border-danger-border bg-danger-bg px-2.5 text-caption text-danger">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-pill bg-danger"
              />
              {critical} critical
            </span>
          ) : null
        }
      />

      {!workspaceId ? (
        <Alert tone="warning" className="mb-5">
          No active workspace is linked to this account, so there is nothing for
          NEXUS to analyse yet.
        </Alert>
      ) : null}

      {error ? (
        <ErrorState
          title="We couldn't read this workspace"
          description="Your session may have expired, or the workspace is no longer reachable. Nothing has been changed."
          action={<ButtonLink href="/app/intelligence">Retry</ButtonLink>}
        />
      ) : (
        <IntelligenceView insights={insights} context={context} snapshot={snapshot} />
      )}
    </div>
  );
}

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
  title: "Intelligence. NEXUS",
  description:
    "NEXUS reads your workspace and surfaces what matters next. Every signal carries its evidence.",
};

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ ask?: string; q?: string }>;
}) {
  const params = await searchParams;
  // ?ask=1 focuses the console (mobile home CTA); ?q= prefills a
  // starter without sending it.
  const autoFocusAsk = params.ask === "1";
  const initialAskQuery =
    typeof params.q === "string" && params.q.trim() ? params.q.trim().slice(0, 500) : "";
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

    if (tasks.error || projects.error || goals.error) {
      error = "Intelligence data is temporarily unavailable. Please retry.";
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
        description="NEXUS reads your workspace and surfaces what matters next. Every signal is derived from your own data and shows the evidence behind it."
        actions={
          critical > 0 ? (
            <span className="inline-flex h-8 items-center gap-2 rounded-input border border-danger-border bg-danger-bg px-2.5 text-caption text-danger">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-pill bg-danger"
              />
              {critical} critical signal{critical === 1 ? "" : "s"}
            </span>
          ) : null
        }
      />

      {!workspaceId ? (
        <Alert tone="warning" className="mb-6">
          No active workspace is linked to this account. NEXUS has nothing to
          read until you create one.
        </Alert>
      ) : null}

      {error ? (
        <ErrorState
          title="NEXUS could not read this workspace"
          description="Your session may have expired, or the workspace is no longer reachable. Nothing was changed."
          action={<ButtonLink href="/app/intelligence">Retry</ButtonLink>}
        />
      ) : (
        <IntelligenceView
          insights={insights}
          context={context}
          snapshot={snapshot}
          workspaceId={workspaceId}
          autoFocusAsk={autoFocusAsk}
          initialAskQuery={initialAskQuery}
        />
      )}
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getActiveMembership } from "@/lib/workspace";
import { computeInsights, type WorkspaceSnapshot } from "@/lib/intelligence/engine";
import { FocusPanel, IntelligenceList } from "@/components/intelligence-panel";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/feedback";

export const metadata = {
  title: "Intelligence — NEXUS",
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
        .select("id, title, status, priority, due_at, completed_at, project_id")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("projects")
        .select("id, name, status, due_date, goal_id")
        .eq("workspace_id", workspaceId),
      supabase
        .from("goals")
        .select("id, title, status, progress, target_date")
        .eq("workspace_id", workspaceId),
    ]);

    if (tasks.error || projects.error || goals.error) {
      error =
        tasks.error?.message ?? projects.error?.message ?? goals.error?.message ?? null;
    } else {
      snapshot = {
        tasks: (tasks.data ?? []) as WorkspaceSnapshot["tasks"],
        projects: (projects.data ?? []) as WorkspaceSnapshot["projects"],
        goals: (goals.data ?? []) as WorkspaceSnapshot["goals"],
      };
    }
  }

  const insights = computeInsights(snapshot);

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-5">
      <PageHeader
        title="Intelligence"
        count={insights.length}
        description="A deterministic read of your workspace — every signal includes its reason."
      />

      {!workspaceId ? (
        <Alert tone="warning">
          No active workspace is currently linked to this account.
        </Alert>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <FocusPanel insight={insights[0] ?? null} />

      <IntelligenceList insights={insights} />
    </div>
  );
}

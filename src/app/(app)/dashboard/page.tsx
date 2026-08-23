import Link from "next/link";
import {
  ArrowRight,
  CheckSquare,
  FolderKanban,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfileSummary, requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Metric, Panel } from "@/components/ui/card";
import { Alert, EmptyState, Progress } from "@/components/ui/feedback";
import { FocusPanel, InsightRow } from "@/components/intelligence-panel";
import {
  computeInsights,
  describeWorkspace,
  nextBestAction,
  type WorkspaceSnapshot,
} from "@/lib/intelligence/engine";
import { ActivityList, type ActivityRow } from "@/components/activity-list";
import { getActiveMembership } from "@/lib/workspace";

// ============================================================
// NEXUS — OVERVIEW
// Answers one question: what is happening in my workspace, and what
// deserves attention right now. Not an analytics dashboard — a priority
// read. Every number is a Supabase count; nothing is illustrative.
// ============================================================

export const metadata = {
  title: "Overview — NEXUS",
};

type DashboardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  created_at: string;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
  }).format(date);
};

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const profile = await getProfileSummary();
  const firstName = profile.displayName.split(" ")[0] ?? profile.displayName;

  const { membership, error: membershipError } = await getActiveMembership(
    supabase,
    user.id
  );
  const workspaceId = membership?.workspaceId ?? null;

  const { data: workspace, error: workspaceError } = workspaceId
    ? await supabase
        .from("workspaces")
        .select("id, name")
        .eq("id", workspaceId)
        .maybeSingle()
    : { data: null, error: null };

  const emptySnapshot: WorkspaceSnapshot = { tasks: [], projects: [], goals: [] };

  // One snapshot drives the metrics, the signals and the focus block:
  // the same numbers everywhere, read once.
  const snapshotPromise: Promise<WorkspaceSnapshot> = workspaceId
    ? (async () => {
        const [tasks, projects, goals] = await Promise.all([
          supabase
            .from("tasks")
            .select(
              "id, title, status, priority, due_at, completed_at, project_id, updated_at, created_at"
            )
            .eq("workspace_id", workspaceId)
            .limit(1000),
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
        return {
          tasks: (tasks.data ?? []) as WorkspaceSnapshot["tasks"],
          projects: (projects.data ?? []) as WorkspaceSnapshot["projects"],
          goals: (goals.data ?? []) as WorkspaceSnapshot["goals"],
        };
      })()
    : Promise.resolve(emptySnapshot);

  const recentProjectsPromise = workspaceId
    ? supabase
        .from("projects")
        .select("id, name, status, progress, due_date, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(4)
    : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null });

  const recentGoalsPromise = workspaceId
    ? supabase
        .from("goals")
        .select("id, title, status, progress, target_date, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(3)
    : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null });

  const recentActivitiesPromise = workspaceId
    ? supabase
        .from("activities")
        .select("id, entity_type, action, metadata, created_at, actor_id")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(6)
    : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null });

  const [
    snapshot,
    recentProjectsResult,
    recentGoalsResult,
    recentActivitiesResult,
  ] = await Promise.all([
    snapshotPromise,
    recentProjectsPromise,
    recentGoalsPromise,
    recentActivitiesPromise,
  ]);

  const context = describeWorkspace(snapshot);
  const insights = computeInsights(snapshot);
  const focus = nextBestAction(snapshot);
  const needsAttention = insights
    .filter((insight) => insight.severity !== "positive")
    .slice(0, 4);

  const recentProjects = recentProjectsResult.data ?? [];
  const recentGoals = recentGoalsResult.data ?? [];
  const recentActivities = (recentActivitiesResult.data ?? []) as ActivityRow[];
  const activitiesUnavailable = Boolean(recentActivitiesResult.error);

  const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
  const nowStr = new Date().toISOString();

  const priorityTasks = (snapshot.tasks as DashboardTask[])
    .filter((task) => task.status !== "done" && task.status !== "cancelled")
    .sort((a, b) => {
      const pA = priorityWeight[a.priority as keyof typeof priorityWeight] ?? 0;
      const pB = priorityWeight[b.priority as keyof typeof priorityWeight] ?? 0;
      if (pB !== pA) return pB - pA;
      if (a.due_at && b.due_at)
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      if (a.due_at) return -1;
      if (b.due_at) return 1;
      return 0;
    })
    .slice(0, 5);

  const workspaceName = workspace?.name ?? null;
  const showWorkspaceWarning = Boolean(
    membershipError || workspaceError || !workspaceId || !workspace
  );

  const attentionLine =
    needsAttention.length > 0
      ? `${needsAttention.length} ${
          needsAttention.length === 1 ? "signal needs" : "signals need"
        } a decision.`
      : context.openTasks > 0
        ? "Nothing is at risk. Here is what is moving."
        : "Your workspace is clear.";

  return (
    <div className="page-enter space-y-6">
      {/* HEADER */}
      <header className="flex flex-col gap-3 border-b border-border-subtle pb-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="eyebrow text-text-quaternary">
            {new Intl.DateTimeFormat("en", {
              weekday: "long",
              month: "long",
              day: "numeric",
            }).format(new Date())}
          </p>
          <h1 className="mt-2.5 text-[26px] font-semibold leading-[32px] tracking-[-0.03em] text-text-primary">
            {greeting(new Date())}, {firstName}.
          </h1>
          <p className="mt-1.5 text-small text-text-secondary">
            {attentionLine}{" "}
            {workspaceName ? (
              <span className="text-text-tertiary">
                NEXUS analysed activity in {workspaceName}.
              </span>
            ) : null}
          </p>
        </div>

        <Link
          href="/app/intelligence"
          className="group inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-colors duration-150 ease-nexus hover:border-border-strong hover:bg-accent-ghost hover:text-text-primary md:self-auto"
        >
          Open Intelligence
          <ArrowRight
            size={14}
            strokeWidth={1.75}
            aria-hidden="true"
            className="transition-transform duration-150 ease-nexus group-hover:translate-x-0.5"
          />
        </Link>
      </header>

      {showWorkspaceWarning ? (
        <Alert tone="warning">
          No active workspace is linked to this account, so NEXUS has nothing to
          analyse yet.
        </Alert>
      ) : null}

      {/* NEXT ACTION */}
      <FocusPanel insight={focus} />

      {/* NEEDS ATTENTION — the operational signals, highest value first */}
      <Panel
        title="Needs attention"
        description="Derived from deadlines, blocked work and project momentum"
        bodyClassName="p-0"
        actions={
          <Link
            href="/app/intelligence"
            className="text-caption text-text-tertiary transition-colors duration-150 ease-nexus hover:text-text-primary"
          >
            All signals
          </Link>
        }
      >
        {needsAttention.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-4">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-input border border-success-border bg-success-bg text-success"
            >
              <CheckSquare size={15} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-body-medium text-text-primary">
                No risk detected in this workspace.
              </p>
              <p className="text-caption text-text-tertiary">
                Nothing is overdue, blocked or drifting.
              </p>
            </div>
          </div>
        ) : (
          <ul>
            {needsAttention.map((insight, index) => (
              <InsightRow key={insight.id} insight={insight} index={index} />
            ))}
          </ul>
        )}
      </Panel>

      {/* WORKSPACE STATE */}
      <div className="grid grid-cols-2 overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/50 sm:grid-cols-3 lg:grid-cols-5 [&>*]:border-b [&>*]:border-r [&>*]:border-border-subtle">
        <Metric label="Open tasks" value={context.openTasks} />
        <Metric
          label="Overdue"
          value={context.overdueTasks}
          tone={context.overdueTasks > 0 ? "danger" : "default"}
        />
        <Metric
          label="Blocked"
          value={context.blockedTasks}
          tone={context.blockedTasks > 0 ? "warning" : "default"}
        />
        <Metric label="Due this week" value={context.dueThisWeek} />
        <Metric label="Completed" value={`${context.completionRate}%`} />
      </div>

      {/* CONTENT GRID */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel
            title="Priority tasks"
            description="Sorted by priority, then due date"
            bodyClassName="p-0"
            actions={
              <Link
                href="/tasks"
                className="text-caption text-text-tertiary transition-colors duration-150 ease-nexus hover:text-text-primary"
              >
                View all
              </Link>
            }
          >
            {priorityTasks.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Nothing open"
                  description="Your queue is clear. New tasks appear here ranked by priority and date."
                  icon={<CheckSquare size={17} strokeWidth={1.75} />}
                  action={
                    <Link
                      href="/tasks?create=1"
                      className="inline-flex h-9 items-center rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                    >
                      Create a task
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul>
                {priorityTasks.map((task) => {
                  const overdue = Boolean(task.due_at && task.due_at < nowStr);
                  return (
                    <li key={task.id}>
                      <Link
                        href="/tasks"
                        className="flex h-11 items-center gap-3 border-b border-border-subtle px-4 transition-colors duration-150 ease-nexus last:border-b-0 hover:bg-white/[0.02]"
                      >
                        <span
                          aria-hidden="true"
                          className="h-[15px] w-[15px] shrink-0 rounded-[5px] border border-border-strong"
                        />
                        <span className="min-w-0 flex-1 truncate text-body text-text-primary">
                          {task.title}
                        </span>
                        {task.priority === "urgent" || task.priority === "high" ? (
                          <Badge
                            tone={task.priority === "urgent" ? "danger" : "warning"}
                            className="hidden sm:inline-flex"
                          >
                            {task.priority}
                          </Badge>
                        ) : null}
                        <span
                          className={cn(
                            "w-12 shrink-0 text-right font-mono text-mono tabular-nums",
                            overdue ? "text-danger" : "text-text-quaternary"
                          )}
                        >
                          {formatDate(task.due_at)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            title="Projects"
            description="Most recently created"
            bodyClassName="p-0"
            actions={
              <Link
                href="/projects"
                className="text-caption text-text-tertiary transition-colors duration-150 ease-nexus hover:text-text-primary"
              >
                View all
              </Link>
            }
          >
            {recentProjects.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No projects yet"
                  description="Create your first project to give NEXUS the context it needs to detect risk and momentum."
                  icon={<FolderKanban size={17} strokeWidth={1.75} />}
                  action={
                    <Link
                      href="/projects?create=1"
                      className="inline-flex h-9 items-center rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg transition-colors hover:bg-accent-hover"
                    >
                      Create a project
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul>
                {recentProjects.map((project) => {
                  const progress = Math.min(
                    100,
                    Math.max(0, Number(project.progress ?? 0))
                  );
                  return (
                    <li key={project.id as string}>
                      <Link
                        href="/projects"
                        className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 transition-colors duration-150 ease-nexus last:border-b-0 hover:bg-white/[0.02]"
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-tertiary"
                        >
                          <FolderKanban size={15} strokeWidth={1.75} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 truncate text-body-medium text-text-primary">
                              {project.name as string}
                            </span>
                            <span className="eyebrow shrink-0 text-text-quaternary">
                              {project.status as string}
                            </span>
                          </span>
                          <Progress
                            value={progress}
                            label={`${project.name as string} progress`}
                            className="mt-2 max-w-sm"
                          />
                        </span>

                        <span className="shrink-0 text-right">
                          <span className="block font-mono text-mono tabular-nums text-text-secondary">
                            {progress}%
                          </span>
                          {project.due_date ? (
                            <span className="mt-0.5 block font-mono text-mono tabular-nums text-text-quaternary">
                              {formatDate(project.due_date as string)}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          <Panel
            title="Goals"
            bodyClassName="p-0"
            actions={
              <Link
                href="/goals"
                className="text-caption text-text-tertiary transition-colors duration-150 ease-nexus hover:text-text-primary"
              >
                View all
              </Link>
            }
          >
            {recentGoals.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No goals yet"
                  description="Define what this workspace is working towards so NEXUS can measure progress against it."
                  icon={<Target size={17} strokeWidth={1.75} />}
                />
              </div>
            ) : (
              <ul>
                {recentGoals.map((goal) => {
                  const progress = Math.min(
                    100,
                    Math.max(0, Number(goal.progress ?? 0))
                  );
                  return (
                    <li
                      key={goal.id as string}
                      className="border-b border-border-subtle px-4 py-3 last:border-b-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href="/goals"
                            className="block truncate text-body-medium text-text-primary transition-colors hover:text-white"
                          >
                            {goal.title as string}
                          </Link>
                          {goal.target_date ? (
                            <p className="eyebrow mt-1 text-text-quaternary">
                              {formatDate(goal.target_date as string)}
                            </p>
                          ) : null}
                        </div>
                        <span className="font-mono text-mono tabular-nums text-text-primary">
                          {progress}%
                        </span>
                      </div>
                      <Progress
                        value={progress}
                        label={`${goal.title as string} progress`}
                        className="mt-2.5"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            title="Activity"
            bodyClassName="p-0"
            actions={
              <Link
                href="/activity"
                className="text-caption text-text-tertiary transition-colors duration-150 ease-nexus hover:text-text-primary"
              >
                View all
              </Link>
            }
          >
            <ActivityList
              activities={recentActivities}
              unavailable={activitiesUnavailable}
              compact
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}

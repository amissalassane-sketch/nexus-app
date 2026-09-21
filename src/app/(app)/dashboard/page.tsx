import Link from "next/link";
import {
  IconArrowRight,
  IconBan,
  IconCalendarClock,
  IconChecklist,
  IconCircleCheck,
  IconLayoutKanban,
  IconListCheck,
  IconSparkles,
  IconTarget,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { createClient } from "@/lib/supabase/server";
import { getProfileSummary, requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Alert, EmptyState, Progress } from "@/components/ui/feedback";
import { FocusPanel, InsightRow } from "@/components/intelligence-panel";
import {
  computeInsights,
  describeWorkspace,
  isActiveTask,
  nextBestAction,
  type WorkspaceSnapshot,
} from "@/lib/intelligence/engine";
import { workspaceHealth, weeklyBriefing, forecastWorkspace, rankPriorities } from "@/lib/intelligence/advanced";
import { ActivityList, type ActivityRow } from "@/components/activity-list";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { BriefingPanel } from "@/components/dashboard/briefing-panel";
import { PriorityQueuePanel } from "@/components/dashboard/priority-queue";
import { ActiveProjectsPanel } from "@/components/dashboard/active-projects";
import { UpcomingPanel, type UpcomingItem } from "@/components/dashboard/upcoming-panel";
import { MobileOverview } from "@/components/mobile-home/mobile-overview";
import { readActiveMissions } from "@/lib/intelligence/mission";
import type { IntelligenceMission } from "@/lib/intelligence/types";
import { withTimeout } from "@/lib/auth-flow";
import { getActiveMembership } from "@/lib/workspace";
import { logDataReadFailure } from "@/lib/server-logs";

// ============================================================
// NEXUS — OVERVIEW
// Answers one question: what is happening in my workspace, and what
// deserves attention right now. Not an analytics dashboard — a priority
// read. Every number is a Supabase count; nothing is illustrative.
// ============================================================

export const metadata = {
  title: "Overview. NEXUS",
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
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
  // `displayName` is null until the user (or their OAuth provider) actually
  // provides a name — the greeting then simply omits it. No invented names.
  const firstName = profile.displayName?.split(" ")[0] ?? null;

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
        // A failed read degrades to an empty slice (the dashboard renders
        // an honest "nothing to show" state), but it is never silent: the
        // real code/message/hint goes to the runtime logs, where an
        // operator can distinguish "no data" from "could not read data".
        logDataReadFailure("dashboard.snapshot.tasks", tasks.error);
        logDataReadFailure("dashboard.snapshot.projects", projects.error);
        logDataReadFailure("dashboard.snapshot.goals", goals.error);
        return {
          tasks: (tasks.data ?? []) as WorkspaceSnapshot["tasks"],
          projects: (projects.data ?? []) as WorkspaceSnapshot["projects"],
          goals: (goals.data ?? []) as WorkspaceSnapshot["goals"],
        };
      })()
    : Promise.resolve(emptySnapshot);

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

  // Active mission for the phone surface — best effort: the stored
  // state is read once, bounded, and a failure degrades to "no mission"
  // rather than holding the overview open. The controller is aborted on
  // timeout so a slow read is actually cancelled, not just abandoned.
  const missionReadController = new AbortController();
  const missionPromise: Promise<IntelligenceMission[]> = workspaceId
    ? withTimeout(
        Promise.resolve(
          readActiveMissions(supabase, workspaceId, user.id, missionReadController.signal)
        ),
        4_000,
        "MISSION_READ_TIMEOUT",
        missionReadController
      ).catch(() => [] as IntelligenceMission[])
    : Promise.resolve([]);

  const [
    snapshot,
    recentGoalsResult,
    recentActivitiesResult,
    missions,
  ] = await Promise.all([
    snapshotPromise,
    recentGoalsPromise,
    recentActivitiesPromise,
    missionPromise,
  ]);

  // The recent lists are decorative: a failure degrades to an empty list,
  // but is logged so a schema drift is visible before it is reported.
  logDataReadFailure("dashboard.recent_goals", recentGoalsResult.error);
  logDataReadFailure("dashboard.recent_activities", recentActivitiesResult.error);

  const context = describeWorkspace(snapshot);
  const activeMission = missions.length > 0 ? missions[0] : null;
  const insights = computeInsights(snapshot);
  const focus = nextBestAction(snapshot);
  const health = workspaceHealth(snapshot);
  // Dashboard 2.0 reads — all derived from the same snapshot, no new
  // queries and no parallel logic: the engine already computes them.
  const briefing = weeklyBriefing(snapshot);
  const forecasts = forecastWorkspace(snapshot);
  const priorities = rankPriorities(snapshot, 5);
  const completedTasks = snapshot.tasks.filter(
    (task) => task.status === "done"
  ).length;
  const activeGoals = snapshot.goals.filter(
    (goal) => goal.status !== "completed" && goal.status !== "archived"
  ).length;
  const needsAttention = insights
    .filter((insight) => insight.severity !== "positive")
    .slice(0, 4);

  const recentGoals = recentGoalsResult.data ?? [];
  const recentActivities = (recentActivitiesResult.data ?? []) as ActivityRow[];
  const activitiesUnavailable = Boolean(recentActivitiesResult.error);

  const workspaceName = workspace?.name ?? null;
  const showWorkspaceWarning = Boolean(
    membershipError || workspaceError || !workspaceId || !workspace
  );

  // FIRST-VISIT STATE — a brand-new workspace (no projects, tasks or goals)
  // gets a focused welcome instead of a wall of empty panels. The moment the
  // user creates the first thing NEXUS can understand, the full dashboard
  // appears.
  const isNewWorkspace =
    context.projects === 0 && context.tasks === 0 && context.goals === 0;

  const attentionLine =
    needsAttention.length > 0
      ? `${needsAttention.length} ${
          needsAttention.length === 1 ? "signal needs" : "signals need"
        } a decision.`
      : context.openTasks > 0
        ? "Nothing is at risk right now."
        : "No open tasks yet.";

  const onboardingStepsDone =
    1 +
    (profile.profileComplete ? 1 : 0) +
    (context.projects > 0 ? 1 : 0) +
    (context.tasks > 0 ? 1 : 0);

  // Current operating period, rendered from the server clock.
  const nowDate = new Date();
  const weekStart = new Date(nowDate);
  weekStart.setDate(nowDate.getDate() - ((nowDate.getDay() + 6) % 7));
  const periodLabel = `WEEK OF ${new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(weekStart).toUpperCase()}`;

  // UPCOMING — open tasks whose real due date lands inside 7 days,
  // read from the same snapshot (no extra query, no invented dates).
  const projectNameById = new Map(
    snapshot.projects.map((project) => [project.id, project.name])
  );
  const upcoming: UpcomingItem[] = snapshot.tasks
    .filter((task) => {
      if (!isActiveTask(task) || !task.due_at) return false;
      const due = new Date(task.due_at).getTime();
      if (Number.isNaN(due)) return false;
      return (
        due >= nowDate.getTime() && due <= nowDate.getTime() + 7 * 86_400_000
      );
    })
    .sort(
      (a, b) =>
        new Date(a.due_at as string).getTime() -
        new Date(b.due_at as string).getTime()
    )
    .slice(0, 5)
    .map((task) => ({
      id: task.id,
      title: task.title,
      dueAt: task.due_at as string,
      projectName: task.project_id
        ? projectNameById.get(task.project_id) ?? null
        : null,
    }));

  return (
    <div className="page-enter space-y-6" data-guide="dashboard">
      {/* OPERATIONAL SITUATION HEADER */}
      <header className="flex flex-col gap-4 border-b border-border-subtle pb-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-text-quaternary">
            <span className="flex items-center gap-1.5 text-text-tertiary">
              <span className="h-1.5 w-1.5 rounded-pill bg-lavender" aria-hidden="true" />
              NEXUS OPERATING SYSTEM
            </span>
            <span>·</span>
            <span>{workspaceName ?? "PERSONAL WORKSPACE"}</span>
            <span>·</span>
            <span className="text-success font-medium">LIVE READ</span>
            <span>·</span>
            <span>{periodLabel}</span>
          </div>

          <h1 className="mt-2 text-[26px] font-semibold leading-[32px] tracking-[-0.03em] text-text-primary sm:text-[30px]">
            {greeting(new Date())}
            {firstName ? `, ${firstName}` : ""}.
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-small">
            <span className="font-medium text-text-primary">
              {health.band === "steady"
                ? "Your workspace is steady."
                : health.band === "watch"
                  ? "Pressure is building in your workspace."
                  : "Attention needed today."}
            </span>
            <span className="hidden sm:inline text-text-quaternary">·</span>
            <span className="inline-flex items-center gap-1.5 text-text-secondary">
              Operational health:
              <span className="font-mono font-semibold text-text-primary tabular-nums">
                {health.score}
              </span>
              <Badge
                tone={
                  health.band === "critical"
                    ? "danger"
                    : health.band === "watch"
                      ? "warning"
                      : "success"
                }
              >
                {health.band.toUpperCase()}
              </Badge>
            </span>
            <span className="hidden sm:inline text-text-quaternary">·</span>
            <span className="text-text-tertiary">
              {needsAttention.length} {needsAttention.length === 1 ? "signal" : "signals"} · {context.dueThisWeek} approaching {context.dueThisWeek === 1 ? "deadline" : "deadlines"} · {context.blockedTasks} {context.blockedTasks === 1 ? "blocker" : "blockers"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/app/intelligence?ask=1"
            className="group inline-flex h-9 items-center gap-1.5 rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-colors duration-150 ease-nexus hover:border-border-strong hover:bg-accent-ghost hover:text-text-primary"
          >
            <NexusIcon icon={IconSparkles} className="text-lavender" />
            <span>Ask NEXUS</span>
            <kbd className="hidden font-mono text-[10px] text-text-quaternary sm:inline">⌘J</kbd>
          </Link>
          <Link
            href="/app/intelligence"
            className="group inline-flex h-9 items-center gap-1.5 rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg transition-colors duration-150 ease-nexus hover:bg-accent-hover"
          >
            <span>Open Intelligence</span>
            <NexusIcon
              icon={IconArrowRight}
              className="transition-transform duration-150 ease-nexus group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </header>

      {showWorkspaceWarning ? (
        <section className="overflow-hidden rounded-card border border-warning-border/40 bg-warning-bg/15 p-6 sm:p-8 animate-[intelligence-state-in_280ms_var(--ease-nexus)_both]">
          <div className="max-w-[620px]">
            <p className="eyebrow text-warning">Workspace not found</p>
            <h2 className="mt-2 text-h2 font-semibold text-text-primary">
              No active workspace yet
            </h2>
            <p className="mt-2 text-body text-text-secondary">
              Your session is not connected to a workspace. Retry the connection, or check your workspace settings.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <ButtonLink href="/dashboard" size="md">
                Retry connection
              </ButtonLink>
              <ButtonLink href="/settings?tab=workspace" variant="secondary" size="md">
                Workspace settings
              </ButtonLink>
            </div>
          </div>
        </section>
      ) : isNewWorkspace ? (
        <section className="overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/70 animate-[intelligence-state-in_280ms_var(--ease-nexus)_both]">
          <div className="px-6 py-8 sm:px-10 sm:py-12">
            <div className="max-w-[640px]">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-pill bg-lavender animate-pulse" aria-hidden="true" />
                <p className="eyebrow text-lavender">
                  Your workspace is ready · Setup ({onboardingStepsDone}/5)
                </p>
              </div>
              <h2 className="mt-2.5 text-[22px] font-semibold leading-[28px] tracking-[-0.025em] text-text-primary">
                Welcome to NEXUS.
              </h2>
              <p className="mt-2 text-body text-text-secondary">
                NEXUS reads your projects and tasks to detect risk and suggest what to do next. Complete these steps:
              </p>

              {/* 5-step progressive model */}
              <ul className="mt-5 space-y-2 rounded-card border border-border-subtle bg-bg-surface/50 p-3.5">
                <li className="flex items-center gap-3 text-small">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-success text-black font-semibold text-[11px]">
                    ✓
                  </span>
                  <span className="text-text-primary font-medium">01 Workspace</span>
                  <span className="text-text-secondary text-caption">Connected</span>
                  <span className="ml-auto font-mono text-mono text-text-quaternary">verified</span>
                </li>
                <li className="flex items-center gap-3 text-small">
                  {profile.profileComplete ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-success text-black font-semibold text-[11px]">
                      ✓
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border border-border-strong text-text-tertiary font-mono text-[10px]">
                      2
                    </span>
                  )}
                  <span className={profile.profileComplete ? "text-text-secondary line-through" : "text-text-primary font-medium"}>
                    02 Profile
                  </span>
                  <span className="text-text-secondary text-caption">Tell NEXUS who you are</span>
                  <span className="ml-auto font-mono text-mono text-text-quaternary">
                    {profile.profileComplete ? "done" : "identity"}
                  </span>
                </li>
                <li className="flex items-center gap-3 text-small">
                  {context.projects > 0 ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-success text-black font-semibold text-[11px]">
                      ✓
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border border-border-strong text-text-tertiary font-mono text-[10px]">
                      3
                    </span>
                  )}
                  <span className={context.projects > 0 ? "text-text-secondary line-through" : "text-text-primary font-medium"}>
                    03 Context
                  </span>
                  <span className="text-text-secondary text-caption">Add your first project</span>
                  <span className="ml-auto font-mono text-mono text-text-quaternary">
                    {context.projects > 0 ? "created" : "context"}
                  </span>
                </li>
                <li className="flex items-center gap-3 text-small">
                  {context.tasks > 0 ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-success text-black font-semibold text-[11px]">
                      ✓
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border border-border-strong text-text-tertiary font-mono text-[10px]">
                      4
                    </span>
                  )}
                  <span className={context.tasks > 0 ? "text-text-secondary line-through" : "text-text-primary font-medium"}>
                    04 Execution
                  </span>
                  <span className="text-text-secondary text-caption">Create your first task</span>
                  <span className="ml-auto font-mono text-mono text-text-quaternary">
                    {context.tasks > 0 ? "created" : "action"}
                  </span>
                </li>
                <li className="flex items-center gap-3 text-small">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border border-border-strong text-text-tertiary font-mono text-[10px]">
                    5
                  </span>
                  <span className="text-text-primary font-medium">
                    05 Intelligence
                  </span>
                  <span className="text-text-secondary text-caption">Ask NEXUS what matters</span>
                  <span className="ml-auto font-mono text-mono text-text-quaternary">
                    intelligence
                  </span>
                </li>
              </ul>

              {/* SINGLE DOMINANT PRIMARY CTA */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                {!profile.profileComplete ? (
                  <ButtonLink
                    href="/settings?tab=profile"
                    size="lg"
                  >
                    Set up your profile
                  </ButtonLink>
                ) : context.projects === 0 ? (
                  <ButtonLink
                    href="/projects?create=1"
                    size="lg"
                    data-guide="new-project"
                  >
                    <NexusIcon icon={IconLayoutKanban} />
                    Create your first project
                  </ButtonLink>
                ) : context.tasks === 0 ? (
                  <ButtonLink
                    href="/tasks?create=1"
                    size="lg"
                    data-guide="new-task"
                  >
                    <NexusIcon icon={IconChecklist} />
                    Create your first task
                  </ButtonLink>
                ) : (
                  <ButtonLink
                    href="/app/intelligence?ask=1"
                    size="lg"
                  >
                    <NexusIcon icon={IconSparkles} />
                    Ask NEXUS what matters
                  </ButtonLink>
                )}
                <Link
                  href="/app/intelligence"
                  className="group inline-flex items-center gap-1.5 text-small text-text-tertiary transition-colors duration-150 ease-nexus hover:text-text-primary px-1 py-1.5"
                >
                  Open Intelligence
                  <NexusIcon
                    icon={IconArrowRight}
                    px={13}
                    className="transition-transform duration-150 ease-nexus group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          {showWorkspaceWarning ? (
            <Alert tone="warning">
              No active workspace is linked to this account, so NEXUS has nothing
              to analyse yet.
            </Alert>
          ) : null}

          {/* PHONE SURFACE — attention → mission → next action →
              recent context → ask, rendered from the same reads as the
              desktop overview. Hidden from lg where the full overview
              stays the reference experience. */}
          <MobileOverview
            insights={needsAttention}
            focus={focus}
            mission={activeMission}
            recentActivities={recentActivities}
            activitiesUnavailable={activitiesUnavailable}
            context={context}
          />

          <div className="hidden space-y-6 lg:block">
            {/* KPI GRID — every number is a real Supabase count, and each
                card deep-links into the filtered view of that data. */}
            <KpiGrid
              items={[
                {
                  label: "Open tasks",
                  value: context.openTasks,
                  icon: IconListCheck,
                  href: "/tasks",
                  hint: "in progress",
                },
                {
                  label: "Completed",
                  value: completedTasks,
                  icon: IconCircleCheck,
                  href: "/tasks",
                  tone: "success",
                  hint: `${context.completionRate}% rate`,
                },
                {
                  label: "Overdue",
                  value: context.overdueTasks,
                  icon: IconCalendarClock,
                  href: "/tasks?filter=overdue",
                  tone: context.overdueTasks > 0 ? "danger" : "default",
                  hint: "past deadline",
                },
                {
                  label: "Blocked",
                  value: context.blockedTasks,
                  icon: IconBan,
                  href: "/tasks?filter=blocked",
                  tone: context.blockedTasks > 0 ? "warning" : "default",
                  hint: "waiting",
                },
                {
                  label: "Active projects",
                  value: context.activeProjects,
                  icon: IconLayoutKanban,
                  href: "/projects",
                  hint: "in flight",
                },
                {
                  label: "Active goals",
                  value: activeGoals,
                  icon: IconTarget,
                  href: "/goals",
                  tone: "accent",
                  hint: "tracked",
                },
              ]}
            />

            {/* LAYER 1 — SITUATION (Operational Diagnostic & Context Brief) */}
            <section
              aria-label="Workspace situation"
              className="overflow-hidden rounded-card border border-border-subtle bg-bg-surface/60 p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.5)] transition-[border-color] duration-200 ease-nexus hover:border-border-strong animate-[intelligence-state-in_280ms_var(--ease-nexus)_both]"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-pill",
                        health.band === "critical"
                          ? "bg-danger animate-pulse"
                          : health.band === "watch"
                            ? "bg-warning"
                            : "bg-success"
                      )}
                      aria-hidden="true"
                    />
                    <span className="eyebrow text-text-quaternary">
                      SITUATION · OPERATING INDEX
                    </span>
                  </div>
                  <span className="rounded-pill border border-border-subtle bg-bg-surface px-2.5 py-0.5 font-mono text-[11px] font-semibold text-text-primary tabular-nums">
                    {health.score}/100
                  </span>
                  <Badge
                    tone={
                      health.band === "critical"
                        ? "danger"
                        : health.band === "watch"
                          ? "warning"
                          : "success"
                    }
                  >
                    {health.band.toUpperCase()}
                  </Badge>
                </div>

                <span className="font-mono text-[11px] text-text-quaternary">
                  {context.projects} {context.projects === 1 ? "project" : "projects"} · {context.openTasks} open {context.openTasks === 1 ? "task" : "tasks"} · {context.goals} {context.goals === 1 ? "goal" : "goals"}
                </span>
              </div>

              <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div className="max-w-2xl">
                  <h2 className="text-h3 font-semibold text-text-primary">
                    {health.headline}
                  </h2>
                  <p className="mt-1 text-small text-text-secondary">
                    {attentionLine} {context.blockedTasks > 0 ? `${context.blockedTasks} tasks are blocked.` : "No blocked tasks."}
                  </p>
                </div>
              </div>

              {/* 4 Health Diagnostic Factor Pills */}
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-input border border-border-subtle bg-bg-subtle/50 p-2.5">
                <div className="min-w-0">
                  <span className="block truncate text-caption text-text-quaternary">
                    Deadlines
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block truncate font-mono text-body-medium font-medium",
                      context.overdueTasks > 0 ? "text-danger" : "text-text-primary"
                    )}
                  >
                    {context.overdueTasks > 0 ? `${context.overdueTasks} overdue` : "On schedule"}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-caption text-text-quaternary">
                    Blockers
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block truncate font-mono text-body-medium font-medium",
                      context.blockedTasks > 0 ? "text-warning" : "text-text-primary"
                    )}
                  >
                    {context.blockedTasks > 0 ? `${context.blockedTasks} blocked` : "Clear"}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-caption text-text-quaternary">
                    Projects
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-body-medium font-medium text-text-primary">
                    {context.projects > 0 ? `${context.projects} active` : "None"}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-caption text-text-quaternary">
                    Completed
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-body-medium font-medium text-text-primary">
                    {context.completionRate}%
                  </span>
                </div>
              </div>
            </section>

            {/* IF ACTIVE MISSION: SPOTLIGHT COMMAND CARD */}
            {activeMission && activeMission.status !== "completed" && activeMission.status !== "cancelled" ? (
              <section
                aria-label="Active mission"
                className="overflow-hidden rounded-card border-2 border-lavender-border/50 bg-bg-surface/90 p-5 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.6)] animate-[intelligence-state-in_280ms_var(--ease-nexus)_both]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-pill bg-lavender animate-pulse" aria-hidden="true" />
                    <span className="eyebrow text-lavender font-semibold tracking-wider">
                      ACTIVE MISSION IN PROGRESS
                    </span>
                    {activeMission.status === "blocked" ? (
                      <span className="rounded-[4px] border border-warning-border bg-warning-bg/40 px-1.5 py-0.5 font-mono text-[10px] uppercase text-warning">
                        Blocked
                      </span>
                    ) : null}
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
                    {activeMission.steps.filter((s) => s.status === "completed").length}/{activeMission.steps.length} steps completed ({activeMission.progress}%)
                  </span>
                </div>

                <div className="mt-3.5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-h2 font-semibold text-text-primary">
                      {activeMission.title}
                    </h3>
                    <p className="mt-1 text-small text-text-secondary leading-relaxed max-w-2xl">
                      {activeMission.objective}
                    </p>
                  </div>
                  <ButtonLink
                    href="/app/intelligence#mission"
                    size="md"
                    className="shrink-0 font-medium"
                  >
                    {activeMission.status === "blocked" ? "Unblock mission" : "Continue mission"}
                    <NexusIcon icon={IconArrowRight} />
                  </ButtonLink>
                </div>

                <div className="mt-3.5">
                  <Progress
                    value={activeMission.progress}
                    tone={activeMission.status === "blocked" ? "warning" : "white"}
                  />
                </div>
              </section>
            ) : null}

            {/* INTELLIGENCE — the decision centre of the workspace.
                Everything below this marker is produced by the NEXUS
                engine from real data: next best action, signals,
                briefing, priority queue. */}
            <div className="flex items-center gap-3 pt-1">
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-pill bg-lavender animate-pulse"
                  aria-hidden="true"
                />
                <span className="eyebrow text-lavender">
                  NEXUS INTELLIGENCE · DECISION CENTRE
                </span>
              </span>
              <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
            </div>

            {/* LAYER 3 & 4 — DECISION & EXECUTION (Single Dominant Next Best Action) */}
            <FocusPanel insight={focus} />

            {/* LAYER 2 — INTERPRETATION & WHAT MATTERS (Needs attention signals)
                paired with the weekly briefing column. */}
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="min-w-0 lg:col-span-2">
                <Panel
                  title="Needs your attention"
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
                    <NexusIcon icon={IconChecklist} />
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
              </div>

              <div className="space-y-5">
                <BriefingPanel briefing={briefing} />
              </div>
            </div>

            {/* LAYER 6 — GIVE NEXUS AN OBJECTIVE (Intention Command Strip) */}
            <section
              aria-label="Direct intelligence objective"
              className="overflow-hidden rounded-card border border-lavender-border/40 bg-lavender/5 p-5 transition-all duration-200 ease-nexus hover:border-lavender-border/70"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <NexusIcon icon={IconSparkles} className="text-lavender" />
                    <span className="eyebrow text-lavender">TELL NEXUS WHAT MATTERS</span>
                  </div>
                  <h3 className="mt-1 text-h3 font-semibold text-text-primary">
                    Tell NEXUS what you want done
                  </h3>
                  <p className="mt-0.5 text-small text-text-secondary">
                    State an objective. NEXUS reads the context, shows the risks and proposes a plan. It acts only with your confirmation.
                  </p>
                </div>
                <ButtonLink
                  href="/app/intelligence?ask=1"
                  size="md"
                  className="shrink-0"
                >
                  Open Command Center
                  <NexusIcon icon={IconArrowRight} />
                </ButtonLink>
              </div>

              {/* Natural Starters */}
              <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-lavender-border/20">
                <span className="font-mono text-[11px] text-text-quaternary uppercase tracking-wider">
                  Quick starters:
                </span>
                <Link
                  href="/app/intelligence?q=Aide-moi%20%C3%A0%20organiser%20cette%20semaine"
                  className="inline-flex min-h-[36px] items-center rounded-pill border border-border-subtle bg-bg-surface/80 px-3 text-caption text-text-secondary transition-colors hover:border-lavender-border hover:text-text-primary"
                >
                  Organiser cette semaine
                </Link>
                <Link
                  href="/app/intelligence?q=Quels%20projets%20n%C3%A9cessitent%20mon%20attention%20%3F"
                  className="inline-flex min-h-[36px] items-center rounded-pill border border-border-subtle bg-bg-surface/80 px-3 text-caption text-text-secondary transition-colors hover:border-lavender-border hover:text-text-primary"
                >
                  Quels projets nécessitent mon attention ?
                </Link>
                <Link
                  href="/app/intelligence?q=Quelles%20sont%20mes%203%20prochaines%20t%C3%A2ches%20prioritaires%20%3F"
                  className="inline-flex min-h-[36px] items-center rounded-pill border border-border-subtle bg-bg-surface/80 px-3 text-caption text-text-secondary transition-colors hover:border-lavender-border hover:text-text-primary"
                >
                  Mes 3 priorités immédiates
                </Link>
              </div>
            </section>

            {/* ACTIVE PROJECTS — health table computed by the
                forecast engine (real velocity, real projections). */}
            <ActiveProjectsPanel forecasts={forecasts} />

            {/* LAYER 5 & CONTEXT PILLARS (What Changed + Active Context) */}
            <div className="grid gap-5 lg:grid-cols-3">
              {/* Activity / Delta Column */}
              <div className="space-y-5 lg:col-span-2">
                <Panel
                  title="What changed · Recent activity"
                  description="Recent completions, status shifts, and updates verified in your workspace"
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

              {/* Context Pillars: Priorities, Upcoming & Goals */}
              <div className="space-y-5">
                <PriorityQueuePanel items={priorities} />

                <UpcomingPanel items={upcoming} />

                <Panel
                  title="Recent goals"
                  description="Outcomes with real progress"
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
                        title="Set your first goal"
                        description="A goal gives NEXUS an outcome to measure progress against."
                        icon={<NexusIcon icon={IconTarget} size="state" />}
                        action={
                          <Link
                            href="/goals?create=1"
                            className="inline-flex h-8 items-center rounded-input border border-border-default px-3 text-caption text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                          >
                            Set a goal
                          </Link>
                        }
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
                                  <p className="eyebrow mt-0.5 text-text-quaternary">
                                    Target: {formatDate(goal.target_date as string)}
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
                              className="mt-2"
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Panel>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

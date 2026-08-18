import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckSquare, FolderKanban, Target } from "lucide-react";
import { NexusShell } from "@/components/nexus-shell";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Card, SectionHeader } from "@/components/ui/card";
import { Alert, EmptyState, Progress } from "@/components/ui/feedback";
import { StatLine } from "@/components/ui/page-header";
import type { PlanName } from "@/lib/plan-limits";

type DashboardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  created_at: string;
};

type FocusTask = DashboardTask & {
  reason: "Overdue" | "Blocked" | "High priority";
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "No date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
  }).format(date);
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, username, bio, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return (
      <NexusShell title="Dashboard" userName="User">
        <Alert tone="danger">
          We could not load your profile right now. Please try again in a moment.
        </Alert>
      </NexusShell>
    );
  }

  const userName = profile?.display_name || profile?.username || user.email || "User";
  const username = profile?.username || undefined;

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const workspaceId = membership?.workspace_id ?? null;

  const { data: workspace, error: workspaceError } = workspaceId
    ? await supabase
        .from("workspaces")
        .select("id, name, slug, description, icon, color")
        .eq("id", workspaceId)
        .maybeSingle()
    : { data: null, error: null };

  const statsPromise = workspaceId
    ? (async () => {
        const [
          projectsResult,
          tasksResult,
          doneResult,
          activeResult,
          overdueResult,
          goalsResult,
          goalProgressResult,
        ] = await Promise.all([
          supabase.from("projects").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "done"),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .in("status", ["todo", "in_progress", "in_review", "blocked"]),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .lt("due_at", new Date().toISOString())
            .neq("status", "done"),
          supabase.from("goals").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          supabase.from("goals").select("progress").eq("workspace_id", workspaceId),
        ]);

        const goalProgressRows = goalProgressResult.data ?? [];
        const averageGoalProgress =
          goalProgressRows.length > 0
            ? goalProgressRows.reduce((sum: number, goal: { progress: number | string | null }) => {
                return sum + Number(goal.progress ?? 0);
              }, 0) / goalProgressRows.length
            : 0;

        return {
          projectTotal: projectsResult.count ?? 0,
          taskTotal: tasksResult.count ?? 0,
          completedTasks: doneResult.count ?? 0,
          activeTasks: activeResult.count ?? 0,
          overdueTasks: overdueResult.count ?? 0,
          goalsTotal: goalsResult.count ?? 0,
          averageGoalProgress,
        };
      })()
    : Promise.resolve({
        projectTotal: 0,
        taskTotal: 0,
        completedTasks: 0,
        activeTasks: 0,
        overdueTasks: 0,
        goalsTotal: 0,
        averageGoalProgress: 0,
      });

  const recentProjectsPromise = workspaceId
    ? supabase
        .from("projects")
        .select("id, name, status, progress, due_date, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(3)
    : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null });

  const activeTasksPromise = workspaceId
    ? supabase
        .from("tasks")
        .select("id, title, status, priority, due_at, created_at")
        .eq("workspace_id", workspaceId)
        .in("status", ["todo", "in_progress", "in_review", "blocked"])
        .order("created_at", { ascending: false })
        .limit(100)
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
        .select("id, entity_type, action, metadata, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(6)
    : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null });

  const subscriptionPromise = workspaceId
    ? supabase
        .from("workspace_subscriptions")
        .select("plan, status")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [
    stats,
    recentProjectsResult,
    activeTasksResult,
    recentGoalsResult,
    recentActivitiesResult,
    subscriptionResult,
  ] = await Promise.all([
    statsPromise,
    recentProjectsPromise,
    activeTasksPromise,
    recentGoalsPromise,
    recentActivitiesPromise,
    subscriptionPromise,
  ]);

  const projectTotal = stats.projectTotal;
  const activeTasks = stats.activeTasks;
  const goalsTotal = stats.goalsTotal;

  const recentProjects = recentProjectsResult.data ?? [];
  const activeTasksList = (activeTasksResult.data as DashboardTask[] | null) ?? [];
  const recentGoals = recentGoalsResult.data ?? [];
  const recentActivities = recentActivitiesResult.data ?? [];
  const currentPlan = ((subscriptionResult.data?.plan as PlanName) ?? "FREE") as PlanName;

  // ---- Focus Block ------------------------------------------------
  const nowStr = new Date().toISOString();

  const focusOverdue = activeTasksList.filter((task) => task.due_at && task.due_at < nowStr);

  const focusBlocked = activeTasksList.filter(
    (task) =>
      task.status === "blocked" &&
      !focusOverdue.some((overdueTask) => overdueTask.id === task.id)
  );

  const focusHighPriority = activeTasksList.filter(
    (task) =>
      (task.priority === "high" || task.priority === "urgent") &&
      !focusOverdue.some((overdueTask) => overdueTask.id === task.id) &&
      !focusBlocked.some((blockedTask) => blockedTask.id === task.id)
  );

  const focusItems: FocusTask[] = [
    ...focusOverdue.map((task): FocusTask => ({ ...task, reason: "Overdue" })),
    ...focusBlocked.map((task): FocusTask => ({ ...task, reason: "Blocked" })),
    ...focusHighPriority.map((task): FocusTask => ({ ...task, reason: "High priority" })),
  ].slice(0, 3);

  // ---- Priority list ----------------------------------------------
  const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };

  const priorityTasks = [...activeTasksList]
    .sort((a, b) => {
      const pA = priorityWeight[a.priority as keyof typeof priorityWeight] ?? 0;
      const pB = priorityWeight[b.priority as keyof typeof priorityWeight] ?? 0;
      if (pB !== pA) return pB - pA;
      if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      if (a.due_at) return -1;
      if (b.due_at) return 1;
      return 0;
    })
    .slice(0, 5);

  const todayFormatted = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "2-digit",
  })
    .format(new Date())
    .toUpperCase();

  const workspaceName = workspace?.name ?? "No workspace";
  const showWorkspaceWarning = Boolean(
    membershipError || workspaceError || !workspaceId || !workspace
  );

  return (
    <NexusShell title="Dashboard" userName={userName} username={username}>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-3 border-b border-border-subtle pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary">
              {todayFormatted}
            </p>
            <h1 className="mt-1.5 text-display text-text-primary">
              Bonjour, {userName}
            </h1>
            <p className="mt-1 text-small text-text-secondary">
              {focusItems.length > 0
                ? `${focusItems.length} ${focusItems.length === 1 ? "item needs" : "items need"} your attention today.`
                : "Everything is under control today."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {workspace ? (
              <span className="inline-flex h-[22px] items-center rounded-pill border border-border-default bg-bg-surface px-2 font-mono text-mono uppercase tracking-[0.04em] text-text-secondary">
                {workspaceName} · {membership?.role ?? "member"}
              </span>
            ) : null}
            <Link href="/upgrade" aria-label={`Current plan ${currentPlan} — see plans`}>
              <Badge tone={currentPlan === "FREE" ? "neutral" : "lavender"}>
                {currentPlan}
              </Badge>
            </Link>
          </div>
        </div>

        {showWorkspaceWarning ? (
          <Alert tone="warning">
            No active workspace is currently linked to this account.
          </Alert>
        ) : null}

        {/* FOCUS BLOCK */}
        <Card className="border-border-default p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-h2 text-text-primary">What needs attention today?</h2>
            <span className="font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary">
              Focus
            </span>
          </div>

          {focusItems.length === 0 ? (
            <div className="flex items-center gap-3 rounded-row bg-bg-surface px-3.5 py-3">
              <CheckSquare size={16} strokeWidth={1.75} className="text-success" />
              <div>
                <p className="text-body-medium text-text-primary">
                  Everything is under control.
                </p>
                <p className="text-caption text-text-tertiary">
                  Nothing urgent needs your attention right now.
                </p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {focusItems.map((task) => {
                const tone =
                  task.reason === "Overdue"
                    ? "danger"
                    : task.reason === "Blocked"
                      ? "warning"
                      : "lavender";

                return (
                  <li
                    key={task.id}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-row bg-bg-surface px-3.5 py-2 transition-colors duration-150 ease-nexus hover:bg-bg-surface-2"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Badge tone={tone}>{task.reason}</Badge>
                      <span className="truncate text-body text-text-primary">
                        {task.title}
                      </span>
                    </div>
                    {task.due_at ? (
                      <span className="shrink-0 font-mono text-mono tabular-nums text-text-tertiary">
                        {formatDate(task.due_at)}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* COMPACT STATS */}
        <StatLine
          items={[
            { value: activeTasks, label: "active tasks" },
            {
              value: stats.overdueTasks,
              label: "overdue",
              tone: stats.overdueTasks > 0 ? "danger" : "default",
            },
            { value: projectTotal, label: "projects" },
            { value: goalsTotal, label: "goals" },
            { value: `${Math.round(stats.averageGoalProgress)}%`, label: "goal progress" },
          ]}
        />

        {/* CONTENT GRID */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {/* PRIORITY TASKS */}
            <section>
              <SectionHeader
                eyebrow="Tasks"
                title="Priority"
                action={
                  <Link
                    href="/tasks"
                    className="text-caption text-text-secondary transition-colors duration-150 ease-nexus hover:text-text-primary"
                  >
                    View all
                  </Link>
                }
              />

              {priorityTasks.length === 0 ? (
                <EmptyState
                  title="No priority tasks"
                  description="Your queue is clear."
                  icon={<CheckSquare size={18} strokeWidth={1.75} />}
                />
              ) : (
                <ul className="flex flex-col">
                  {priorityTasks.map((task) => {
                    const overdue = Boolean(task.due_at && task.due_at < nowStr);

                    return (
                      <li
                        key={task.id}
                        className="flex h-11 items-center gap-3 rounded-row px-2.5 transition-colors duration-150 ease-nexus hover:bg-bg-surface"
                      >
                        <span
                          aria-hidden="true"
                          className="h-[18px] w-[18px] shrink-0 rounded-[6px] border border-border-strong"
                        />
                        <Link
                          href="/tasks"
                          className="min-w-0 flex-1 truncate text-body text-text-primary"
                        >
                          {task.title}
                        </Link>
                        <span className="hidden font-mono text-mono uppercase text-text-tertiary sm:block">
                          {task.priority}
                        </span>
                        <span
                          className={cn(
                            "w-14 shrink-0 text-right font-mono text-mono tabular-nums",
                            overdue ? "text-danger" : "text-text-tertiary"
                          )}
                        >
                          {task.due_at ? formatDate(task.due_at) : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* RECENT PROJECTS */}
            <section>
              <SectionHeader
                eyebrow="Projects"
                title="Recent"
                action={
                  <Link
                    href="/projects"
                    className="text-caption text-text-secondary transition-colors duration-150 ease-nexus hover:text-text-primary"
                  >
                    View all
                  </Link>
                }
              />

              {recentProjects.length === 0 ? (
                <EmptyState
                  title="No projects yet"
                  description="Create your first project to group your work."
                  icon={<FolderKanban size={18} strokeWidth={1.75} />}
                  action={
                    <Link
                      href="/projects?create=1"
                      className="text-small text-text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-text-primary"
                    >
                      Create a project
                    </Link>
                  }
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {recentProjects.map((project) => {
                    const progress = Math.min(
                      100,
                      Math.max(0, Number(project.progress ?? 0))
                    );

                    return (
                      <li key={project.id as string}>
                        <Link
                          href="/projects"
                          className="flex items-center gap-3 rounded-row px-2.5 py-2 transition-colors duration-150 ease-nexus hover:bg-bg-surface"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-bg-surface text-text-secondary">
                            <FolderKanban size={16} strokeWidth={1.75} />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body-medium text-text-primary">
                              {project.name as string}
                            </span>
                            <Progress
                              value={progress}
                              label={`${project.name as string} progress`}
                              className="mt-1.5"
                            />
                          </span>

                          <span className="shrink-0 text-right">
                            <span className="block font-mono text-mono tabular-nums text-text-secondary">
                              {progress}%
                            </span>
                            {project.due_date ? (
                              <span className="mt-0.5 block font-mono text-mono tabular-nums text-text-tertiary">
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
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-8">
            <section>
              <SectionHeader
                eyebrow="Goals"
                title="Objectives"
                action={
                  <Link
                    href="/goals"
                    className="text-caption text-text-secondary transition-colors duration-150 ease-nexus hover:text-text-primary"
                  >
                    View all
                  </Link>
                }
              />

              {recentGoals.length === 0 ? (
                <EmptyState
                  title="No goals yet"
                  description="Define what you are working towards."
                  icon={<Target size={18} strokeWidth={1.75} />}
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {recentGoals.map((goal) => {
                    const progress = Math.min(100, Math.max(0, Number(goal.progress ?? 0)));

                    return (
                      <li
                        key={goal.id as string}
                        className="rounded-[20px] border border-border-subtle bg-bg-subtle p-4 transition-colors duration-150 ease-nexus hover:border-border-default"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-body-medium text-text-primary">
                              {goal.title as string}
                            </p>
                            {goal.target_date ? (
                              <p className="mt-0.5 font-mono text-mono uppercase tabular-nums text-text-tertiary">
                                Target · {formatDate(goal.target_date as string)}
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
                          className="mt-3"
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <SectionHeader eyebrow="Activity" title="Recent" />

              {recentActivities.length === 0 ? (
                <EmptyState title="No recent activity" />
              ) : (
                <ul className="relative ml-1.5 space-y-3.5 border-l border-border-subtle py-1 pl-4">
                  {recentActivities.map((activity) => {
                    const metadata =
                      (activity.metadata as Record<string, unknown> | null) ?? {};
                    const label =
                      typeof metadata?.title === "string"
                        ? metadata.title
                        : typeof metadata?.name === "string"
                          ? metadata.name
                          : (activity.entity_type as string);

                    return (
                      <li key={activity.id as string} className="relative">
                        <span
                          aria-hidden="true"
                          className="absolute -left-[21px] top-1.5 h-1.5 w-1.5 rounded-pill bg-border-strong"
                        />
                        <p className="text-small text-text-primary">
                          <span className="capitalize">{activity.action as string}</span>
                          <span className="text-text-secondary"> · {label}</span>
                        </p>
                        <p className="mt-0.5 font-mono text-mono uppercase tabular-nums text-text-tertiary">
                          {activity.entity_type as string} /{" "}
                          {formatDate(activity.created_at as string)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </NexusShell>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { NexusShell } from "@/components/nexus-shell";
import { createClient } from "@/lib/supabase/server";
import { getProfileSummary } from "@/lib/profile";
import { collectWorkspaceIntel } from "@/lib/intelligence/server";
import type { Insight, Severity } from "@/lib/intelligence/engine";
import { CheckSquare, FolderKanban } from "lucide-react";

type DashboardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  created_at: string;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "No date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export default async function DashboardPage() {
  const summary = await getProfileSummary();

  if (!summary) {
    redirect("/login");
  }

  const supabase = await createClient();

  const userName = summary.displayName;
  const username = summary.username ?? undefined;

  const workspaceId = summary.workspaceId;

  const membership = workspaceId
    ? { workspace_id: workspaceId, role: summary.role, status: "active" as const }
    : null;

  const { data: workspace } = workspaceId
    ? await supabase
        .from("workspaces")
        .select("id, name, slug, description, icon, color")
        .eq("id", workspaceId)
        .maybeSingle()
    : { data: null };

  const statsPromise = workspaceId
    ? (async () => {
        const [projectsResult, tasksResult, doneResult, activeResult, overdueResult, goalsResult, goalProgressResult] =
          await Promise.all([
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

  const [stats, recentProjectsResult, activeTasksResult, recentGoalsResult, recentActivitiesResult] = await Promise.all([
    statsPromise,
    recentProjectsPromise,
    activeTasksPromise,
    recentGoalsPromise,
    recentActivitiesPromise,
  ]);

  const projectTotal = stats.projectTotal;
  const activeTasks = stats.activeTasks;
  const goalsTotal = stats.goalsTotal;

  const recentProjects = recentProjectsResult.data ?? [];
  const activeTasksList = (activeTasksResult.data as DashboardTask[] | null) ?? [];
  const recentGoals = recentGoalsResult.data ?? [];
  const recentActivities = recentActivitiesResult.data ?? [];

  // FOCUS (Level 1) — driven by the deterministic intelligence engine (P3)
  const intel = workspaceId ? await collectWorkspaceIntel(workspaceId) : null;
  const nextAction = intel?.result.nextAction ?? null;
  const topInsights: Insight[] = intel ? intel.result.insights.slice(0, 3) : [];
  const attentionCount = intel
    ? intel.result.insights.filter((item) => item.severity === "critical" || item.severity === "warning").length
    : 0;

  const SEVERITY_BADGE: Record<Severity, string> = {
    critical: "bg-danger-bg text-danger-fg border-danger-border",
    warning: "bg-warning-bg text-warning-fg border-warning-border",
    info: "bg-info-bg text-info-fg border-info-border",
    positive: "bg-success-bg text-success-fg border-success-border",
  };

  // Priority Tasks list (Level 3 Left)
  const priorityWeight = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  const priorityTasks = [...activeTasksList]
    .sort((a, b) => {
      const pA = priorityWeight[a.priority as keyof typeof priorityWeight] ?? 0;
      const pB = priorityWeight[b.priority as keyof typeof priorityWeight] ?? 0;
      if (pB !== pA) return pB - pA;
      // Secondary sort: due_at ascending
      if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      if (a.due_at) return -1;
      if (b.due_at) return 1;
      return 0;
    })
    .slice(0, 5);

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).toUpperCase();

  const workspaceName = workspace?.name ?? "No workspace";

  // The (app) layout already guarantees a verified workspace; this only
  // remains as a defensive net against mid-session data loss.
  const showWorkspaceWarning = !workspaceId || !workspace;

  return (
    <NexusShell title="Overview" userName={userName} username={username}>
      <div className="space-y-8">
        {/* HEADER GREETING */}
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between border-b border-border-subtle pb-6">
          <div>
            <div className="font-mono text-xs font-medium text-text-tertiary tracking-wider uppercase mb-1">
              {todayFormatted}
            </div>
            <p className="text-display font-semibold text-text-primary">
              Bonjour, {userName}
            </p>
            <p className="text-small text-text-secondary mt-1">
              {attentionCount > 0
                ? `${attentionCount} ${attentionCount === 1 ? "signal needs" : "signals need"} your arbitration today.`
                : "Nothing requires arbitration today."}
            </p>
          </div>
          {workspace && (
            <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary border border-border-default px-3 py-1.5 rounded bg-bg-surface">
              {workspaceName} · {membership?.role ?? "member"}
            </div>
          )}
        </div>

        {showWorkspaceWarning && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-small text-amber-200">
            No active workspace is currently linked to this account.
          </div>
        )}

        {/* LEVEL 1 — FOCUS BLOCK (next best action + its reason) */}
        <div className="rounded-xl border border-border-default bg-bg-surface-2 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-body font-semibold uppercase tracking-wide text-text-primary">
              What should you work on?
            </h2>
            <Link
              href="/intelligence"
              className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary transition-colors duration-[120ms] hover:text-text-primary"
            >
              All signals →
            </Link>
          </div>

          {nextAction ? (
            <div className="animate-rise-in mb-4 rounded-lg border border-volt-border bg-bg-surface p-4">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-volt">
                Next best action
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-body font-medium text-text-primary">
                    {nextAction.insight.title}
                  </div>
                  {/* The reason is ALWAYS displayed */}
                  <p className="mt-0.5 text-small text-text-secondary">
                    {nextAction.insight.reason}
                  </p>
                </div>
                <Link
                  href={nextAction.insight.href}
                  className="flex min-h-9 shrink-0 items-center justify-center rounded-md bg-accent-primary px-3 text-button font-medium text-accent-primary-fg transition-all duration-[120ms] ease-out hover:bg-accent-primary-hover active:scale-[0.98]"
                >
                  {nextAction.insight.cta}
                </Link>
              </div>
            </div>
          ) : null}

          {topInsights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border-default bg-bg-surface text-volt">
                <CheckSquare size={18} strokeWidth={1.75} />
              </div>
              <h3 className="text-body font-medium text-text-primary">
                Nothing requires arbitration.
              </h3>
              <p className="mt-1 text-xs text-text-secondary">
                No overdue, blocked or at-risk item. Give a project its next action while it is calm.
              </p>
            </div>
          ) : (
            <div className="stagger-list space-y-2">
              {topInsights.map((insight) => (
                <Link
                  key={insight.id}
                  href={insight.href}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-surface px-4 py-3 transition-all duration-[160ms] ease-out hover:border-border-strong hover:bg-bg-surface-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider ${SEVERITY_BADGE[insight.severity]}`}
                    >
                      {insight.signal.replace(/_/g, " ")}
                    </span>
                    <span className="truncate text-body font-medium text-text-primary">
                      {insight.title}
                    </span>
                  </div>
                  <span className="hidden shrink-0 font-mono text-xs text-text-tertiary transition-colors duration-[120ms] group-hover:text-text-primary md:block">
                    {insight.cta}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* LEVEL 2 — COMPACT STATS */}
        <div className="flex items-center gap-2 border-y border-border-subtle py-3 text-small text-text-secondary">
          <span className="font-mono font-medium text-text-primary">{activeTasks}</span> active tasks
          <span className="text-text-quaternary font-mono">·</span>
          <span className="font-mono font-medium text-text-primary">{projectTotal}</span> projects
          <span className="text-text-quaternary font-mono">·</span>
          <span className="font-mono font-medium text-text-primary">{goalsTotal}</span> goals
        </div>

        {/* LEVEL 3 — CONTENT 2-COLUMN GRID */}
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* LEFT COLUMN */}
          <div className="space-y-8">
            {/* PRIORITY TASKS */}
            <div>
              <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-h3-mono uppercase tracking-wider text-text-tertiary">Tasks</span>
                  <span className="text-text-quaternary font-mono">/</span>
                  <h3 className="text-body font-semibold text-text-primary">Priority</h3>
                </div>
                <Link href="/tasks" className="text-xs text-text-secondary hover:text-text-primary transition duration-120">
                  View all
                </Link>
              </div>

              {priorityTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-default p-6 text-center text-small text-text-secondary">
                  No priority tasks. Your mind is clear.
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {priorityTasks.map((task) => {
                    let dotColor = "bg-text-quaternary";
                    if (task.priority === "urgent" || task.priority === "high") {
                      dotColor = "bg-danger-fg";
                    } else if (task.priority === "medium") {
                      dotColor = "bg-warning-fg";
                    }

                    return (
                      <div key={task.id} className="flex h-11 items-center justify-between gap-4 py-2 hover:bg-bg-subtle/30 px-2 rounded transition duration-120">
                        <div className="flex items-center gap-3">
                          <div className="h-[18px] w-[18px] shrink-0 rounded-[6px] border border-border-strong" />
                          <span className="text-body text-text-primary line-clamp-1">{task.title}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                            <span className="font-mono text-[10px] text-text-tertiary capitalize">{task.priority}</span>
                          </div>
                          {task.due_at && (
                            <span className="font-mono text-[11px] text-text-tertiary">
                              {formatDate(task.due_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RECENT PROJECTS */}
            <div>
              <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-h3-mono uppercase tracking-wider text-text-tertiary">Projects</span>
                  <span className="text-text-quaternary font-mono">/</span>
                  <h3 className="text-body font-semibold text-text-primary">Recent</h3>
                </div>
                <Link href="/projects" className="text-xs text-text-secondary hover:text-text-primary transition duration-120">
                  View all
                </Link>
              </div>

              {recentProjects.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-default p-6 text-center text-small text-text-secondary">
                  No projects yet. <Link href="/projects" className="text-text-primary underline decoration-border-strong hover:decoration-text-primary transition">Create your first project</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentProjects.map((project) => {
                    const progress = Math.min(100, Math.max(0, Number(project.progress ?? 0)));
                    return (
                      <div
                        key={project.id}
                        className="group relative flex h-14 flex-col justify-between overflow-hidden rounded-lg border border-border-subtle bg-bg-surface px-4 py-3 transition duration-120 hover:border-border-strong"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-border-default bg-bg-surface-2 text-text-secondary group-hover:text-text-primary transition duration-120">
                              <FolderKanban size={15} strokeWidth={1.75} />
                            </div>
                            <div>
                              <div className="text-body font-medium text-text-primary leading-tight">{project.name}</div>
                              <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mt-0.5">{project.status}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-small text-text-secondary">{progress}%</span>
                            {project.due_date && (
                              <div className="font-mono text-[10px] text-text-tertiary mt-0.5">
                                {formatDate(project.due_date)}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Integrated bottom progress bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-border-default">
                          <div
                            className="h-full bg-accent transition-all duration-600 ease-out"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-8">
            {/* GOALS */}
            <div>
              <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-h3-mono uppercase tracking-wider text-text-tertiary">Goals</span>
                  <span className="text-text-quaternary font-mono">/</span>
                  <h3 className="text-body font-semibold text-text-primary">Objectives</h3>
                </div>
                <Link href="/goals" className="text-xs text-text-secondary hover:text-text-primary transition duration-120">
                  View all
                </Link>
              </div>

              {recentGoals.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-default p-6 text-center text-small text-text-secondary">
                  No goals yet. <Link href="/goals" className="text-text-primary underline decoration-border-strong hover:decoration-text-primary transition">Set your first goal</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentGoals.map((goal) => {
                    const progress = Math.min(100, Math.max(0, Number(goal.progress ?? 0)));
                    return (
                      <div key={goal.id} className="rounded-lg border border-border-subtle bg-bg-surface p-4 transition duration-120 hover:border-border-strong">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-body-medium font-medium text-text-primary leading-tight">{goal.title}</h4>
                            {goal.target_date && (
                              <span className="font-mono text-[10px] text-text-tertiary block mt-1 uppercase">
                                Target: {formatDate(goal.target_date)}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-small font-semibold text-text-primary">{progress}%</span>
                        </div>
                        
                        {/* Linear progress bar for goal (Volt #D2FF4D) */}
                        <div className="mt-3 h-1 overflow-hidden rounded-full bg-border-default">
                          <div
                            className="h-full bg-volt shadow-[0_0_8px_rgba(210,255,77,0.4)] transition-all duration-600 ease-out"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RECENT ACTIVITY */}
            <div>
              <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-h3-mono uppercase tracking-wider text-text-tertiary">Activity</span>
                  <span className="text-text-quaternary font-mono">/</span>
                  <h3 className="text-body font-semibold text-text-primary">Recent</h3>
                </div>
              </div>

              {recentActivities.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-default p-6 text-center text-small text-text-secondary">
                  No recent activity.
                </div>
              ) : (
                <div className="relative pl-4 border-l border-border-subtle ml-2 space-y-4 py-1">
                  {recentActivities.map((activity) => {
                    const metadata = activity.metadata ?? {};
                    const label =
                      typeof metadata?.title === "string"
                        ? metadata.title
                        : typeof metadata?.name === "string"
                          ? metadata.name
                          : activity.entity_type;
                    
                    const isVolt = activity.action?.toLowerCase().includes("create") || 
                                   activity.action?.toLowerCase().includes("complete") ||
                                   activity.action?.toLowerCase().includes("done");

                    return (
                      <div key={activity.id} className="relative group">
                        {/* Timeline Dot */}
                        <span
                          className={`absolute -left-[21px] top-1.5 h-1.5 w-1.5 rounded-full border border-bg-base transition duration-120 ${
                            isVolt ? "bg-volt shadow-[0_0_4px_rgba(210,255,77,0.5)]" : "bg-border-strong group-hover:bg-text-secondary"
                          }`}
                        />
                        
                        <div className="text-xs">
                          <div className="font-medium text-text-primary">
                            <span className="capitalize">{activity.action}</span>
                            <span className="text-text-secondary"> · {label}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-text-tertiary uppercase font-mono">
                            <span>{activity.entity_type}</span>
                            <span>/</span>
                            <span>{formatDate(activity.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </NexusShell>
  );
}

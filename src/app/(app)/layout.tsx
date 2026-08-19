import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getProfileSummary, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/workspace";
import { DEFAULT_PLAN, PLAN_LIMITS, type PlanName } from "@/lib/plan-limits";

// ============================================================
// AUTHENTICATED SHELL LAYOUT
// Resolves the signed-in user, their workspace, the live navigation
// counters and the plan usage ONCE for every product route, instead of
// repeating the same queries in each page.
// Every value here comes from Supabase — nothing is hardcoded.
// ============================================================

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const profile = await getProfileSummary();

  // Signup -> onboarding -> workspace -> dashboard: the product stays behind
  // a completed profile. /onboarding sends completed users straight back here.
  if (!profile.onboardingCompleted) {
    redirect("/onboarding");
  }

  const supabase = await createClient();

  const { membership } = await getActiveMembership(supabase, user.id);
  const workspaceId = membership?.workspaceId ?? null;

  const emptyCounts = {
    tasks: 0,
    projects: 0,
    goals: 0,
    unreadNotifications: 0,
  };

  const [counts, workspace, subscription] = await Promise.all([
    workspaceId
      ? (async () => {
          const [tasks, projects, goals, unread] = await Promise.all([
            supabase
              .from("tasks")
              .select("id", { count: "exact", head: true })
              .eq("workspace_id", workspaceId)
              .in("status", ["todo", "in_progress", "in_review", "blocked"]),
            supabase
              .from("projects")
              .select("id", { count: "exact", head: true })
              .eq("workspace_id", workspaceId),
            supabase
              .from("goals")
              .select("id", { count: "exact", head: true })
              .eq("workspace_id", workspaceId),
            supabase
              .from("notifications")
              .select("id", { count: "exact", head: true })
              .eq("workspace_id", workspaceId)
              .eq("user_id", user.id)
              .is("read_at", null),
          ]);

          return {
            tasks: tasks.count ?? 0,
            projects: projects.count ?? 0,
            goals: goals.count ?? 0,
            unreadNotifications: unread.count ?? 0,
          };
        })()
      : Promise.resolve(emptyCounts),
    workspaceId
      ? supabase
          .from("workspaces")
          .select("name")
          .eq("id", workspaceId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    workspaceId
      ? supabase
          .from("workspace_subscriptions")
          .select("plan")
          .eq("workspace_id", workspaceId)
          .eq("status", "active")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const plan = ((subscription?.data?.plan as PlanName) ?? DEFAULT_PLAN) as PlanName;
  const limits = PLAN_LIMITS[plan];

  return (
    <AppShell
      user={{
        name: profile.displayName,
        username: profile.username,
        email: profile.email,
      }}
      workspace={{
        name: (workspace?.data?.name as string | undefined) ?? null,
        role: membership?.role ?? null,
      }}
      counts={counts}
      plan={{
        name: plan,
        projectsUsed: counts.projects,
        projectsLimit: limits.projects,
        tasksUsed: counts.tasks,
        tasksLimit: limits.activeTasks,
        goalsUsed: counts.goals,
        goalsLimit: limits.goals,
      }}
    >
      {children}
    </AppShell>
  );
}

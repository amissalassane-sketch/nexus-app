import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getProfileSummary, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/workspace";
import { DEFAULT_PLAN, PLAN_LIMITS, type PlanName } from "@/lib/plan-limits";
import {
  ensurePersonalWorkspaceServer,
  ensureProfileServer,
} from "@/lib/auth-flow";

// ============================================================
// AUTHENTICATED SHELL LAYOUT
// Resolves the signed-in user, their workspace, the live navigation
// counters and the plan usage ONCE for every product route.
//
// Before rendering:
//  1. Require authenticated user
//  2. Ensure profile exists (orphan repair)
//  3. Ensure workspace + membership exist (idempotent bootstrap)
//  4. Check onboarding state — redirect to /onboarding if incomplete
//  5. Render the app shell with live workspace data
// ============================================================

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  const supabase = await createClient();

  // Step 1: Ensure profile exists (orphan repair)
  await ensureProfileServer(supabase, user.id, user.email);

  // Step 2: Ensure workspace + membership exist (idempotent bootstrap)
  await ensurePersonalWorkspaceServer(supabase);

  // Step 3: Get profile summary (onboarding state)
  const profile = await getProfileSummary();

  // Step 4: If onboarding incomplete, redirect to /onboarding
  if (!profile.onboardingCompleted) {
    redirect("/onboarding");
  }

  // Step 5: Resolve active workspace for the shell
  const { membership } = await getActiveMembership(supabase, user.id);

  // Double-check: if no active workspace despite bootstrap, redirect to onboarding
  if (!membership?.workspaceId) {
    redirect("/onboarding");
  }

  const workspaceId = membership.workspaceId;

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

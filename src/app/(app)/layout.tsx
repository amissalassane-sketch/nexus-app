import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { WorkspaceStatusBanner } from "@/components/workspace-status-banner";
import { getProfileSummary, requireUser, type ProfileSummary } from "@/lib/auth";
import {
  ensurePersonalWorkspaceServer,
  ensureProfileServer,
  withTimeout,
} from "@/lib/auth-flow";
import {
  logBootstrapEvent,
  summarizeError,
} from "@/lib/bootstrap-diagnostics";
import { createClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/workspace";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import { effectivePlanOf } from "@/lib/billing/subscription-state";

// ============================================================
// AUTHENTICATED SHELL LAYOUT (ACCESS FIRST)
// Resolves the signed-in user, their workspace, the live navigation
// counters and the plan usage ONCE for every product route.
//
// THE PRODUCT IS NEVER BLOCKED ON WORKSPACE STATE.
//
// Before rendering:
//  1. Require authenticated user (the ONLY hard gate)
//  2. Ensure profile exists (orphan repair — minimal record, no
//     invented identity) — best effort, never fatal
//  3. Ensure workspace + membership exist (idempotent, BOUNDED
//     bootstrap) — best effort: a failure must not hold /app open
//  4. Resolve the active membership through RLS (the read every
//     workspace-scoped query relies on)
//  5. If the bootstrap could not be verified this request, render
//     the FULL app shell with a controlled, in-product
//     "workspace is being prepared" state (with Retry / Continue)
//     and a bounded automatic retry — never a dedicated waiting
//     screen, never a form, never a redirect.
//
// Profile completeness is read and passed to the shell purely as UI
// guidance (the optional completion prompt). It never blocks rendering.
// ============================================================

/** Bounded settle window for a transient first-load race (e.g. the signup
 *  transaction's advisory lock still being committed while the first /app
 *  request boots the RPC). One extra bounded attempt — not a loop. */
const BOOTSTRAP_RETRY_SETTLE_MS = 750;

/** Hard bound on the shell's decorative reads (counts, name, plan). The
 *  product must never be held open on a workspace data read. */
const SHELL_DATA_TIMEOUT_MS = 8_000;

/** Hard bound on the RLS membership read. A stall degrades to the banner
 *  state (with Retry), never to an open-ended page. */
const MEMBERSHIP_READ_TIMEOUT_MS = 5_000;

async function boundedMembershipRead(
  supabase: Parameters<typeof getActiveMembership>[0],
  userId: string
) {
  try {
    // Real cancellation: the controller's signal is attached to the
    // actual PostgREST request inside getActiveMembership(), so a
    // timeout here aborts the in-flight request instead of leaving it
    // running against Postgres after this function has already returned
    // a degraded result to the caller.
    const controller = new AbortController();
    return await withTimeout(
      Promise.resolve(getActiveMembership(supabase, userId, controller.signal)),
      MEMBERSHIP_READ_TIMEOUT_MS,
      "MEMBERSHIP_READ_TIMEOUT",
      controller
    );
  } catch (cause) {
    logBootstrapEvent("MEMBERSHIP_READ_FAILED", {
      ...summarizeError(cause),
    });
    return { membership: null, error: "timeout" } as const;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  const supabase = await createClient();

  // Step 1: ensure profile exists (orphan repair, minimal record).
  // Best effort: a profile hiccup must never keep the product closed.
  await ensureProfileServer(supabase, user.id);

  // Step 2: ensure workspace + membership exist (idempotent, bounded).
  let bootstrap = await ensurePersonalWorkspaceServer(supabase);
  const activeRead = await boundedMembershipRead(supabase, user.id);
  let activeMembership = activeRead.membership;

  // Step 3: ONE bounded retry when the context is not yet visible.
  // This absorbs the only legitimate transient: concurrent first loads
  // racing the signup/bootstrap commit (the advisory lock serializes
  // them — the loser sees the winner's rows as soon as it re-reads).
  //
  // If the RPC already returned a structured error we do NOT repeat the
  // full bootstrap (a timeout would simply wait out another 8s lock
  // window); we only re-read the membership through RLS, which is cheap.
  if (!bootstrap.membership || !activeMembership?.workspaceId) {
    await new Promise((resolve) => setTimeout(resolve, BOOTSTRAP_RETRY_SETTLE_MS));
    if (!bootstrap.error) {
      const bootstrapRetry = await ensurePersonalWorkspaceServer(supabase);
      if (bootstrapRetry.membership) {
        bootstrap = bootstrapRetry;
      } else {
        bootstrap = { membership: null, error: bootstrapRetry.error };
      }
    }
    const activeRetry = await boundedMembershipRead(supabase, user.id);
    if (activeRetry.membership) {
      activeMembership = activeRetry.membership;
    }
  }

  const workspaceReady =
    Boolean(bootstrap.membership) && Boolean(activeMembership?.workspaceId);

  if (!workspaceReady) {
    logBootstrapEvent("DASHBOARD_RENDER_DEGRADED", {
      userId: user.id,
      bootstrapError: bootstrap.error,
      membershipReadError: activeRead.error,
    });
  }

  // Step 4: profile summary — drives the shell UI, never access.
  // getProfileSummary() is self-bounded (real AbortController-based
  // timeout inside src/lib/auth.ts) and already degrades to a fallback
  // identity on its own, so it is not wrapped in a second, non-cancelling
  // withTimeout() here — that would only re-introduce an orphaned-request
  // race on top of a call that already protects itself correctly.
  const profile: ProfileSummary = await getProfileSummary();

  // Step 5: workspace context. Only the RLS-verified membership is used:
  // every workspace-scoped read below is subject to the same RLS, so a
  // workspace id the RLS layer cannot see would only produce an empty
  // dashboard — the banner state is more honest.
  const workspaceId = activeMembership?.workspaceId ?? null;

  const emptyCounts = {
    tasks: 0,
    projects: 0,
    goals: 0,
    unreadNotifications: 0,
  };

  // All shell data is read-only and degrades gracefully: if the read cannot
  // complete in time we render the shell with empty counts / default plan
  // rather than holding the page open. The workspace context itself was
  // already verified above; these reads only decorate the shell.
  //
  // One shared controller for all six queries: they are bounded by the
  // same SHELL_DATA_TIMEOUT_MS window, so a single timeout firing must
  // abort every one of them at once instead of leaving the slow ones
  // running against Postgres after the caller has already moved on.
  const shellDataController = new AbortController();
  const shellData = await withTimeout(
    Promise.all([
      workspaceId
        ? (async () => {
            const [tasks, projects, goals, unread] = await Promise.all([
              supabase
                .from("tasks")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", workspaceId)
                .in("status", ["todo", "in_progress", "in_review", "blocked"])
                .abortSignal(shellDataController.signal),
              supabase
                .from("projects")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", workspaceId)
                .abortSignal(shellDataController.signal),
              supabase
                .from("goals")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", workspaceId)
                .abortSignal(shellDataController.signal),
              supabase
                .from("notifications")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", workspaceId)
                .eq("user_id", user.id)
                .is("read_at", null)
                .abortSignal(shellDataController.signal),
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
            .abortSignal(shellDataController.signal)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      workspaceId
        ? supabase
            .from("workspace_subscriptions")
            .select("plan, status, current_period_end")
            .eq("workspace_id", workspaceId)
            .eq("status", "active")
            .abortSignal(shellDataController.signal)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]),
    SHELL_DATA_TIMEOUT_MS,
    "SHELL_DATA_TIMEOUT",
    shellDataController
  ).catch((cause) => {
    logBootstrapEvent("SHELL_DATA_DEGRADED", {
      userId: user.id,
      ...summarizeError(cause),
    });
    return [emptyCounts, { data: null }, { data: null }] as const;
  });

  const [counts, workspace, subscription] = shellData;

  // Same resolution as get_workspace_plan(): a lapsed 'active' row (or any
  // incoherent value) displays FREE, matching what the write guards enforce.
  const plan = effectivePlanOf(subscription?.data);
  const limits = PLAN_LIMITS[plan];

  logBootstrapEvent("DASHBOARD_RENDER_STARTED", {
    userId: user.id,
    workspaceReady,
    workspaceId,
  });

  const workspaceStatus: "ready" | "preparing" | "failed" = workspaceReady
    ? "ready"
    : bootstrap.error
      ? "failed"
      : "preparing";

  return (
    <AppShell
      userId={user.id}
      workspaceId={workspaceId}
      user={{
        name: profile.displayName,
        username: profile.username ?? undefined,
        email: profile.email,
        profileComplete: profile.profileComplete,
      }}
      workspace={{
        name: (workspace?.data?.name as string | undefined) ?? null,
        role: activeMembership?.role ?? null,
        status: workspaceStatus,
        errorKind: bootstrap.error ?? null,
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
      {workspaceReady ? null : (
        <WorkspaceStatusBanner
          state={bootstrap.error ? "failed" : "preparing"}
          errorKind={bootstrap.error}
        />
      )}
      {children}
    </AppShell>
  );
}

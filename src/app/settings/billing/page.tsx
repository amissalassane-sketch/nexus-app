import { redirect } from "next/navigation";
import Link from "next/link";
import { NexusShell } from "@/components/nexus-shell";
import { BillingUpgradeButton } from "@/components/billing-upgrade-button";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS, type PlanName } from "@/lib/plan-limits";

export default async function BillingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  const userName = profile?.display_name || profile?.username || user.email || "User";
  const username = profile?.username || undefined;

  // Get active workspace
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const workspaceId = membership?.workspace_id ?? null;

  // Get subscription
  const { data: subscription } = workspaceId
    ? await supabase
        .from("workspace_subscriptions")
        .select("plan, status, trial_ends_at, current_period_end")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };

  const currentPlan = ((subscription?.plan as PlanName) ?? "FREE");
  type LimitResourceKey = keyof (typeof PLAN_LIMITS)[PlanName];

  // Get usage via RPC
  type UsageResult = {
    plan: string;
    usage: { projects: number; active_tasks: number; goals: number; members: number };
    limits: { projects: number; active_tasks: number; goals: number; members: number };
  };

  let usage: UsageResult | null = null;
  if (workspaceId) {
    const { data } = await supabase.rpc("get_workspace_usage", {
      p_workspace_id: workspaceId,
    });
    usage = data as UsageResult | null;
  }

  const resources: { label: string; key: LimitResourceKey; usageKey: string }[] = [
    { label: "Projects", key: "projects", usageKey: "projects" },
    { label: "Active tasks", key: "activeTasks", usageKey: "active_tasks" },
    { label: "Goals", key: "goals", usageKey: "goals" },
    { label: "Members", key: "members", usageKey: "members" },
  ];

  const plans: PlanName[] = ["FREE", "PRO", "TEAM"];

  return (
    <NexusShell title="Billing" subtitle="Manage your plan and usage." userName={userName} username={username}>
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Current plan */}
        <div className="rounded-xl border border-border-default bg-bg-surface p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Current plan</div>
              <h2 className="text-display font-semibold text-text-primary">{currentPlan}</h2>
              {subscription?.status && (
                <p className="text-small text-text-secondary mt-1 capitalize">{subscription.status}</p>
              )}
            </div>
            <span className="rounded-md border border-border-default bg-bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-secondary">
              Workspace-scoped
            </span>
          </div>
        </div>

        {/* Usage */}
        {usage && (
          <div className="rounded-xl border border-border-default bg-bg-surface p-6">
            <h3 className="text-body font-semibold text-text-primary mb-4">Usage</h3>
            <div className="space-y-4">
              {resources.map(({ label, key, usageKey }) => {
                const current = (usage!.usage as Record<string, number>)[usageKey] ?? 0;
                const limit = (usage!.limits as Record<string, number>)[usageKey] ?? 0;
                const pct = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
                const isNear = pct >= 80;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-small mb-1">
                      <span className="text-text-secondary">{label}</span>
                      <span className="font-mono text-text-primary">
                        {current} / {limit}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-border-default">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isNear ? "bg-amber-400" : "bg-volt"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Plan comparison */}
        <div>
          <h3 className="text-body font-semibold text-text-primary mb-4">Plans</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {plans.map((plan) => {
              const planLimits = PLAN_LIMITS[plan];
              const isCurrent = plan === currentPlan;
              return (
                <div
                  key={plan}
                  className={`rounded-xl border p-5 ${
                    isCurrent
                      ? "border-border-strong bg-bg-surface-2"
                      : "border-border-default bg-bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-text-primary">{plan}</span>
                    {isCurrent && (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-volt border border-volt/30 rounded px-1.5 py-0.5">
                        Active
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1 text-small text-text-secondary">
                    <li><span className="font-mono text-text-primary">{planLimits.projects}</span> projects</li>
                    <li><span className="font-mono text-text-primary">{planLimits.activeTasks}</span> active tasks</li>
                    <li><span className="font-mono text-text-primary">{planLimits.goals}</span> goals</li>
                    <li><span className="font-mono text-text-primary">{planLimits.members}</span> member{planLimits.members !== 1 ? "s" : ""}</li>
                  </ul>
                  {!isCurrent && <BillingUpgradeButton targetPlan={plan} />}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-text-tertiary">
            Payment integration is isolated behind a server route and ready for FedaPay wiring.
            No API secret is exposed to the frontend.
          </p>
        </div>

        <div className="flex justify-start">
          <Link
            href="/settings"
            className="text-small text-text-secondary hover:text-text-primary transition"
          >
            ? Back to settings
          </Link>
        </div>
      </div>
    </NexusShell>
  );
}

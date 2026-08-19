import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NexusShell } from "@/components/nexus-shell";
import { BillingUpgradeButton } from "@/components/billing-upgrade-button";
import { createClient } from "@/lib/supabase/server";
import { getProfileSummary } from "@/lib/profile";
import { PLAN_LIMITS, type PlanName } from "@/lib/plan-limits";

// ============================================================
// NEXUS — BILLING (P4 design QA)
//  - Full-width column (no max-w-3xl orphan block)
//  - Equal-height plan cards, CTAs anchored at the bottom
//  - FREE price reads "Free · forever" — never an orphan "0"
//  - One single permission note under the whole grid
// ============================================================

export default async function BillingPage() {
  const summary = await getProfileSummary();

  if (!summary) redirect("/login");

  const supabase = await createClient();

  const userName = summary.displayName;
  const username = summary.username ?? undefined;
  const workspaceId = summary.workspaceId;

  // Get subscription
  const { data: subscription } = workspaceId
    ? await supabase
        .from("workspace_subscriptions")
        .select("plan, status, trial_ends_at, current_period_end")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };

  const currentPlan = ((subscription?.plan as PlanName) ?? "FREE") as PlanName;
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

  const plans: { plan: PlanName; price: string; priceSuffix: string }[] = [
    { plan: "FREE", price: "Free", priceSuffix: "forever" },
    { plan: "PRO", price: "—", priceSuffix: "at checkout" },
    { plan: "TEAM", price: "—", priceSuffix: "at checkout" },
  ];

  return (
    <NexusShell title="Billing" subtitle="Manage your plan and usage." userName={userName} username={username}>
      <div className="space-y-6">
        {/* Current plan */}
        <div className="rounded-xl border border-border-default bg-bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
                Current plan
              </div>
              <div className="text-h2 font-semibold text-text-primary">{currentPlan}</div>
              {subscription?.status ? (
                <p className="mt-1 text-small capitalize text-text-secondary">{subscription.status}</p>
              ) : (
                <p className="mt-1 text-small text-text-secondary">
                  Default FREE plan — active since workspace creation.
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-md border border-border-default bg-bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-secondary">
                {summary.workspaceName ?? "Workspace"}
              </span>
              <span className="rounded-md border border-border-default bg-bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-secondary">
                {summary.role ?? "member"}
              </span>
            </div>
          </div>
        </div>

        {/* Usage */}
        {usage ? (
          <div className="rounded-xl border border-border-default bg-bg-surface p-5">
            <h2 className="mb-4 text-body font-semibold text-text-primary">Usage</h2>
            <div className="space-y-4">
              {resources.map(({ label, key, usageKey }) => {
                const current = (usage!.usage as Record<string, number>)[usageKey] ?? 0;
                const limit = (usage!.limits as Record<string, number>)[usageKey] ?? 0;
                const pct = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
                const isNear = pct >= 80;
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between text-small">
                      <span className="text-text-secondary">{label}</span>
                      <span className="font-mono text-text-primary">
                        {current} / {limit}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-bg-surface-3">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          isNear ? "bg-warning-fg" : "bg-volt"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border-default p-5 text-small text-text-secondary">
            Usage will appear here as soon as your workspace has data.
          </div>
        )}

        {/* Plan comparison — equal heights, baselines aligned */}
        <div>
          <h2 className="mb-4 text-body font-semibold text-text-primary">Plans</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {plans.map(({ plan, price, priceSuffix }) => {
              const planLimits = PLAN_LIMITS[plan];
              const isCurrent = plan === currentPlan;
              return (
                <div
                  key={plan}
                  className={`flex h-full flex-col rounded-xl border p-5 transition-all duration-[160ms] ease-out ${
                    isCurrent
                      ? "border-border-strong bg-bg-surface-2"
                      : "border-border-default bg-bg-surface hover:border-border-strong"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-body font-semibold text-text-primary">{plan}</span>
                    {isCurrent ? (
                      <span className="rounded border border-volt-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-volt">
                        Active
                      </span>
                    ) : null}
                  </div>

                  {/* Price block — identical height on all three cards,
                      FREE never renders an orphan "0" */}
                  <div className="mb-4 flex min-h-11 items-baseline gap-2">
                    <span className="text-h1 font-semibold text-text-primary">{price}</span>
                    <span className="font-mono text-mono-small text-text-tertiary">/ {priceSuffix}</span>
                  </div>

                  <ul className="space-y-1 text-small text-text-secondary">
                    <li>
                      <span className="font-mono text-text-primary">{planLimits.projects}</span> projects
                    </li>
                    <li>
                      <span className="font-mono text-text-primary">{planLimits.activeTasks}</span> active
                      tasks
                    </li>
                    <li>
                      <span className="font-mono text-text-primary">{planLimits.goals}</span> goals
                    </li>
                    <li>
                      <span className="font-mono text-text-primary">{planLimits.members}</span> member
                      {planLimits.members !== 1 ? "s" : ""}
                    </li>
                  </ul>

                  {/* CTA anchored at the bottom — keeps the 3 baselines aligned */}
                  <div className="mt-auto pt-4">
                    {isCurrent ? (
                      <span className="block rounded-md border border-border-default px-3 py-1.5 text-center font-mono text-mono-small uppercase tracking-[0.1em] text-text-tertiary">
                        Current plan
                      </span>
                    ) : (
                      <BillingUpgradeButton targetPlan={plan} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ONE permission note under the whole grid — never per card */}
          <p className="mt-4 text-xs text-text-tertiary">
            Only workspace owners and admins can change the plan. Payment integration is isolated
            behind a server route, ready for FedaPay wiring — no API secret reaches the frontend.
          </p>
        </div>

        <div className="flex justify-start">
          <Link
            href="/settings"
            className="flex items-center gap-2 text-small text-text-secondary transition-colors duration-[120ms] hover:text-text-primary"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Back to settings
          </Link>
        </div>
      </div>
    </NexusShell>
  );
}

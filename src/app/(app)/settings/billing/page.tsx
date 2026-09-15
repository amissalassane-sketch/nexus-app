import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BillingUpgradeButton } from "@/components/billing-upgrade-button";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, Progress } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { PLAN_ORDER, PLAN_PRESENTATION, planRank } from "@/lib/billing/plans";
import { parseWorkspaceUsage, type WorkspaceUsage } from "@/lib/billing/usage";
import {
  displayStatusOf,
  effectivePlanOf,
} from "@/lib/billing/subscription-state";
import { canManageBilling, getActiveMembership } from "@/lib/workspace";

const USAGE_ROWS: { label: string; key: keyof WorkspaceUsage["usage"] }[] = [
  { label: "Projects", key: "projects" },
  { label: "Active tasks", key: "active_tasks" },
  { label: "Goals", key: "goals" },
  { label: "Members", key: "members" },
];

export default async function BillingPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { membership } = await getActiveMembership(supabase, user.id);

  const workspaceId = membership?.workspaceId ?? null;
  const userCanManageBilling = canManageBilling(membership?.role);

  const { data: subscription } = workspaceId
    ? await supabase
        .from("workspace_subscriptions")
        .select("plan, status, trial_ends_at, current_period_end")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };

  // Same resolution the database applies (get_workspace_plan): an
  // 'active' row whose period lapsed displays as expired and grants
  // FREE, so this page never shows a plan the write guards would deny.
  const currentPlan = effectivePlanOf(subscription);
  const displayStatus = displayStatusOf(subscription);

  let usage: WorkspaceUsage | null = null;
  let usageError: string | null = null;

  if (workspaceId) {
    const { data, error } = await supabase.rpc("get_workspace_usage", {
      p_workspace_id: workspaceId,
    });
    usage = parseWorkspaceUsage(data);
    usageError = error?.message ?? (data && !usage ? "Usage data could not be read." : null);
  }

  return (
    <div className="page-enter space-y-5">
        <PageHeader
          title="Billing"
          description="The plan on this workspace, and how much of it you are using."
          actions={
            <Link
              href="/upgrade"
              className="inline-flex h-9 items-center rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg transition-colors duration-150 ease-nexus hover:bg-accent-hover"
            >
              Compare plans
            </Link>
          }
        />

        {!workspaceId ? (
          <Alert tone="warning">
            No active workspace is currently linked to this account.
          </Alert>
        ) : null}

        {/* Current plan */}
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-text-tertiary">
                Current plan
              </p>
              <h2 className="mt-1 text-display text-text-primary">{currentPlan}</h2>
              {displayStatus ? (
                <p className="mt-1 text-small capitalize text-text-secondary">
                  {displayStatus}
                </p>
              ) : (
                <p className="mt-1 text-small text-text-secondary">
                  Default plan. No subscription record yet.
                </p>
              )}
            </div>
            <Badge tone={currentPlan === "FREE" ? "neutral" : "lavender"}>
              Workspace-scoped
            </Badge>
          </div>
        </Card>

        {/* Usage */}
        {usageError ? <Alert tone="danger">{usageError}</Alert> : null}

        {usage ? (
          <Card className="p-6">
            <h2 className="text-h2 text-text-primary">Usage</h2>
            <p className="mt-1 text-small text-text-secondary">
              Counted server-side by Supabase, not by the interface.
            </p>

            <div className="mt-5 space-y-4">
              {USAGE_ROWS.map((row) => {
                const current = usage.usage[row.key] ?? 0;
                const limit = usage.limits[row.key] ?? 0;
                const pct = limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
                const isNear = pct >= 80;

                return (
                  <div key={row.key}>
                    <div className="mb-1.5 flex items-center justify-between text-small">
                      <span className="text-text-secondary">{row.label}</span>
                      <span
                        className={cn(
                          "font-mono tabular-nums",
                          isNear ? "text-warning" : "text-text-primary"
                        )}
                      >
                        {current} / {limit}
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      label={`${row.label} usage`}
                      tone={isNear ? "lavender" : "white"}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}

        {/* Plans */}
        <section aria-label="Plans">
          <h2 className="mb-3 text-h2 text-text-primary">Plans</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {PLAN_ORDER.map((planName) => {
              const plan = PLAN_PRESENTATION[planName];
              const isCurrent = planName === currentPlan;
              const isUpgrade = planRank(planName) > planRank(currentPlan);

              return (
                <div
                  key={planName}
                  className={cn(
                    "flex flex-col rounded-card border p-5",
                    isCurrent
                      ? "border-border-strong bg-bg-surface"
                      : plan.featured
                        ? "border-lavender-border bg-bg-subtle"
                        : "border-border-default bg-bg-subtle"
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-h3 text-text-primary">{planName}</span>
                    {isCurrent ? <Badge tone="solid">Active</Badge> : null}
                  </div>

                  <ul className="space-y-1 text-small text-text-secondary">
                    {plan.highlights.slice(0, 5).map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>

                  {isUpgrade ? (
                    <div className="mt-4">
                      <BillingUpgradeButton
                        targetPlan={planName}
                        canManageBilling={userCanManageBilling}
                        fullWidth
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-caption text-text-tertiary">
            Payment integration is isolated behind a server route and ready for provider
            wiring. No API secret is exposed to the frontend and no transaction is
            simulated.
          </p>
        </section>

        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-small text-text-secondary transition-colors duration-150 ease-nexus hover:text-text-primary"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back to settings
        </Link>
    </div>
  );
}

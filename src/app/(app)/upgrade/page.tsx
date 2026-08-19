import Link from "next/link";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { BillingUpgradeButton } from "@/components/billing-upgrade-button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/feedback";
import { PLAN_ORDER, PLAN_PRESENTATION, planRank } from "@/lib/billing/plans";
import { parseWorkspaceUsage, type WorkspaceUsage } from "@/lib/billing/usage";
import { type PlanName } from "@/lib/plan-limits";
import { canManageBilling, getActiveMembership } from "@/lib/workspace";

const USAGE_ROWS: { label: string; key: keyof WorkspaceUsage["usage"] }[] = [
  { label: "Projects", key: "projects" },
  { label: "Active tasks", key: "active_tasks" },
  { label: "Goals", key: "goals" },
  { label: "Members", key: "members" },
];

export default async function UpgradePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { membership } = await getActiveMembership(supabase, user.id);

  const workspaceId = membership?.workspaceId ?? null;
  const userCanManageBilling = canManageBilling(membership?.role);

  const { data: subscription } = workspaceId
    ? await supabase
        .from("workspace_subscriptions")
        .select("plan, status")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };

  const currentPlan = ((subscription?.plan as PlanName) ?? "FREE") as PlanName;

  let usage: WorkspaceUsage | null = null;
  if (workspaceId) {
    const { data } = await supabase.rpc("get_workspace_usage", {
      p_workspace_id: workspaceId,
    });
    usage = parseWorkspaceUsage(data);
  }

  return (
    <div className="mx-auto w-full max-w-[960px]">
        {/* HERO */}
        <div className="text-center">
          <span className="inline-flex h-[22px] items-center rounded-pill border border-lavender-border bg-lavender-subtle px-2.5 font-mono text-mono uppercase tracking-[0.08em] text-lavender">
            Upgrade
          </span>
          <h1 className="mt-4 text-display text-text-primary">
            Build your system, without limits.
          </h1>
          <p className="mx-auto mt-2 max-w-[480px] text-small text-text-secondary">
            Your current plan is{" "}
            <span className="font-mono text-text-primary">{currentPlan}</span>. Increase
            capacity when your system outgrows it — nothing you already created is ever
            removed.
          </p>
        </div>

        {/* CURRENT USAGE */}
        {usage ? (
          <section
            aria-label="Current usage"
            className="mt-12 rounded-card border border-border-subtle bg-bg-subtle p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-h2 text-text-primary">Current usage</h2>
              <Badge tone={currentPlan === "FREE" ? "neutral" : "lavender"}>
                {currentPlan}
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {USAGE_ROWS.map((row) => {
                const current = usage.usage[row.key] ?? 0;
                const limit = usage.limits[row.key] ?? 0;
                const pct = limit > 0 ? Math.min(100, (current / limit) * 100) : 0;

                return (
                  <div key={row.key}>
                    <div className="mb-1.5 flex items-center justify-between text-small">
                      <span className="text-text-secondary">{row.label}</span>
                      <span className="font-mono tabular-nums text-text-primary">
                        {current} / {limit}
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      label={`${row.label} usage`}
                      tone={pct >= 80 ? "lavender" : "white"}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* PRICING */}
        <section aria-label="Plans" className="mt-10 grid gap-6 md:grid-cols-3">
          {PLAN_ORDER.map((planName) => {
            const plan = PLAN_PRESENTATION[planName];
            const isCurrent = planName === currentPlan;
            const isUpgrade = planRank(planName) > planRank(currentPlan);

            return (
              <div
                key={planName}
                className={cn(
                  "flex flex-col rounded-pricing border bg-bg-subtle p-6",
                  plan.featured
                    ? "border-lavender-border shadow-[0_0_0_1px_rgba(233,228,255,0.12)]"
                    : "border-border-default"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-h2 text-text-primary">{planName}</h3>
                  {isCurrent ? (
                    <Badge tone="solid">Current</Badge>
                  ) : plan.featured ? (
                    <Badge tone="lavender">{plan.tagline}</Badge>
                  ) : (
                    <Badge>{plan.tagline}</Badge>
                  )}
                </div>

                <div className="mt-3 flex items-baseline gap-1.5">
                  {plan.priceLabel ? (
                    <>
                      <span className="text-[28px] font-medium leading-none tracking-[-0.02em] text-text-primary">
                        {plan.priceLabel}
                      </span>
                      <span className="text-small text-text-secondary">
                        {plan.pricePeriod}
                      </span>
                    </>
                  ) : (
                    <span className="font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary">
                      Pricing announced at launch
                    </span>
                  )}
                </div>

                <p className="mt-2 text-small text-text-secondary">{plan.description}</p>

                <ul className="mt-5 flex flex-col gap-2.5">
                  {plan.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="flex items-center gap-2 text-small text-text-secondary"
                    >
                      <Check
                        size={14}
                        strokeWidth={2}
                        className="shrink-0 text-text-tertiary"
                        aria-hidden="true"
                      />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 pt-2">
                  {isCurrent ? (
                    <div className="flex h-9 items-center justify-center rounded-pill border border-border-default text-button text-text-secondary">
                      Your current plan
                    </div>
                  ) : isUpgrade ? (
                    <BillingUpgradeButton
                      targetPlan={planName}
                      canManageBilling={userCanManageBilling}
                      fullWidth
                      label={`Upgrade to ${planName}`}
                    />
                  ) : (
                    <div className="flex h-9 items-center justify-center rounded-pill border border-border-subtle text-button text-text-tertiary">
                      Included in your plan
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <p className="mt-8 text-center text-caption text-text-tertiary">
          Plan limits are enforced server-side by Supabase (RLS, triggers and RPC), never
          by the interface alone. No payment provider is connected yet — no transaction is
          ever simulated.
        </p>

        <div className="mt-6 text-center">
          <Link
            href="/settings/billing"
            className="text-small text-text-secondary underline decoration-border-strong underline-offset-4 transition-colors hover:text-text-primary"
          >
            See detailed usage and billing
          </Link>
        </div>
    </div>
  );
}

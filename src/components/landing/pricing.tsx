import type { CSSProperties } from "react";
import { Check, Minus } from "lucide-react";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { SpotlightBorder } from "@/components/landing/spotlight-border";
import { ButtonLink, type ButtonVariant } from "@/components/ui/button";
import { PLAN_FEATURES, PLAN_LIMITS, type PlanName } from "@/lib/plan-limits";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS LANDING — PRICING
//
// Three plans, one badge, per-plan CTAs — unchanged.
//
// DESIGN AUDIT: the cards listed eight near-identical bullet points,
// so no visitor could tell the plans apart. Each card now answers
// three questions in order:
//
//   WHO IS IT FOR?   → the audience line under the price
//   WHAT CHANGES?    → the entitlements, read from plan-limits.ts
//   WHY UPGRADE?     → the delta line at the foot of the card
//
// Entitlements are imported from src/lib/plan-limits.ts — the single
// source of truth the database enforces — so the marketing surface
// can never drift away from what the product actually allows.
// ============================================================

interface PlanPresentationRow {
  key: PlanName;
  name: string;
  price: string;
  billing: string;
  audience: string;
  badge: string | null;
  featured: boolean;
  delta: string | null;
  cta: { label: string; href: string; variant: ButtonVariant };
}

const pricingPlans: PlanPresentationRow[] = [
  {
    key: "FREE",
    name: "Free",
    price: "0",
    billing: "Forever",
    audience:
      "One person getting their workspace under control. Everything NEXUS reads, nothing to pay for.",
    badge: null,
    featured: false,
    delta: null,
    cta: {
      label: "Get Started",
      href: "/signup",
      variant: "secondary" as ButtonVariant,
    },
  },
  {
    key: "PRO",
    name: "Pro",
    price: "19",
    billing: "per user / month",
    audience:
      "Operators running several projects at once, who need the full signal set and room to grow.",
    badge: "Most Popular",
    featured: true,
    delta: "5× the workspaces, 10× the tasks and 20 goals, plus advanced analytics.",
    cta: {
      label: "Start Pro",
      href: "/upgrade",
      variant: "primary" as ButtonVariant,
    },
  },
  {
    key: "TEAM",
    name: "Business",
    price: "49",
    billing: "per user / month",
    audience:
      "Teams that want NEXUS to become the shared operational layer for everyone.",
    badge: "For Teams",
    featured: false,
    delta: "20 shared workspaces, collaboration and granular permissions.",
    cta: {
      label: "Contact Sales",
      href: "/upgrade",
      variant: "secondary" as ButtonVariant,
    },
  },
];

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** Entitlements straight from the enforced limits — never hand-written. */
function entitlementsFor(plan: PlanName): string[] {
  const limits = PLAN_LIMITS[plan];
  const features = PLAN_FEATURES[plan];

  return [
    "The full model: goals → projects → tasks → activity",
    "NEXUS Intelligence signals and next best action",
    plural(limits.workspaces, "workspace"),
    plural(limits.projects, "project"),
    `${limits.activeTasks.toLocaleString("en-US")} active tasks`,
    plural(limits.goals, "goal"),
    plural(limits.members, "member"),
    ...(features.advancedAnalytics ? ["Advanced analytics"] : []),
    ...(features.advancedCollaboration ? ["Advanced collaboration"] : []),
    ...(features.advancedPermissions ? ["Granular permissions"] : []),
  ];
}

type ComparisonRow = {
  label: string;
  value: (plan: PlanName) => string;
  included: (plan: PlanName) => boolean;
};

const COMPARISON: ComparisonRow[] = [
  {
    label: "Workspaces",
    value: (plan) => String(PLAN_LIMITS[plan].workspaces),
    included: () => true,
  },
  {
    label: "Projects",
    value: (plan) => String(PLAN_LIMITS[plan].projects),
    included: () => true,
  },
  {
    label: "Active tasks",
    value: (plan) => PLAN_LIMITS[plan].activeTasks.toLocaleString("en-US"),
    included: () => true,
  },
  {
    label: "Goals",
    value: (plan) => String(PLAN_LIMITS[plan].goals),
    included: () => true,
  },
  {
    label: "Members",
    value: (plan) => String(PLAN_LIMITS[plan].members),
    included: () => true,
  },
  {
    label: "Advanced analytics",
    value: () => "",
    included: (plan) => PLAN_FEATURES[plan].advancedAnalytics,
  },
  {
    label: "Advanced collaboration",
    value: () => "",
    included: (plan) => PLAN_FEATURES[plan].advancedCollaboration,
  },
  {
    label: "Granular permissions",
    value: () => "",
    included: (plan) => PLAN_FEATURES[plan].advancedPermissions,
  },
];

function stageDelay(milliseconds: number) {
  return {
    "--pricing-stage-delay": `${milliseconds}ms`,
  } as CSSProperties;
}

function PricingCard({
  plan,
  revealDelay,
}: {
  plan: PlanPresentationRow;
  revealDelay: number;
}) {
  const isBusiness = plan.key === "TEAM";
  const entitlements = entitlementsFor(plan.key);

  return (
    <LandingReveal
      delay={revealDelay}
      amount={0.25}
      className="pricing-reveal h-full"
    >
      <SpotlightBorder>
        <article
          aria-label={`${plan.name} plan, $${plan.price} ${plan.billing}`}
          className={cn(
            "pricing-card relative flex h-full min-h-[560px] flex-col rounded-pricing border p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-7",
            plan.featured
              ? "border-white/20 bg-white/[0.055]"
              : "border-white/10 bg-white/[0.035]"
          )}
        >
          {plan.featured ? (
            <span className="absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-pill bg-white px-3 py-1 text-[11px] font-medium leading-4 tracking-[-0.01em] text-black shadow-[0_5px_16px_rgba(0,0,0,0.32)]">
              {plan.badge}
            </span>
          ) : null}

          <div
            className="pricing-card-stage flex min-h-5 items-center justify-between gap-3"
            style={stageDelay(0)}
          >
            <h3 className="nexus-eyebrow">{plan.name}</h3>
            {isBusiness ? (
              <span className="rounded-pill border border-white/10 bg-white/[0.045] px-2.5 py-0.5 font-mono text-[10px] uppercase leading-4 tracking-[0.08em] text-text-secondary">
                {plan.badge}
              </span>
            ) : null}
          </div>

          <div
            className="pricing-card-stage mt-5 border-t border-white/[0.07] pt-6"
            style={stageDelay(100)}
          >
            <div className="flex items-start text-text-primary">
              <span className="mt-1.5 font-mono text-[20px] font-normal leading-none text-text-secondary sm:text-[22px]">
                $
              </span>
              <span className="font-mono text-[44px] font-normal leading-[0.9] tracking-[-0.055em] tabular-nums sm:text-[48px]">
                {plan.price}
              </span>
            </div>
            <p className="nexus-meta-strong mt-3 uppercase tracking-[0.08em]">
              {plan.billing}
            </p>
          </div>

          {/* WHO IS IT FOR? */}
          <div className="pricing-card-stage mt-5" style={stageDelay(200)}>
            <p className="nexus-eyebrow">Who it is for</p>
            <p className="mt-2 text-small leading-[20px] text-text-secondary">
              {plan.audience}
            </p>
          </div>

          <div className="pricing-card-stage mt-6" style={stageDelay(300)}>
            <ButtonLink
              href={plan.cta.href}
              variant={plan.cta.variant}
              size="lg"
              aria-label={`${plan.cta.label} for the ${plan.name} plan`}
              className={cn(
                "w-full",
                plan.featured
                  ? "pricing-primary-cta"
                  : "border-white/10 bg-white/[0.055] text-text-primary hover:bg-white/[0.09]"
              )}
            >
              {plan.cta.label}
            </ButtonLink>
          </div>

          {/* WHAT CHANGES? */}
          <div className="pricing-card-stage mt-7 flex flex-1 flex-col" style={stageDelay(400)}>
            <p className="nexus-eyebrow">What you get</p>
            <ul className="mt-1 flex flex-1 flex-col" aria-label={`${plan.name} plan entitlements`}>
              {entitlements.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 border-t border-white/[0.055] py-3 text-small text-text-primary first:border-t-0 first:pt-0"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.18] bg-white/[0.05]">
                    <Check
                      size={11}
                      strokeWidth={2.25}
                      aria-hidden="true"
                      className="text-text-primary"
                    />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* WHY UPGRADE? */}
          {plan.delta ? (
            <p
              className="pricing-card-stage mt-5 border-t border-white/[0.07] pt-4 text-small text-text-secondary"
              style={stageDelay(500)}
            >
              <span className="nexus-eyebrow mr-2">Why upgrade</span>
              {plan.delta}
            </p>
          ) : null}
        </article>
      </SpotlightBorder>
    </LandingReveal>
  );
}

export function PricingSection() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="nexus-band relative w-full scroll-mt-20 py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="mb-12 flex flex-col gap-8 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <LandingReveal amount={0.25} className="pricing-reveal w-fit">
              <span className="nexus-eyebrow-pill">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-lavender/70"
                  aria-hidden="true"
                />
                Pricing
              </span>
            </LandingReveal>

            <LandingReveal delay={100} amount={0.25} className="pricing-reveal">
              <h2
                id="pricing-title"
                className="mt-5 max-w-[15ch] text-[32px] font-medium leading-[1.08] tracking-[-0.04em] text-text-primary sm:text-[40px] lg:text-[44px]"
              >
                Plans that scale with your work.
              </h2>
            </LandingReveal>
          </div>

          <LandingReveal
            delay={200}
            amount={0.25}
            className="pricing-reveal max-w-[420px] lg:text-right"
          >
            <p className="nexus-lead">
              Start free, upgrade when the workspace outgrows the limits. Every
              limit below is enforced server-side, the same numbers the
              database checks.
            </p>
          </LandingReveal>
        </div>

        <div className="mx-auto grid max-w-[1080px] grid-cols-1 gap-6 pt-3 md:grid-cols-2 lg:grid-cols-3">
          {pricingPlans.map((plan, index) => (
            <PricingCard
              key={plan.name}
              plan={plan}
              revealDelay={index * 100}
            />
          ))}
        </div>

        {/* ---------- Compact comparison ----------
            A table where there is room for one, a stack of per-plan
            blocks below `sm` so nothing is squeezed or scrolled. */}
        <LandingReveal delay={150} amount={0.15}>
          <div className="mt-12">
            <p className="nexus-eyebrow">Compare the plans</p>

            <div className="mt-4 hidden overflow-hidden rounded-card border border-border-subtle sm:block">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  NEXUS plan limits compared
                </caption>
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-surface/40">
                    <th scope="col" className="px-4 py-3">
                      <span className="nexus-eyebrow">Limit</span>
                    </th>
                    {pricingPlans.map((plan) => (
                      <th
                        key={plan.name}
                        scope="col"
                        className="px-4 py-3 text-right"
                      >
                        <span
                          className={cn(
                            "text-small font-semibold",
                            plan.featured
                              ? "text-text-primary"
                              : "text-text-secondary"
                          )}
                        >
                          {plan.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr
                      key={row.label}
                      className="border-b border-border-subtle last:border-b-0"
                    >
                      <th
                        scope="row"
                        className="px-4 py-3 text-small font-normal text-text-secondary"
                      >
                        {row.label}
                      </th>
                      {pricingPlans.map((plan) => {
                        const on = row.included(plan.key);
                        return (
                          <td
                            key={plan.name}
                            className="px-4 py-3 text-right align-middle"
                          >
                            {row.value(plan.key) ? (
                              <span className="numeric text-small text-text-primary">
                                {row.value(plan.key)}
                              </span>
                            ) : on ? (
                              <span className="inline-flex items-center gap-1.5 text-small text-text-primary">
                                <Check
                                  size={12}
                                  strokeWidth={2.25}
                                  aria-hidden="true"
                                />
                                <span className="sr-only">Included</span>
                                <span aria-hidden="true" className="nexus-meta">
                                  Yes
                                </span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                <Minus
                                  size={12}
                                  strokeWidth={2}
                                  className="text-text-tertiary"
                                  aria-hidden="true"
                                />
                                <span className="sr-only">Not included</span>
                                <span aria-hidden="true" className="nexus-meta">
                                  No
                                </span>
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: one block per plan — no sideways scrolling. */}
            <ul className="mt-4 grid gap-3 sm:hidden">
              {pricingPlans.map((plan) => (
                <li key={plan.name} className="nexus-panel p-4">
                  <p className="text-h4 text-text-primary">{plan.name}</p>
                  <dl className="mt-2">
                    {COMPARISON.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-baseline justify-between gap-4 border-t border-border-subtle py-2 first:border-t-0"
                      >
                        <dt className="text-small text-text-secondary">
                          {row.label}
                        </dt>
                        <dd className="numeric text-small text-text-primary">
                          {row.value(plan.key) ||
                            (row.included(plan.key) ? "Yes" : "No")}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        </LandingReveal>

        <LandingReveal delay={200} amount={0.25} className="pricing-reveal">
          <p className="nexus-meta mx-auto mt-8 max-w-[560px] text-center">
            Free requires no card. Paid plans are per user, per month; plan
            changes are managed from workspace billing.
          </p>
        </LandingReveal>
      </div>
    </section>
  );
}

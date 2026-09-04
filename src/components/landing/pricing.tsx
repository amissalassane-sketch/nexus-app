"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { Check, Minus } from "lucide-react";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { SpotlightBorder } from "@/components/landing/spotlight-border";
import { ButtonLink, type ButtonVariant } from "@/components/ui/button";
import { PLAN_FEATURES, PLAN_LIMITS, type PlanName } from "@/lib/plan-limits";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS LANDING — PRICING
//
// Three plans, one badge, per-plan CTAs. Each card answers three
// questions in order:
//
//   WHO IS IT FOR?   → the audience line under the price
//   WHAT CHANGES?    → the entitlements, read from plan-limits.ts
//   WHY UPGRADE?     → the delta line at the foot of the card
//
// BILLING — monthly / annual. The monthly prices are the ones the
// product already quoted (Free $0, Pro $19, Business $49 per user
// / month). Annual is derived from a single declared discount:
// 25% off the monthly rate, billed yearly. Nothing else is
// invented — the same numbers stay visible in both states and the
// annual saving is always shown next to the rate it comes from.
// ============================================================

/** The only discount NEXUS declares. Annual price = monthly × (1 − 0.25). */
const ANNUAL_SAVINGS_RATE = 0.25;

type BillingPeriod = "monthly" | "annual";

const money = (value: number) =>
  Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;

const annualRate = (monthly: number) => monthly * (1 - ANNUAL_SAVINGS_RATE);
const annualSavings = (monthly: number) =>
  monthly * 12 * ANNUAL_SAVINGS_RATE;

interface PlanPresentationRow {
  key: PlanName;
  name: string;
  /** Monthly price per user, as quoted by the product. 0 = free. */
  price: number;
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
    price: 0,
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
    price: 19,
    audience:
      "Operators running several projects at once, who need the full signal set and room to grow.",
    badge: "Most Popular",
    featured: true,
    delta:
      "5× the workspaces, 10× the tasks and 20 goals, plus advanced analytics.",
    cta: {
      label: "Start Pro",
      href: "/upgrade",
      variant: "primary" as ButtonVariant,
    },
  },
  {
    key: "TEAM",
    name: "Business",
    price: 49,
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

/** The numbers shown under the price, for a given billing period. */
function priceCopy(plan: PlanPresentationRow, billing: BillingPeriod) {
  if (plan.price === 0) {
    return {
      amount: "0",
      rate: "Forever",
      note: "No card required",
    };
  }

  if (billing === "annual") {
    return {
      amount: money(annualRate(plan.price)),
      rate: "per user / month",
      note: `billed annually · Save ${money(annualSavings(plan.price))} / year`,
    };
  }

  return {
    amount: money(plan.price),
    rate: "per user / month",
    note: "billed monthly",
  };
}

function BillingToggle({
  value,
  onChange,
}: {
  value: BillingPeriod;
  onChange: (next: BillingPeriod) => void;
}) {
  return (
    <fieldset className="flex flex-col items-start gap-2 lg:items-end">
      <legend className="sr-only">Billing period</legend>
      <div className="flex h-12 items-center rounded-pill border border-border-default bg-bg-surface/60 p-1 sm:h-11">
        <label className="relative flex-1 cursor-pointer sm:flex-none">
          <input
            type="radio"
            name="nexus-billing-period"
            value="monthly"
            checked={value === "monthly"}
            onChange={() => onChange("monthly")}
            className="peer sr-only"
          />
          <span className="flex h-10 items-center justify-center rounded-pill px-3.5 font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary transition-colors duration-150 ease-nexus peer-checked:bg-accent peer-checked:text-accent-fg peer-focus-visible:ring-2 peer-focus-visible:ring-lavender/60 sm:h-9">
            Monthly
          </span>
        </label>

        <label className="relative flex-1 cursor-pointer sm:flex-none">
          <input
            type="radio"
            name="nexus-billing-period"
            value="annual"
            checked={value === "annual"}
            onChange={() => onChange("annual")}
            className="peer sr-only"
          />
          <span className="flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill px-3.5 font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary transition-colors duration-150 ease-nexus peer-checked:bg-accent peer-checked:text-accent-fg peer-focus-visible:ring-2 peer-focus-visible:ring-lavender/60 sm:h-9">
            Annual
            <span
              className={cn(
                "rounded-[4px] px-1.5 py-0.5 font-mono text-[9.5px] leading-none tracking-[0.04em] transition-colors duration-150 ease-nexus",
                value === "annual"
                  ? "bg-black/10 text-accent-fg"
                  : "bg-lavender-subtle text-lavender"
              )}
            >
              Save 25%
            </span>
          </span>
        </label>
      </div>
      <p className="nexus-meta hidden lg:block">
        {value === "annual"
          ? "One yearly payment, same features."
          : "Switch to annual and keep 25%."}
      </p>
    </fieldset>
  );
}

function stageDelay(milliseconds: number) {
  return {
    "--pricing-stage-delay": `${milliseconds}ms`,
  } as CSSProperties;
}

function PricingCard({
  plan,
  billing,
  revealDelay,
}: {
  plan: PlanPresentationRow;
  billing: BillingPeriod;
  revealDelay: number;
}) {
  const isBusiness = plan.key === "TEAM";
  const isFree = plan.price === 0;
  const entitlements = entitlementsFor(plan.key);
  const price = priceCopy(plan, billing);

  return (
    <LandingReveal
      delay={revealDelay}
      amount={0.25}
      className="pricing-reveal h-full"
    >
      <SpotlightBorder>
        <article
          aria-label={`${plan.name} plan, ${price.amount} ${price.rate}`}
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
              {!isFree ? (
                <span className="mt-1.5 font-mono text-[20px] font-normal leading-none text-text-secondary sm:text-[22px]">
                  $
                </span>
              ) : null}
              <span
                key={`${plan.key}-${billing}`}
                className="pricing-price-swap font-mono text-[44px] font-normal leading-[0.9] tracking-[-0.055em] tabular-nums sm:text-[48px]"
              >
                {price.amount}
              </span>
            </div>
            <p className="nexus-meta-strong mt-3 uppercase tracking-[0.08em]">
              {price.rate}
            </p>
            {/* One line, always — the note swaps in place, never below. */}
            <p className="mt-1.5 h-4 font-mono text-[10.5px] leading-4 text-text-tertiary">
              {price.note}
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
          <div
            className="pricing-card-stage mt-7 flex flex-1 flex-col"
            style={stageDelay(400)}
          >
            <p className="nexus-eyebrow">What you get</p>
            <ul
              className="mt-1 flex flex-1 flex-col"
              aria-label={`${plan.name} plan entitlements`}
            >
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
  const [billing, setBilling] = useState<BillingPeriod>("monthly");

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="nexus-band relative w-full scroll-mt-20 py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-page px-4 sm:px-6">
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

          <div className="flex w-full max-w-[420px] flex-col gap-5 lg:items-end">
            <LandingReveal
              delay={200}
              amount={0.25}
              className="pricing-reveal lg:text-right"
            >
              <p className="nexus-lead">
                Start free, upgrade when the workspace outgrows the limits.
                Every limit below is enforced server-side, the same numbers
                the database checks.
              </p>
            </LandingReveal>

            <LandingReveal
              delay={260}
              amount={0.25}
              className="pricing-reveal w-full lg:w-auto"
            >
              <BillingToggle value={billing} onChange={setBilling} />
            </LandingReveal>
          </div>
        </div>

        <div className="mx-auto grid max-w-page grid-cols-1 gap-6 pt-3 md:grid-cols-2 lg:grid-cols-3">
          {pricingPlans.map((plan, index) => (
            <PricingCard
              key={plan.name}
              plan={plan}
              billing={billing}
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

            <div className="mt-4 hidden overflow-hidden rounded-card border border-border-subtle tablet:block">
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
                                <span
                                  aria-hidden="true"
                                  className="nexus-meta"
                                >
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
            <ul className="mt-4 grid gap-3 tablet:hidden">
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
            Free requires no card. Paid plans are per user; annual billing is
            one yearly payment at 25% off. Plan changes are managed from
            workspace billing.
          </p>
        </LandingReveal>
      </div>
    </section>
  );
}

import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { SpotlightBorder } from "@/components/landing/spotlight-border";
import { ButtonLink, type ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// Marketing plan copy lives in one structure so prices, descriptions and
// entitlements can be updated without touching the card markup. TEAM remains
// the internal billing slug; "Business" is its customer-facing tier name.
const pricingPlans = [
  {
    name: "Free",
    price: "0",
    billing: "Forever",
    description:
      "Start organizing your work and experience the NEXUS workspace.",
    badge: null,
    featured: false,
    cta: {
      label: "Get Started",
      href: "/signup",
      variant: "secondary" as ButtonVariant,
    },
    features: [
      "Core workspace",
      "Projects and tasks",
      "Basic collaboration",
      "Limited AI Intelligence",
      "Basic automations",
      "Community support",
    ],
  },
  {
    name: "Pro",
    price: "19",
    billing: "per user / month",
    description:
      "For creators and teams who want deeper intelligence and automation.",
    badge: "Most Popular",
    featured: true,
    cta: {
      label: "Start Pro",
      href: "/upgrade",
      variant: "primary" as ButtonVariant,
    },
    features: [
      "Everything in Free",
      "Advanced AI Intelligence",
      "AI agents",
      "Advanced automations",
      "Unlimited projects",
      "Advanced collaboration",
      "Priority support",
    ],
  },
  {
    name: "Business",
    price: "49",
    billing: "per user / month",
    description:
      "For teams that want NEXUS to become their operational intelligence layer.",
    badge: "For Teams",
    featured: false,
    cta: {
      label: "Contact Sales",
      href: "/upgrade",
      variant: "secondary" as ButtonVariant,
    },
    features: [
      "Everything in Pro",
      "Advanced AI agents",
      "Team intelligence",
      "Workflow orchestration",
      "Advanced permissions",
      "Usage analytics",
      "Priority support",
      "Custom team configuration",
    ],
  },
] as const;

type PricingPlan = (typeof pricingPlans)[number];

function stageDelay(milliseconds: number) {
  return {
    "--pricing-stage-delay": `${milliseconds}ms`,
  } as CSSProperties;
}

function PricingCard({
  plan,
  revealDelay,
}: {
  plan: PricingPlan;
  revealDelay: number;
}) {
  const isBusiness = plan.name === "Business";

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
            <h3 className="eyebrow text-text-secondary">
              {plan.name}
            </h3>
            {isBusiness ? (
              <span className="rounded-pill border border-white/10 bg-white/[0.045] px-2.5 py-0.5 font-mono text-[10px] uppercase leading-4 tracking-[0.08em] text-text-tertiary">
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
            <p className="mt-3 font-mono text-[11px] uppercase leading-4 tracking-[0.08em] text-text-tertiary">
              {plan.billing}
            </p>
          </div>

          <p
            className="pricing-card-stage mt-5 min-h-[63px] text-body leading-[21px] text-text-secondary"
            style={stageDelay(200)}
          >
            {plan.description}
          </p>

          <div className="pricing-card-stage mt-6" style={stageDelay(300)}>
            <ButtonLink
              href={plan.cta.href}
              variant={plan.cta.variant}
              size="lg"
              aria-label={`${plan.cta.label} — ${plan.name} plan`}
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

          <ul
            className="pricing-card-stage mt-7 flex flex-1 flex-col"
            style={stageDelay(400)}
            aria-label={`${plan.name} plan features`}
          >
            {plan.features.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3 border-t border-white/[0.055] py-3 text-small text-text-primary first:border-t-0 first:pt-0"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.18] bg-white/[0.05]">
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
      className="relative w-full scroll-mt-20 bg-background py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-[1120px] px-4 sm:px-6 lg:px-8">
        <div className="mb-14 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <LandingReveal amount={0.25} className="pricing-reveal w-fit">
              <span className="inline-flex h-7 items-center gap-2 rounded-pill border border-white/[0.09] bg-white/[0.035] px-3 eyebrow text-text-secondary backdrop-blur-sm">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-text-secondary shadow-[0_0_8px_rgba(255,255,255,0.16)]"
                  aria-hidden="true"
                />
                Pricing
              </span>
            </LandingReveal>

            <LandingReveal delay={100} amount={0.25} className="pricing-reveal">
              <h2
                id="pricing-title"
                className="mt-5 max-w-[15ch] text-[34px] font-medium leading-[1.08] tracking-[-0.04em] text-text-primary sm:text-[40px] lg:text-[44px]"
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
            <p className="text-body leading-[22px] text-text-secondary sm:text-[15px] sm:leading-6">
              Start with the essentials. Upgrade when your workspace, team, and
              intelligence layer grow.
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

        <LandingReveal delay={200} amount={0.25} className="pricing-reveal">
          <p className="mx-auto mt-8 max-w-[560px] text-center text-caption text-text-tertiary">
            Free requires no card. Listed paid prices are per user, per month;
            plan changes are managed from workspace billing.
          </p>
        </LandingReveal>
      </div>
    </section>
  );
}

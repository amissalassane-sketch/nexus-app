import { Check } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_ORDER, PLAN_PRESENTATION } from "@/lib/billing/plans";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS LANDING — PRICING
// Real plan data from src/lib/billing/plans.ts. No invented
// prices: PRO and TEAM display the honest "pricing announced at
// launch" state until a payment provider is connected, and the
// Free card is always shown with its full context.
// ============================================================

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-20 px-5 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto w-full max-w-[1120px]">
        <LandingReveal>
          <SectionHeading
            eyebrow="Pricing"
            title="Start free. Scale when your system grows."
            sub="No payment provider is connected yet — nothing on this page is charged or simulated. Plans differ in capacity and collaboration features; the core system is the same."
          />
        </LandingReveal>

        <div className="mt-12 grid gap-4 md:grid-cols-3 lg:mt-14 lg:gap-5">
          {PLAN_ORDER.map((planName, index) => {
            const plan = PLAN_PRESENTATION[planName];
            const featured = plan.featured;

            return (
              <LandingReveal key={planName} delay={index * 80} className="h-full">
                <article
                  className={cn(
                    "flex h-full flex-col rounded-pricing border bg-bg-subtle p-6 sm:p-7",
                    featured
                      ? "border-lavender-border shadow-[0_0_0_1px_rgba(233,228,255,0.12)]"
                      : "border-border-default"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-mono text-mono uppercase tracking-[0.1em] text-text-secondary">
                      {plan.name}
                    </h3>
                    <Badge tone={featured ? "lavender" : "neutral"}>{plan.tagline}</Badge>
                  </div>

                  {/* Price: Free is shown with context, never as a bare "0". */}
                  <div className="mt-5">
                    {plan.priceLabel === "$0" ? (
                      <>
                        <span className="text-[34px] font-medium leading-none tracking-[-0.03em] text-text-primary">
                          Free
                        </span>
                        <p className="mt-2 text-small text-text-secondary">
                          No card required. Start with a full system and upgrade only when you
                          need capacity.
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-[15px] uppercase leading-none tracking-[0.02em] text-text-primary">
                          Pricing announced at launch
                        </span>
                        <p className="mt-2 text-small text-text-secondary">
                          {plan.description}
                        </p>
                      </>
                    )}
                  </div>

                  <ul className="mt-6 flex flex-1 flex-col gap-2.5 border-t border-border-subtle pt-5">
                    {plan.highlights.map((highlight) => (
                      <li
                        key={highlight}
                        className="flex items-center gap-2.5 text-small text-text-secondary"
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-bg-surface">
                          <Check size={10} strokeWidth={2.5} className="text-text-primary" aria-hidden="true" />
                        </span>
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7">
                    <ButtonLink
                      href="/signup"
                      size="lg"
                      variant={planName === "FREE" ? "primary" : "secondary"}
                      className="w-full"
                    >
                      Get started
                    </ButtonLink>
                  </div>
                </article>
              </LandingReveal>
            );
          })}
        </div>

        <LandingReveal delay={120}>
          <p className="mx-auto mt-8 max-w-[560px] text-center text-caption text-text-tertiary">
            Plan limits are enforced server-side by Supabase — row-level security, database
            triggers and a usage RPC — never by the interface alone.
          </p>
        </LandingReveal>
      </div>
    </section>
  );
}

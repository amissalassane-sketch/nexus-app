import { ArrowRight } from "lucide-react";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { ButtonLink } from "@/components/ui/button";

// ============================================================
// NEXUS LANDING — FINAL CTA
// The last push: a clear reason to start, inside a quiet panel
// that stays strictly inside the NEXUS visual language.
// ============================================================

export function FinalCtaSection() {
  return (
    <section className="px-5 py-24 sm:px-6 sm:py-32">
      <LandingReveal>
        <div className="mx-auto w-full max-w-[1120px]">
          <div className="relative overflow-hidden rounded-[24px] border border-border-default bg-bg-subtle/60 px-6 py-16 text-center sm:px-12 sm:py-24">
            <span
              className="absolute left-1/2 top-0 h-px w-24 -translate-x-1/2 bg-lavender/40"
              aria-hidden="true"
            />

            <span className="font-mono text-mono uppercase tracking-[0.12em] text-text-tertiary">
              Start
            </span>
            <h2 className="mx-auto mt-4 max-w-[18ch] text-[32px] font-medium leading-[1.08] tracking-[-0.035em] text-text-primary sm:text-[44px]">
              Bring your work into focus.
            </h2>
            <p className="mx-auto mt-4 max-w-[440px] text-body text-text-secondary sm:text-[15px] sm:leading-[24px]">
              One workspace. One chain from goal to activity. One next action,
              always.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/signup" size="lg">
                Get started
                <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary" size="lg">
                Sign in
              </ButtonLink>
            </div>
          </div>
        </div>
      </LandingReveal>
    </section>
  );
}

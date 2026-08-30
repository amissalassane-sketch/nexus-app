import { ArrowRight } from "lucide-react";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { ButtonLink } from "@/components/ui/button";

// ============================================================
// NEXUS LANDING — FINAL CTA
// The last push: the work is already there, NEXUS starts reading
// it immediately. Inside a quiet panel that stays strictly inside
// the NEXUS visual language.
// ============================================================

export function FinalCtaSection() {
  return (
    <section className="px-5 py-24 sm:px-6 sm:py-32">
      <LandingReveal>
        <div className="mx-auto w-full max-w-[1120px]">
          <div className="nexus-panel relative overflow-hidden rounded-[16px] px-6 py-16 text-center sm:px-12 sm:py-24">
            <span
              className="absolute left-1/2 top-0 h-px w-24 -translate-x-1/2 bg-lavender/40"
              aria-hidden="true"
            />

            <span className="nexus-eyebrow-pill">
              Start
            </span>
            <h2 className="mx-auto mt-4 max-w-[20ch] text-[32px] font-medium leading-[1.08] tracking-[-0.035em] text-text-primary sm:text-[44px]">
              Stop managing the work. Understand it.
            </h2>
            <p className="nexus-lead mx-auto mt-5 max-w-[440px]">
              Free to start, no card required. Your workspace already has
              what NEXUS needs.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/signup" size="lg">
                Get started
                <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/intelligence" variant="secondary" size="lg">
                See it in action
              </ButtonLink>
            </div>
          </div>
        </div>
      </LandingReveal>
    </section>
  );
}

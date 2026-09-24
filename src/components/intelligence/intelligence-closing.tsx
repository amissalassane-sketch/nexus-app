import { IconArrowRight } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { ButtonLink } from "@/components/ui/button";

// ============================================================
// SECTION 7 — CLOSING
// Straight into the existing NEXUS authentication flow:
// /signup and /login, zero invented claims.
// ============================================================

export function IntelligenceClosing() {
  return (
    <section className="relative isolate overflow-hidden px-4 py-18 sm:px-6 sm:py-24">
      {/* The architectural mark watermark — quiet, theme-adaptive */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2"
        aria-hidden="true"
      >
        <div className="nexus-intel-mark-layer nexus-intel-closing-mark" />
      </div>

      <LandingReveal>
        <div className="mx-auto flex w-full max-w-[720px] flex-col items-center text-center">
          <span className="eyebrow text-lavender font-semibold">
            Ready to cut through noise
          </span>

          <h2 className="mt-4 max-w-[20ch] text-[32px] font-medium leading-[1.08] tracking-[-0.035em] text-text-primary sm:text-[44px]">
            Your workspace already shows what needs{" "}
            <span className="nexus-intel-accent">attention</span>.
          </h2>

          <p className="mt-4 max-w-[460px] text-body text-text-secondary sm:text-[15.5px] sm:leading-[25px]">
            NEXUS helps you see it. Every signal is deterministically traced back to the real
            work that produced it.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/signup" size="lg" className="nexus-intel-sweep">
              Get started
              <NexusIcon icon={IconArrowRight} />
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" size="lg">
              Sign in
            </ButtonLink>
          </div>

          <p className="mt-4 eyebrow text-text-secondary font-medium">
            Free to start · No card required
          </p>
        </div>
      </LandingReveal>
    </section>
  );
}

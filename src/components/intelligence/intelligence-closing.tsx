import { ArrowRight } from "lucide-react";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { ButtonLink } from "@/components/ui/button";

// ============================================================
// SECTION 7 — CLOSING
// Straight into the existing NEXUS authentication flow:
// /signup and /login, nothing invented.
// ============================================================

export function IntelligenceClosing() {
  return (
    <section className="relative isolate overflow-hidden px-4 py-28 sm:px-6 sm:py-36">
      {/* The mark, one last time — quiet, static, behind everything. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 opacity-[0.45]"
        aria-hidden="true"
      >
        <div className="nexus-intel-mark-layer nexus-intel-closing-mark" />
      </div>

      <LandingReveal>
        <div className="mx-auto flex w-full max-w-[720px] flex-col items-center text-center">
          <span className="inline-flex h-[22px] items-center rounded-pill border border-border-default bg-bg-subtle px-2.5 eyebrow text-text-tertiary">
            Nexus Intelligence
          </span>

          <h2 className="mt-5 max-w-[18ch] text-[32px] font-medium leading-[1.06] tracking-[-0.035em] text-text-primary sm:text-[46px]">
            Your workspace already shows what needs attention.
          </h2>

          <p className="mt-5 max-w-[440px] text-body text-text-secondary sm:text-[15px] sm:leading-[24px]">
            NEXUS helps you see it. Every signal is traced back to the work
            that produced it.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/signup" size="lg" className="nexus-intel-sweep">
              Get started
              <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" size="lg">
              Sign in
            </ButtonLink>
          </div>

          <p className="mt-5 eyebrow text-text-quaternary">
            Free to start. No card required
          </p>
        </div>
      </LandingReveal>
    </section>
  );
}

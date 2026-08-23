import { LandingReveal } from "@/components/landing/landing-reveal";

// ============================================================
// NEXUS LANDING — VALUE BAND
// The problem → answer beat between the product preview and the
// model. Editorial, quiet, typographic: no cards, no icons.
// ============================================================

export function ValueBand() {
  return (
    <section className="px-5 py-20 sm:px-6 sm:py-28" aria-label="Why NEXUS">
      <LandingReveal>
        <div className="mx-auto flex max-w-[720px] flex-col items-center text-center">
          <span className="eyebrow text-text-tertiary">The problem</span>
          <p className="mt-5 max-w-[640px] text-[22px] leading-[1.3] tracking-[-0.02em] text-text-primary sm:text-[28px] sm:leading-[1.28]">
            The status of your work is spread across tools —{" "}
            <span className="text-text-tertiary">
              so nobody sees the risk until it is late.
            </span>
          </p>

          <span className="my-10 inline-flex h-px w-8 bg-border-strong" aria-hidden="true" />

          <span className="eyebrow text-text-tertiary">The answer</span>
          <p className="mt-5 max-w-[640px] text-[22px] leading-[1.3] tracking-[-0.02em] text-text-primary sm:text-[28px] sm:leading-[1.28]">
            NEXUS reads it continuously —{" "}
            <span className="text-text-tertiary">
              and tells you what to do about it.
            </span>
          </p>
        </div>
      </LandingReveal>
    </section>
  );
}

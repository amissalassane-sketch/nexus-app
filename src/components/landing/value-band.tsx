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
          <span className="font-mono text-mono uppercase tracking-[0.12em] text-text-tertiary">
            The problem
          </span>
          <p className="mt-5 max-w-[640px] text-[22px] leading-[1.3] tracking-[-0.02em] text-text-primary sm:text-[28px] sm:leading-[1.28]">
            Work lives in tabs, tools and memory —{" "}
            <span className="text-text-tertiary">and none of them talk to each other.</span>
          </p>

          <span className="my-10 inline-flex h-px w-8 bg-border-strong" aria-hidden="true" />

          <span className="font-mono text-mono uppercase tracking-[0.12em] text-text-tertiary">
            The answer
          </span>
          <p className="mt-5 max-w-[640px] text-[22px] leading-[1.3] tracking-[-0.02em] text-text-primary sm:text-[28px] sm:leading-[1.28]">
            NEXUS connects them —{" "}
            <span className="text-text-tertiary">goal by goal, task by task.</span>
          </p>
        </div>
      </LandingReveal>
    </section>
  );
}

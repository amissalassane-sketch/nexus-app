import type { CSSProperties } from "react";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";

// ============================================================
// NEXUS LANDING — FOUR MOVES
//
// Four independent cards would read as four features. The four
// moves are a CHAIN, so they are drawn as one: a rail, four
// markers, and activation that travels left to right as the
// section reveals. The rail closes on a still-lit dot — the
// system keeps reading after the fourth move.
//
// Below `lg` the chain becomes a vertical flow with its own
// connector — it is never squeezed into a row. Activation is
// pure CSS (it hangs off `.landing-reveal.is-visible`), so there
// is no extra observer and nothing to hydrate.
// ============================================================

const STEPS = [
  {
    number: "01",
    title: "Connect",
    body: "Connect your Gmail, Calendar, Notion, GitHub and Slack. NEXUS reads the work so you don't have to guess what matters.",
  },
  {
    number: "02",
    title: "Understand",
    body: "Deadlines, dependencies and real progress connect into one working context without manual data entry.",
  },
  {
    number: "03",
    title: "Prioritize",
    body: "Cross-tool risk is computed continuously: blockers and drift are ranked by operational consequence.",
  },
  {
    number: "04",
    title: "Act",
    body: "Recommends clear next steps with full evidence. Consequential changes always require your confirmation.",
  },
] as const;

const LOOP = [
  "Connect",
  "Context",
  "Understand",
  "Prioritize",
  "Act",
  "Verify",
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto w-full max-w-page">
        <LandingReveal>
          <SectionHeading
            eyebrow="The Operating Cycle"
            title="Connect. Understand. Prioritize. Act."
            sub="NEXUS keeps learning from what changes. It connects the tools you already use and turns their scattered activity into the one decision you need to make right now."
          />
        </LandingReveal>

        <LandingReveal delay={80}>
          {/* The rail lives outside the <ol> — a <span> is not valid
              list content — but inside `.nexus-chain` so it can be
              positioned against the steps. */}
          <div className="nexus-chain relative mt-14 lg:mt-16">
            <span
              className="nexus-chain-rail hidden lg:block"
              aria-hidden="true"
            />

            <ol className="grid gap-10 lg:grid-cols-4 lg:gap-6">
              {STEPS.map((step, index) => (
                <li
                  key={step.number}
                  className="relative pl-9 lg:pl-0 lg:pt-10"
                  style={{ "--chain-index": index } as CSSProperties}
                >
                  {/* Connector for the stacked (mobile / tablet) flow */}
                  {index < STEPS.length - 1 ? (
                    <span
                      className="absolute bottom-[-40px] left-[7px] top-9 w-px bg-border-subtle lg:hidden"
                      aria-hidden="true"
                    />
                  ) : null}

                  <span className="nexus-chain-marker" aria-hidden="true" />

                  <div className="nexus-chain-step nexus-panel-quiet p-4">
                    <span className="font-mono text-[15px] tabular-nums tracking-[-0.02em] text-text-secondary">
                      {step.number}
                    </span>
                    <h3 className="mt-2 text-xl text-text-primary">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 max-w-[30ch] text-small text-text-secondary">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            {/* The chain stays live after the last move. */}
            <p className="nexus-chain-endcap mt-9 flex items-center justify-center gap-2 lg:mt-10">
              <span className="h-1 w-1 rounded-full bg-lavender/80" aria-hidden="true" />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-tertiary">
                NEXUS keeps learning from what changes
              </span>
            </p>
          </div>
        </LandingReveal>

        {/* The same chain, stated once in full, for the visitor who wants
            the whole loop in one line. Numbered so order never depends
            on the arrows. */}
        <LandingReveal delay={140}>
          <ol
            className="mt-10 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2"
            aria-label="The NEXUS loop"
          >
            {LOOP.map((step, index) => (
              <li key={step} className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-secondary">
                  {step}
                </span>
                {index < LOOP.length - 1 ? (
                  <span
                    className="nexus-flow-arrow h-px w-3 bg-border-strong"
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </LandingReveal>
      </div>
    </section>
  );
}

import type { CSSProperties } from "react";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";

// ============================================================
// NEXUS LANDING — FOUR MOVES
//
// DESIGN AUDIT: four independent cards read as four features. The
// four moves are a CHAIN, so they are drawn as one: a rail, four
// markers, and activation that travels left to right as the section
// reveals. Below `lg` the chain becomes a vertical flow with its own
// connector — it is never squeezed into a row.
//
// Activation is pure CSS (it hangs off `.landing-reveal.is-visible`),
// so there is no extra observer and nothing to hydrate.
// ============================================================

const STEPS = [
  {
    number: "01",
    title: "Read",
    body: "Every goal, project, task and activity event in the workspace.",
  },
  {
    number: "02",
    title: "Understand",
    body: "It connects deadlines and dependencies, and reads progress and momentum from the data.",
  },
  {
    number: "03",
    title: "Decide",
    body: "Risk is surfaced, ranked and reduced to one next action.",
  },
  {
    number: "04",
    title: "Run",
    body: "Execution asks for confirmation, then verifies the result.",
  },
] as const;

const LOOP = [
  "Read",
  "Understand",
  "Surface risk",
  "Recommend",
  "Execute",
  "Verify",
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 px-5 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto w-full max-w-[1120px]">
        <LandingReveal>
          <SectionHeading
            eyebrow="How it works"
            title="Four moves. Then it keeps watching."
            sub="NEXUS is a system, not a dashboard to babysit. It takes the work you already have and turns it into the decision you have to make."
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

                  <div className="nexus-chain-step">
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
          </div>
        </LandingReveal>

        {/* The same chain, stated once in full, for the visitor who wants
            the whole loop in one line. Numbered so order never depends
            on the arrows. */}
        <LandingReveal delay={140}>
          <ol
            className="mt-14 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 lg:mt-16"
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

import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";

// ============================================================
// NEXUS LANDING — HOW IT WORKS
// Four steps, no long text. The horizontal rule + dots draw the
// progression on desktop; the same order reads as a stack on mobile.
// ============================================================

const STEPS = [
  {
    number: "01",
    title: "Set your direction",
    body: "Define goals that measure real outcomes.",
  },
  {
    number: "02",
    title: "Organize the work",
    body: "Group tasks into projects that move goals.",
  },
  {
    number: "03",
    title: "Execute",
    body: "Capture tasks with dates and priorities.",
  },
  {
    number: "04",
    title: "Let NEXUS surface what matters",
    body: "Overdue, blocked, at risk — and the next best action.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 px-5 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto w-full max-w-[1120px]">
        <LandingReveal>
          <SectionHeading
            eyebrow="How it works"
            title="Four moves. Then it runs itself."
            sub="NEXUS is a system, not a dashboard to babysit. Set it up once and the work stays connected from goal to activity."
          />
        </LandingReveal>

        <LandingReveal delay={100}>
          <div className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-6">
            <span
              className="absolute left-0 right-0 top-[7px] hidden h-px bg-border-strong lg:block"
              aria-hidden="true"
            />
            {STEPS.map((step) => (
              <div key={step.number} className="relative pt-8 lg:pt-10">
                <span
                  className="absolute left-0 top-0 hidden h-[15px] w-[15px] rounded-full border border-border-strong bg-bg-base lg:block"
                  aria-hidden="true"
                />
                <span className="font-mono text-[15px] tabular-nums tracking-[-0.02em] text-text-tertiary">
                  {step.number}
                </span>
                <h3 className="mt-3 max-w-[16ch] text-h2 text-text-primary">{step.title}</h3>
                <p className="mt-1.5 max-w-[26ch] text-small text-text-secondary">{step.body}</p>
              </div>
            ))}
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

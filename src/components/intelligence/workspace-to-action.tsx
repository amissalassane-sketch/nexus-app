import type { CSSProperties } from "react";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { SectionHeading } from "@/components/landing/section-heading";

// ============================================================
// SECTION 6 — FROM WORKSPACE TO ACTION
// The reasoning loop, written out. A single CSS sequence walks
// the chain so the page feels alive without a frame of JS.
// ============================================================

const STEPS = [
  {
    label: "Your workspace",
    body: "Tasks, projects, goals and activity — already there, already yours.",
  },
  {
    label: "NEXUS analyzes",
    body: "The engine reads the current state of the workspace, on every visit.",
  },
  {
    label: "Signals",
    body: "Overdue, blocked, at risk, drifting, moving — each one named.",
  },
  {
    label: "Priority",
    body: "Everything open is ranked against everything else that is open.",
  },
  {
    label: "Next best action",
    body: "One thing to do now, with the reasoning that put it there.",
  },
];

export function WorkspaceToAction() {
  return (
    <section id="flow" className="scroll-mt-20 px-5 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto w-full max-w-[1120px]">
        <LandingReveal>
          <SectionHeading
            eyebrow="From workspace to action"
            title="A loop, not a conversation."
            sub="Nothing to prompt, nothing to explain, nothing to maintain. The workspace changes, the reading changes with it."
          />
        </LandingReveal>

        <LandingReveal delay={80}>
          <ol className="mx-auto mt-14 w-full max-w-[560px]">
            {STEPS.map((step, index) => {
              const isLast = index === STEPS.length - 1;
              return (
                <li key={step.label} className="flex gap-5">
                  <div className="flex flex-col items-center pt-[7px]">
                    <span
                      className="nexus-intel-step-dot h-2 w-2 shrink-0 rounded-full bg-bg-surface-3"
                      style={{ "--step-delay": `${index * 1000}ms` } as CSSProperties}
                      aria-hidden="true"
                    />
                    {!isLast ? (
                      <span
                        className="nexus-intel-step-line relative mt-1.5 w-px flex-1 bg-border-subtle"
                        style={{ "--step-delay": `${index * 1000}ms` } as CSSProperties}
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>

                  <div className={isLast ? "pb-0" : "pb-9"}>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-mono tabular-nums text-text-quaternary">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-mono text-mono uppercase tracking-[0.12em] text-text-primary">
                        {step.label}
                      </h3>
                    </div>
                    <p className="mt-2 text-body text-text-secondary">{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </LandingReveal>
      </div>
    </section>
  );
}

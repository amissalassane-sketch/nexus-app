import { Activity, ArrowRight, Check, CheckSquare, FolderKanban, Target } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { ButtonLink } from "@/components/ui/button";

// ============================================================
// NEXUS LANDING — THE NEXUS MODEL
// The fundamental section: GOAL → PROJECT → TASK → ACTIVITY,
// drawn as a connected cascade (a vertical chain, not four loose
// cards) so the visitor sees the relationship between levels.
// ============================================================

const LEVELS = [
  {
    icon: Target,
    name: "Goal",
    line: "Where you're going.",
    detail: "Outcomes with real progress — measured, not decorative.",
    meta: "Ship v1 · 72%",
  },
  {
    icon: FolderKanban,
    name: "Project",
    line: "What you're moving forward.",
    detail: "Work grouped around a goal. Progress counts real tasks.",
    meta: "4 of 9 done",
  },
  {
    icon: CheckSquare,
    name: "Task",
    line: "What you do next.",
    detail: "Priorities, due dates and a focus list — nothing decorative.",
    meta: "Next: onboarding",
  },
  {
    icon: Activity,
    name: "Activity",
    line: "What actually happened.",
    detail: "Every change recorded. Who, what and when — always traceable.",
    meta: "09:41 · done",
  },
] as const;

const WHY_REAL = [
  "Goals are measured by real progress, never a slider.",
  "Project progress is counted from the tasks inside it.",
  "Activity is a record of what happened, not what you meant to do.",
];

export function ModelSection() {
  return (
    <section id="model" className="scroll-mt-20 px-5 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto grid w-full max-w-[1120px] items-start gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <LandingReveal className="lg:sticky lg:top-24">
          <SectionHeading
            align="left"
            eyebrow="The NEXUS model"
            title={
              <>
                Not a todo list.
                <br />
                A connected system.
              </>
            }
            sub="A todo list stores tasks. NEXUS connects four levels: a goal sets the direction, a project moves it forward, a task is the next concrete step, and activity records what actually happened."
          />

          <ul className="mt-7 flex flex-col gap-3">
            {WHY_REAL.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-small text-text-secondary">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-bg-surface">
                  <Check size={10} strokeWidth={2.5} className="text-text-primary" aria-hidden="true" />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <ButtonLink href="/signup" variant="secondary" size="md">
              Start with NEXUS
              <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
            </ButtonLink>
          </div>
        </LandingReveal>

        <LandingReveal delay={90}>
          <div className="rounded-[20px] border border-border-default bg-bg-subtle/60 p-5 sm:p-6">
            <p className="font-mono text-mono uppercase tracking-[0.12em] text-text-tertiary">
              Goal → Project → Task → Activity
            </p>

            <div className="mt-4">
              {LEVELS.map((level, index) => {
                const Icon = level.icon;
                return (
                  <div key={level.name} className="flex gap-4">
                    {/* Connector column: icon, then a vertical link to the next level. */}
                    <div className="flex w-11 shrink-0 flex-col items-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-input border border-border-default bg-bg-surface text-text-secondary">
                        <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      {index < LEVELS.length - 1 ? (
                        <span
                          className="mt-2 w-px flex-1 bg-border-strong"
                          aria-hidden="true"
                          style={{ minHeight: 28 }}
                        />
                      ) : null}
                    </div>

                    <div className={index < LEVELS.length - 1 ? "min-w-0 flex-1 pb-7" : "min-w-0 flex-1"}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <h3 className="flex items-baseline gap-2 text-h2 text-text-primary">
                          <span className="font-mono text-mono uppercase tracking-[0.08em] text-text-quaternary">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {level.name}
                        </h3>
                        <span className="font-mono text-mono tabular-nums text-text-tertiary">
                          {level.meta}
                        </span>
                      </div>
                      <p className="mt-1 text-body-medium text-text-primary">{level.line}</p>
                      <p className="mt-0.5 text-small text-text-secondary">{level.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

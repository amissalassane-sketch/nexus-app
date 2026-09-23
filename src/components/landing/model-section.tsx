import type { CSSProperties } from "react";
import {
  IconActivity,
  IconArrowRight,
  IconCheck,
  IconChecklist,
  IconLayoutKanban,
  IconTarget,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { ButtonLink } from "@/components/ui/button";

// ============================================================
// NEXUS LANDING — THE NEXUS MODEL
//
// The fundamental section: GOAL → PROJECT → TASK → ACTIVITY.
//
// DESIGN AUDIT: the four levels were four cards with metadata set in
// quaternary at 11.5px — present, but effectively invisible. Each
// level now carries three clearly separated steps of information:
//
//   01 · GOAL              ← eyebrow (the level)
//   Ship v1                ← the concrete instance (primary, 20px)
//   Target · Sep 14        ← the metadata, as a chip, never dimmed
//   Where you're going.    ← what the level means
//
// and they are drawn as one cascade: a rail, four markers, links
// that grow in as the section reveals.
// ============================================================

const LEVELS = [
  {
    icon: IconTarget,
    name: "Goal",
    example: "Ship v1",
    meta: "Target · Sep 14",
    line: "Where you're going.",
    detail: "Outcomes with real progress, not a slider.",
  },
  {
    icon: IconLayoutKanban,
    name: "Project",
    example: "Onboarding",
    meta: "8 tasks · 2 blocked",
    line: "What you're moving forward.",
    detail: "Work grouped around a goal. Progress counts real tasks.",
  },
  {
    icon: IconChecklist,
    name: "Task",
    example: "Review signup flow",
    meta: "Due in 2 days",
    line: "What you do next.",
    detail: "Priorities, due dates and a focus list. Nothing decorative.",
  },
  {
    icon: IconActivity,
    name: "Activity",
    example: "Last completion",
    meta: "42 minutes ago",
    line: "What actually happened.",
    detail: "Every change recorded: who, what and when, always traceable.",
  },
] as const;

const WHY_REAL = [
  "Goals are measured by real progress, never a slider.",
  "Project progress is counted from the tasks inside it.",
  "Activity is a record of what happened, not what you meant to do.",
];

export function ModelSection() {
  return (
    <section id="model" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto grid w-full max-w-page items-start gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <LandingReveal className="lg:sticky lg:top-24">
          <SectionHeading
            align="left"
            eyebrow="The NEXUS model"
            title={
              <>
                An operating layer
                <br />
                for your work.
              </>
            }
            sub="A todo list keeps tasks. NEXUS keeps the relationships between them: a goal sets the direction, a project moves it, a task is the next concrete step, and activity records what actually happened, which is exactly what makes risk detectable."
          />

          <ul className="mt-7 flex flex-col gap-3">
            {WHY_REAL.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2.5 text-small text-text-secondary"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-bg-surface">
                  <NexusIcon
                    icon={IconCheck}
                    px={10}
                    className="text-text-primary"
                  />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <ButtonLink href="/signup" variant="secondary" size="md">
              Get started
              <NexusIcon icon={IconArrowRight} />
            </ButtonLink>
          </div>
        </LandingReveal>

        <LandingReveal delay={90}>
          <div className="nexus-panel p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="nexus-eyebrow">
                Goal → Project → Task → Activity
              </p>
              <span className="nexus-meta-strong">One connected chain</span>
            </div>

            <ol className="mt-6">
              {LEVELS.map((level, index) => {
                const Icon = level.icon;
                const isLast = index === LEVELS.length - 1;
                return (
                  <li
                    key={level.name}
                    className="nexus-cascade-step flex gap-4"
                    style={
                      { "--cascade-index": index } as CSSProperties
                    }
                  >
                    {/* Connector column: the marker, then a link to the
                        next level. */}
                    <div className="flex w-11 shrink-0 flex-col items-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-input border border-border-default bg-bg-surface text-text-secondary">
                        <NexusIcon icon={Icon} />
                      </span>
                      {isLast ? null : (
                        <span
                          className="nexus-cascade-link mt-2"
                          style={
                            { "--cascade-index": index } as CSSProperties
                          }
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div
                      className={
                        isLast ? "min-w-0 flex-1" : "min-w-0 flex-1 pb-7"
                      }
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
                        <h3 className="flex items-baseline gap-2 text-xl text-text-primary">
                          <span className="nexus-meta-strong">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {level.name}
                        </h3>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                        <p className="text-[17px] font-medium leading-[24px] tracking-[-0.015em] text-text-primary">
                          {level.example}
                        </p>
                        {/* Metadata as a chip: readable, never lost. */}
                        <span className="inline-flex h-[22px] shrink-0 items-center rounded-pill border border-border-default bg-bg-surface px-2.5 font-mono text-[11px] leading-none tracking-[0.01em] text-text-secondary">
                          {level.meta}
                        </span>
                      </div>

                      <p className="mt-2 text-small font-medium text-text-secondary">
                        {level.line}
                      </p>
                      <p className="mt-0.5 text-small text-text-tertiary">
                        {level.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

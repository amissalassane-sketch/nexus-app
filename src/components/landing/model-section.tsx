import type { CSSProperties } from "react";
import {
  IconActivity,
  IconArrowRight,
  IconCheck,
  IconChecklist,
  IconLayoutKanban,
  IconMail,
  IconCalendar,
  IconBrandGithub,
  IconNotes,
  IconBrandSlack,
  IconTarget,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { ButtonLink } from "@/components/ui/button";

// ============================================================
// NEXUS LANDING — THE NEXUS MODEL & OPERATING LAYER
//
// Mental Model: NEXUS is a Context Layer above the user's tools.
// It does NOT replace Gmail, Calendar, Notion or GitHub.
// It unifies them into one coherent context graph:
//
//              NEXUS
//        ┌───────────────┐
//        │ Context Layer │
//        └───────────────┘
//           ↑  ↑  ↑  ↑  ↑
//        Gmail Calendar Notion GitHub Slack Linear
//
// Plus the fundamental hierarchy:
// GOAL → PROJECT → TASK → ACTIVITY
// ============================================================

const LEVELS = [
  {
    icon: IconTarget,
    name: "Goal",
    example: "Ship v1",
    meta: "Target · Sep 14",
    line: "Where you're going.",
    detail: "Outcomes with real progress, not a manual slider.",
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
    detail: "Priorities, due dates and dependencies from all your tools.",
  },
  {
    icon: IconActivity,
    name: "Activity",
    example: "Last completion",
    meta: "42 minutes ago",
    line: "What actually happened.",
    detail: "Every change recorded across tools: who, what and when, always traceable.",
  },
] as const;

const DIFFERENTIATION = [
  {
    strong: "Not another task manager:",
    text: "We don't ask you to migrate tasks, recreate projects, or manually update duplicate statuses.",
  },
  {
    strong: "Not another chatbot:",
    text: "ChatGPT only answers what you remember to type. NEXUS continuously observes your working context.",
  },
  {
    strong: "Context above silos:",
    text: "Gmail, Calendar, Notion, Linear and GitHub stay where work happens. NEXUS connects the dots.",
  },
];

const TOOLS_LAYER = [
  { name: "Gmail", role: "Client requests", icon: IconMail },
  { name: "Calendar", role: "Time constraints", icon: IconCalendar },
  { name: "Notion", role: "Knowledge & specs", icon: IconNotes },
  { name: "GitHub", role: "Code & blockers", icon: IconBrandGithub },
  { name: "Slack", role: "Decisions & chat", icon: IconBrandSlack },
  { name: "Linear", role: "Task execution", icon: IconChecklist },
];

export function ModelSection() {
  return (
    <section id="model" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto grid w-full max-w-page items-start gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <LandingReveal className="lg:sticky lg:top-24">
          <SectionHeading
            align="left"
            eyebrow="Operating Layer"
            title={
              <>
                An operating layer
                <br />
                for your work.
              </>
            }
            sub="NEXUS connects the tools you already use and turns their scattered information into one working context. It doesn't replace your tools—it unifies them so you always know what matters now, why it matters, and where it came from."
          />

          <ul className="mt-7 flex flex-col gap-3.5">
            {DIFFERENTIATION.map((item) => (
              <li
                key={item.strong}
                className="flex items-start gap-3 text-small text-text-secondary"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-bg-surface">
                  <NexusIcon
                    icon={IconCheck}
                    px={10}
                    className="text-text-primary"
                  />
                </span>
                <span>
                  <strong className="font-semibold text-text-primary">
                    {item.strong}{" "}
                  </strong>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex items-center gap-3">
            <ButtonLink href="/signup" size="md">
              Get started
              <NexusIcon icon={IconArrowRight} />
            </ButtonLink>
            <ButtonLink href="#integrations" variant="secondary" size="md">
              View integrations
            </ButtonLink>
          </div>
        </LandingReveal>

        <LandingReveal delay={90}>
          <div className="flex flex-col gap-6">
            {/* The Mental Model Diagram (Audit Item #14) */}
            <div className="nexus-panel p-5 sm:p-7">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <p className="nexus-eyebrow">The Mental Model</p>
                <span className="nexus-meta-strong">Unified Context Layer</span>
              </div>

              {/* Diagram Body */}
              <div className="mt-5 flex flex-col items-center">
                {/* NEXUS Top Node */}
                <div className="flex w-full max-w-[340px] flex-col items-center rounded-card border border-lavender-border bg-bg-surface-2 p-3.5 text-center shadow-sm">
                  <span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-lavender">
                    <span className="h-2 w-2 rounded-full bg-lavender signal-pulse" aria-hidden="true" />
                    NEXUS Context Layer
                  </span>
                  <p className="mt-1 text-[11px] text-text-secondary">
                    Relationships · Priorities · Evidence · Actions
                  </p>
                </div>

                {/* Connecting Lines / Feeders */}
                <div className="my-2 flex flex-col items-center" aria-hidden="true">
                  <span className="h-6 w-px bg-border-strong" />
                  <div className="flex w-full max-w-[400px] items-center justify-between px-4">
                    <span className="h-px flex-1 bg-border-subtle" />
                    <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
                    <span className="h-px flex-1 bg-border-subtle" />
                  </div>
                </div>

                {/* Bottom Tools Grid */}
                <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
                  {TOOLS_LAYER.map((tool) => (
                    <div
                      key={tool.name}
                      className="flex items-center gap-2 rounded-nav border border-border-subtle bg-bg-surface p-2 text-left"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border border-border-subtle bg-bg-subtle">
                        <NexusIcon icon={tool.icon} px={12} className="text-text-primary" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] font-medium text-text-primary">
                          {tool.name}
                        </span>
                        <span className="block truncate font-mono text-[9.5px] text-text-tertiary">
                          {tool.role}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-center font-mono text-[10.5px] text-text-quaternary">
                  Your tools stay where they are. NEXUS sits above them as a contextual operating layer.
                </p>
              </div>
            </div>

            {/* Core Model Cascade (Goal → Project → Task → Activity) */}
            <div className="nexus-panel p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
                <p className="nexus-eyebrow">
                  Goal → Project → Task → Activity
                </p>
                <span className="nexus-meta-strong">Data Model Hierarchy</span>
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
                      {/* Connector column: marker then link */}
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
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

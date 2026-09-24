import type { CSSProperties } from "react";
import {
  IconChecklist,
  IconCpu,
  IconDatabase,
  IconFlame,
  IconRadar,
  IconRefresh,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { Badge } from "@/components/ui/badge";

// ============================================================
// SECTION 6 — FROM WORKSPACE TO ACTION
// The operational reasoning loop. A sequential chain showing
// how raw state flows into deterministic signals, ranked priority,
// and focused execution — closing the loop back to the workspace.
// ============================================================

const STEPS = [
  {
    step: "01",
    label: "Workspace state",
    tag: "Data layer",
    icon: IconDatabase,
    body: "Tasks, projects, milestones and dependencies already stored in your Postgres database. No duplicate input, no second brain to maintain.",
  },
  {
    step: "02",
    label: "Deterministic engine",
    tag: "Rule evaluation",
    icon: IconCpu,
    body: "The engine walks the workspace dependency graph on every visit. 0 LLM hallucinations, 4ms evaluation time, 100% reproducible.",
  },
  {
    step: "03",
    label: "Signal extraction",
    tag: "6 indicators",
    icon: IconRadar,
    body: "Isolates overdue deadlines, downstream blockers, goal pacing drift, and unassigned stalled initiatives into actionable alerts.",
  },
  {
    step: "04",
    label: "Topological priority",
    tag: "Ranking queue",
    icon: IconFlame,
    body: "All open tasks are ranked against blocker counts, milestone proximity, and inactivity intervals. The highest leverage item emerges on top.",
  },
  {
    step: "05",
    label: "Next best action",
    tag: "Execution",
    icon: IconChecklist,
    body: "A single, unambiguous task to do now — with the exact audit evidence and reason explaining why it belongs at the front of your queue.",
  },
];

export function WorkspaceToAction() {
  return (
    <section id="flow" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-page">
        <LandingReveal>
          <SectionHeading
            eyebrow="The operational loop"
            title={
              <>
                A loop, not a{" "}
                <span className="nexus-intel-accent">conversation</span>.
              </>
            }
            sub="Nothing to prompt, nothing to explain, nothing to maintain. The workspace changes, the reading changes with it."
          />
        </LandingReveal>

        <LandingReveal delay={80}>
          <div className="mx-auto mt-12 w-full max-w-[680px]">
            <ol className="flex flex-col gap-3">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isLast = index === STEPS.length - 1;

                return (
                  <li key={step.label} className="relative">
                    <div
                      className="group flex flex-col sm:flex-row sm:items-start gap-4 rounded-xl border border-border-default bg-bg-surface/90 p-5 shadow-xs transition-colors hover:border-lavender/40"
                      style={{ "--cycle-delay": `${index * 1200}ms` } as CSSProperties}
                    >
                      <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-default bg-bg-subtle text-lavender shadow-xs">
                          <NexusIcon icon={Icon} px={18} />
                        </span>
                        <span className="font-mono text-mono text-text-secondary font-medium tabular-nums">
                          {step.step}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-body font-semibold text-text-primary">
                            {step.label}
                          </h3>
                          <Badge tone="quiet">{step.tag}</Badge>
                        </div>
                        <p className="mt-2 text-small text-text-secondary leading-relaxed">
                          {step.body}
                        </p>
                      </div>
                    </div>

                    {!isLast ? (
                      <div className="flex justify-center py-1" aria-hidden="true">
                        <div className="h-4 w-px bg-gradient-to-b from-lavender/60 via-border-default to-transparent" />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            {/* Closed-loop feedback indicator */}
            <div className="mt-6 flex items-center justify-center gap-2.5 rounded-xl border border-lavender/30 bg-bg-surface/80 px-4 py-3 text-center shadow-xs">
              <NexusIcon icon={IconRefresh} px={15} className="text-lavender shrink-0 motion-safe:animate-[spin_12s_linear_infinite]" />
              <p className="text-small font-medium text-text-secondary">
                Closed feedback loop: Every completed task or new blocker resets the cycle in 4ms without prompting.
              </p>
            </div>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

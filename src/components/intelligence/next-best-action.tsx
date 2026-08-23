import type { CSSProperties } from "react";
import { AlertTriangle, ArrowRight, Ban, Clock, FolderOpen } from "lucide-react";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { Badge } from "@/components/ui/badge";
import { NexusLogo } from "@/components/nexus-logo";

// ============================================================
// SECTION 4 — THE NEXT BEST ACTION
// A product visualisation, explicitly labelled as one: example
// signals on the left, the ranked recommendation on the right.
// The loop (scan → signal → severity → priority → action) runs
// in CSS so it costs nothing and stops under reduced motion.
// ============================================================

const EXAMPLE_SIGNALS = [
  {
    icon: Clock,
    state: "Critical",
    tone: "danger" as const,
    title: "3 tasks are overdue.",
    reason: "Oldest: “Ship onboarding”, 4 days past due.",
  },
  {
    icon: Ban,
    state: "Blocked",
    tone: "warning" as const,
    title: "Design review is preventing progress.",
    reason: "2 tasks in “Onboarding v2” are waiting on it.",
  },
  {
    icon: AlertTriangle,
    state: "At risk",
    tone: "warning" as const,
    title: "“Ship v1” is at risk.",
    reason: "45% complete with 9 days to the target date.",
  },
  {
    icon: FolderOpen,
    state: "No action",
    tone: "info" as const,
    title: "“Website refresh” has no next action.",
    reason: "Active project, no open task for 11 days.",
  },
];

export function NextBestAction() {
  return (
    <section id="in-action" className="scroll-mt-20 px-5 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto w-full max-w-[1120px]">
        <LandingReveal>
          <SectionHeading
            eyebrow="The point of it"
            title={
              <>
                Not just what is late.{" "}
                <span className="nexus-intel-accent">What matters next.</span>
              </>
            }
            sub="Everything open is ranked against everything else. One action comes out on top, with the reasoning attached."
          />
        </LandingReveal>

        <LandingReveal delay={80}>
          <div className="nexus-intel-glass relative mt-14 rounded-card">
            <div className="nexus-intel-scan" aria-hidden="true" />

            <div className="relative flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <NexusLogo size={15} />
                <span className="eyebrow text-text-secondary">
                  Nexus Intelligence
                </span>
              </div>
              <Badge>Product visualisation</Badge>
            </div>

            <div className="relative grid lg:grid-cols-[1.05fr_1fr]">
              <div className="border-b border-border-subtle p-5 sm:p-7 lg:border-b-0 lg:border-r">
                <p className="eyebrow text-text-tertiary">
                  Reading the workspace
                </p>

                <ul className="mt-4 flex flex-col gap-2">
                  {EXAMPLE_SIGNALS.map((signal, index) => {
                    const Icon = signal.icon;
                    return (
                      <li
                        key={signal.title}
                        className="nexus-intel-cycle flex items-start gap-3 rounded-row border border-border-subtle bg-white/[0.012] px-3.5 py-3"
                        style={
                          { "--cycle-delay": `${index * 2600}ms` } as CSSProperties
                        }
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border border-border-default bg-bg-surface text-text-tertiary">
                          <Icon size={12} strokeWidth={1.75} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={signal.tone}>{signal.state}</Badge>
                            <span className="text-small font-medium text-text-primary">
                              {signal.title}
                            </span>
                          </div>
                          <p className="mt-1 text-small text-text-tertiary">
                            {signal.reason}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex flex-col justify-center p-5 sm:p-7">
                <p className="eyebrow text-lavender">
                  Next best action
                </p>

                <h3 className="mt-3 text-[24px] font-medium leading-[1.14] tracking-[-0.03em] text-text-primary sm:text-[28px]">
                  Review the onboarding flow.
                </h3>

                <div className="mt-5 border-l border-border-default pl-4">
                  <p className="eyebrow text-text-tertiary">
                    Why
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {[
                      "3 related tasks are blocked behind it.",
                      "The “Ship v1” milestone is 9 days out.",
                      "It is the oldest overdue item in the project.",
                    ].map((reason) => (
                      <li key={reason} className="flex items-start gap-2">
                        <span
                          className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-text-quaternary"
                          aria-hidden="true"
                        />
                        <span className="text-small text-text-secondary">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Demo state: the real action lives in the workspace. */}
                <span
                  className="mt-6 inline-flex h-9 items-center gap-2 self-start rounded-pill border border-border-default bg-bg-surface px-4 text-button text-text-secondary"
                  aria-hidden="true"
                >
                  Review task
                  <ArrowRight size={13} strokeWidth={1.75} />
                </span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center eyebrow text-text-quaternary">
            Example signals — your workspace produces its own
          </p>
        </LandingReveal>
      </div>
    </section>
  );
}

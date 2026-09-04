import { AlertTriangle } from "lucide-react";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { Badge } from "@/components/ui/badge";

// ============================================================
// SECTION 5 — EXPLAINABLE INTELLIGENCE
// A signal opened up into the workspace rows it was computed
// from. No black box, no "revolutionary AI" — just the trace.
// ============================================================

const TRACE = [
  { label: "Goal", value: "Ship v1", meta: "progress 45%" },
  { label: "Target date", value: "in 9 days", meta: "not moved" },
  { label: "Open tasks", value: "6", meta: "2 blocked" },
  { label: "Last completion", value: "8 days ago", meta: "momentum down" },
];

const GUARANTEES = [
  {
    title: "Deterministic",
    body: "The same workspace always produces the same signals.",
  },
  {
    title: "Traceable",
    body: "Every signal names the task, project or goal it came from.",
  },
  {
    title: "Never invented",
    body: "If the workspace does not say it, NEXUS does not claim it.",
  },
];

export function ExplainableIntelligence() {
  return (
    <section id="explainable" className="scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto grid w-full max-w-page items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <LandingReveal>
          <SectionHeading
            align="left"
            eyebrow="Explainable"
            title={
              <>
                Every signal has a{" "}
                <span className="nexus-intel-accent">reason</span>.
              </>
            }
            sub="Intelligence you cannot question is intelligence you cannot trust. Open any signal and you land on the exact workspace state that produced it."
          />

          <ul className="mt-8 flex flex-col gap-4">
            {GUARANTEES.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span
                  className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-lavender"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-small font-medium text-text-primary">{item.title}</p>
                  <p className="mt-0.5 text-small text-text-secondary">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </LandingReveal>

        <LandingReveal delay={80}>
          <div className="nexus-intel-glass rounded-card p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-input border border-warning-border bg-warning-bg text-warning">
                <AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="warning">At risk</Badge>
                  <span className="eyebrow text-text-quaternary">
                    goal
                  </span>
                </div>
                <h3 className="mt-2 text-h1 text-text-primary">
                  &ldquo;Ship v1&rdquo; is at risk.
                </h3>
              </div>
            </div>

            <div className="mt-5 pl-4">
              <p className="eyebrow text-text-tertiary">
                Computed from
              </p>

              <ul className="mt-3 border-l border-border-default">
                {TRACE.map((row) => (
                  <li key={row.label} className="relative pl-5">
                    <span
                      className="absolute left-0 top-[15px] h-px w-3.5 bg-border-default"
                      aria-hidden="true"
                    />
                    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2 last:border-b-0">
                      <span className="text-small text-text-secondary">{row.label}</span>
                      <span className="flex items-baseline gap-2 text-right">
                        <span className="numeric text-small text-text-primary">
                          {row.value}
                        </span>
                        <span className="eyebrow text-text-quaternary">
                          {row.meta}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-6 border-t border-border-subtle pt-4 text-small text-text-tertiary">
              Read from your own tasks, projects and goals. No hidden scoring,
              no invented facts.
            </p>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

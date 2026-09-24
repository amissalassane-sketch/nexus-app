import { IconAlertTriangle } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { Badge } from "@/components/ui/badge";

// ============================================================
// SECTION 5 — EXPLAINABLE INTELLIGENCE
// A signal opened up into the workspace rows it was computed
// from. No black box, no "revolutionary AI" — just the trace.
//
// Coherent numbers:
// Open tasks: 6 (3 blocked, precisely matching the 3 blocked
// tasks waiting on design review in Next Best Action).
// ============================================================

const TRACE = [
  { label: "Goal", value: "Ship v1", meta: "progress 45%" },
  { label: "Target date", value: "in 9 days", meta: "not moved" },
  { label: "Open tasks", value: "6", meta: "3 blocked" },
  { label: "Oldest overdue", value: "Ship onboarding", meta: "4 days past due" },
  { label: "Last completion", value: "8 days ago", meta: "momentum down" },
];

const GUARANTEES = [
  {
    title: "Deterministic rule engine",
    body: "Calculated via TypeScript and Postgres relational queries. 0 LLM hallucinations, identical results every time.",
  },
  {
    title: "100% auditable lineage",
    body: "Every single signal names the exact task ID, project state, and deadline timestamp it was computed from.",
  },
  {
    title: "Zero external AI leakage",
    body: "Workspace data stays strictly inside your database. No private rows or secrets are ever sent to third-party LLMs.",
  },
];

export function ExplainableIntelligence() {
  return (
    <section id="explainable" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto grid w-full max-w-page items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <LandingReveal>
          <SectionHeading
            align="left"
            eyebrow="Explainability"
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
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-lavender"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-small font-medium text-text-primary">{item.title}</p>
                  <p className="mt-0.5 text-small text-text-secondary leading-relaxed">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </LandingReveal>

        <LandingReveal delay={80}>
          <div className="nexus-intel-glass rounded-card border border-border-default bg-bg-surface/90 p-5 shadow-card sm:p-7">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-input border border-lavender/30 bg-lavender/10 text-lavender">
                <NexusIcon icon={IconAlertTriangle} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">At risk</Badge>
                  <span className="eyebrow text-text-secondary">
                    goal
                  </span>
                </div>
                <h3 className="mt-2 text-h1 text-text-primary font-medium">
                  &ldquo;Ship v1&rdquo; is at risk.
                </h3>
              </div>
            </div>

            <div className="mt-5 pl-4">
              <p className="eyebrow text-text-secondary font-semibold">
                Computed from
              </p>

              <ul className="mt-3 border-l-2 border-border-default">
                {TRACE.map((row) => (
                  <li key={row.label} className="relative pl-5">
                    <span
                      className="absolute left-0 top-[15px] h-px w-3.5 bg-border-default"
                      aria-hidden="true"
                    />
                    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5 last:border-b-0">
                      <span className="text-small font-medium text-text-secondary">{row.label}</span>
                      <span className="flex items-baseline gap-2 text-right">
                        <span className="numeric text-small font-medium text-text-primary">
                          {row.value}
                        </span>
                        <span className="eyebrow text-text-secondary">
                          {row.meta}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-6 border-t border-border-subtle pt-4 text-small text-text-secondary">
              Read directly from your own tasks, projects and goals. No hidden scoring,
              no probabilistic hallucinations.
            </p>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

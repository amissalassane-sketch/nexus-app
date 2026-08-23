import { ArrowRight, Ban, Clock, FolderOpen, Sparkles, Target, TrendingUp, Zap } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { Badge } from "@/components/ui/badge";

// ============================================================
// NEXUS LANDING — NEXUS INTELLIGENCE
// Presented as a product capability, not a chatbot: a deterministic
// engine that reads the real workspace and surfaces what needs
// attention. Every claim below matches src/lib/intelligence/engine.ts.
// ============================================================

const SIGNALS = [
  {
    icon: Clock,
    title: "Overdue work",
    body: "Deadlines pass, NEXUS notices.",
  },
  {
    icon: Ban,
    title: "Blocked tasks",
    body: "Anything stuck that stalls the rest.",
  },
  {
    icon: FolderOpen,
    title: "No next action",
    body: "Projects with nothing moving them forward.",
  },
  {
    icon: Target,
    title: "Goals at risk",
    body: "Low progress close to the deadline.",
  },
  {
    icon: TrendingUp,
    title: "Momentum",
    body: "What actually got done this week.",
  },
  {
    icon: Zap,
    title: "Next best action",
    body: "The single thing to do right now.",
  },
] as const;

export function IntelligenceSection() {
  return (
    <section id="intelligence" className="scroll-mt-20 px-5 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto grid w-full max-w-[1120px] items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <LandingReveal>
          <SectionHeading
            align="left"
            eyebrow="Nexus Intelligence"
            title={
              <>
                It reads the work.
                <br />
                Not the chat.
              </>
            }
            sub="NEXUS analyzes the tasks, projects and goals you already have — no prompts, no setup. It flags what is drifting and tells you what to do next."
          />

          <ul className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {SIGNALS.map((signal) => {
              const Icon = signal.icon;
              return (
                <li key={signal.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-input border border-border-default bg-bg-surface text-text-tertiary">
                    <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-small font-medium text-text-primary">{signal.title}</p>
                    <p className="mt-0.5 text-small text-text-secondary">{signal.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-8 max-w-[460px] text-small text-text-tertiary">
            Everything NEXUS surfaces is computed from your real workspace data — never
            invented, never a guess. Every signal explains its own reason.
          </p>
        </LandingReveal>

        <LandingReveal delay={90}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Sparkles size={14} strokeWidth={1.75} className="text-lavender" aria-hidden="true" />
              <span className="eyebrow text-text-tertiary">
                What it looks like in the workspace
              </span>
            </div>

            {/* Example signal — critical */}
            <article className="rounded-card border border-danger-border bg-danger-bg/40 p-5">
              <div className="flex items-center justify-between gap-3">
                <Badge tone="danger">Critical</Badge>
                <span className="eyebrow text-text-quaternary">
                  task
                </span>
              </div>
              <h3 className="mt-3 text-h2 text-text-primary">3 tasks are overdue.</h3>
              <p className="mt-1 text-small text-text-secondary">
                The oldest is &ldquo;Ship onboarding&rdquo;, due 4 days ago and still open.
              </p>
              <span className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-pill border border-border-default bg-bg-surface px-3 text-caption text-text-secondary">
                Review task
                <ArrowRight size={12} strokeWidth={1.75} aria-hidden="true" />
              </span>
            </article>

            {/* Example signal — goal at risk */}
            <article className="rounded-card border border-warning-border bg-warning-bg/30 p-5">
              <div className="flex items-center justify-between gap-3">
                <Badge tone="warning">Warning</Badge>
                <span className="eyebrow text-text-quaternary">
                  goal
                </span>
              </div>
              <h3 className="mt-3 text-h2 text-text-primary">
                &ldquo;Ship v1&rdquo; is at risk.
              </h3>
              <p className="mt-1 text-small text-text-secondary">
                45% complete with 9 days to the deadline.
              </p>
              <span className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-pill border border-border-default bg-bg-surface px-3 text-caption text-text-secondary">
                Open goal
                <ArrowRight size={12} strokeWidth={1.75} aria-hidden="true" />
              </span>
            </article>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

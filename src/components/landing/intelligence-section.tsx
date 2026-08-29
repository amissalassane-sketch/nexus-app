import {
  ArrowRight,
  Ban,
  Clock,
  FolderOpen,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { Badge } from "@/components/ui/badge";

// ============================================================
// NEXUS LANDING — IT READS THE WORK. NOT THE CHAT.
//
// DESIGN AUDIT: this was already the strongest section, so it is
// reinforced rather than replaced. It now *shows* the intelligence
// instead of only describing it, and it borrows the /intelligence
// page's own vocabulary — severity badge, evidence rows, COMPUTED
// FROM trace — so both surfaces speak one language.
//
//   CRITICAL / WARNING signal → NEXT BEST ACTION → WHY → COMPUTED FROM
//
// Every claim below matches src/lib/intelligence/engine.ts.
// Nothing here is invented.
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

const WHY = [
  "3 related tasks are blocked behind it.",
  "The “Ship v1” milestone is 9 days out.",
  "It is the oldest overdue item in the project.",
];

const COMPUTED_FROM = [
  { label: "Goal", value: "Ship v1" },
  { label: "Target date", value: "in 9 days" },
  { label: "Open tasks", value: "6" },
  { label: "Last completion", value: "8 days ago" },
];

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
            sub="Your workspace already contains the signals. NEXUS connects them — no prompts, no setup, nothing to re-type."
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
                    <p className="text-h4 text-text-primary">{signal.title}</p>
                    <p className="mt-0.5 text-small text-text-secondary">
                      {signal.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="nexus-lead mt-8 max-w-[460px]">
            Everything NEXUS surfaces is computed from your real workspace data
            — never invented, never a guess. Every signal explains its own
            reason.
          </p>
        </LandingReveal>

        <LandingReveal delay={90}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles
                  size={14}
                  strokeWidth={1.75}
                  className="text-lavender"
                  aria-hidden="true"
                />
                <span className="nexus-eyebrow">
                  What it looks like in the workspace
                </span>
              </div>
              <Badge tone="neutral">Product visualisation</Badge>
            </div>

            <div className="nexus-panel p-4 sm:p-5">
              {/* ---------- Signal 1 — critical ---------- */}
              <article className="nexus-signal" data-severity="critical">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock
                      size={14}
                      strokeWidth={1.75}
                      className="nexus-signal-icon shrink-0"
                      aria-hidden="true"
                    />
                    <Badge tone="danger">Critical</Badge>
                  </div>
                  <span className="nexus-eyebrow">Overdue · task</span>
                </div>

                <h3 className="mt-3 text-h2 text-text-primary">
                  3 tasks are overdue.
                </h3>
                <p className="mt-1.5 text-small text-text-secondary">
                  The oldest is &ldquo;Ship onboarding&rdquo;, due 4 days ago and
                  still open.
                </p>

                <span className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-pill border border-border-default bg-bg-surface px-3 text-caption text-text-secondary">
                  Review task
                  <ArrowRight size={12} strokeWidth={1.75} aria-hidden="true" />
                </span>
              </article>

              {/* ---------- Signal 2 — warning ---------- */}
              <article
                className="nexus-signal mt-3"
                data-severity="warning"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Target
                      size={14}
                      strokeWidth={1.75}
                      className="nexus-signal-icon shrink-0"
                      aria-hidden="true"
                    />
                    <Badge tone="warning">Warning</Badge>
                  </div>
                  <span className="nexus-eyebrow">At risk · goal</span>
                </div>

                <h3 className="mt-3 text-h2 text-text-primary">
                  &ldquo;Ship v1&rdquo; is at risk.
                </h3>
                <p className="mt-1.5 text-small text-text-secondary">
                  45% complete with 9 days to the deadline.
                </p>

                {/* COMPUTED FROM — the /intelligence trace, reused. */}
                <div className="nexus-computed mt-4">
                  <p className="nexus-eyebrow">Computed from</p>
                  <dl className="mt-2">
                    {COMPUTED_FROM.map((row) => (
                      <div
                        key={row.label}
                        className="nexus-computed-row flex items-baseline justify-between gap-4 border-b border-border-subtle py-1.5 last:border-b-0"
                      >
                        <dt className="text-small text-text-secondary">
                          {row.label}
                        </dt>
                        <dd className="nexus-evidence-value">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </article>

              {/* ---------- Next best action ---------- */}
              <article className="nexus-signal mt-3" data-severity="positive">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Zap
                      size={14}
                      strokeWidth={1.75}
                      className="nexus-signal-icon shrink-0"
                      aria-hidden="true"
                    />
                    <Badge tone="lavender">Next best action</Badge>
                  </div>
                  <span className="nexus-eyebrow">Ranked #1</span>
                </div>

                <h3 className="mt-3 text-[20px] font-medium leading-[28px] tracking-[-0.02em] text-text-primary">
                  Review the onboarding flow.
                </h3>

                <div className="mt-4 border-l border-border-default pl-4">
                  <p className="nexus-eyebrow">Why</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {WHY.map((reason) => (
                      <li key={reason} className="flex items-start gap-2">
                        <span
                          className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-text-quaternary"
                          aria-hidden="true"
                        />
                        <span className="text-small text-text-secondary">
                          {reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </div>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

import {
  IconArrowRight,
  IconBan,
  IconBolt,
  IconClock,
  IconFolderOpen,
  IconSparkles,
  IconTarget,
  IconTrendingUp,
  type TablerIcon,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { Badge, type BadgeTone } from "@/components/ui/badge";

// ============================================================
// NEXUS LANDING — IT READS THE WORK. NOT THE CHAT.
//
// The strongest section of the page, reinforced so it belongs to
// the same visual system as /intelligence: the six signal types
// carry the exact severity badges the Intelligence page uses, and
// the panel on the right reuses its vocabulary — severity rail,
// NEXT BEST ACTION, WHY NEXUS RECOMMENDS THIS, COMPUTED FROM.
//
//   CRITICAL / WARNING signal → NEXT BEST ACTION → WHY → COMPUTED FROM
//
// Every claim below matches src/lib/intelligence/engine.ts.
// Nothing here is invented.
// ============================================================

const SIGNALS: {
  icon: TablerIcon;
  state: string;
  tone: BadgeTone;
  title: string;
  body: string;
}[] = [
  {
    icon: IconClock,
    state: "Critical",
    tone: "danger",
    title: "Overdue work",
    body: "Deadlines pass, NEXUS notices.",
  },
  {
    icon: IconBan,
    state: "Warning",
    tone: "warning",
    title: "Blocked tasks",
    body: "Anything stuck that stalls the rest.",
  },
  {
    icon: IconFolderOpen,
    state: "Info",
    tone: "info",
    title: "No next action",
    body: "Projects with nothing moving them forward.",
  },
  {
    icon: IconTarget,
    state: "Warning",
    tone: "warning",
    title: "Goals at risk",
    body: "Progress too low for the time left.",
  },
  {
    icon: IconTrendingUp,
    state: "Positive",
    tone: "success",
    title: "Momentum",
    body: "What actually got done this week.",
  },
  {
    icon: IconBolt,
    state: "Priority",
    tone: "lavender",
    title: "Next best action",
    body: "The one thing to do right now.",
  },
];

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
    <section id="intelligence" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto grid w-full max-w-page items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <LandingReveal>
          <SectionHeading
            align="left"
            eyebrow="Nexus Intelligence"
            title={
              <>
                It reads the work,
                <br />
                not the chat.
              </>
            }
            sub="Your workspace already contains the signals. NEXUS connects them: no prompts, no setup, nothing to re-type."
          />

          {/* Six signals — the same reading the Intelligence page gives. */}
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {SIGNALS.map((signal) => {
              const Icon = signal.icon;
              return (
                <li
                  key={signal.title}
                  className="nexus-panel p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-input border border-border-default bg-bg-surface text-text-secondary">
                      <NexusIcon icon={Icon} />
                    </span>
                    <Badge tone={signal.tone}>{signal.state}</Badge>
                  </div>
                  <p className="mt-3.5 text-h2 text-text-primary">{signal.title}</p>
                  <p className="mt-1 text-small text-text-secondary">
                    {signal.body}
                  </p>
                </li>
              );
            })}
          </ul>

          <p className="nexus-lead mt-8 max-w-[460px]">
            Everything NEXUS surfaces is computed from your real workspace
            data. Never invented, never a guess. Every signal explains its own
            reason.
          </p>
        </LandingReveal>

        <LandingReveal delay={90}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <NexusIcon
                  icon={IconSparkles}
                  px={14}
                  className="text-lavender"
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
                    <NexusIcon
                      icon={IconClock}
                      px={14}
                      className="nexus-signal-icon"
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
                  <NexusIcon icon={IconArrowRight} px={12} />
                </span>
              </article>

              {/* ---------- Signal 2 — warning ---------- */}
              <article
                className="nexus-signal mt-3"
                data-severity="warning"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <NexusIcon
                      icon={IconTarget}
                      px={14}
                      className="nexus-signal-icon"
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
                    <NexusIcon
                      icon={IconBolt}
                      px={14}
                      className="nexus-signal-icon"
                    />
                    <Badge tone="lavender">Next best action</Badge>
                  </div>
                  <span className="nexus-eyebrow">Ranked #1</span>
                </div>

                <h3 className="mt-3 text-[20px] font-medium leading-[28px] tracking-[-0.02em] text-text-primary">
                  Review the onboarding flow.
                </h3>

                <div className="mt-4 border-l border-border-default pl-4">
                  <p className="nexus-eyebrow">
                    Why NEXUS recommends this
                  </p>
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

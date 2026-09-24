import Link from "next/link";
import {
  IconArrowRight,
  IconBolt,
  IconClock,
  IconSparkles,
  IconTarget,
  type TablerIcon,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS LANDING — IT READS THE WORK. NOT THE CHAT.
//
// The landing pitch: selling the concept with speed and clarity,
// then pointing the visitor to /intelligence for the full deep dive.
// Palette is strictly noir / blanc / lavande.
// ============================================================

const SIGNAL_TIERS: {
  icon: TablerIcon;
  category: string;
  badge: string;
  tone: BadgeTone;
  isUrgent?: boolean;
  signals: string;
  summary: string;
}[] = [
  {
    icon: IconClock,
    category: "Friction & blocks",
    badge: "Immediate",
    tone: "lavender",
    isUrgent: true,
    signals: "Overdue work · Blocked tasks",
    summary: "Deadlines that passed and work held back by dependencies. NEXUS brings the bottleneck to the surface first.",
  },
  {
    icon: IconTarget,
    category: "Trajectory drift",
    badge: "Risk",
    tone: "neutral",
    signals: "Goals at risk · No next action",
    summary: "Active projects with stalled momentum and milestones slipping behind target dates.",
  },
  {
    icon: IconBolt,
    category: "Resolution",
    badge: "Focus",
    tone: "lavender",
    signals: "Next best action · Momentum",
    summary: "Everything open ranked continuously against everything else, distilled into one concrete next step.",
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

          {/* Differentiated signal tier list — fast synthesis on the landing page */}
          <div className="mt-8 flex flex-col gap-3">
            {SIGNAL_TIERS.map((tier) => {
              const Icon = tier.icon;
              return (
                <div
                  key={tier.category}
                  className={cn(
                    "rounded-card p-4 transition-[border-color,background-color] duration-200",
                    tier.isUrgent
                      ? "border border-lavender/35 bg-gradient-to-r from-lavender/[0.07] via-bg-surface/50 to-bg-surface/30"
                      : "border border-border-subtle/80 bg-white/[0.012]"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-input border",
                          tier.isUrgent
                            ? "border-lavender/40 bg-lavender/10 text-lavender"
                            : "border-border-default bg-bg-surface text-text-secondary"
                        )}
                      >
                        <NexusIcon icon={Icon} px={14} />
                      </span>
                      <span className="text-[13.5px] font-semibold text-text-primary">
                        {tier.category}
                      </span>
                    </div>
                    <Badge
                      tone={tier.tone}
                      className={cn(
                        tier.isUrgent && "border-lavender/40 bg-lavender/15 text-lavender font-semibold"
                      )}
                    >
                      {tier.badge}
                    </Badge>
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-text-tertiary">
                    {tier.signals}
                  </p>
                  <p className="mt-1 text-small text-text-secondary">
                    {tier.summary}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="nexus-lead max-w-[380px] text-[13.5px]">
              Every signal is computed from real workspace state. Never invented.
            </p>
            <Link
              href="/intelligence"
              className="group inline-flex items-center gap-1.5 font-mono text-[11.5px] uppercase tracking-[0.08em] text-lavender hover:text-white transition-colors"
            >
              <span>Explore the full engine</span>
              <NexusIcon icon={IconArrowRight} px={13} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
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
                      className="nexus-signal-icon text-lavender"
                    />
                    <Badge tone="lavender">Critical</Badge>
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
                      className="nexus-signal-icon text-text-secondary"
                    />
                    <Badge tone="neutral">Warning</Badge>
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
                      className="nexus-signal-icon text-lavender"
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

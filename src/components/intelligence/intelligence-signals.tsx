import type { CSSProperties } from "react";
import {
  IconBan,
  IconBolt,
  IconClock,
  IconFolderOpen,
  IconTarget,
  IconTrendingUp,
  type TablerIcon,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

// ============================================================
// SECTION 3 — WHAT IT SURFACES
// The six signal types the NEXUS engine actually computes
// (src/lib/intelligence/engine.ts). Nothing here is aspirational.
// ============================================================

type SignalSeverity = "critical" | "high" | "standard" | "quiet";

const SIGNALS: {
  icon: TablerIcon;
  state: string;
  severity: SignalSeverity;
  tone: BadgeTone;
  title: string;
  body: string;
}[] = [
  {
    icon: IconClock,
    state: "Critical",
    severity: "critical",
    tone: "lavender",
    title: "Overdue work",
    body: "A deadline has passed and the task is still open. NEXUS names the oldest one first.",
  },
  {
    icon: IconBan,
    state: "Blocked",
    severity: "critical",
    tone: "lavender",
    title: "Blocked tasks",
    body: "Work marked as blocked, held back by something that has to move first.",
  },
  {
    icon: IconTarget,
    state: "At risk",
    severity: "high",
    tone: "neutral",
    title: "Goals at risk",
    body: "Progress is too low for the time left before the target date.",
  },
  {
    icon: IconBolt,
    state: "Priority",
    severity: "high",
    tone: "lavender",
    title: "Next best action",
    body: "The single task worth doing now, chosen from everything currently open.",
  },
  {
    icon: IconFolderOpen,
    state: "Observing",
    severity: "quiet",
    tone: "quiet",
    title: "No next action",
    body: "An active project with nothing open against it. The work has quietly stopped.",
  },
  {
    icon: IconTrendingUp,
    state: "Finished",
    severity: "quiet",
    tone: "quiet",
    title: "Momentum",
    body: "What actually got finished this week, so progress is visible, not assumed.",
  },
];

export function IntelligenceSignals() {
  return (
    <section id="signals" className="scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto w-full max-w-page">
        <LandingReveal>
          <SectionHeading
            eyebrow="What it surfaces"
            title="Six signals, one reading of the workspace."
            sub="A short, ranked read of what is actually happening, and what is quietly going wrong."
          />
        </LandingReveal>

        <LandingReveal delay={80}>
          <ul className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SIGNALS.map((signal, index) => {
              const Icon = signal.icon;
              const isCritical = signal.severity === "critical";
              const isHigh = signal.severity === "high";

              return (
                <li
                  key={signal.title}
                  className={cn(
                    "nexus-intel-cycle rounded-card p-5 transition-[border-color,background-color,transform] duration-200",
                    isCritical
                      ? "border border-lavender/40 bg-gradient-to-b from-lavender/[0.09] via-bg-surface/60 to-bg-surface/30 shadow-[0_0_28px_-8px_rgba(233,228,255,0.14)]"
                      : isHigh
                      ? "border border-border-strong bg-bg-surface/70"
                      : "border border-border-subtle/70 bg-white/[0.008]"
                  )}
                  style={{ "--cycle-delay": `${index * 2600}ms` } as CSSProperties}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-input border transition-colors",
                        isCritical
                          ? "border-lavender/40 bg-lavender/10 text-lavender"
                          : isHigh
                          ? "border-border-strong bg-bg-surface text-text-primary"
                          : "border-border-subtle bg-bg-surface/50 text-text-tertiary"
                      )}
                    >
                      <NexusIcon icon={Icon} />
                    </span>
                    <Badge
                      tone={signal.tone}
                      className={cn(
                        isCritical && "border-lavender/40 bg-lavender/15 text-lavender font-semibold"
                      )}
                    >
                      {signal.state}
                    </Badge>
                  </div>
                  <h3
                    className={cn(
                      "mt-4 text-h2 font-medium tracking-[-0.015em]",
                      isCritical ? "text-white" : "text-text-primary"
                    )}
                  >
                    {signal.title}
                  </h3>
                  <p
                    className={cn(
                      "mt-1.5 text-small",
                      isCritical ? "text-text-primary/90" : "text-text-secondary"
                    )}
                  >
                    {signal.body}
                  </p>
                </li>
              );
            })}
          </ul>
        </LandingReveal>
      </div>
    </section>
  );
}

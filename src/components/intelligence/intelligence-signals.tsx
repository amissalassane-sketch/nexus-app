import type { CSSProperties } from "react";
import { Ban, Clock, FolderOpen, Target, TrendingUp, Zap } from "lucide-react";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/components/ui/badge";

// ============================================================
// SECTION 3 — WHAT IT SURFACES
// The six signal types the NEXUS engine actually computes
// (src/lib/intelligence/engine.ts). Nothing here is aspirational.
// ============================================================

const SIGNALS: {
  icon: typeof Clock;
  state: string;
  tone: BadgeTone;
  title: string;
  body: string;
}[] = [
  {
    icon: Clock,
    state: "Critical",
    tone: "danger",
    title: "Overdue work",
    body: "A deadline has passed and the task is still open. NEXUS names the oldest one first.",
  },
  {
    icon: Ban,
    state: "Warning",
    tone: "warning",
    title: "Blocked tasks",
    body: "Work marked as blocked, held back by something that has to move first.",
  },
  {
    icon: Target,
    state: "Warning",
    tone: "warning",
    title: "Goals at risk",
    body: "Progress is too low for the time left before the target date.",
  },
  {
    icon: FolderOpen,
    state: "Info",
    tone: "info",
    title: "No next action",
    body: "An active project with nothing open against it. The work has quietly stopped.",
  },
  {
    icon: TrendingUp,
    state: "Positive",
    tone: "success",
    title: "Momentum",
    body: "What actually got finished this week, so progress is visible, not assumed.",
  },
  {
    icon: Zap,
    state: "Priority",
    tone: "lavender",
    title: "Next best action",
    body: "The single task worth doing now, chosen from everything currently open.",
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
              return (
                <li
                  key={signal.title}
                  className="nexus-intel-cycle rounded-card border border-border-subtle bg-white/[0.012] p-5"
                  style={{ "--cycle-delay": `${index * 2600}ms` } as CSSProperties}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-input border border-border-default bg-bg-surface text-text-secondary">
                      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <Badge tone={signal.tone}>{signal.state}</Badge>
                  </div>
                  <h3 className="mt-4 text-h2 text-text-primary">{signal.title}</h3>
                  <p className="mt-1.5 text-small text-text-secondary">{signal.body}</p>
                </li>
              );
            })}
          </ul>
        </LandingReveal>
      </div>
    </section>
  );
}

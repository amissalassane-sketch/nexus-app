import {
  Activity,
  BrainCircuit,
  CheckSquare,
  Command,
  FolderKanban,
  LayoutDashboard,
  Sparkles,
  Target,
} from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";

// ============================================================
// NEXUS LANDING — FEATURES
// Real NEXUS capabilities only, each answering "why is this
// useful to me?". Command K, Intelligence, Workspace, Activity
// and the plan all exist in the actual application.
// ============================================================

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Workspace",
    body: "One surface for everything operational — no tabs, no context switching.",
  },
  {
    icon: Target,
    title: "Goals",
    body: "Outcomes stay visible next to the work, measured by real progress.",
  },
  {
    icon: FolderKanban,
    title: "Projects",
    body: "Work grouped around a goal. Progress counts real tasks, not sliders.",
  },
  {
    icon: CheckSquare,
    title: "Tasks",
    body: "Priorities, due dates and a focus list — captured in seconds.",
  },
  {
    icon: Activity,
    title: "Activity",
    body: "A record of what actually happened, so nothing quietly disappears.",
  },
  {
    icon: BrainCircuit,
    title: "NEXUS Intelligence",
    body: "Reads the workspace, explains the evidence, and names the next action.",
  },
  {
    icon: Command,
    title: "Command K",
    body: "Jump to any task, project or destination straight from the keyboard.",
  },
  {
    icon: Sparkles,
    title: "Free to start",
    body: "One workspace, two projects, one hundred tasks — no card required.",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-20 px-5 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto w-full max-w-[1120px]">
        <LandingReveal>
          <SectionHeading
            eyebrow="Features"
            title="Built around the work, not around the tool."
            sub="Every part of NEXUS exists for one reason: to keep the work connected, visible and actionable."
          />
        </LandingReveal>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <LandingReveal key={feature.title} delay={(index % 3) * 60}>
                <article className="h-full rounded-card border border-border-subtle bg-bg-subtle/40 p-5 transition-colors duration-150 ease-nexus hover:border-border-default hover:bg-bg-surface">
                  <div className="flex h-9 w-9 items-center justify-center rounded-input border border-border-default bg-bg-surface text-text-secondary">
                    <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-h3 text-text-primary">{feature.title}</h3>
                  <p className="mt-1.5 text-small text-text-secondary">{feature.body}</p>
                </article>
              </LandingReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

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
// NEXUS LANDING — FEATURE ARCHITECTURE
//
// DESIGN AUDIT: eight identical cards read as "feature soup". The
// eight items are not the same kind of thing:
//
//   THE OPERATING MODEL (6) → what NEXUS IS. Full cards, primary
//                             weight, the product's data model.
//   BUILT FOR SPEED (2)     → how NEXUS FEELS. One compact strip,
//                             secondary weight, two characteristics.
//
// Real NEXUS capabilities only — Command K, Intelligence, the plan
// limits and the workspace model all exist in the application.
// ============================================================

const OPERATING_MODEL = [
  {
    icon: LayoutDashboard,
    title: "Workspace",
    body: "One surface for everything operational. No tabs, no context switching.",
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
    body: "Priorities, due dates and a focus list, captured in seconds.",
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
] as const;

const BUILT_FOR_SPEED = [
  {
    icon: Command,
    title: "Command K",
    body: "Jump to any task, project or destination straight from the keyboard.",
  },
  {
    icon: Sparkles,
    title: "Free to start",
    body: "One workspace, two projects, one hundred tasks. No card required.",
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
            sub="Six parts make the model. Two make it fast. All of it keeps the work connected and turns it into the next action."
          />
        </LandingReveal>

        {/* ---------- The operating model — full weight ---------- */}
        <LandingReveal delay={80}>
          <div className="mt-12 lg:mt-14">
            <div className="flex items-center gap-3">
              <h3 className="nexus-eyebrow">The operating model</h3>
              <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
            </div>

            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {OPERATING_MODEL.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li
                    key={feature.title}
                    className="nexus-panel card-hover h-full p-5"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-input border border-border-default bg-bg-surface text-text-secondary">
                      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <h4 className="mt-4 text-[15px] font-semibold leading-[22px] tracking-[-0.015em] text-text-primary">
                      {feature.title}
                    </h4>
                    <p className="mt-1.5 text-small text-text-secondary">
                      {feature.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </LandingReveal>

        {/* ---------- Built for speed — secondary weight ---------- */}
        <LandingReveal delay={140}>
          <div className="mt-10 lg:mt-12">
            <div className="flex items-center gap-3">
              <h3 className="nexus-eyebrow">Built for speed</h3>
              <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
            </div>

            <ul className="nexus-panel mt-5 grid divide-y divide-border-subtle sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              {BUILT_FOR_SPEED.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li
                    key={feature.title}
                    className="flex items-start gap-3.5 p-5 sm:p-6"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-tertiary">
                      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-h4 text-text-primary">
                        {feature.title}
                      </h4>
                      <p className="mt-1 text-small text-text-secondary">
                        {feature.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

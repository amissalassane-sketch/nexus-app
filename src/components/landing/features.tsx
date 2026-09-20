import {
  IconActivity,
  IconBrain,
  IconChecklist,
  IconCommand,
  IconLayoutDashboard,
  IconLayoutKanban,
  IconSparkles,
  IconTarget,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";

// ============================================================
// NEXUS LANDING — FEATURE ARCHITECTURE
//
// The eight items are NOT the same kind of thing, so they are not
// presented as eight identical cards:
//
//   CORE MODEL (6)          → what NEXUS IS. Full cards, primary
//                             weight, the product's data model —
//                             the chain the intelligence reads.
//   PRODUCT EXPERIENCE (2)  → how NEXUS FEELS. One compact strip,
//                             secondary weight: Command K and
//                             Free to start are product attributes,
//                             not model concepts.
//
// The model chain (Goal → Project → Task → Activity → Intelligence)
// is drawn once above the cards so the mental model is stated before
// any feature is read. Real NEXUS capabilities only.
// ============================================================

const MODEL_FLOW = ["Goal", "Project", "Task", "Activity", "Intelligence"] as const;

const OPERATING_MODEL = [
  {
    icon: IconLayoutDashboard,
    title: "Workspace",
    body: "One surface for everything operational. No tabs, no context switching.",
  },
  {
    icon: IconTarget,
    title: "Goals",
    body: "Outcomes stay visible next to the work, measured by real progress.",
  },
  {
    icon: IconLayoutKanban,
    title: "Projects",
    body: "Work grouped around a goal. Progress counts real tasks, not sliders.",
  },
  {
    icon: IconChecklist,
    title: "Tasks",
    body: "Priorities, due dates and a focus list, captured in seconds.",
  },
  {
    icon: IconActivity,
    title: "Activity",
    body: "A record of what actually happened, so nothing quietly disappears.",
  },
  {
    icon: IconBrain,
    title: "NEXUS Intelligence",
    body: "Reads the workspace, explains the evidence, and names the next action.",
  },
] as const;

const PRODUCT_EXPERIENCE = [
  {
    icon: IconCommand,
    title: "Command K",
    body: "Jump to any task, project or destination straight from the keyboard.",
  },
  {
    icon: IconSparkles,
    title: "Free to start",
    body: "One workspace, two projects, one hundred tasks. No card required.",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto w-full max-w-page">
        <LandingReveal>
          <SectionHeading
            eyebrow="Features"
            title="Built around the work, not around the tool."
            sub="Six parts make the model. Two make it fast. All of it keeps the work connected and turns it into the next action."
          />
        </LandingReveal>

        {/* ---------- Core model — full weight ---------- */}
        <LandingReveal delay={80}>
          <div className="mt-12 lg:mt-14">
            <div className="flex items-center gap-3">
              <h3 className="nexus-eyebrow">Core model</h3>
              <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
              <span className="nexus-meta">What NEXUS reads</span>
            </div>

            {/* The model chain, stated once — horizontal, wraps on the
                smallest screens so it never overflows. */}
            <ol
              className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 lg:justify-start"
              aria-label="The NEXUS model: goal, project, task, activity, intelligence"
            >
              {MODEL_FLOW.map((level, index) => (
                <li key={level} className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-lavender/70" aria-hidden="true" />
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-secondary">
                      {level}
                    </span>
                  </span>
                  {index < MODEL_FLOW.length - 1 ? (
                    <span
                      className="h-px w-4 bg-gradient-to-r from-border-strong to-border-subtle"
                      aria-hidden="true"
                    />
                  ) : null}
                </li>
              ))}
            </ol>

            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {OPERATING_MODEL.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <li
                    key={feature.title}
                    className="nexus-panel card-hover h-full p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-input border border-border-default bg-bg-surface text-text-secondary">
                        <NexusIcon icon={Icon} />
                      </span>
                      <span className="nexus-meta mt-0.5">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
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

        {/* ---------- Product experience — secondary weight ---------- */}
        <LandingReveal delay={140}>
          <div className="mt-10 lg:mt-12">
            <div className="flex items-center gap-3">
              <h3 className="nexus-eyebrow">Product experience</h3>
              <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
              <span className="nexus-meta">How it feels</span>
            </div>

            <ul className="nexus-panel mt-5 grid divide-y divide-border-subtle sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              {PRODUCT_EXPERIENCE.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <li
                    key={feature.title}
                    className="flex items-start gap-3.5 p-5 sm:p-6"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-tertiary">
                      <NexusIcon icon={Icon} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <h4 className="text-h4 text-text-primary">
                          {feature.title}
                        </h4>
                        <span className="nexus-meta">
                          {String(index + 7).padStart(2, "0")}
                        </span>
                      </div>
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

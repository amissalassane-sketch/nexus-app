import { Layers, Lock, ShieldCheck, Zap } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";

// ============================================================
// NEXUS LANDING — TRUST
// No invented logos, statistics or testimonials. The trust case
// here is the product itself: its data model, its architecture,
// its honesty and its restraint.
// ============================================================

const TRUST_POINTS = [
  {
    icon: Layers,
    title: "Connected by design",
    body: "Goals, projects, tasks and activity live in one data model — nothing is a silo.",
  },
  {
    icon: Lock,
    title: "Private by architecture",
    body: "Every workspace is isolated with Postgres row-level security.",
  },
  {
    icon: ShieldCheck,
    title: "Honest by construction",
    body: "Plan limits are enforced server-side. No transaction is ever faked.",
  },
  {
    icon: Zap,
    title: "Lean by default",
    body: "Self-hosted fonts, no third-party trackers, no noise between you and the work.",
  },
] as const;

export function TrustSection() {
  return (
    <section className="px-5 py-20 sm:px-6 sm:py-28" aria-label="Why trust NEXUS">
      <div className="mx-auto w-full max-w-[1120px]">
        <LandingReveal>
          <SectionHeading
            eyebrow="Why NEXUS"
            title="Quiet, precise and honest by construction."
            sub="There are no invented logos or testimonials here. This is what NEXUS is, built the way it behaves."
          />
        </LandingReveal>

        <LandingReveal delay={100}>
          <div className="mt-12 grid gap-px overflow-hidden rounded-card border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
            {TRUST_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <div key={point.title} className="bg-bg-subtle/70 p-6">
                  <span className="flex h-8 w-8 items-center justify-center rounded-input border border-border-default bg-bg-surface text-text-secondary">
                    <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-h3 text-text-primary">{point.title}</h3>
                  <p className="mt-1.5 text-small text-text-secondary">{point.body}</p>
                </div>
              );
            })}
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

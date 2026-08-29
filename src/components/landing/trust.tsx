import { Layers, Lock, ShieldCheck, Zap } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";

// ============================================================
// NEXUS LANDING — TRUST
//
// DESIGN AUDIT: four equal cells read as a flat list. The four
// pillars are properties of ONE system, so they hang off it:
//
//                      NEXUS
//           /           |          |          \
//     Connected     Private     Honest      Lean
//     by design     by arch.    by build    by default
//
// Connectors are single hairlines. Every line below is a property
// that exists in this repository — no invented certification,
// statistic, logo or testimonial.
// ============================================================

const TRUST_POINTS = [
  {
    icon: Layers,
    title: "Connected by design",
    proof: "One data model",
    body: "Goals, projects, tasks and activity live in one model — nothing is a silo.",
  },
  {
    icon: Lock,
    title: "Private by architecture",
    proof: "Row-level security",
    body: "Every workspace is isolated in Postgres with row-level security.",
  },
  {
    icon: ShieldCheck,
    title: "Honest by construction",
    proof: "Server-side limits",
    body: "Plan limits are enforced server-side. No transaction is ever faked.",
  },
  {
    icon: Zap,
    title: "Lean by default",
    proof: "Self-hosted, no trackers",
    body: "Self-hosted fonts, no third-party trackers, no noise around the work.",
  },
] as const;

export function TrustSection() {
  return (
    <section
      className="nexus-band scroll-mt-20 px-5 py-20 sm:px-6 sm:py-28"
      aria-label="Why trust NEXUS"
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <LandingReveal>
          <SectionHeading
            eyebrow="Why NEXUS"
            title="Quiet, precise and honest by construction."
            sub="There are no invented logos or testimonials here. This is what NEXUS is, described the way it behaves."
          />
        </LandingReveal>

        <LandingReveal delay={100}>
          {/* ---------- Desktop: NEXUS at the centre, pillars below ---------- */}
          <div className="mt-14 hidden lg:block">
            <div className="flex justify-center">
              <span className="nexus-eyebrow-pill">NEXUS</span>
            </div>
            <span className="nexus-trust-drop mx-auto block" aria-hidden="true" />
            {/* The spine stops at the first and last column centre so every
                connector actually meets it. */}
            <span
              className="nexus-trust-spine mx-[12.5%] block"
              aria-hidden="true"
            />

            {/* No gap on this grid: with four equal columns and no
                gutter the column centres land exactly on 12.5% /
                37.5% / 62.5% / 87.5%, which is where the spine above
                starts and ends. Spacing is handled by cell padding. */}
            <ul className="grid grid-cols-4">
              {TRUST_POINTS.map((point) => {
                const Icon = point.icon;
                return (
                  <li
                    key={point.title}
                    className="flex flex-col items-center px-3"
                  >
                    <span
                      className="nexus-trust-drop block"
                      aria-hidden="true"
                    />
                    <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-pill border border-border-default bg-bg-surface text-text-secondary">
                      <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <div className="mt-4 text-center">
                      <h3 className="text-[15px] font-semibold leading-[22px] tracking-[-0.015em] text-text-primary">
                        {point.title}
                      </h3>
                      <p className="nexus-meta-strong mt-1.5">{point.proof}</p>
                      <p className="mt-2 text-small text-text-secondary">
                        {point.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ---------- Tablet / mobile: a vertical rail, never a squeezed row ---------- */}
          <ul className="mt-12 lg:hidden">
            {TRUST_POINTS.map((point, index) => {
              const Icon = point.icon;
              const isLast = index === TRUST_POINTS.length - 1;
              return (
                <li key={point.title} className="relative flex gap-4 pb-7 last:pb-0">
                  {isLast ? null : (
                    <span
                      className="absolute bottom-0 left-[15px] top-11 w-px bg-border-subtle"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-pill border border-border-default bg-bg-surface text-text-secondary">
                    <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 pt-1">
                    <h3 className="text-[15px] font-semibold leading-[22px] tracking-[-0.015em] text-text-primary">
                      {point.title}
                    </h3>
                    <p className="nexus-meta-strong mt-1">{point.proof}</p>
                    <p className="mt-1.5 text-small text-text-secondary">
                      {point.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </LandingReveal>
      </div>
    </section>
  );
}

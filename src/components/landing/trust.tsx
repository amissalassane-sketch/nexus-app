import { IconBolt, IconLock, IconShieldCheck, IconStack2 } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";

// ============================================================
// NEXUS LANDING — TRUST
//
// Four equal cells would read as a flat list. These are four
// properties of ONE system, so they hang off the mark:
//
//                      NEXUS
//           /           |          |          \
//     Connected     Private     Honest      Lean
//     by design     by arch.    by build    by default
//
// Each pillar gets its own identity — index, icon, proof chip —
// joined by a spine and small nodes, so the group reads as one
// constellation. Every line below is a property that exists in
// this repository: no invented certification, statistic, logo or
// testimonial.
// ============================================================

const TRUST_POINTS = [
  {
    icon: IconStack2,
    title: "Connected by design",
    proof: "One data model",
    body: "Goals, projects, tasks and activity live in one model. Nothing is a silo.",
  },
  {
    icon: IconLock,
    title: "Private by architecture",
    proof: "Row-level security",
    body: "Every workspace is isolated in Postgres with row-level security.",
  },
  {
    icon: IconShieldCheck,
    title: "Honest by construction",
    proof: "Server-side limits",
    body: "Plan limits are enforced server-side. The numbers you see are the ones the database checks.",
  },
  {
    icon: IconBolt,
    title: "Lean by default",
    proof: "Self-hosted, no trackers",
    body: "Self-hosted fonts, no third-party trackers. Nothing watches you browse.",
  },
] as const;

function Pillar({
  point,
  index,
}: {
  point: (typeof TRUST_POINTS)[number];
  index: number;
}) {
  const Icon = point.icon;
  return (
    <div className="flex h-full flex-col items-center px-3 text-center">
      <span className="nexus-trust-node" aria-hidden="true" />
      <span className="nexus-trust-drop -mt-px block" aria-hidden="true" />
      <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-pill border border-border-default bg-bg-surface text-text-secondary">
        <NexusIcon icon={Icon} />
      </span>
      <span className="nexus-meta mt-3">
        {String(index + 1).padStart(2, "0")}
      </span>
      <h3 className="mt-1.5 text-[15px] font-semibold leading-[22px] tracking-[-0.015em] text-text-primary">
        {point.title}
      </h3>
      <span className="mt-2 inline-flex h-[22px] items-center rounded-pill border border-border-default bg-bg-surface px-2.5 font-mono text-[10.5px] leading-none tracking-[0.04em] text-text-tertiary">
        {point.proof}
      </span>
      <p className="mt-3 max-w-[24ch] text-small text-text-secondary">
        {point.body}
      </p>
    </div>
  );
}

export function TrustSection() {
  return (
    <section
      className="nexus-band scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28"
      aria-label="Why trust NEXUS"
    >
      <div className="mx-auto w-full max-w-page">
        <LandingReveal>
          <SectionHeading
            eyebrow="Why NEXUS"
            title="Quiet, precise and honest by construction."
            sub="No invented logos or testimonials here. This is what NEXUS is, described the way it behaves."
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
              {TRUST_POINTS.map((point, index) => (
                <li
                  key={point.title}
                  className={index > 0 ? "border-l border-border-subtle" : undefined}
                >
                  <Pillar point={point} index={index} />
                </li>
              ))}
            </ul>
          </div>

          {/* ---------- Tablet / mobile: a vertical rail, never a squeezed row ---------- */}
          <ul className="mt-12 lg:hidden">
            {TRUST_POINTS.map((point, index) => {
              const Icon = point.icon;
              const isLast = index === TRUST_POINTS.length - 1;
              return (
                <li
                  key={point.title}
                  className="relative flex gap-4 pb-7 last:pb-0"
                >
                  {isLast ? null : (
                    <span
                      className="absolute bottom-0 left-[15px] top-11 w-px bg-border-subtle"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-pill border border-border-default bg-bg-surface text-text-secondary">
                    <NexusIcon icon={Icon} />
                  </span>
                  <div className="min-w-0 pt-1">
                    <div className="flex items-baseline gap-2">
                      <span className="nexus-meta">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-[15px] font-semibold leading-[22px] tracking-[-0.015em] text-text-primary">
                        {point.title}
                      </h3>
                    </div>
                    <span className="mt-1.5 inline-flex h-[22px] items-center rounded-pill border border-border-default bg-bg-surface px-2.5 font-mono text-[10.5px] leading-none tracking-[0.04em] text-text-tertiary">
                      {point.proof}
                    </span>
                    <p className="mt-2 text-small text-text-secondary">
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

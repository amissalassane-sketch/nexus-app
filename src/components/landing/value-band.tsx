import { LandingReveal } from "@/components/landing/landing-reveal";

// ============================================================
// NEXUS LANDING — PROBLEM → ANSWER
//
// Two deliberately unequal beats, so the page resolves instead
// of hovering:
//
//   THE PROBLEM  ·  quiet, tertiary, one line smaller
//        ↓
//   THE ANSWER   ·  primary, one step larger, more air around it
//
// The connector is a rule with a marker, not an emoji arrow: it
// states the relationship (this resolves into that) instead of
// decorating it. The answer carries the story — the work is
// already there, NEXUS keeps up with it.
// ============================================================

export function ValueBand() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28" aria-label="Why NEXUS">
      <LandingReveal>
        <div className="mx-auto flex max-w-[760px] flex-col items-center text-center">
          {/* ---------- The problem ---------- */}
          <p className="max-w-[620px] text-[20px] font-normal leading-[1.34] tracking-[-0.02em] text-text-tertiary sm:text-[24px] sm:leading-[1.32]">
            The status of your work sits in everything you already manage.
            The signals are there: they are just hard to see until it is
            late.
          </p>

          {/* ---------- The connector ---------- */}
          <div
            className="mt-10 flex flex-col items-center sm:mt-12"
            aria-hidden="true"
          >
            <span className="h-6 w-px bg-gradient-to-b from-border-subtle to-border-strong" />
            <span className="h-1.5 w-1.5 rounded-pill bg-lavender/70" />
            <span className="h-6 w-px bg-gradient-to-b from-border-strong to-border-subtle" />
          </div>

          {/* ---------- The answer ---------- */}
          <div className="mt-10 flex flex-col items-center sm:mt-12">
            <p className="max-w-[16ch] text-[34px] font-medium leading-[1.06] tracking-[-0.038em] text-text-primary sm:max-w-[18ch] sm:text-[48px]">
              NEXUS reads it continuously.
            </p>
            <p className="nexus-lead mt-6 max-w-[520px]">
              Your work changes constantly. NEXUS keeps up: it sees what is
              drifting, blocked or getting risky, and tells you what deserves
              attention now.
            </p>
          </div>
        </div>
      </LandingReveal>
    </section>
  );
}

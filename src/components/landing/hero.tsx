import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { HeroAtmosphere } from "@/components/landing/hero-atmosphere";
import { HeroField } from "@/components/landing/hero-field";

// ============================================================
// NEXUS LANDING — HERO
// The proposition in one line: NEXUS reads the work, not the chat.
// Black canvas, a subtle relationship field, the mark behind the type.
// Entrance is one staggered sequence that never blocks reading.
// ============================================================

const delay = (ms: number) =>
  ({ "--landing-hero-delay": `${ms}ms` }) as CSSProperties;

export function Hero({ notice }: { notice?: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden px-5 pb-16 pt-32 sm:px-6 sm:pb-20 sm:pt-40">
      <HeroAtmosphere />
      <HeroField />

      <div className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-col items-center text-center">
        {notice ? (
          <div
            className="landing-hero-item mb-8 w-full max-w-[460px] text-left"
            style={delay(0)}
          >
            {notice}
          </div>
        ) : null}

        <span
          className="landing-hero-item inline-flex h-[26px] items-center gap-2 rounded-pill border border-border-default bg-bg-subtle/80 px-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-secondary backdrop-blur-sm"
          style={delay(0)}
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-lavender signal-pulse"
            aria-hidden="true"
          />
          NEXUS Intelligence
        </span>

        <h1
          className="landing-hero-item mt-7 text-[40px] font-medium leading-[1.03] tracking-[-0.04em] text-text-primary sm:text-[58px] lg:text-[68px]"
          style={delay(70)}
        >
          It reads the work.
          <br />
          <span className="text-text-tertiary">Not the chat.</span>
        </h1>

        <p
          className="landing-hero-item mt-7 max-w-[580px] text-body text-text-secondary sm:text-[15.5px] sm:leading-[26px]"
          style={delay(140)}
        >
          NEXUS analyses the work already happening in your workspace and
          surfaces what is drifting, what is blocked, what is at risk — and what
          deserves your attention next.
        </p>

        <div
          className="landing-hero-item mt-9 flex flex-wrap items-center justify-center gap-2.5"
          style={delay(210)}
        >
          <ButtonLink href="/signup" size="lg">
            Get started
            <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
          </ButtonLink>
          <ButtonLink href="#product" variant="secondary" size="lg">
            See it in action
          </ButtonLink>
        </div>

        <p
          className="landing-hero-item mt-5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-quaternary"
          style={delay(280)}
        >
          Free to start — no card required
        </p>
      </div>
    </section>
  );
}

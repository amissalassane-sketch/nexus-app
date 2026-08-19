import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

// ============================================================
// NEXUS LANDING — HERO
// In less than five seconds the visitor understands what NEXUS
// is (a connected system), why it exists (scattered work), what
// it can do (goal → project → task → activity), and what to do
// next (Get started). Entrance is a single short stagger.
// ============================================================

const delay = (ms: number) =>
  ({ "--landing-hero-delay": `${ms}ms` }) as CSSProperties;

export function Hero({ notice }: { notice?: ReactNode }) {
  return (
    <section className="relative px-5 pb-14 pt-32 sm:px-6 sm:pb-16 sm:pt-40">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center text-center">
        {notice ? (
          <div
            className="landing-hero-item mb-8 w-full max-w-[460px] text-left"
            style={delay(0)}
          >
            {notice}
          </div>
        ) : null}

        <span
          className="landing-hero-item inline-flex h-[26px] items-center gap-2 rounded-pill border border-border-default bg-bg-subtle px-3 font-mono text-mono uppercase tracking-[0.1em] text-text-secondary"
          style={delay(0)}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-lavender" aria-hidden="true" />
          Personal operating system
        </span>

        <h1
          className="landing-hero-item mt-6 max-w-[15ch] text-[42px] font-medium leading-[1.04] tracking-[-0.04em] text-text-primary sm:text-[56px] lg:text-[64px]"
          style={delay(70)}
        >
          Everything important, one connected system.
        </h1>

        <p
          className="landing-hero-item mt-6 max-w-[540px] text-body text-text-secondary sm:text-[16px] sm:leading-[26px]"
          style={delay(140)}
        >
          NEXUS links goals, projects, tasks and activity in a single quiet
          workspace — then tells you what to do next.
        </p>

        <div
          className="landing-hero-item mt-8 flex flex-wrap items-center justify-center gap-3"
          style={delay(210)}
        >
          <ButtonLink href="/signup" size="lg">
            Get started
            <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" size="lg">
            Sign in
          </ButtonLink>
        </div>

        <p
          className="landing-hero-item mt-4 font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary"
          style={delay(280)}
        >
          Free to start — no card required
        </p>
      </div>
    </section>
  );
}

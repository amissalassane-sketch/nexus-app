import type { CSSProperties, ReactNode } from "react";
import { IconArrowRight } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { ButtonLink } from "@/components/ui/button";

import { HeroHeadline } from "@/components/landing/hero-headline";
import { HeroAtmosphere } from "@/components/landing/hero-atmosphere";

// ============================================================
// NEXUS LANDING — HERO
//
// Time-to-value is the job here. The visitor learns in one
// breath:
//   what NEXUS is   → "It reads the work." (+ rotating facet line)
//   what it does    → drift, blocks, risk, what deserves attention
//   what to do next → Get started · See it in action
//
// The animated field is the mark and the atmosphere *behind* the
// copy — never in front of it, and dimmed so the type stays the
// brightest thing on the page. The mono strip under the buttons
// answers "how does it work?" in one glance: READ → UNDERSTAND →
// SURFACE RISK → RECOMMEND → EXECUTE → VERIFY.
// ============================================================

const delay = (ms: number) =>
  ({ "--landing-hero-delay": `${ms}ms` }) as CSSProperties;

const FLOW = [
  "Connect",
  "Context",
  "Understand",
  "Prioritize",
  "Act",
  "Verify",
];

export function Hero({ notice }: { notice?: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32 lg:pt-36">
      <HeroAtmosphere />

      <div className="relative z-10 mx-auto flex w-full max-w-page flex-col items-center text-center">
        {notice ? (
          <div
            className="landing-hero-item mb-8 w-full max-w-[460px] text-left"
            style={delay(0)}
          >
            {notice}
          </div>
        ) : null}

        <span
          className="landing-hero-item nexus-eyebrow-pill"
          style={delay(0)}
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-lavender signal-pulse"
            aria-hidden="true"
          />
          Contextual Orchestration Layer
        </span>

        <h1
          className="landing-hero-item mt-6 max-w-[20ch] text-[38px] font-medium leading-[1.04] tracking-[-0.04em] text-text-primary sm:mt-7 sm:text-[54px] lg:text-[62px]"
          style={delay(70)}
        >
          {/* Screen readers hear the stable proposition once. */}
          <span className="sr-only">
            NEXUS reads the work. Your work is scattered. NEXUS puts it in context.
          </span>
          <span aria-hidden="true">
            It reads the work.
            <br />
            <HeroHeadline />
          </span>
        </h1>

        <p
          className="landing-hero-item nexus-lead mt-6 max-w-[640px] sm:mt-7"
          style={delay(140)}
        >
          Your work is scattered across tools. NEXUS connects your projects,
          tasks, calendar, email and documents to show you what matters now,
          why it matters, and where it came from.
        </p>

        <div
          className="landing-hero-item mt-8 flex w-full flex-col items-stretch gap-2.5 sm:mt-9 sm:w-auto sm:flex-row sm:items-center sm:justify-center"
          style={delay(210)}
        >
          <ButtonLink href="/signup" size="lg" className="sm:min-w-[190px]">
            Get started
            <NexusIcon icon={IconArrowRight} />
          </ButtonLink>
          <ButtonLink
            href="#product"
            variant="secondary"
            size="lg"
            className="sm:min-w-[190px]"
          >
            See how it works
          </ButtonLink>
        </div>

        <div
          className="landing-hero-item mt-4 flex flex-col items-center gap-1.5 text-center"
          style={delay(280)}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-quaternary">
            Free to start · No card required · Connect tools when you&apos;re ready
          </p>
          <p className="font-mono text-[10.5px] text-text-tertiary">
            Projects · Tasks · Gmail · Calendar · Documents
          </p>
        </div>

        {/* How it works, in one line. Numbered so the order is explicit
            and never depends on the arrows being read. */}
        <ol
          className="landing-hero-item mt-10 flex max-w-[760px] flex-wrap items-center justify-center gap-x-2.5 gap-y-2 sm:mt-12"
          style={delay(340)}
          aria-label="How NEXUS works"
        >
          {FLOW.map((step, index) => (
            <li key={step} className="flex items-center gap-2.5">
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] tabular-nums text-text-quaternary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-secondary">
                  {step}
                </span>
              </span>
              {index < FLOW.length - 1 ? (
                <span
                  className="nexus-flow-arrow h-px w-3 bg-border-strong"
                  aria-hidden="true"
                />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

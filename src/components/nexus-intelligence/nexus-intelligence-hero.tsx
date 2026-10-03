"use client";

import { type CSSProperties, type ReactNode } from "react";
import { IconArrowRight } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { ButtonLink } from "@/components/ui/button";
import { SlideLabel } from "@/components/ui/slide-label";
import { NexusIntelligenceVisual } from "./nexus-intelligence-visual";

// ============================================================
// NEXUS INTELLIGENCE — HERO
//
// The signal core is decorative; the page remains semantic HTML.
//
//   layer 0  a theme-friendly orbital signal illustration
//   layer 1  the copy and the two NEXUS actions
//
// The illustration stays restrained and to the right on desktop, then
// drops behind the copy at low opacity on mobile. Theme surfaces remain
// visible around it.
// Every claim below still maps to src/lib/intelligence/engine.ts.
// ============================================================

const delay = (ms: number) =>
  ({ "--nxi-delay": `${ms}ms` }) as CSSProperties;

export interface NexusIntelligenceHeroProps {
  notice?: ReactNode;
  /** `hoverLabel` turns the primary CTA into the slide interaction: the
   *  resting label states the offer, the revealed one states the outcome
   *  ("Get started" → "Start building"). Omit it and the CTA is still. */
  primaryCta?: { label: string; href: string; hoverLabel?: string };
  secondaryCta?: { label: string; href: string };
  dense?: boolean;
}

const FOOTNOTES = [
  { label: "Reads the work you already have" },
  { label: "Explains every signal it surfaces" },
  { label: "Free to start · No card required" },
] as const;

export function NexusIntelligenceHero({
  notice,
  primaryCta = {
    label: "Get started",
    href: "/signup",
    hoverLabel: "Start building",
  },
  secondaryCta = { label: "See how it works", href: "#in-action" },
  dense = false,
}: NexusIntelligenceHeroProps) {
  return (
    <section
      className={`nexus-intelligence-hero relative isolate flex flex-col overflow-hidden pt-12 sm:pt-14 bg-bg-base text-text-primary ${
        dense ? "min-h-[74svh]" : "min-h-[82svh] lg:min-h-[86svh]"
      }`}
    >
      {/* ---- Layer 0: restrained orbital signal illustration ---- */}
      <NexusIntelligenceVisual />

      {/* Bottom fade into the page */}
      <div
        aria-hidden="true"
        className="nexus-intelligence-bottom-fade pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-24"
      />

      {/* ---- Layer 1: the copy ---- */}
      <div className="relative z-10 mx-auto flex w-full max-w-page flex-1 flex-col px-4 sm:px-6">
        <div className="flex flex-1 flex-col items-center justify-start pt-6 pb-12 text-center lg:items-start lg:justify-center lg:py-10 lg:text-left">
          {notice ? (
            <div
              className="nexus-intelligence-item mb-6 w-full max-w-[460px] text-left"
              style={delay(0)}
            >
              {notice}
            </div>
          ) : null}

          <span
            className="nexus-intelligence-item inline-flex h-[28px] items-center gap-2 rounded-control border border-border-subtle bg-bg-surface-2 px-3.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-secondary backdrop-blur-sm"
            style={delay(60)}
          >
            <span
              className="nexus-intelligence-dot"
              aria-hidden="true"
            />
            The intelligence layer
          </span>

          <h1
            className="nexus-intelligence-item nexus-intelligence-lockup mt-6"
            style={delay(140)}
          >
            <span className="nexus-intelligence-lockup-primary !text-text-primary">NEXUS</span>
            <span className="nexus-intelligence-lockup-secondary !text-text-tertiary">
              INTELLIGENCE
            </span>
          </h1>

          <p
            className="nexus-intelligence-item mt-5 text-xl font-medium leading-[1.3] tracking-[-0.02em] text-text-primary sm:text-[24px]"
            style={delay(220)}
          >
            Your workspace, read end to end.
          </p>

          <p
            className="nexus-intelligence-item mt-4 max-w-[490px] text-balance text-body text-text-secondary"
            style={delay(300)}
          >
            NEXUS Intelligence reads your tasks, projects, goals and activity,
            connects the relationships between them and names the one thing
            worth doing next.
          </p>

          <div
            className="nexus-intelligence-item mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            style={delay(380)}
          >
            <ButtonLink
              href={primaryCta.href}
              size="lg"
              variant={primaryCta.hoverLabel ? "slide" : "primary"}
            >
              {primaryCta.hoverLabel ? (
                <SlideLabel
                  text={primaryCta.label}
                  hoverText={primaryCta.hoverLabel}
                />
              ) : (
                primaryCta.label
              )}
              <NexusIcon icon={IconArrowRight} />
            </ButtonLink>
            <ButtonLink
              href={secondaryCta.href}
              variant="secondary"
              size="lg"
              className="border-border-strong bg-bg-surface-2 text-text-primary hover:bg-bg-surface-3"
            >
              {secondaryCta.label}
            </ButtonLink>
          </div>
        </div>
      </div>

      {/* ---- Footnote rule ---- */}
      <div
        className="nexus-intelligence-item relative z-10 border-t border-border-subtle bg-bg-base"
        style={delay(520)}
      >
        <ul className="mx-auto flex w-full max-w-page flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:gap-8 sm:px-6 sm:py-4">
          {FOOTNOTES.map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-2.5 text-caption font-medium text-text-secondary sm:justify-start"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-lavender"
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

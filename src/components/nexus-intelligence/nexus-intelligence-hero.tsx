import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { NexusIntelligenceStage } from "./nexus-intelligence-stage";

// ============================================================
// NEXUS INTELLIGENCE — HERO
//
// The 3D system is the visual identity; the page is still HTML. Two
// separate layers that never touch:
//
//   layer 0  the WebGL scene (or its static fallback)
//   layer 1  a scrim that guarantees contrast for the type
//   layer 2  the copy and the two NEXUS actions
//
// The scene is composed so the core sits centre-right on desktop and
// below the copy on mobile — no important geometry ever lands behind
// the headline. Everything in layer 0 is `pointer-events: none`, so
// the canvas cannot intercept a click, a selection or a scroll.
// ============================================================

const delay = (ms: number) =>
  ({ "--nxi-delay": `${ms}ms` }) as CSSProperties;

export interface NexusIntelligenceHeroProps {
  /** Optional slot rendered above the lockup (e.g. a confirmation alert). */
  notice?: ReactNode;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  /** Compact variant for narrower placements. */
  dense?: boolean;
}

const FOOTNOTES = [
  { label: "Reads the work you already have" },
  { label: "Explains every signal it surfaces" },
  { label: "Free to start. No card required" },
] as const;

export function NexusIntelligenceHero({
  notice,
  primaryCta = { label: "Get started", href: "/signup" },
  secondaryCta = { label: "See how it works", href: "#in-action" },
  dense = false,
}: NexusIntelligenceHeroProps) {
  return (
    <section
      className={`nexus-intelligence-hero relative isolate flex flex-col overflow-hidden pt-16 ${
        dense ? "min-h-[78svh]" : "min-h-[100svh]"
      }`}
    >
      {/* ---- Layer 0: the intelligence system ---- */}
      <div className="nexus-intelligence-stage" aria-hidden="true">
        <NexusIntelligenceStage className="absolute inset-0" />
      </div>

      {/* ---- Layer 1: the scrim ---- */}
      <div className="nexus-intelligence-scrim" aria-hidden="true" />

      {/* ---- Layer 2: the copy ---- */}
      <div className="relative z-10 mx-auto w-full max-w-[1180px] flex-1 px-5 sm:px-6">
        <div className="flex min-h-[62svh] flex-col items-center justify-center text-center lg:min-h-[68svh] lg:items-start lg:text-left">
          {notice ? (
            <div
              className="nexus-intelligence-item mb-8 w-full max-w-[460px] text-left"
              style={delay(0)}
            >
              {notice}
            </div>
          ) : null}

          <span
            className="nexus-intelligence-item inline-flex h-[26px] items-center gap-2 rounded-pill border border-border-default bg-bg-subtle/80 px-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-secondary backdrop-blur-sm"
            style={delay(60)}
          >
            <span
              className="nexus-intelligence-dot"
              aria-hidden="true"
            />
            The intelligence layer
          </span>

          <h1
            className="nexus-intelligence-item nexus-intelligence-lockup mt-7"
            style={delay(140)}
          >
            <span className="nexus-intelligence-lockup-primary">NEXUS</span>
            <span className="nexus-intelligence-lockup-secondary">
              INTELLIGENCE
            </span>
          </h1>

          <p
            className="nexus-intelligence-item mt-6 text-[19px] font-medium leading-[1.3] tracking-[-0.02em] text-text-primary sm:text-[22px]"
            style={delay(220)}
          >
            Your workspace, read end to end.
          </p>

          <p
            className="nexus-intelligence-item mt-5 max-w-[470px] text-balance text-body text-text-secondary sm:text-[15px] sm:leading-[25px]"
            style={delay(300)}
          >
            NEXUS Intelligence reads your tasks, projects, goals and activity,
            connects the relationships between them and names the one thing
            worth doing next.
          </p>

          <div
            className="nexus-intelligence-item mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            style={delay(380)}
          >
            <ButtonLink href={primaryCta.href} size="lg">
              {primaryCta.label}
              <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href={secondaryCta.href} variant="secondary" size="lg">
              {secondaryCta.label}
            </ButtonLink>
          </div>
        </div>
      </div>

      {/* ---- Footnote rule ---- */}
      <div
        className="nexus-intelligence-item relative z-10 border-t border-border-subtle"
        style={delay(520)}
      >
        <ul className="mx-auto flex w-full max-w-[1180px] flex-col gap-1.5 px-5 py-4 sm:flex-row sm:gap-8 sm:px-6 sm:py-5">
          {FOOTNOTES.map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-2.5 text-[11.5px] text-text-tertiary sm:justify-start"
            >
              <span
                className="h-1 w-1 shrink-0 rounded-full bg-text-quaternary"
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

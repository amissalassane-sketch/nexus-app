"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { IconArrowRight } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { ButtonLink } from "@/components/ui/button";
import { BlackHoleHeroSection } from "@/components/ui/blackhole-hero-section";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS INTELLIGENCE — HERO
//
// The black hole is the visual identity; the page is still HTML.
// Two separate layers that never touch:
//
//   layer 0  the raymarched black hole (pure WebGL, pointer-transparent)
//   layer 1  the copy and the two NEXUS actions
//
// Readability comes from the composition, not from a flat overlay:
// the hole is framed high-right on desktop (the reading half stays
// clear) and low on mobile (the copy sits on top), with the shader's
// own scrim darkening only the edge the copy sits on. The footnote
// rule carries its own bottom wash so it stays legible over the glow.
//
// The disc burns lavender — white-hot rim, violet mid, deep indigo
// edge — instead of the film's amber: same physics, NEXUS palette.
// Every claim below still maps to src/lib/intelligence/engine.ts.
// ============================================================

const delay = (ms: number) =>
  ({ "--nxi-delay": `${ms}ms` }) as CSSProperties;

/** True below the `lg` breakpoint, where the layout stacks. */
function useNarrow(query = "(max-width: 1023px)") {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const sync = () => setNarrow(m.matches);
    sync();
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, [query]);
  return narrow;
}

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

function LightIntelligenceGraphic({ narrow }: { narrow: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Atmospheric radial glow */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_72%_46%,rgba(99,91,255,0.08)_0%,rgba(99,91,255,0.02)_50%,transparent_75%)]"
        aria-hidden="true"
      />

      {/* Orbital Lens System */}
      <div
        className={cn(
          "absolute flex items-center justify-center pointer-events-none",
          narrow
            ? "bottom-10 left-1/2 -translate-x-1/2 h-[340px] w-[340px]"
            : "right-[6%] top-[46%] -translate-y-1/2 h-[540px] w-[540px] xl:right-[10%]"
        )}
      >
        {/* Soft focal glow */}
        <div className="absolute h-72 w-72 rounded-full bg-lavender/10 blur-3xl" />

        {/* Outer orbital ring */}
        <div className="absolute h-full w-full rounded-full border border-border-default/80 motion-safe:animate-[spin_80s_linear_infinite]" />
        <div className="absolute h-[84%] w-[84%] rounded-full border border-dashed border-border-strong/50 motion-safe:animate-[spin_56s_linear_infinite_reverse]" />

        {/* Mid orbital ring with data points */}
        <div className="absolute h-[64%] w-[64%] rounded-full border border-lavender/30 motion-safe:animate-[spin_40s_linear_infinite]">
          <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-lavender shadow-[0_0_10px_rgba(99,91,255,0.5)]" />
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-2 w-2 rounded-full bg-text-tertiary" />
        </div>

        {/* Inner orbital ring */}
        <div className="absolute h-[44%] w-[44%] rounded-full border border-dashed border-lavender/40 motion-safe:animate-[spin_26s_linear_infinite_reverse]" />

        {/* Central Intelligence Core Pill */}
        <div className="relative flex flex-col items-center justify-center rounded-2xl border border-border-default bg-bg-surface/90 px-6 py-5 shadow-[0_16px_36px_-8px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.9)] backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-subtle bg-bg-subtle text-text-primary shadow-xs">
              <span className="font-mono text-[11px] font-semibold">N</span>
            </span>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold tracking-[-0.01em] text-text-primary">
                NEXUS Engine
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-lavender">
                Active synthesis
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-full border border-border-subtle bg-bg-subtle/80 px-3 py-1 font-mono text-[9.5px] text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-ping" />
            <span>Workspace context indexed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NexusIntelligenceHero({
  notice,
  primaryCta = { label: "Get started", href: "/signup" },
  secondaryCta = { label: "See how it works", href: "#in-action" },
  dense = false,
}: NexusIntelligenceHeroProps) {
  const narrow = useNarrow();

  return (
    <section
      className={`nexus-intelligence-hero relative isolate flex flex-col overflow-hidden pt-16 bg-bg-base dark:bg-black ${
        dense ? "min-h-[78svh]" : "min-h-[100svh]"
      }`}
    >
      {/* ---- Layer 0: the black hole (Dark Mode only) ---- */}
      <div
        className="pointer-events-none absolute inset-0 z-0 hidden dark:block"
        aria-hidden="true"
      >
        <BlackHoleHeroSection
          // Desktop: hole high-right, copy reads on the left. Mobile: the
          // arrangement turns 90° — copy on top under a veil, the hole low
          // and whole in the bottom third. A wider field on narrow screens
          // makes up the room the frame lost.
          focus={narrow ? [0.5, 0.8] : [0.72, 0.46]}
          scrim={narrow ? "top" : "left"}
          scrimStrength={0.9}
          distance={narrow ? 26 : 24}
          elevation={narrow ? -7 : -5.5}
          fov={narrow ? 58 : 42}
          // NEXUS palette, locked in at the usage site: the disc burns
          // lavender instead of amber. See the component for the film values.
          hotColor="#F5F2FF"
          midColor="#9C8CFF"
          coolColor="#46338C"
          glow={narrow ? 0.85 : 1}
          steps={narrow ? 200 : 300}
          resolution={narrow ? 0.6 : 0.7}
        />
      </div>

      {/* ---- Layer 0: the intelligence aperture (Light Mode) ---- */}
      <div
        className="pointer-events-none absolute inset-0 z-0 block dark:hidden"
        aria-hidden="true"
      >
        <LightIntelligenceGraphic narrow={narrow} />
      </div>

      {/* Bottom fade into the page — and a wash behind the footnote rule
          so it stays legible over the lower glow on mobile. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-36 bg-gradient-to-b from-transparent to-bg-base"
      />

      {/* ---- Layer 1: the copy ---- */}
      <div className="relative z-10 mx-auto flex w-full max-w-page flex-1 flex-col px-4 sm:px-6">
        {/* Mobile: the copy is anchored to the top, under the top scrim, so
            the text and CTAs never sit on the brightest band of the disc
            (which is low in the frame). Desktop: vertically centred beside
            the high-right hole. */}
        <div className="flex flex-1 flex-col items-center justify-start pt-10 pb-16 text-center lg:items-start lg:justify-center lg:py-12 lg:text-left">
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
              <NexusIcon icon={IconArrowRight} />
            </ButtonLink>
            <ButtonLink href={secondaryCta.href} variant="secondary" size="lg">
              {secondaryCta.label}
            </ButtonLink>
          </div>
        </div>
      </div>

      {/* ---- Footnote rule ---- */}
      <div
        className="nexus-intelligence-item relative z-10 border-t border-border-subtle bg-gradient-to-t from-bg-base via-bg-base/60 to-transparent"
        style={delay(520)}
      >
        <ul className="mx-auto flex w-full max-w-page flex-col gap-1.5 px-4 py-4 sm:flex-row sm:gap-8 sm:px-6 sm:py-5">
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

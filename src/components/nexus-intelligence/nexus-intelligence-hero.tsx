"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { IconArrowRight, IconBan, IconChecklist, IconCpu, IconTarget } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { ButtonLink } from "@/components/ui/button";
import { BlackHoleHeroSection } from "@/components/ui/blackhole-hero-section";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS INTELLIGENCE — HERO
//
// The black hole is the visual identity; the page is still HTML.
// Two separate layers that never touch:
//
//   layer 0  the raymarched black hole (WebGL dark mode) /
//            deterministic engine inspector (light mode)
//   layer 1  the copy and the two NEXUS actions
//
// Every claim below maps to src/lib/intelligence/engine.ts.
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
  notice?: ReactNode;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  dense?: boolean;
}

const FOOTNOTES = [
  { label: "Reads the work you already have" },
  { label: "Explains every signal it surfaces" },
  { label: "Free to start · No card required" },
] as const;

function LightIntelligenceGraphic({ narrow }: { narrow: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Atmospheric radial glow */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_75%_60%_at_70%_48%,rgba(99,91,255,0.09)_0%,rgba(99,91,255,0.02)_55%,transparent_80%)]"
        aria-hidden="true"
      />

      {/* Orbital Lens System & Engine Inspector */}
      <div
        className={cn(
          "absolute flex items-center justify-center pointer-events-none select-none",
          narrow
            ? "bottom-6 left-1/2 -translate-x-1/2 h-[380px] w-[380px]"
            : "right-[4%] top-[48%] -translate-y-1/2 h-[560px] w-[560px] xl:right-[8%]"
        )}
      >
        {/* Soft focal glow */}
        <div className="absolute h-80 w-80 rounded-full bg-lavender/15 blur-3xl" />

        {/* Outer orbital ring */}
        <div className="absolute h-full w-full rounded-full border border-border-default/90 motion-safe:animate-[spin_90s_linear_infinite]" />
        <div className="absolute h-[85%] w-[85%] rounded-full border border-dashed border-border-strong/60 motion-safe:animate-[spin_60s_linear_infinite_reverse]" />

        {/* Mid orbital ring with data points */}
        <div className="absolute h-[68%] w-[68%] rounded-full border border-lavender/40 motion-safe:animate-[spin_44s_linear_infinite]">
          <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-lavender shadow-[0_0_12px_rgba(99,91,255,0.6)]" />
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-2.5 w-2.5 rounded-full bg-text-secondary" />
        </div>

        {/* Inner orbital ring */}
        <div className="absolute h-[48%] w-[48%] rounded-full border border-dashed border-lavender/50 motion-safe:animate-[spin_28s_linear_infinite_reverse]" />

        {/* Concrete context satellite: Tasks */}
        <div className="absolute -top-1 right-12 hidden lg:flex items-center gap-2 rounded-lg border border-border-default bg-bg-surface px-3 py-1.5 shadow-sm">
          <NexusIcon icon={IconChecklist} px={14} className="text-text-secondary" />
          <span className="font-mono text-[11px] font-medium text-text-primary">18 tasks indexed</span>
        </div>

        {/* Concrete context satellite: Blockers */}
        <div className="absolute bottom-8 left-2 hidden lg:flex items-center gap-2 rounded-lg border border-lavender/40 bg-bg-surface px-3 py-1.5 shadow-sm">
          <NexusIcon icon={IconBan} px={14} className="text-lavender" />
          <span className="font-mono text-[11px] font-medium text-text-primary">3 blocked items</span>
        </div>

        {/* Concrete context satellite: Milestone */}
        <div className="absolute top-16 left-4 hidden lg:flex items-center gap-2 rounded-lg border border-border-default bg-bg-surface px-3 py-1.5 shadow-sm">
          <NexusIcon icon={IconTarget} px={14} className="text-text-secondary" />
          <span className="font-mono text-[11px] font-medium text-text-primary">Ship v1 · in 9d</span>
        </div>

        {/* Central Intelligence Core Card — Real Proof */}
        <div className="relative flex w-[310px] flex-col rounded-2xl border border-border-strong bg-bg-surface/95 p-5 shadow-[0_20px_45px_-10px_rgba(0,0,0,0.12),0_0_0_1px_rgba(255,255,255,0.8)] backdrop-blur-md">
          {/* Card header */}
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-lavender/40 bg-lavender/10 text-lavender">
                <NexusIcon icon={IconCpu} px={15} />
              </span>
              <div>
                <span className="block text-[13px] font-semibold text-text-primary leading-tight">
                  NEXUS Engine
                </span>
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-text-secondary font-medium">
                  Deterministic read
                </span>
              </div>
            </div>
            <Badge tone="lavender" className="font-semibold text-[10px]">
              Live · 4ms
            </Badge>
          </div>

          {/* Surfaced action preview */}
          <div className="mt-3.5 rounded-lg border border-border-subtle bg-bg-subtle/80 p-3">
            <span className="eyebrow text-lavender font-semibold text-[10px]">
              Ranked Next Best Action
            </span>
            <p className="mt-1 text-[13px] font-medium text-text-primary leading-snug">
              Review onboarding flow
            </p>
            <p className="mt-1 font-mono text-[10.5px] text-text-secondary">
              Unblocks 3 tasks · Oldest overdue
            </p>
          </div>

          {/* Verification guarantee */}
          <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#10b981]" />
              <span>Workspace snapshot verified</span>
            </span>
            <span className="text-text-tertiary">0 hallucination</span>
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
      className={`nexus-intelligence-hero relative isolate flex flex-col overflow-hidden pt-12 sm:pt-14 bg-bg-base dark:bg-black ${
        dense ? "min-h-[74svh]" : "min-h-[82svh] lg:min-h-[86svh]"
      }`}
    >
      {/* ---- Layer 0: the black hole (Dark Mode only) ---- */}
      <div
        className="pointer-events-none absolute inset-0 z-0 hidden dark:block"
        aria-hidden="true"
      >
        <BlackHoleHeroSection
          focus={narrow ? [0.5, 0.8] : [0.72, 0.46]}
          scrim={narrow ? "top" : "left"}
          scrimStrength={0.9}
          distance={narrow ? 26 : 24}
          elevation={narrow ? -7 : -5.5}
          fov={narrow ? 58 : 42}
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

      {/* Bottom fade into the page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-24 bg-gradient-to-b from-transparent to-bg-base"
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
            className="nexus-intelligence-item inline-flex h-[28px] items-center gap-2 rounded-pill border border-border-default bg-bg-surface/90 px-3.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-secondary backdrop-blur-sm"
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
            <span className="nexus-intelligence-lockup-primary">NEXUS</span>
            <span className="nexus-intelligence-lockup-secondary">
              INTELLIGENCE
            </span>
          </h1>

          <p
            className="nexus-intelligence-item mt-5 text-[20px] font-medium leading-[1.3] tracking-[-0.02em] text-text-primary sm:text-[24px]"
            style={delay(220)}
          >
            Your workspace, read end to end.
          </p>

          <p
            className="nexus-intelligence-item mt-4 max-w-[490px] text-balance text-body text-text-secondary sm:text-[15.5px] sm:leading-[25px]"
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
        className="nexus-intelligence-item relative z-10 border-t border-border-subtle bg-bg-surface/50 backdrop-blur-xs"
        style={delay(520)}
      >
        <ul className="mx-auto flex w-full max-w-page flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:gap-8 sm:px-6 sm:py-4">
          {FOOTNOTES.map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-2.5 text-[13px] font-medium text-text-secondary sm:justify-start"
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

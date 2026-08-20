import { LandingReveal } from "@/components/landing/landing-reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { NexusLogo } from "@/components/nexus-logo";
import type { CSSProperties } from "react";

// ============================================================
// SECTION 2 — WHAT INTELLIGENCE SEES
// The workspace already holds the context. Intelligence connects
// it. The diagram is a 3x3 field: eight real workspace surfaces
// wired into one reading. Lines are SVG, pulses are CSS dashes.
// ============================================================

type Cell = { label: string; detail: string; x: number; y: number };

const CELLS: Cell[] = [
  { label: "Tasks", detail: "status, priority, due date", x: 16.7, y: 16.7 },
  { label: "Projects", detail: "scope and state", x: 50, y: 16.7 },
  { label: "Goals", detail: "progress vs. target", x: 83.3, y: 16.7 },
  { label: "Deadlines", detail: "what is already past", x: 16.7, y: 50 },
  { label: "Progress", detail: "what actually moved", x: 83.3, y: 50 },
  { label: "Dependencies", detail: "what blocks what", x: 16.7, y: 83.3 },
  { label: "Activity", detail: "the last real change", x: 50, y: 83.3 },
  { label: "Workload", detail: "what is open right now", x: 83.3, y: 83.3 },
];

export function WhatIntelligenceSees() {
  return (
    <section id="context" className="scroll-mt-20 px-5 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto w-full max-w-[1120px]">
        <LandingReveal>
          <SectionHeading
            eyebrow="What it sees"
            title={
              <>
                Your workspace already contains the context.{" "}
                <span className="text-text-tertiary">Intelligence connects it.</span>
              </>
            }
            sub="No prompts, no imported documents, no second brain to maintain. NEXUS reads the objects you already work with and the relationships between them."
          />
        </LandingReveal>

        <LandingReveal delay={80} className="mt-14">
          {/* Desktop: the connected field. */}
          <div
            className="relative mx-auto hidden aspect-[16/8] w-full max-w-[900px] md:block"
            aria-hidden="true"
          >
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              focusable="false"
            >
              {CELLS.map((cell, index) => (
                <g key={cell.label}>
                  <path
                    d={`M${cell.x} ${cell.y} L50 50`}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    className="nexus-intel-wire"
                    d={`M${cell.x} ${cell.y} L50 50`}
                    fill="none"
                    stroke="rgba(233,228,255,0.55)"
                    strokeWidth="1.5"
                    pathLength={1}
                    vectorEffect="non-scaling-stroke"
                    style={{ "--wire-delay": `${index * 900}ms` } as CSSProperties}
                  />
                </g>
              ))}
            </svg>

            {CELLS.map((cell) => (
              <div
                key={cell.label}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${cell.x}%`, top: `${cell.y}%` }}
              >
                <div className="rounded-input border border-border-default bg-bg-subtle/90 px-3.5 py-2 text-center backdrop-blur-sm">
                  <p className="text-small font-medium text-text-primary">{cell.label}</p>
                  <p className="mt-0.5 font-mono text-[10px] leading-[14px] uppercase tracking-[0.06em] text-text-quaternary">
                    {cell.detail}
                  </p>
                </div>
              </div>
            ))}

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="nexus-intel-glass flex items-center gap-2.5 rounded-pill px-4 py-2.5">
                <NexusLogo size={16} />
                <span className="font-mono text-mono uppercase tracking-[0.12em] text-text-secondary">
                  Nexus Intelligence
                </span>
              </div>
            </div>
          </div>

          {/* Mobile: the same eight surfaces, read as a list. */}
          <ul className="grid grid-cols-2 gap-2.5 md:hidden">
            {CELLS.map((cell) => (
              <li
                key={cell.label}
                className="rounded-input border border-border-subtle bg-bg-subtle px-3 py-2.5"
              >
                <p className="text-small font-medium text-text-primary">{cell.label}</p>
                <p className="mt-0.5 font-mono text-[10px] leading-[14px] uppercase tracking-[0.06em] text-text-quaternary">
                  {cell.detail}
                </p>
              </li>
            ))}
          </ul>

          <p className="mx-auto mt-10 max-w-[520px] text-center text-small text-text-tertiary">
            Every reading is computed from your own workspace. Nothing is
            imported, nothing is invented, nothing is sent to a chat window.
          </p>
        </LandingReveal>
      </div>
    </section>
  );
}

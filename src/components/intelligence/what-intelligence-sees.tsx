import { LandingReveal } from "@/components/landing/landing-reveal";
import { ContextScene } from "@/components/intelligence/context/context-scene";
import { CONTEXT_NODES } from "@/components/intelligence/context/config";

// ============================================================
// SECTION 2 — WHAT INTELLIGENCE SEES
//
// The engine understanding the workspace. The copy is unchanged:
// the workspace already holds the context, intelligence connects
// it. The visualization is the spatial context network — the
// eight workspace surfaces floating at different depths around
// NEXUS Intelligence, with relationships travelling between them
// (components/intelligence/context). The visual field mirrors the
// plain list below it, which is also what screen readers receive.
// ============================================================

export function WhatIntelligenceSees() {
  return (
    <section id="context" className="scroll-mt-20 px-5 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="flex flex-col items-center text-center">
          <LandingReveal>
            <span className="eyebrow inline-flex h-[22px] items-center rounded-pill border border-border-subtle bg-bg-subtle px-2.5 text-text-tertiary">
              What it sees
            </span>
          </LandingReveal>

          <LandingReveal delay={70}>
            <h2 className="mt-4 max-w-[24ch] text-[30px] font-medium leading-[1.08] tracking-[-0.035em] text-text-primary sm:text-[40px]">
              Your workspace already contains the context.{" "}
              <span className="text-text-tertiary">
                Intelligence connects it.
              </span>
            </h2>
          </LandingReveal>

          <LandingReveal delay={150}>
            <p className="mt-4 max-w-[560px] text-body text-text-secondary sm:text-[15px] sm:leading-[24px]">
              No prompts, no imported documents, no second brain to maintain.
              NEXUS reads the objects you already work with and the
              relationships between them.
            </p>
          </LandingReveal>
        </div>

        <div className="mt-12 sm:mt-14">
          <ContextScene />

          {/* The same eight surfaces, for assistive technology — the
              scene above is visual only. */}
          <ul className="sr-only">
            {CONTEXT_NODES.map((node) => (
              <li key={node.id}>
                {node.label}: {node.detail}
              </li>
            ))}
          </ul>

          <LandingReveal delay={80}>
            <p className="mx-auto mt-10 max-w-[520px] text-center text-small text-text-tertiary">
              Every reading is computed from your own workspace. Nothing is
              imported, nothing is invented, nothing is sent to a chat window.
            </p>
          </LandingReveal>
        </div>
      </div>
    </section>
  );
}

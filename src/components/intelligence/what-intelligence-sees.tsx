import { LandingReveal } from "@/components/landing/landing-reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { ContextScene } from "@/components/intelligence/context/context-scene";
import { CONTEXT_NODES } from "@/components/intelligence/context/config";

// ============================================================
// SECTION 2 — WHAT INTELLIGENCE SEES
//
// The engine understanding the workspace:
// The workspace already holds the context; intelligence connects
// it. The visualization is the spatial context network — the
// eight workspace surfaces floating at different depths around
// NEXUS Intelligence, with relationships travelling between them
// (components/intelligence/context).
// ============================================================

export function WhatIntelligenceSees() {
  return (
    <section id="context" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-page">
        <LandingReveal>
          <SectionHeading
            eyebrow="What it sees"
            title={
              <>
                Your workspace already contains the context.{" "}
                <span className="nexus-intel-accent">Intelligence connects it</span>.
              </>
            }
            sub="No prompts, no imported documents, no second brain to maintain. NEXUS reads the objects you already work with and the relationships between them."
          />
        </LandingReveal>

        <div className="mt-10 sm:mt-12">
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
            <p className="mx-auto mt-8 max-w-[540px] text-center text-small font-medium text-text-secondary">
              Every reading is computed from your own workspace data model. Nothing is
              imported, nothing is invented, nothing is sent to a chat window.
            </p>
          </LandingReveal>
        </div>
      </div>
    </section>
  );
}

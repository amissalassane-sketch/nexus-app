import type { Metadata } from "next";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/footer";
import { LandingAtmosphere } from "@/components/landing/landing-atmosphere";
import { NexusIntelligenceHero } from "@/components/nexus-intelligence";
import { WhatIntelligenceSees } from "@/components/intelligence/what-intelligence-sees";
import { IntelligenceSignals } from "@/components/intelligence/intelligence-signals";
import { NextBestAction } from "@/components/intelligence/next-best-action";
import { ExplainableIntelligence } from "@/components/intelligence/explainable-intelligence";
import { WorkspaceToAction } from "@/components/intelligence/workspace-to-action";
import { IntelligenceFaq } from "@/components/intelligence/intelligence-faq";
import { IntelligenceClosing } from "@/components/intelligence/intelligence-closing";

// ============================================================
// NEXUS INTELLIGENCE — PUBLIC PRODUCT LANDING (/intelligence)
//
// A plain public marketing route: it never depends on auth or onboarding
// state. The authenticated Intelligence workspace lives at /app/intelligence.
// Composition:
//   NAV → HERO → WHAT IT SEES → WHAT IT SURFACES → NEXT BEST ACTION →
//   EXPLAINABLE → THE FLOW (LOOP) → FAQ & OBJECTIONS → CTA → FOOTER
//
// Every claim on this page maps to src/lib/intelligence/engine.ts.
// Every example signal is labelled as a product visualisation.
// ============================================================

export const metadata: Metadata = {
  title: "NEXUS Intelligence. It reads the work. Not the guesswork.",
  description:
    "NEXUS Intelligence analyzes the work already happening in your workspace and surfaces what is drifting, blocked or at risk, and what deserves your attention next.",
  alternates: { canonical: "/intelligence" },
  openGraph: {
    type: "website",
    siteName: "NEXUS",
    url: "/intelligence",
    title: "NEXUS Intelligence. It reads the work. Not the guesswork.",
    description:
      "The intelligence layer inside NEXUS. It reads your tasks, projects, goals and activity, then tells you what deserves attention next, and why.",
  },
  robots: { index: true, follow: true },
};

export default function IntelligenceLandingPage() {
  return (
    <div className="nexus-intel nexus-landing min-h-dvh bg-bg-base text-text-primary">
      <LandingAtmosphere />
      <LandingNav context="intelligence" />

      <main id="main">
        <NexusIntelligenceHero
          primaryCta={{ label: "Get started", href: "/signup" }}
          secondaryCta={{ label: "See how it works", href: "#in-action" }}
        />
        <WhatIntelligenceSees />
        <IntelligenceSignals />
        <NextBestAction />
        <ExplainableIntelligence />
        <WorkspaceToAction />
        <IntelligenceFaq />
        <IntelligenceClosing />
      </main>

      <LandingFooter context="intelligence" />
    </div>
  );
}

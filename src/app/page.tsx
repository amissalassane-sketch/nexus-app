import type { Metadata } from "next";
import { Alert } from "@/components/ui/feedback";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { Hero } from "@/components/landing/hero";
import { ProductPreview } from "@/components/landing/product-preview";
import { ValueBand } from "@/components/landing/value-band";
import { ModelSection } from "@/components/landing/model-section";
import { IntelligenceSection } from "@/components/landing/intelligence-section";
import { HowItWorksSection } from "@/components/landing/how-it-works";
import { FeaturesSection } from "@/components/landing/features";
import { IntegrationsSection } from "@/components/landing/integrations-section";
import { TrustSection } from "@/components/landing/trust";
import { PricingSection } from "@/components/landing/pricing";
import { FaqSection } from "@/components/landing/faq";
import { FinalCtaSection } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";
import { LaunchExperience } from "@/components/landing/launch-experience";
import { SonarGrid } from "@/components/ui/sonar-grid";

// ============================================================
// NEXUS — PUBLIC LANDING PAGE
//
// Composition (composition only — the branding is 100% NEXUS V3):
//   NAVBAR → HERO + PRODUCT PREVIEW (one continuous opening) →
//   PROBLEM → ANSWER → THE NEXUS MODEL → IT READS THE WORK →
//   FOUR MOVES → FEATURE ARCHITECTURE → TRUST → PRICING →
//   FAQ → FINAL CTA → FOOTER
//
// DESIGN AUDIT: the product preview now sits inside the opening
// beat, pulled up against the hero, so the visitor sees the real
// surface within the first screen instead of after a full page of
// copy. Sections alternate between bare black and a framed band
// (`.nexus-band`) so the page has depth without decoration.
//
// Every section uses real NEXUS data or real product behaviour.
// ============================================================

export const metadata: Metadata = {
  title: {
    absolute:
      "NEXUS. It reads the work, then tells you what matters next",
  },
  description:
    "NEXUS reads the work already in your workspace and surfaces what is drifting, blocked or at risk — and what to do next. Free to start, no card required.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "NEXUS",
    url: "/",
    title: "NEXUS. It reads the work, then tells you what matters next",
    description:
      "It reads the work, not the chat. NEXUS turns the activity already in your workspace into signals, evidence and a clear next action.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NEXUS. It reads the work, then tells you what matters next",
    description:
      "It reads the work, not the chat. NEXUS turns workspace activity into signals and a clear next action.",
  },
  robots: { index: true, follow: true },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string; from?: string }>;
}) {
  const params = await searchParams;
  const justConfirmed = params.confirmed === "1";
  // Public marketing stays public even when a session exists. Authenticated
  // visitors who choose Sign in or Get started are routed to /app by proxy.

  return (
    <div className="nexus-landing min-h-dvh bg-bg-base text-text-primary">
      <LaunchExperience />
      {/* BACKGROUND — SonarGrid: decorative dot field answering taps with expanding rings across the entire landing page */}
      <SonarGrid
        id="nexus-sonar-grid"
        ringWidth={90}
        speed={260}
        amplitude={2.2}
        pingEvery={2.4}
        interactive={true}
        spacing={26}
        baseOpacity={0.28}
        color="#6366f1"
        seedPing={true}
        pingArea={[0.22, 0.18, 0.78, 0.82]}
        className="pointer-events-none fixed inset-0 -z-[1] h-screen w-screen overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,rgba(0,0,0,0.65)_0%,transparent_100%)]"
        />
      </SonarGrid>
      <LandingNav />

      <main id="main">
        <Hero
          notice={
            justConfirmed ? (
              <Alert tone="success">
                Your email is confirmed. Sign in to enter your workspace, or
                create an account.
              </Alert>
            ) : undefined
          }
        />

        {/* Product preview — pulled into the opening beat so the real
            NEXUS surface is visible almost immediately. */}
        <section id="product" className="scroll-mt-20 px-4 sm:px-6">
          <LandingReveal>
            <div className="mx-auto w-full max-w-page">
              <ProductPreview />
              <p className="nexus-eyebrow mt-6 text-center">
                The workspace: goals, projects, tasks and activity, connected.
                NEXUS reads it continuously.
              </p>
            </div>
          </LandingReveal>
        </section>

        <ValueBand />
        <ModelSection />
        <IntelligenceSection />
        <HowItWorksSection />
        <FeaturesSection />
        <IntegrationsSection />
        <TrustSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>

      <LandingFooter />
    </div>
  );
}

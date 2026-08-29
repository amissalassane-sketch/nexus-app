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
import { TrustSection } from "@/components/landing/trust";
import { PricingSection } from "@/components/landing/pricing";
import { FaqSection } from "@/components/landing/faq";
import { FinalCtaSection } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";
import { LaunchExperience } from "@/components/landing/launch-experience";
import { LandingAtmosphere } from "@/components/landing/landing-atmosphere";

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
      "NEXUS — It reads the work, then tells you what matters next",
  },
  description:
    "NEXUS continuously reads your workspace — deadlines, dependencies, progress and activity — and turns that context into the next decision worth making.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "NEXUS",
    url: "/",
    title: "NEXUS — It reads the work, then tells you what matters next",
    description:
      "It reads the work, not the chat. NEXUS turns the activity already in your workspace into signals, evidence and a clear next action.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NEXUS — It reads the work, then tells you what matters next",
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
      <LandingAtmosphere />
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
        <section id="product" className="scroll-mt-20 px-5 sm:px-6">
          <LandingReveal>
            <div className="mx-auto w-full max-w-[1080px]">
              <ProductPreview />
              <p className="nexus-eyebrow mt-6 text-center">
                The workspace — goals, projects, tasks and activity, connected
              </p>
            </div>
          </LandingReveal>
        </section>

        <ValueBand />
        <ModelSection />
        <IntelligenceSection />
        <HowItWorksSection />
        <FeaturesSection />
        <TrustSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>

      <LandingFooter />
    </div>
  );
}

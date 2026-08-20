import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
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
// Composition (composition only — the branding is 100% NEXUS V3):
//   NAVBAR → HERO → PRODUCT PREVIEW → VALUE → THE NEXUS MODEL →
//   INTELLIGENCE → HOW IT WORKS → FEATURES → TRUST → PRICING →
//   FAQ → FINAL CTA → FOOTER
// Every section uses real NEXUS data or real product behaviour.
// ============================================================

export const metadata: Metadata = {
  title: "NEXUS — Everything important, one connected system",
  description:
    "NEXUS is a quiet personal operating system that connects goals, projects, tasks and activity in one workspace — then tells you what to do next.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "NEXUS",
    title: "NEXUS — Everything important, one connected system",
    description:
      "Goals, projects, tasks and activity in one connected workspace. NEXUS tells you what to do next.",
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
  const fromOnboarding = params.from === "onboarding";

  // After an email confirmation link — or when a user was just bounced here
  // from /onboarding after a page refresh — we always show this page so the
  // visitor can choose Sign in or Create account, instead of an authenticated
  // session bouncing them straight back into /dashboard -> /onboarding.
  if (isSupabaseConfigured() && !justConfirmed && !fromOnboarding) {
    const user = await getAuthenticatedUser();
    if (user) {
      redirect("/dashboard");
    }
  }

  return (
    <div className="nexus-landing min-h-dvh bg-bg-base text-text-primary">
      <LaunchExperience />
      <LandingAtmosphere />
      <LandingNav />

      <main>
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

        {/* Product preview — the real NEXUS workspace surface */}
        <section id="product" className="scroll-mt-20 px-5 sm:px-6">
          <LandingReveal>
            <div className="mx-auto w-full max-w-[1080px]">
              <ProductPreview />
              <p className="mt-6 text-center font-mono text-mono uppercase tracking-[0.1em] text-text-tertiary">
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

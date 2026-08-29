import type { Metadata } from "next";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/footer";
import { LandingAtmosphere } from "@/components/landing/landing-atmosphere";
import { PricingSection } from "@/components/landing/pricing";
import { FaqSection } from "@/components/landing/faq";
import { FinalCtaSection } from "@/components/landing/final-cta";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Choose the NEXUS plan that matches your workspace. Start free and upgrade when your team needs more operational context.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    url: "/pricing",
    title: "NEXUS Pricing",
    description: "Clear plans for operational intelligence, from one workspace to an entire team.",
  },
};

export default function PricingPage() {
  return (
    <div className="nexus-landing min-h-dvh bg-bg-base text-text-primary">
      <LandingAtmosphere />
      <LandingNav context="pricing" />
      <main id="main" className="pt-12">
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <LandingFooter context="pricing" />
    </div>
  );
}

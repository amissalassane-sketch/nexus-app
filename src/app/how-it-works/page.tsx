import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Network, Radar } from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/footer";
import { LandingAtmosphere } from "@/components/landing/landing-atmosphere";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { HowItWorksSection } from "@/components/landing/how-it-works";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How NEXUS Works",
  description:
    "NEXUS connects workspace context, detects operational signals and recommends a reviewable next action.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    url: "/how-it-works",
    title: "How NEXUS Works",
    description: "Workspace context becomes explainable signals and controlled next actions.",
  },
};

const stages = [
  {
    icon: Network,
    label: "Context",
    title: "NEXUS reads connected work",
    copy: "Projects, tasks, goals, deadlines and activity form one workspace model. You do not have to restate that context in a chat.",
  },
  {
    icon: Radar,
    label: "Signals",
    title: "Relationships reveal what changed",
    copy: "Deterministic checks surface blocked work, deadline pressure, stalled projects and priority drift from the data already present.",
  },
  {
    icon: CheckCircle2,
    label: "Action",
    title: "A recommendation stays under your control",
    copy: "Each signal includes evidence, why it matters and a proposed next step. Consequential changes always require review and confirmation.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <div className="nexus-landing min-h-dvh bg-bg-base text-text-primary">
      <LandingAtmosphere />
      <LandingNav context="how-it-works" />
      <main id="main">
        <section className="px-4 pb-14 pt-32 sm:px-6 sm:pb-20 sm:pt-40">
          <LandingReveal>
            <div className="mx-auto max-w-[860px] text-center">
              <p className="eyebrow text-lavender">Workspace → context → action</p>
              <h1 className="mx-auto mt-5 max-w-[16ch] text-[42px] font-medium leading-[1.04] tracking-[-0.045em] sm:text-[58px] lg:text-[68px]">
                Operational awareness, built from the work itself.
              </h1>
              <p className="mx-auto mt-6 max-w-[62ch] text-[15px] leading-6 text-text-secondary sm:text-[17px] sm:leading-7">
                NEXUS continuously structures workspace activity into evidence-backed signals, then recommends what deserves attention next.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <ButtonLink href="/signup" size="lg">Get started</ButtonLink>
                <ButtonLink href="/intelligence" variant="secondary" size="lg">
                  See Intelligence <ArrowRight size={14} aria-hidden="true" />
                </ButtonLink>
              </div>
            </div>
          </LandingReveal>
        </section>

        <section aria-label="NEXUS operating model" className="px-4 pb-12 sm:px-6 sm:pb-20">
          <div className="mx-auto grid max-w-page gap-px overflow-hidden rounded-panel border border-border-subtle bg-border-subtle md:grid-cols-3">
            {stages.map((stage, index) => (
              <article key={stage.label} className="bg-bg-subtle p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <stage.icon size={18} strokeWidth={1.5} className="text-lavender" aria-hidden="true" />
                  <span className="font-mono text-mono text-text-quaternary">0{index + 1}</span>
                </div>
                <p className="eyebrow mt-10 text-text-tertiary">{stage.label}</p>
                <h2 className="mt-3 text-[20px] font-medium leading-7 tracking-[-0.025em]">{stage.title}</h2>
                <p className="mt-3 text-small leading-5 text-text-secondary">{stage.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <HowItWorksSection />
      </main>
      <LandingFooter context="how-it-works" />
    </div>
  );
}

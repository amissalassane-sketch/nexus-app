"use client";

import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { NexusLogo } from "@/components/nexus-logo";
import { IntegrationIcon } from "@/components/integrations/integration-icon";
import { INTEGRATION_CATALOG } from "@/lib/integrations/catalog";

const featured = INTEGRATION_CATALOG.filter((integration) => ["google-calendar", "github", "slack", "notion", "webhooks"].includes(integration.id));

export function IntegrationsSection() {
  const firstRow = featured.slice(0, 3);
  const secondRow = featured.slice(3);

  return (
    <section id="integrations" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto w-full max-w-page">
        <LandingReveal>
          <SectionHeading
            title="Your tools. One intelligent workspace."
            sub="NEXUS is designed to bring the work you already do into one place so context can become signal, and signal can become the next action."
          />
        </LandingReveal>

        <LandingReveal delay={80}>
          <div className="relative mt-12 overflow-hidden rounded-panel border border-border-subtle bg-bg-subtle px-4 py-10 sm:px-8 sm:py-14">
            <div className="relative space-y-4 opacity-70" aria-hidden="true">
              <IconRail items={[...firstRow, ...firstRow]} direction={-1} />
              <IconRail items={[...secondRow, ...secondRow, ...secondRow]} direction={1} />
            </div>

            <div className="relative mx-auto my-8 flex max-w-[460px] flex-col items-center text-center sm:my-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-panel border border-lavender-border bg-bg-surface shadow-[0_0_40px_rgba(233,228,255,0.12)]">
                <NexusLogo size={34} />
              </div>
              <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-lavender">NEXUS core</p>
              <p className="mt-2 text-small text-text-secondary">External context converges here. Intelligence and action stay grounded in the workspace.</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-text-quaternary"><span>Context</span><span aria-hidden="true">·</span><span>Signals</span><span aria-hidden="true">·</span><span>Actions</span></div>
            </div>

            <div className="relative mx-auto flex max-w-[640px] items-center justify-center gap-3 text-center text-caption text-text-quaternary" aria-hidden="true"><span className="h-px flex-1 bg-border-subtle" /><span>Connection paths are being built carefully, not simulated</span><span className="h-px flex-1 bg-border-subtle" /></div>
          </div>
        </LandingReveal>

        <LandingReveal delay={140}>
          <div className="mt-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <p className="max-w-[52ch] text-small text-text-secondary">Connect the tools your work already lives in. When a provider is ready, NEXUS will make its permissions, capabilities and health explicit.</p>
            <Link href="/integrations" className="inline-flex h-10 items-center gap-2 rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-[background-color,color,border-color,transform] hover:border-border-strong hover:bg-bg-surface hover:text-text-primary active:scale-[0.98]">Explore integrations <NexusIcon icon={IconArrowRight} /></Link>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

// Pure-CSS infinite marquee (see .nexus-icon-rail in globals.css).
// Framer Motion must never leak into the public landing bundle — the
// 24s linear loop this replaces needs no JavaScript at all, and the
// reduced-motion / no-JS fallbacks are handled in CSS.
function IconRail({ items, direction }: { items: typeof featured; direction: -1 | 1 }) {
  return (
    <div className="overflow-hidden rounded-card border border-border-subtle bg-bg-base/30 py-2.5">
      <div className={`nexus-icon-rail flex w-max gap-2.5 ${direction === -1 ? "nexus-icon-rail-left" : "nexus-icon-rail-right"}`}>
        {items.map((integration, index) => {
          return <div key={`${integration.id}-${index}`} className="flex min-w-[150px] items-center gap-2 rounded-input border border-border-subtle bg-bg-surface/70 px-3 py-2 text-small text-text-secondary"><IntegrationIcon id={integration.id} size={14} /><span>{integration.name}</span><span className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-text-quaternary">soon</span></div>;
        })}
      </div>
    </div>
  );
}

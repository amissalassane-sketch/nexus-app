"use client";

import Link from "next/link";
import {
  IconArrowRight,
  IconBrandGithub,
  IconBrandSlack,
  IconCalendar,
  IconChecklist,
  IconMail,
  IconNotes,
  IconPlus,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { NexusLogo } from "@/components/nexus-logo";

// ============================================================
// NEXUS LANDING — INTEGRATIONS (JOBS & CONVERGENCE)
//
// Audit Item #15 & #16:
// "Your tools. One working context."
// Connecting tools is not a technical flex—it solves specific jobs:
//   Gmail     → Client requests & validation threads
//   Calendar  → Time constraints & scheduled delivery
//   Notion    → Specifications, PRDs & team knowledge
//   GitHub    → Code reviews, PRs & technical blockers
//   Slack     → Team decisions & async conversations
//   Linear    → Issue tracking & sprint velocity
//
// And crucially: NEXUS combines them.
// ============================================================

const TOOL_JOBS = [
  {
    id: "gmail",
    name: "Gmail",
    job: "Client requests & validation",
    signal: "Extracts deadlines and validation requests from relevant threads",
    icon: IconMail,
  },
  {
    id: "calendar",
    name: "Google Calendar",
    job: "Time constraints & commitments",
    signal: "Maps sprint reviews, client syncs and actual working windows",
    icon: IconCalendar,
  },
  {
    id: "notion",
    name: "Notion",
    job: "Specifications & team knowledge",
    signal: "Links PRDs, meeting notes and project requirements to active work",
    icon: IconNotes,
  },
  {
    id: "github",
    name: "GitHub",
    job: "Code activity & technical blockers",
    signal: "Tracks pull requests, stalled reviews and code dependency chains",
    icon: IconBrandGithub,
  },
  {
    id: "slack",
    name: "Slack",
    job: "Decisions & async discussion",
    signal: "Surfaces unresolved questions and key decisions made in channels",
    icon: IconBrandSlack,
  },
  {
    id: "linear",
    name: "Linear",
    job: "Execution & issue tracking",
    signal: "Reads task states, cycles and blockers without manual re-entry",
    icon: IconChecklist,
  },
];

export function IntegrationsSection() {
  return (
    <section id="integrations" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto w-full max-w-page">
        <LandingReveal>
          <SectionHeading
            eyebrow="Integrations & Jobs"
            title="Your tools. One working context."
            sub="NEXUS connects the tools you already use and turns their scattered activity into unified operational context. It does not replace them—it combines them."
          />
        </LandingReveal>

        {/* Convergence Core Panel */}
        <LandingReveal delay={80}>
          <div className="mt-12 overflow-hidden rounded-panel border border-border-default bg-bg-surface p-5 sm:p-8 lg:p-10">
            {/* The 6 Tool Jobs Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TOOL_JOBS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.id}
                    className="flex flex-col rounded-card border border-border-subtle bg-bg-subtle p-4 transition-colors duration-150 ease-nexus hover:border-border-default"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-input border border-border-default bg-bg-surface text-text-primary">
                          <NexusIcon icon={Icon} px={16} />
                        </span>
                        <div>
                          <span className="block text-[13.5px] font-semibold text-text-primary">
                            {tool.name}
                          </span>
                          <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                            {tool.job}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-small text-text-secondary">
                      {tool.signal}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* The Convergence Centerpiece: NEXUS Combines Them */}
            <div className="mt-8 rounded-card border border-border-strong bg-bg-surface-2 p-5 text-center sm:p-7">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-panel border border-lavender-border bg-bg-surface shadow-sm">
                <NexusLogo size={28} />
              </div>
              <h3 className="mt-3.5 text-[17px] font-semibold text-text-primary">
                NEXUS combines them into one decision
              </h3>
              <p className="mx-auto mt-1 max-w-[560px] text-small text-text-secondary">
                1 client validation in Gmail + 1 deadline on Calendar + 1 stalled PR in GitHub = 1 prioritized next best action.
              </p>

              {/* Equation row */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-text-tertiary">
                <span className="rounded-pill border border-border-subtle bg-bg-surface px-2.5 py-1 text-text-primary">
                  Gmail (Request)
                </span>
                <NexusIcon icon={IconPlus} px={12} className="text-text-quaternary" />
                <span className="rounded-pill border border-border-subtle bg-bg-surface px-2.5 py-1 text-text-primary">
                  Calendar (Deadline)
                </span>
                <NexusIcon icon={IconPlus} px={12} className="text-text-quaternary" />
                <span className="rounded-pill border border-border-subtle bg-bg-surface px-2.5 py-1 text-text-primary">
                  GitHub (Blocker)
                </span>
                <span className="text-text-primary">=</span>
                <span className="rounded-pill border border-lavender-border bg-lavender-subtle px-3 py-1 font-semibold text-lavender">
                  Next Best Action
                </span>
              </div>
            </div>
          </div>
        </LandingReveal>

        <LandingReveal delay={140}>
          <div className="mt-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <p className="max-w-[56ch] text-small text-text-secondary">
              Connect the tools your work already lives in. When a source is linked, NEXUS makes its permissions, data boundaries and sync freshness completely transparent.
            </p>
            <Link
              href="/integrations"
              className="inline-flex h-10 items-center gap-2 rounded-input border border-border-default bg-bg-surface px-4 text-button text-text-primary transition-colors duration-150 ease-nexus hover:border-border-strong hover:bg-bg-surface-2"
            >
              <span>Explore all integrations</span>
              <NexusIcon icon={IconArrowRight} px={14} />
            </Link>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

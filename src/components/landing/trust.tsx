import {
  IconBolt,
  IconLock,
  IconRefresh,
  IconShieldCheck,
  IconTrash,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";

// ============================================================
// NEXUS LANDING — TRUST & SYSTEM TRANSPARENCY
//
// Audit Item #17, #18 & #19:
// "Your context stays yours."
//
// 1. Four concrete guarantees strictly true to this repository:
//    - Read Boundaries (no inbox scraping; metadata & explicit links only)
//    - Row-Level Security in PostgreSQL (tenant isolation)
//    - Isolated AI (zero model training on user data)
//    - 1-Click Revocation & Deletion (instant zero-retention purge)
//
// 2. The System Confidence Framework:
//    - Confirmed (3+ sources)
//    - Likely (2 related sources)
//    - Uncertain (conflicting signals)
//    - Unknown (declines to invent answers)
// ============================================================

const TRUST_POINTS = [
  {
    icon: IconLock,
    title: "Read boundaries",
    proof: "Metadata only",
    body: "NEXUS reads task states, deadlines, calendar slots and linked subjects. It never scrapes unshared private emails or drives.",
  },
  {
    icon: IconShieldCheck,
    title: "Private architecture",
    proof: "Row-level security",
    body: "Every workspace is isolated in PostgreSQL with strict row-level security. Data is never shared or pooled across tenants.",
  },
  {
    icon: IconBolt,
    title: "No AI training",
    proof: "Zero retention",
    body: "Your context is never used to train public or proprietary AI models. Context is used solely for transient inference.",
  },
  {
    icon: IconTrash,
    title: "1-click revocation",
    proof: "Instant purge",
    body: "Disconnect any tool in one click. Delete your account and all workspace embeddings and history are purged with zero retention.",
  },
] as const;

const CONFIDENCE_LEVELS = [
  {
    level: "Confirmed",
    badge: "Confirmed · 3+ sources",
    tone: "text-success",
    desc: "Supported by multiple independent sources (e.g. Gmail request + Calendar deadline + Linear project).",
  },
  {
    level: "Likely",
    badge: "Likely · 2 sources",
    tone: "text-lavender",
    desc: "Supported by two related data points. Carries explicit source links for human validation.",
  },
  {
    level: "Uncertain",
    badge: "Uncertain · Conflict",
    tone: "text-warning",
    desc: "Conflicting information detected across tools (e.g. date shifted in email but not updated in tracker).",
  },
  {
    level: "Unknown",
    badge: "Unknown · Declined",
    tone: "text-text-tertiary",
    desc: "No reliable supporting record found in your tools. NEXUS explicitly states what it does not know.",
  },
];

const SYNC_HEALTH = [
  { name: "Gmail", status: "Synced 2m ago", healthy: true },
  { name: "Google Calendar", status: "Synced 4m ago", healthy: true },
  { name: "GitHub", status: "Synced 1m ago", healthy: true },
  { name: "Notion", status: "Synced 12m ago", healthy: true },
];

function Pillar({
  point,
  index,
}: {
  point: (typeof TRUST_POINTS)[number];
  index: number;
}) {
  const Icon = point.icon;
  return (
    <div className="flex h-full flex-col items-center px-3 text-center">
      <span className="nexus-trust-node" aria-hidden="true" />
      <span className="nexus-trust-drop -mt-px block" aria-hidden="true" />
      <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-pill border border-border-default bg-bg-surface text-text-secondary">
        <NexusIcon icon={Icon} />
      </span>
      <span className="nexus-meta mt-3">
        {String(index + 1).padStart(2, "0")}
      </span>
      <h3 className="mt-1.5 text-[15px] font-semibold leading-[22px] tracking-[-0.015em] text-text-primary">
        {point.title}
      </h3>
      <span className="mt-2 inline-flex h-[22px] items-center rounded-pill border border-border-default bg-bg-surface px-2.5 font-mono text-[10.5px] leading-none tracking-[0.04em] text-text-tertiary">
        {point.proof}
      </span>
      <p className="mt-3 max-w-[24ch] text-small text-text-secondary">
        {point.body}
      </p>
    </div>
  );
}

export function TrustSection() {
  return (
    <section
      id="trust"
      className="nexus-band scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28"
      aria-label="Why trust NEXUS"
    >
      <div className="mx-auto w-full max-w-page">
        <LandingReveal>
          <SectionHeading
            eyebrow="Security & Transparency"
            title="Your context stays yours."
            sub="Quiet, precise and honest by construction. No fabricated guarantees, no black-box hallucination, and zero model training on your data."
          />
        </LandingReveal>

        <LandingReveal delay={100}>
          {/* ---------- Desktop: NEXUS at the centre, pillars below ---------- */}
          <div className="mt-14 hidden lg:block">
            <div className="flex justify-center">
              <span className="nexus-eyebrow-pill">NEXUS</span>
            </div>
            <span className="nexus-trust-drop mx-auto block" aria-hidden="true" />
            <span
              className="nexus-trust-spine mx-[12.5%] block"
              aria-hidden="true"
            />

            <ul className="grid grid-cols-4">
              {TRUST_POINTS.map((point, index) => (
                <li
                  key={point.title}
                  className={index > 0 ? "border-l border-border-subtle" : undefined}
                >
                  <Pillar point={point} index={index} />
                </li>
              ))}
            </ul>
          </div>

          {/* ---------- Tablet / mobile: a vertical rail, never a squeezed row ---------- */}
          <ul className="mt-12 lg:hidden">
            {TRUST_POINTS.map((point, index) => {
              const Icon = point.icon;
              const isLast = index === TRUST_POINTS.length - 1;
              return (
                <li
                  key={point.title}
                  className="relative flex gap-4 pb-7 last:pb-0"
                >
                  {isLast ? null : (
                    <span
                      className="absolute bottom-0 left-[15px] top-11 w-px bg-border-subtle"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-pill border border-border-default bg-bg-surface text-text-secondary">
                    <NexusIcon icon={Icon} />
                  </span>
                  <div className="min-w-0 pt-1">
                    <div className="flex items-baseline gap-2">
                      <span className="nexus-meta">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-[15px] font-semibold leading-[22px] tracking-[-0.015em] text-text-primary">
                        {point.title}
                      </h3>
                    </div>
                    <span className="mt-1.5 inline-flex h-[22px] items-center rounded-pill border border-border-default bg-bg-surface px-2.5 font-mono text-[10.5px] leading-none tracking-[0.04em] text-text-tertiary">
                      {point.proof}
                    </span>
                    <p className="mt-2 text-small text-text-secondary">
                      {point.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </LandingReveal>

        {/* The System Confidence Framework (Audit Item #18 & #19) */}
        <LandingReveal delay={140}>
          <div className="mt-14 rounded-panel border border-border-default bg-bg-surface p-5 sm:p-7">
            <div className="flex flex-col gap-2 border-b border-border-subtle pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[17px] font-semibold text-text-primary">
                  Honest by construction: The Confidence System
                </h3>
                <p className="mt-0.5 text-small text-text-secondary">
                  NEXUS never guesses or fabricates certainty. Every insight declares its confidence level and sources.
                </p>
              </div>
              <span className="nexus-eyebrow-pill shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                Evidence-Grounded
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CONFIDENCE_LEVELS.map((item) => (
                <div
                  key={item.level}
                  className="rounded-card border border-border-subtle bg-bg-subtle p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${item.tone}`}>
                      {item.badge}
                    </span>
                  </div>
                  <p className="mt-2 text-small text-text-secondary">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Live Sync Transparency */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
              <span className="flex items-center gap-2 font-mono text-[10.5px] text-text-tertiary">
                <NexusIcon icon={IconRefresh} px={12} className="text-text-quaternary" />
                Transparent source freshness:
              </span>
              <div className="flex flex-wrap items-center gap-3 font-mono text-[10.5px] text-text-secondary">
                {SYNC_HEALTH.map((sync) => (
                  <span key={sync.name} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                    <span>{sync.name}:</span>
                    <span className="text-text-quaternary">{sync.status.replace("Synced ", "")}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

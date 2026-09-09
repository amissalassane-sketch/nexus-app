import type { Metadata } from "next";
import { LegalHubLayout } from "@/components/legal/legal-layout";
import { LegalCard } from "@/components/legal/legal-card";
import { LEGAL_DOCUMENTS_LIST } from "@/components/legal/legal-data";
import { LegalContactBox, LegalDisclaimerNotice } from "@/components/legal/legal-ui";
import { Database, Lock, Shield, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Legal Center",
  description:
    "Explore NEXUS legal documentation, terms of service, privacy practices, cookie disclosures, and acceptable use policies.",
  alternates: { canonical: "/legal" },
  openGraph: {
    url: "/legal",
    title: "Legal Center · NEXUS",
    description: "Access official legal agreements, privacy policies, cookie technical disclosures, and operational terms.",
  },
};

const TRUST_PILLARS = [
  {
    icon: Database,
    title: "Tenant-Isolated PostgreSQL RLS",
    description:
      "Every workspace operates with database-level isolation. Row-Level Security policies cryptographically verify active workspace membership before returning any row.",
  },
  {
    icon: Sparkles,
    title: "Human-Confirmed AI Model",
    description:
      "NEXUS Intelligence models propose insights, plans, and actions, but the server strictly requires explicit human confirmation before executing any state mutation.",
  },
  {
    icon: Shield,
    title: "Zero Third-Party Ad Trackers",
    description:
      "We do not embed third-party advertising cookies, social tracking pixels, or cross-site behavioral telemetry. Your workspace remains entirely your own.",
  },
  {
    icon: Lock,
    title: "Complete Data Sovereignty",
    description:
      "You retain full intellectual property ownership of your projects, tasks, and goals. Account and workspace deletions trigger immediate database cascades.",
  },
] as const;

export default function LegalCenterPage() {
  return (
    <LegalHubLayout>
      <div className="mx-auto w-full max-w-page px-4 sm:px-6">
        {/* Hero Section */}
        <div className="mx-auto max-w-[840px] text-center">
          <span className="nexus-eyebrow-pill">
            <Shield size={12} className="text-lavender" aria-hidden="true" />
            Legal &amp; Trust Center
          </span>

          <h1 className="mt-5 text-[38px] font-medium leading-[1.06] tracking-[-0.04em] text-text-primary sm:text-[52px]">
            Transparency, governance, and terms for modern operations.
          </h1>

          <p className="nexus-lead mt-5 max-w-[620px] text-text-secondary mx-auto">
            Review the contractual terms, data protection commitments, storage
            technologies, and security rules governing your use of NEXUS.
          </p>
        </div>

        {/* 4 Core Legal Documents Grid */}
        <section aria-label="Legal Documents" className="mt-14 sm:mt-20">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <p className="nexus-eyebrow text-text-quaternary">Official Agreements</p>
              <h2 className="text-h2 font-medium text-text-primary">Legal Documentation</h2>
            </div>
            <span className="font-mono text-[11px] text-text-quaternary">
              4 Documents Available
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {LEGAL_DOCUMENTS_LIST.map((document) => (
              <LegalCard key={document.id} document={document} />
            ))}
          </div>
        </section>

        {/* Security & Architectural Invariants */}
        <section aria-label="Operational Pillars" className="mt-16 sm:mt-24">
          <div className="border-b border-border-subtle pb-3">
            <p className="nexus-eyebrow text-text-quaternary">Security by Architecture</p>
            <h2 className="text-h2 font-medium text-text-primary">
              How NEXUS Protects Workspace Operations
            </h2>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST_PILLARS.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-card border border-border-subtle bg-bg-surface/50 p-5 transition-colors duration-150 ease-nexus hover:border-border-default hover:bg-bg-surface"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-input border border-border-subtle bg-bg-base/80 text-lavender">
                  <pillar.icon size={18} strokeWidth={1.5} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-h3 font-medium text-text-primary">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-small leading-relaxed text-text-secondary">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact & Entities */}
        <section aria-label="Legal Inquiries" className="mt-16 sm:mt-24">
          <LegalContactBox />
        </section>

        {/* Disclaimer */}
        <LegalDisclaimerNotice />
      </div>
    </LegalHubLayout>
  );
}

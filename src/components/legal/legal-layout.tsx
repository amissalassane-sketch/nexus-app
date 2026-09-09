import type { ReactNode } from "react";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/footer";
import { LandingAtmosphere } from "@/components/landing/landing-atmosphere";
import { LegalDocumentHeader } from "./legal-header";
import { LegalTableOfContents } from "./legal-toc";
import { LegalDocumentNavigation } from "./legal-navigation";
import { LegalDisclaimerNotice } from "./legal-ui";
import type { LegalDocumentId, LegalTocItem } from "./types";
import { LEGAL_DOCUMENTS } from "./legal-data";
import { cn } from "@/lib/cn";

export function LegalDocumentLayout({
  docId,
  toc,
  children,
  className,
}: {
  docId: LegalDocumentId;
  toc: LegalTocItem[];
  children: ReactNode;
  className?: string;
}) {
  const document = LEGAL_DOCUMENTS[docId];

  return (
    <div className="nexus-landing min-h-dvh bg-bg-base text-text-primary">
      <LandingAtmosphere />
      <LandingNav context="legal" />

      <main id="main" className="pt-20 sm:pt-24">
        <div className="mx-auto w-full max-w-page px-4 pb-20 sm:px-6">
          {/* Document Header */}
          <LegalDocumentHeader document={document} />

          {/* Document Grid (Sidebar TOC + Content) */}
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr] lg:gap-12 xl:grid-cols-[300px_1fr]">
            {/* Table of Contents Sidebar */}
            <div>
              <LegalTableOfContents items={toc} currentDocId={docId} />
            </div>

            {/* Document Content Body */}
            <div className={cn("min-w-0 max-w-none", className)}>
              <div className="legal-prose">{children}</div>

              {/* Disclaimer Notice */}
              <LegalDisclaimerNotice />

              {/* Bottom Navigation */}
              <LegalDocumentNavigation currentDocId={docId} />
            </div>
          </div>
        </div>
      </main>

      <LandingFooter context="legal" />
    </div>
  );
}

export function LegalHubLayout({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="nexus-landing min-h-dvh bg-bg-base text-text-primary">
      <LandingAtmosphere />
      <LandingNav context="legal" />

      <main id="main" className={cn("pt-20 sm:pt-24 pb-20", className)}>
        {children}
      </main>

      <LandingFooter context="legal" />
    </div>
  );
}

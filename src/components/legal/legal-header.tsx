"use client";

import { useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconCheck, IconCopy, IconPrinter, IconShield } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import type { LegalDocumentMeta } from "./types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export function LegalDocumentHeader({
  document,
  className,
}: {
  document: LegalDocumentMeta;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Clipboard fallback
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <header className={cn("border-b border-border-subtle pb-8 pt-4", className)}>
      {/* Top breadcrumb & back link */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-small text-text-tertiary">
        <Link
          href="/legal"
          className="inline-flex items-center gap-1.5 rounded-input py-1 text-text-secondary transition-colors duration-150 ease-nexus hover:text-text-primary"
        >
          <NexusIcon icon={IconArrowLeft} px={14} />
          <span>Legal Center</span>
        </Link>

        <div className="flex items-center gap-2">
          <Badge tone="lavender">v{document.version}</Badge>
          <Badge tone="quiet">{document.readingTime}</Badge>
        </div>
      </div>

      {/* Main Title & Description */}
      <div className="mt-5">
        <span className="nexus-eyebrow-pill">
          <NexusIcon icon={IconShield} px={12} className="text-lavender" />
          {document.eyebrow}
        </span>

        <h1 className="mt-4 text-[34px] font-medium leading-[1.08] tracking-[-0.035em] text-text-primary sm:text-[44px] lg:text-[48px]">
          {document.title}
        </h1>

        <p className="nexus-lead mt-4 max-w-[740px] text-text-secondary">
          {document.subtitle}
        </p>
      </div>

      {/* Meta details & Quick actions */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle/70 pt-4 text-small">
        <div className="flex flex-wrap items-center gap-4 text-text-tertiary">
          <div>
            <span className="text-text-quaternary">Last updated:</span>{" "}
            <span className="font-mono text-text-secondary">{document.lastUpdated}</span>
          </div>
          <span className="hidden text-border-strong sm:inline">•</span>
          <div>
            <span className="text-text-quaternary">Effective date:</span>{" "}
            <span className="font-mono text-text-secondary">{document.effectiveDate}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy page link"
            className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-border-subtle bg-bg-surface px-3 font-mono text-[11px] text-text-secondary transition-colors duration-150 ease-nexus hover:border-border-strong hover:text-text-primary"
          >
            {copied ? (
              <>
                <NexusIcon icon={IconCheck} px={12} className="text-success" />
                <span className="text-success">Link copied</span>
              </>
            ) : (
              <>
                <NexusIcon icon={IconCopy} px={12} />
                <span>Share link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            aria-label="Print document"
            className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-border-subtle bg-bg-surface px-3 font-mono text-[11px] text-text-secondary transition-colors duration-150 ease-nexus hover:border-border-strong hover:text-text-primary"
          >
            <NexusIcon icon={IconPrinter} px={12} />
            <span>Print</span>
          </button>
        </div>
      </div>
    </header>
  );
}

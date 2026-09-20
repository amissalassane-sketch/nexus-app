import Link from "next/link";
import { IconArrowLeft, IconArrowRight, IconLayoutGrid } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import type { LegalDocumentId } from "./types";
import { LEGAL_DOCUMENTS_LIST } from "./legal-data";
import { cn } from "@/lib/cn";

export function LegalDocumentNavigation({
  currentDocId,
  className,
}: {
  currentDocId: LegalDocumentId;
  className?: string;
}) {
  const currentIndex = LEGAL_DOCUMENTS_LIST.findIndex((d) => d.id === currentDocId);
  const prevDoc = currentIndex > 0 ? LEGAL_DOCUMENTS_LIST[currentIndex - 1] : null;
  const nextDoc =
    currentIndex < LEGAL_DOCUMENTS_LIST.length - 1
      ? LEGAL_DOCUMENTS_LIST[currentIndex + 1]
      : null;

  return (
    <nav
      aria-label="Legal document sequence"
      className={cn("mt-12 border-t border-border-subtle pt-8", className)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
        {/* Previous Document */}
        {prevDoc ? (
          <Link
            href={prevDoc.href}
            className="group flex flex-1 flex-col justify-between rounded-card border border-border-subtle bg-bg-surface/50 p-4 transition-all duration-200 ease-nexus hover:border-border-default hover:bg-bg-surface"
          >
            <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-text-quaternary group-hover:text-text-tertiary">
              <NexusIcon icon={IconArrowLeft} px={12} />
              <span>Previous Document</span>
            </span>
            <span className="mt-2 text-h3 text-text-primary group-hover:text-lavender">
              {prevDoc.title}
            </span>
          </Link>
        ) : (
          <Link
            href="/legal"
            className="group flex flex-1 flex-col justify-between rounded-card border border-border-subtle bg-bg-surface/50 p-4 transition-all duration-200 ease-nexus hover:border-border-default hover:bg-bg-surface"
          >
            <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-text-quaternary group-hover:text-text-tertiary">
              <NexusIcon icon={IconLayoutGrid} px={12} />
              <span>Legal Center</span>
            </span>
            <span className="mt-2 text-h3 text-text-primary group-hover:text-lavender">
              Legal Hub Overview
            </span>
          </Link>
        )}

        {/* Next Document */}
        {nextDoc ? (
          <Link
            href={nextDoc.href}
            className="group flex flex-1 flex-col justify-between rounded-card border border-border-subtle bg-bg-surface/50 p-4 text-right transition-all duration-200 ease-nexus hover:border-border-default hover:bg-bg-surface"
          >
            <span className="flex items-center justify-end gap-1.5 font-mono text-[11px] uppercase tracking-wider text-text-quaternary group-hover:text-text-tertiary">
              <span>Next Document</span>
              <NexusIcon icon={IconArrowRight} px={12} />
            </span>
            <span className="mt-2 text-h3 text-text-primary group-hover:text-lavender">
              {nextDoc.title}
            </span>
          </Link>
        ) : (
          <Link
            href="/legal"
            className="group flex flex-1 flex-col justify-between rounded-card border border-border-subtle bg-bg-surface/50 p-4 text-right transition-all duration-200 ease-nexus hover:border-border-default hover:bg-bg-surface"
          >
            <span className="flex items-center justify-end gap-1.5 font-mono text-[11px] uppercase tracking-wider text-text-quaternary group-hover:text-text-tertiary">
              <span>Legal Center</span>
              <NexusIcon icon={IconLayoutGrid} px={12} />
            </span>
            <span className="mt-2 text-h3 text-text-primary group-hover:text-lavender">
              Back to Overview
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}

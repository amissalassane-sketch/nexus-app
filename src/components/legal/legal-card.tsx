import Link from "next/link";
import {
  IconArrowRight,
  IconCircleCheck,
  IconCookie,
  IconFileCheck,
  IconFileText,
  IconShieldCheck,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import type { LegalDocumentMeta } from "./types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export function LegalCard({
  document,
  className,
}: {
  document: LegalDocumentMeta;
  className?: string;
}) {
  const IconComponent = {
    terms: IconFileText,
    privacy: IconShieldCheck,
    cookies: IconCookie,
    "acceptable-use": IconFileCheck,
  }[document.id];

  return (
    <article
      className={cn(
        "group relative flex flex-col justify-between rounded-card border border-border-subtle bg-bg-surface/60 p-6 transition-all duration-200 ease-nexus hover:border-border-strong hover:bg-bg-surface sm:p-7",
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-input border border-border-subtle bg-bg-base/80 text-lavender">
            <NexusIcon icon={IconComponent} size="toolbar" />
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="lavender">v{document.version}</Badge>
            <span className="font-mono text-[11px] text-text-quaternary">
              {document.readingTime}
            </span>
          </div>
        </div>

        <div className="mt-5">
          <p className="nexus-eyebrow text-text-quaternary">{document.eyebrow}</p>
          <h2 className="mt-2 text-[20px] font-medium leading-snug tracking-[-0.02em] text-text-primary group-hover:text-lavender transition-colors duration-150">
            {document.title}
          </h2>
          <p className="mt-3 text-small leading-relaxed text-text-secondary">
            {document.summary}
          </p>
        </div>

        {/* Highlights */}
        <div className="mt-5 border-t border-border-subtle/70 pt-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-text-quaternary">
            Key Highlights
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {document.highlights.map((highlight, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-[12.5px] leading-snug text-text-secondary"
              >
                <NexusIcon
                  icon={IconCircleCheck}
                  px={13}
                  className="mt-0.5 text-text-tertiary"
                />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border-subtle/70 pt-4">
        <span className="font-mono text-[11px] text-text-quaternary">
          Updated {document.lastUpdated}
        </span>

        <Link
          href={document.href}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-pill border border-border-subtle bg-bg-base/80 px-3.5 text-small font-medium text-text-primary transition-all duration-150 ease-nexus hover:border-border-strong hover:bg-white hover:text-black"
        >
          <span>Read document</span>
          <NexusIcon
            icon={IconArrowRight}
            px={13}
            className="transition-transform duration-150 group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </article>
  );
}

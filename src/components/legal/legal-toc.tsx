"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, FileText, List } from "lucide-react";
import type { LegalDocumentId, LegalTocItem } from "./types";
import { LEGAL_DOCUMENTS_LIST } from "./legal-data";
import { cn } from "@/lib/cn";

export function LegalTableOfContents({
  items,
  currentDocId,
  className,
}: {
  items: LegalTocItem[];
  currentDocId: LegalDocumentId;
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find top-most visible entry in target window
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) {
          setActiveId(visible.target.id);
        }
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      }
    );

    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
      setMobileOpen(false);
    }
  };

  return (
    <aside className={cn("w-full", className)}>
      {/* Mobile Table of Contents Accordion */}
      <div className="mb-6 rounded-card border border-border-subtle bg-bg-surface/80 p-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          className="flex min-h-[44px] w-full items-center justify-between rounded-input px-3 text-small font-medium text-text-primary"
        >
          <div className="flex items-center gap-2">
            <List size={16} className="text-lavender" aria-hidden="true" />
            <span>Table of Contents</span>
            <span className="font-mono text-[11px] text-text-quaternary">
              ({items.length} sections)
            </span>
          </div>
          <ChevronDown
            size={16}
            className={cn(
              "text-text-tertiary transition-transform duration-200",
              mobileOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>

        {mobileOpen ? (
          <nav
            aria-label="Mobile table of contents"
            className="mt-3 border-t border-border-subtle pt-3"
          >
            <ul className="flex flex-col gap-1">
              {items.map((item) => {
                const isActive = activeId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(item.id)}
                      className={cn(
                        "flex min-h-[44px] w-full items-center rounded-input px-3 text-left text-small transition-colors duration-150 ease-nexus",
                        isActive
                          ? "bg-lavender-subtle text-lavender font-medium"
                          : "text-text-secondary hover:bg-accent-ghost hover:text-text-primary"
                      )}
                    >
                      <span className="truncate">{item.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 border-t border-border-subtle pt-3">
              <p className="px-3 text-eyebrow text-text-quaternary">
                Legal Documents
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {LEGAL_DOCUMENTS_LIST.map((doc) => (
                  <Link
                    key={doc.id}
                    href={doc.href}
                    className={cn(
                      "flex min-h-[44px] items-center justify-between rounded-input px-3 text-small transition-colors duration-150 ease-nexus",
                      doc.id === currentDocId
                        ? "bg-accent-ghost font-medium text-text-primary"
                        : "text-text-tertiary hover:bg-accent-ghost hover:text-text-secondary"
                    )}
                  >
                    <span>{doc.title}</span>
                    <span className="font-mono text-[10.5px] text-text-quaternary">
                      v{doc.version}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </nav>
        ) : null}
      </div>

      {/* Desktop Sticky Sidebar */}
      <div className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-4">
        {/* Document Navigation Tabs */}
        <div className="mb-6 rounded-card border border-border-subtle bg-bg-surface/50 p-2">
          <p className="px-2 pb-2 text-[10.5px] font-mono uppercase tracking-[0.08em] text-text-quaternary">
            Legal Documents
          </p>
          <div className="flex flex-col gap-1">
            {LEGAL_DOCUMENTS_LIST.map((doc) => {
              const isCurrent = doc.id === currentDocId;
              return (
                <Link
                  key={doc.id}
                  href={doc.href}
                  className={cn(
                    "flex items-center justify-between rounded-input px-2.5 py-1.5 text-small transition-colors duration-150 ease-nexus",
                    isCurrent
                      ? "bg-accent-ghost font-medium text-text-primary"
                      : "text-text-tertiary hover:bg-accent-ghost hover:text-text-secondary"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <FileText
                      size={13}
                      className={isCurrent ? "text-lavender" : "text-text-quaternary"}
                      aria-hidden="true"
                    />
                    <span>{doc.title}</span>
                  </span>
                  <span className="font-mono text-[10px] text-text-quaternary">
                    v{doc.version}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Section Table of Contents */}
        <div className="rounded-card border border-border-subtle bg-bg-subtle/70 p-4">
          <h3 className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.08em] text-text-quaternary">
            <List size={13} className="text-text-tertiary" aria-hidden="true" />
            <span>On this page</span>
          </h3>

          <nav aria-label="Document table of contents" className="mt-3">
            <ul className="flex flex-col gap-1 border-l border-border-subtle pl-2">
              {items.map((item) => {
                const isActive = activeId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(item.id)}
                      className={cn(
                        "group -ml-[9px] flex w-full items-start gap-2 rounded-r-input py-1 text-left text-small transition-colors duration-150 ease-nexus",
                        isActive
                          ? "font-medium text-lavender"
                          : "text-text-tertiary hover:text-text-secondary"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill transition-colors duration-150",
                          isActive
                            ? "bg-lavender"
                            : "bg-transparent group-hover:bg-text-quaternary"
                        )}
                      />
                      <span className="truncate leading-snug">{item.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </aside>
  );
}

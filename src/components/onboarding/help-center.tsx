"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconX } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { cn } from "@/lib/cn";
import { browserLocale, t } from "@/lib/onboarding/i18n";

const TOPICS = [
  { titleKey: "tip.projects.title" as const, bodyKey: "tip.projects.body" as const, href: "/projects" },
  { titleKey: "tip.tasks.title" as const, bodyKey: "tip.tasks.body" as const, href: "/tasks" },
  { titleKey: "tip.goals.title" as const, bodyKey: "tip.goals.body" as const, href: "/goals" },
  {
    titleKey: "tip.intelligence.title" as const,
    bodyKey: "tip.intelligence.body" as const,
    href: "/app/intelligence",
  },
];

export function HelpCenter({
  open,
  incomplete,
  onClose,
  onRestart,
  onContinue,
}: {
  open: boolean;
  incomplete?: boolean;
  onClose: () => void;
  onRestart: () => void;
  onContinue?: () => void;
}) {
  const locale = browserLocale();
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setClosing(false);
      onClose();
    }, 160);
  }, [closing, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  // Modal manners, mirroring the Modal primitive: lock the background
  // scroll, move keyboard focus inside the dialog on open, and hand it
  // back to the opener on close.
  useEffect(() => {
    if (!open || closing) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "button, [href], input, [tabindex]:not([tabindex='-1'])"
      );
      (focusable ?? panelRef.current)?.focus();
    }, 60);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, closing]);

  if (!open) return null;

  const panelClass = cn(
    "relative z-[76] my-0 flex max-h-[calc(100dvh-env(safe-area-inset-bottom)-1rem)] w-[min(440px,100vw)] flex-col overflow-hidden rounded-t-card border border-border-default bg-bg-surface shadow-overlay sm:my-4 sm:max-h-[min(86dvh,720px)] sm:rounded-card",
    closing ? "animate-scale-out pointer-events-none" : "animate-scale-in"
  );

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center overflow-y-auto overscroll-contain px-0 pb-[env(safe-area-inset-bottom)] pt-2 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close help"
        className={cn(
          "absolute inset-0 bg-black/60",
          closing ? "animate-fade-out" : "animate-fade-in"
        )}
        onClick={requestClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nexus-help-title"
        tabIndex={-1}
        className={panelClass}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:pb-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-text-quaternary">{t("guide.kicker", locale)}</p>
              <h2
                id="nexus-help-title"
                className="mt-1 text-[18px] font-semibold text-text-primary"
              >
                {t("help.title", locale)}
              </h2>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-nav text-text-tertiary hover:bg-accent-ghost hover:text-text-primary"
            >
              <NexusIcon icon={IconX} />
            </button>
          </div>
          <ul className="mt-4 divide-y divide-border-subtle border-y border-border-subtle">
            {TOPICS.map((topic) => (
              <li key={topic.href}>
                <Link
                  href={topic.href}
                  onClick={requestClose}
                  className="block py-3 hover:bg-accent-ghost"
                >
                  <p className="text-body-medium text-text-primary">
                    {t(topic.titleKey, locale)}
                  </p>
                  <p className="mt-0.5 text-small text-text-secondary">
                    {t(topic.bodyKey, locale)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-caption text-text-tertiary">
            {t("help.shortcuts", locale)}
          </p>
          {incomplete ? (
            <button
              type="button"
              onClick={() => {
                onContinue?.();
                onRestart();
                requestClose();
              }}
              className="mt-3 inline-flex h-9 items-center rounded-input border border-border-default px-3 text-button text-text-secondary hover:text-text-primary"
            >
              {t("help.continue", locale)}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onRestart();
                requestClose();
              }}
              className="mt-3 inline-flex h-9 items-center rounded-input border border-border-default px-3 text-button text-text-secondary hover:text-text-primary"
            >
              {t("help.replay", locale)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

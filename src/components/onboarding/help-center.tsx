"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
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

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close help"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nexus-help-title"
        className="relative z-[76] max-h-[86dvh] w-[min(440px,100vw)] overflow-y-auto rounded-t-card border border-border-default bg-bg-surface p-5 sm:rounded-card"
      >
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
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-nav text-text-tertiary hover:bg-accent-ghost hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>
        <ul className="mt-4 divide-y divide-border-subtle border-y border-border-subtle">
          {TOPICS.map((topic) => (
            <li key={topic.href}>
              <Link
                href={topic.href}
                onClick={onClose}
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
              onClose();
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
              onClose();
            }}
            className="mt-3 inline-flex h-9 items-center rounded-input border border-border-default px-3 text-button text-text-secondary hover:text-text-primary"
          >
            {t("help.replay", locale)}
          </button>
        )}
      </div>
    </div>
  );
}

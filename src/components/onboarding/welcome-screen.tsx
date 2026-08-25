"use client";

import { browserLocale, t } from "@/lib/onboarding/i18n";
import { useReducedMotion } from "@/components/onboarding/spotlight";
import { cn } from "@/lib/cn";

export function WelcomeScreen({
  onStart,
  onExplore,
}: {
  onStart: () => void;
  onExplore: () => void;
}) {
  const locale = browserLocale();
  const reduced = useReducedMotion();

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nexus-welcome-title"
        className={cn(
          "relative z-[71] w-[min(420px,100%)] rounded-card border border-border-default bg-bg-surface p-6 shadow-dropdown",
          !reduced && "animate-fade-in"
        )}
      >
        <p className="eyebrow text-text-quaternary">
          {t("welcome.kicker", locale)}
        </p>
        <h2
          id="nexus-welcome-title"
          className="mt-3 text-[22px] font-semibold tracking-[-0.025em] text-text-primary"
        >
          {t("welcome.title", locale)}
        </h2>
        <p className="mt-2.5 text-body text-text-secondary">
          {t("welcome.body", locale)}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg hover:bg-accent-hover"
          >
            {t("welcome.start", locale)}
          </button>
          <button
            type="button"
            onClick={onExplore}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-input border border-border-default px-3.5 text-button text-text-secondary hover:text-text-primary"
          >
            {t("welcome.explore", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}

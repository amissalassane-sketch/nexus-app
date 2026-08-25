"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  canAdvanceWithoutProductEvent,
  type GuideStep,
} from "@/lib/onboarding/model";
import { browserLocale, t } from "@/lib/onboarding/i18n";
import {
  Spotlight,
  useGuideTarget,
  useReducedMotion,
} from "@/components/onboarding/spotlight";

export function GuidedTour({
  step,
  onSkip,
  onWelcome,
}: {
  step: GuideStep;
  onSkip: () => void;
  onWelcome: () => void;
}) {
  const router = useRouter();
  const locale = browserLocale();
  const reduced = useReducedMotion();
  const { rect, missing } = useGuideTarget(step.target, step.id);
  const isWelcome = step.id === "welcome";
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSkip();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const go = () => {
    if (isWelcome) {
      onWelcome();
      return;
    }
    if (step.href) router.push(step.href);
  };

  const cardStyle =
    rect && !isMobile
      ? {
          top: Math.min(rect.top + rect.height + 16, window.innerHeight - 240),
          left: Math.min(Math.max(12, rect.left), window.innerWidth - 372),
        }
      : isMobile
        ? { left: 12, right: 12, bottom: 88 }
        : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div className="fixed inset-0 z-[70]" aria-live="polite">
      <Spotlight rect={isWelcome ? null : rect} reduced={reduced} />

      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="nexus-guide-title"
        aria-describedby="nexus-guide-body"
        className={cn(
          "pointer-events-auto absolute z-[71] w-[min(360px,calc(100vw-24px))] rounded-card border border-border-default bg-bg-surface p-4 shadow-dropdown",
          !reduced && "animate-fade-in",
          isMobile && "w-auto"
        )}
        style={cardStyle}
      >
        <p className="eyebrow text-text-quaternary">{t("guide.kicker", locale)}</p>
        <h2
          id="nexus-guide-title"
          className="mt-2 text-[17px] font-semibold tracking-[-0.02em] text-text-primary"
        >
          {t(step.titleKey, locale)}
        </h2>
        <p id="nexus-guide-body" className="mt-2 text-small text-text-secondary">
          {missing && step.target
            ? t("guide.fallback", locale)
            : t(step.bodyKey, locale)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {step.actionKey || isWelcome ? (
            <button
              type="button"
              onClick={go}
              className="inline-flex h-9 items-center rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg hover:bg-accent-hover"
            >
              {step.actionKey
                ? t(step.actionKey, locale)
                : t("guide.continue", locale)}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-9 items-center rounded-input px-3 text-button text-text-tertiary hover:text-text-primary"
          >
            {t("guide.skip", locale)}
          </button>
        </div>
        {!canAdvanceWithoutProductEvent(step) ? (
          <p className="mt-3 text-caption text-text-quaternary">
            {t("guide.actionHint", locale)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

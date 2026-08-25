"use client";

import { useEffect, useState } from "react";
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
  type SpotlightRect,
} from "@/components/onboarding/spotlight";

const CARD_WIDTH = 360;
const CARD_HEIGHT_ESTIMATE = 220;
const GAP = 16;
const EDGE = 12;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return isMobile;
}

/** Picks whichever side (bottom/top/right/left) actually fits, so the
 *  panel never covers the element it's pointing at. Falls back to a
 *  centered placement when nothing else fits (or there's no target). */
function placeCard(rect: SpotlightRect | null) {
  if (typeof window === "undefined") {
    return { style: {}, placement: "center" as const };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect) {
    return {
      style: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
      placement: "center" as const,
    };
  }

  const space = {
    bottom: vh - (rect.top + rect.height),
    top: rect.top,
    right: vw - (rect.left + rect.width),
    left: rect.left,
  };

  type Side = "bottom" | "top" | "right" | "left";
  const order: Side[] = (["bottom", "top", "right", "left"] as Side[]).slice().sort(
    (a, b) => space[b] - space[a]
  );
  const placement =
    order.find((side) =>
      side === "bottom" || side === "top"
        ? space[side] >= CARD_HEIGHT_ESTIMATE
        : space[side] >= CARD_WIDTH
    ) ?? order[0];

  const clampLeft = (left: number) =>
    Math.min(Math.max(EDGE, left), vw - CARD_WIDTH - EDGE);
  const clampTop = (top: number) =>
    Math.min(Math.max(EDGE, top), vh - CARD_HEIGHT_ESTIMATE - EDGE);

  if (placement === "bottom") {
    return {
      style: { top: rect.top + rect.height + GAP, left: clampLeft(rect.left) },
      placement,
    };
  }
  if (placement === "top") {
    return {
      style: {
        top: Math.max(EDGE, rect.top - GAP - CARD_HEIGHT_ESTIMATE),
        left: clampLeft(rect.left),
      },
      placement,
    };
  }
  if (placement === "right") {
    return {
      style: { top: clampTop(rect.top), left: rect.left + rect.width + GAP },
      placement,
    };
  }
  return {
    style: { top: clampTop(rect.top), left: Math.max(EDGE, rect.left - GAP - CARD_WIDTH) },
    placement,
  };
}

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
  const isMobile = useIsMobile();

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

  const cardStyle = isMobile
    ? { left: 12, right: 12, bottom: 88 }
    : placeCard(isWelcome ? null : rect).style;

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
          !reduced && "animate-fade-in transition-[top,left,right,bottom] duration-200 ease-nexus",
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

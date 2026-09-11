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
  findGuideTarget,
  useGuideTarget,
  useReducedMotion,
  type SpotlightRect,
} from "@/components/onboarding/spotlight";

const CARD_WIDTH = 360;
const CARD_HEIGHT_ESTIMATE = 220;
const GAP = 16;
const EDGE = 12;

function useIsMobile() {
  // The shell collapses to the bottom tab bar below `lg` (1024px) — the same
  // threshold the tour must use, or it would draw a desktop-anchored card
  // against a mobile chrome between 768 and 1023px.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1024
  );
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 1024);
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
  const [pending, setPending] = useState(false);
  const [prevStepId, setPrevStepId] = useState(step.id);
  const [modalActive, setModalActive] = useState(false);

  if (prevStepId !== step.id) {
    setPrevStepId(step.id);
    setPending(false);
  }

  useEffect(() => {
    const checkModal = () => {
      const modal = document.querySelector("[role='dialog'][aria-modal='true']");
      setModalActive(Boolean(modal));
    };
    checkModal();
    const mo = new MutationObserver(checkModal);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSkip();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const go = () => {
    if (pending) return;
    if (isWelcome) {
      setPending(true);
      onWelcome();
      return;
    }
    // Navigation steps complete on arrival, so a transient pending state
    // is safe there. Create/interact steps only complete through a real
    // product event — locking the card in a spinner would trap the user
    // if they decide not to create the item, so they never lock.
    if (canAdvanceWithoutProductEvent(step)) {
      setPending(true);
      if (step.href) router.push(step.href);
      return;
    }
    if (step.expectedAction === "interact") {
      const el = step.target ? findGuideTarget(step.target) : null;
      if (el) {
        el.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: reduced ? "auto" : "smooth",
        });
        el.focus({ preventScroll: true });
        return;
      }
    }
    if (step.href) router.push(step.href);
  };

  const mobileStyle = (() => {
    if (!rect) return { left: 12, right: 12, bottom: 88 };
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    if (rect.top + rect.height / 2 > vh / 2) {
      return { left: 12, right: 12, top: 68 };
    }
    return { left: 12, right: 12, bottom: 88 };
  })();

  const cardStyle = isMobile
    ? mobileStyle
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
          !reduced && "animate-fade-in transition-[top,left,right,bottom,opacity] duration-200 ease-nexus",
          modalActive && "pointer-events-none opacity-20",
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
              disabled={pending}
              aria-busy={pending || undefined}
              onClick={go}
              className="inline-flex h-9 items-center gap-2 rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg transition-colors duration-140 hover:bg-accent-hover active:translate-y-px disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
            >
              {pending ? (
                <svg
                  className="h-3.5 w-3.5 animate-spin"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6.5"
                    stroke="currentColor"
                    strokeOpacity="0.25"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              ) : null}
              <span>
                {step.actionKey
                  ? t(step.actionKey, locale)
                  : t("guide.continue", locale)}
              </span>
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={onSkip}
            className="inline-flex h-9 items-center rounded-input px-3 text-button text-text-tertiary transition-colors duration-140 hover:text-text-primary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lavender-border"
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

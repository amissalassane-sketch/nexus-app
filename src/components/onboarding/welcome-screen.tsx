"use client";

import { useEffect, useRef, useState } from "react";
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
  const [pending, setPending] = useState<"start" | "explore" | null>(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  const handleStart = () => {
    if (pending || closing) return;
    setPending("start");
    setClosing(true);
    closeTimer.current = setTimeout(onStart, 160);
  };

  const handleExplore = () => {
    if (pending || closing) return;
    setPending("explore");
    setClosing(true);
    closeTimer.current = setTimeout(onExplore, 160);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <div
        className={cn(
          "absolute inset-0 bg-black/45",
          !reduced && (closing ? "animate-fade-out" : "animate-fade-in")
        )}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nexus-welcome-title"
        className={cn(
          "relative z-[71] w-[min(420px,100%)] rounded-card border border-border-default bg-bg-surface p-6 shadow-dropdown",
          !reduced && (closing ? "animate-scale-out" : "animate-scale-in"),
          closing && "pointer-events-none"
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
            disabled={pending !== null}
            onClick={handleStart}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg transition-colors duration-140 hover:bg-accent-hover disabled:opacity-60"
          >
            {pending === "start" ? (
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
            <span>{t("welcome.start", locale)}</span>
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={handleExplore}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-colors duration-140 hover:text-text-primary disabled:opacity-50"
          >
            {t("welcome.explore", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}

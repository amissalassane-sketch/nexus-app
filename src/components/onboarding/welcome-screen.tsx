"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { browserLocale, t } from "@/lib/onboarding/i18n";
import { useReducedMotion } from "@/components/onboarding/spotlight";
import { cn } from "@/lib/cn";

/**
 * In-app welcome overlay — the first thing a new user sees after
 * authentication, before they reach the dashboard.
 *
 * VISUAL: Matches the NEXUS auth visual system — dark translucent
 * surfaces, subtle borders, cinematic motion, premium typography.
 * The animated dot-matrix from the auth pages continues underneath
 * this overlay through the dashboard's own background.
 */
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
    closeTimer.current = setTimeout(onStart, 200);
  };

  const handleExplore = () => {
    if (pending || closing) return;
    setPending("explore");
    setClosing(true);
    closeTimer.current = setTimeout(onExplore, 200);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:items-center sm:p-4">
      {/* Backdrop — cinematic dark overlay with subtle blur */}
      <motion.div
        className="absolute inset-0 bg-black/60"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: reduced ? 0 : 0.3 }}
      />

      {/* Welcome card — dark translucent surface */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nexus-welcome-title"
        initial={reduced ? {} : { opacity: 0, y: 20, scale: 0.97 }}
        animate={
          closing
            ? { opacity: 0, y: -10, scale: 0.98 }
            : { opacity: 1, y: 0, scale: 1 }
        }
        transition={{
          duration: reduced ? 0 : 0.4,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={cn(
          "relative z-[71] w-[min(420px,100%)] rounded-overlay surface-overlay p-5",
          closing && "pointer-events-none"
        )}
      >
        {/* Eyebrow — quiet mono label */}
        <p className="mono-token text-text-quaternary">
          {t("welcome.kicker", locale)}
        </p>

        <h2
          id="nexus-welcome-title"
          className="mt-3 text-h1 text-text-primary"
        >
          {t("welcome.title", locale)}
        </h2>

        <p className="mt-2.5 text-small text-text-secondary">
          {t("welcome.body", locale)}
        </p>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <motion.button
            type="button"
            disabled={pending !== null}
            onClick={handleStart}
            transition={{ duration: 0.15 }}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-pill bg-accent px-4 text-button font-medium text-accent-fg transition-colors duration-[120ms] hover:bg-accent-hover disabled:opacity-60"
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
          </motion.button>

          <motion.button
            type="button"
            disabled={pending !== null}
            onClick={handleExplore}
            transition={{ duration: 0.15 }}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-pill border border-border-default bg-bg-surface-2 px-4 text-button font-medium text-text-secondary transition-colors duration-[120ms] hover:border-border-strong hover:text-text-primary disabled:opacity-50"
          >
            {t("welcome.explore", locale)}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

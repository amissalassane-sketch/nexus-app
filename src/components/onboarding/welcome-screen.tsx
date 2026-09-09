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
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      {/* Backdrop — cinematic dark overlay with subtle blur */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
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
          "relative z-[71] w-[min(420px,100%)] rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/95 backdrop-blur-md p-6 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)]",
          closing && "pointer-events-none"
        )}
      >
        {/* Eyebrow — quiet mono label */}
        <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/30">
          {t("welcome.kicker", locale)}
        </p>

        <h2
          id="nexus-welcome-title"
          className="mt-3 text-[22px] font-bold tracking-[-0.025em] text-white"
        >
          {t("welcome.title", locale)}
        </h2>

        <p className="mt-2.5 text-[13.5px] leading-[21px] text-white/50">
          {t("welcome.body", locale)}
        </p>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <motion.button
            type="button"
            disabled={pending !== null}
            onClick={handleStart}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium text-black transition-colors duration-200 hover:bg-white/90 disabled:opacity-60"
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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 text-[13px] font-medium text-white/60 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-50"
          >
            {t("welcome.explore", locale)}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

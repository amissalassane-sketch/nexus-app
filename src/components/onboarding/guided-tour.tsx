"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import type { GuideStep } from "@/lib/onboarding/model";

type Rect = { top: number; left: number; width: number; height: number };

function measure(selector?: string): Rect | null {
  if (!selector || typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  return {
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
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
  const [rect, setRect] = useState<Rect | null>(null);
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    const update = () => setRect(measure(step.target));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const timer = window.setInterval(update, 400);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(timer);
    };
  }, [step.target, step.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSkip();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const isWelcome = step.id === "welcome";
  const pad = 8;

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none" aria-live="polite">
      <div
        className={cn(
          "absolute inset-0 bg-black/55 pointer-events-auto",
          !reduced && "transition-opacity duration-200"
        )}
        onClick={onSkip}
        aria-hidden="true"
      />

      {rect ? (
        <div
          className={cn(
            "pointer-events-none absolute rounded-input ring-2 ring-white/70",
            !reduced && "transition-all duration-200"
          )}
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      ) : null}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nexus-guide-title"
        aria-describedby="nexus-guide-body"
        className={cn(
          "pointer-events-auto absolute z-[71] w-[min(360px,calc(100vw-24px))] rounded-card border border-border-default bg-bg-surface p-4 shadow-dropdown",
          !reduced && "animate-fade-in"
        )}
        style={
          rect
            ? {
                top: Math.min(
                  rect.top + rect.height + 16,
                  window.innerHeight - 220
                ),
                left: Math.min(
                  Math.max(12, rect.left),
                  window.innerWidth - 372
                ),
              }
            : {
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }
        }
      >
        <p className="eyebrow text-text-quaternary">NEXUS Guide</p>
        <h2
          id="nexus-guide-title"
          className="mt-2 text-[17px] font-semibold tracking-[-0.02em] text-text-primary"
        >
          {step.title}
        </h2>
        <p
          id="nexus-guide-body"
          className="mt-2 text-small text-text-secondary"
        >
          {step.description}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isWelcome ? (
            <button
              type="button"
              onClick={onWelcome}
              className="inline-flex h-9 items-center rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg hover:bg-accent-hover"
            >
              {step.actionLabel}
            </button>
          ) : step.href ? (
            <button
              type="button"
              onClick={() => router.push(step.href!)}
              className="inline-flex h-9 items-center rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg hover:bg-accent-hover"
            >
              {step.actionLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-9 items-center rounded-input px-3 text-button text-text-tertiary hover:text-text-primary"
          >
            Skip for now
          </button>
        </div>
        <p className="mt-3 text-caption text-text-quaternary">
          This step completes when you take the action — not when you click next.
        </p>
      </div>
    </div>
  );
}

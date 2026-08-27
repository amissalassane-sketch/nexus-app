"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "./use-reduced-motion";

// ============================================================
// NEXUS — INTELLIGENCE STATES
// Meaningful UI states for Intelligence processing:
// Understanding workspace → Checking tasks → Found blockers →
// Next best action ready. Quick, intentional, not fake dots.
// ============================================================

export type IntelligenceProcessingState =
  | "idle"
  | "understanding"
  | "checking_tasks"
  | "checking_projects"
  | "analyzing_signals"
  | "synthesizing"
  | "ready";

const STATE_LABELS: Record<IntelligenceProcessingState, string> = {
  idle: "",
  understanding: "Understanding your workspace…",
  checking_tasks: "Checking related tasks…",
  checking_projects: "Reviewing projects…",
  analyzing_signals: "Analyzing signals…",
  synthesizing: "Synthesizing response…",
  ready: "Response ready",
};

const STATE_ORDER: IntelligenceProcessingState[] = [
  "understanding",
  "checking_tasks",
  "analyzing_signals",
  "synthesizing",
];

export function IntelligenceProcessingStates({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentIndex(0);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentIndex(0);

    if (reduced) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= STATE_ORDER.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 380);

    return () => clearInterval(interval);
  }, [active, reduced]);

  if (!active || !visible) return null;

  const currentState = STATE_ORDER[currentIndex];

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-input border border-border-subtle bg-bg-surface/80 px-3 py-2.5 animate-[intelligence-state-in_240ms_var(--ease-nexus)_both]",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-1">
        <span className="h-1 w-1 rounded-pill bg-lavender animate-[intelligence-thinking_1.2s_var(--ease-nexus)_infinite]" />
        <span className="h-1 w-1 rounded-pill bg-lavender/70 animate-[intelligence-thinking_1.2s_var(--ease-nexus)_150ms_infinite]" />
        <span className="h-1 w-1 rounded-pill bg-lavender/40 animate-[intelligence-thinking_1.2s_var(--ease-nexus)_300ms_infinite]" />
      </div>
      <span className="text-caption font-medium text-text-secondary animate-[intelligence-state-in_200ms_var(--ease-nexus)_both]">
        {STATE_LABELS[currentState]}
      </span>
      <div className="ml-auto h-[2px] w-16 overflow-hidden rounded-pill bg-white/[0.06]">
        <div
          className="h-full bg-lavender/60 transition-all duration-300 ease-nexus"
          style={{
            width: `${((currentIndex + 1) / STATE_ORDER.length) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

export function IntelligenceThinkingDots({
  className,
}: {
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-hidden="true">
      <span className="h-1 w-1 rounded-pill bg-current animate-[intelligence-thinking_1s_var(--ease-nexus)_infinite]" />
      <span className="h-1 w-1 rounded-pill bg-current animate-[intelligence-thinking_1s_var(--ease-nexus)_150ms_infinite]" />
      <span className="h-1 w-1 rounded-pill bg-current animate-[intelligence-thinking_1s_var(--ease-nexus)_300ms_infinite]" />
    </span>
  );
}

export function VerificationLifecycle({
  state,
  className,
}: {
  state: "proposed" | "confirm" | "executing" | "verifying" | "verified" | "failed";
  className?: string;
}) {
  const steps = [
    { id: "proposed", label: "Proposed" },
    { id: "confirm", label: "Confirm" },
    { id: "executing", label: "Executing" },
    { id: "verifying", label: "Verifying" },
    { id: "verified", label: "Verified" },
  ] as const;

  const currentIndex = steps.findIndex((s) => s.id === state);
  const isFailed = state === "failed";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-input border border-border-subtle bg-bg-surface/50 px-2.5 py-1.5",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isPast = index < currentIndex;
        const isFuture = index > currentIndex;

        return (
          <div key={step.id} className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-medium transition-all duration-200 ease-nexus",
                isPast && !isFailed && "border-success-border bg-success-bg text-success",
                isActive && !isFailed && "border-lavender bg-lavender-subtle text-lavender animate-[verification-pulse_900ms_var(--ease-nexus)_infinite]",
                isActive && isFailed && "border-danger-border bg-danger-bg text-danger",
                isFuture && "border-border-subtle bg-transparent text-text-quaternary",
                isActive && state === "verified" && "border-success-border bg-success-bg text-success animate-[check-pop_320ms_var(--ease-nexus)_both]"
              )}
            >
              {isPast && !isFailed ? "✓" : index + 1}
            </div>
            <span
              className={cn(
                "hidden text-[11px] font-medium transition-colors duration-200 sm:inline",
                isActive ? "text-text-primary" : isPast ? "text-text-secondary" : "text-text-quaternary"
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <div
                className={cn(
                  "h-px w-4 transition-colors duration-200",
                  index < currentIndex ? "bg-success/40" : "bg-border-subtle"
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

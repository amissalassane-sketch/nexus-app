"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS LANDING — TYPED HERO LINE
//
// The second half of the headline is written, then erased, then
// written again — like someone reading the workspace and
// refining what they see. Quiet, deterministic, no terminal
// noise:
//   - starts on "Not the chat." (already written on load),
//   - holds, erases, types each facet, in a fixed order,
//   - a soft caret sits at the end of the line and only blinks
//     when the line is at rest,
//   - the invisible slot keeps the line-box at exactly one line
//     of height, so nothing below the headline ever moves,
//   - under prefers-reduced-motion nothing moves: the first
//     facet stays, fully written, with a static caret.
//
// Screen readers hear the stable proposition once (sr-only in
// the h1); the visible line is aria-hidden so the typing never
// spams a live region.
// ============================================================

const VARIANTS = [
  "Not the chat.",
  "Not the noise.",
  "Not the guesswork.",
  "Not the busywork.",
  "Not the surface.",
] as const;

/** Longest variant — the invisible slot that reserves the line height. */
const SLOT = "Not the guesswork.";

const TYPE_MS = 55;
const DELETE_MS = 38;
const HOLD_MS = 2000;
const BREATH_MS = 500;
const SETTLE_MS = 340;

type Stage = "hold" | "deleting" | "breath" | "typing" | "settle";

export function HeroHeadline() {
  const [text, setText] = useState<string>(VARIANTS[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducedMotion) return;

    let timer = 0;
    let index = 0;
    let length = VARIANTS[0].length;
    let stage: Stage = "hold";

    const schedule = (next: Stage, ms: number) => {
      stage = next;
      timer = window.setTimeout(run, ms);
    };

    const run = () => {
      switch (stage) {
        case "hold":
          setBusy(false);
          schedule("deleting", DELETE_MS);
          break;
        case "deleting":
          setBusy(true);
          length -= 1;
          setText(VARIANTS[index].slice(0, length));
          if (length === 0) schedule("breath", BREATH_MS);
          else schedule("deleting", DELETE_MS);
          break;
        case "breath":
          index = (index + 1) % VARIANTS.length;
          schedule("typing", 80);
          break;
        case "typing":
          setBusy(true);
          length += 1;
          setText(VARIANTS[index].slice(0, length));
          if (length === VARIANTS[index].length) schedule("settle", SETTLE_MS);
          else schedule("typing", TYPE_MS);
          break;
        case "settle":
          schedule("hold", HOLD_MS);
          break;
      }
    };

    // The first facet is already fully written on load. The loop starts
    // by erasing it — the writing effect is visible from the first beat.
    timer = window.setTimeout(run, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <span className="hero-line" aria-hidden="true">
      {/* Invisible slot: sets the height the animation must respect. */}
      <span className="hero-line-slot">{SLOT}</span>

      <span className="hero-line-layer">
        {text}
        <span
          className={cn(
            "hero-caret",
            busy ? "hero-caret-active" : "hero-caret-blink"
          )}
        />
      </span>
    </span>
  );
}

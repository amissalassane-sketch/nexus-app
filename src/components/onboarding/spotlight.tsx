"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { cn } from "@/lib/cn";

export type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/**
 * Resolves a guide target the way a user actually sees it: the first match
 * with a real, visible box. `document.querySelector` alone would happily
 * return a duplicate that is inside a `display:none` container (for example
 * the desktop sidebar below `lg`, where the mobile tab bar renders the same
 * `data-guide` label) — pointing the spotlight at an element that is not on
 * screen at all.
 */
export function findGuideTarget(selector?: string): HTMLElement | null {
  if (!selector || typeof document === "undefined") return null;
  const matches = document.querySelectorAll<HTMLElement>(selector);
  for (const el of Array.from(matches)) {
    const box = el.getBoundingClientRect();
    if (box.width >= 2 && box.height >= 2) return el;
  }
  return null;
}

export function measureGuide(selector?: string): SpotlightRect | null {
  if (!selector || typeof document === "undefined") return null;
  const el = findGuideTarget(selector);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
  return {
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
  };
}

/** Four-pane overlay so the target stays clickable, yielding pointer events if a modal dialog is active. */
export function Spotlight({
  rect,
  reduced,
}: {
  rect: SpotlightRect | null;
  reduced: boolean;
}) {
  const [modalActive, setModalActive] = useState(false);

  useEffect(() => {
    // Only a *visible* modal dialog counts. A hidden or leftover dialog
    // (route transition, closing animation, display:none panel) would
    // otherwise dim the tour card and steal its pointer events.
    const checkModal = () => {
      const dialogs = document.querySelectorAll<HTMLElement>(
        "[role='dialog'][aria-modal='true']"
      );
      const modal = Array.from(dialogs).find(
        (el) => el.getBoundingClientRect().width >= 2
      );
      setModalActive(Boolean(modal));
    };
    checkModal();
    const mo = new MutationObserver(checkModal);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => mo.disconnect();
  }, []);

  const pad = 8;
  if (!rect) {
    return (
      <div
        className="pointer-events-none absolute inset-0 bg-black/40 transition-opacity duration-200"
        aria-hidden="true"
      />
    );
  }

  const top = Math.max(0, rect.top - pad);
  const left = Math.max(0, rect.left - pad);
  const width = rect.width + pad * 2;
  const height = rect.height + pad * 2;

  // When a modal dialog is open, yield pointer events so the user can type and submit without obstacle
  const pane = cn(
    "absolute bg-black/50 transition-opacity duration-200",
    modalActive ? "pointer-events-none opacity-20" : "pointer-events-auto"
  );

  return (
    <>
      <div className={pane} style={{ top: 0, left: 0, right: 0, height: top }} />
      <div
        className={pane}
        style={{ top: top + height, left: 0, right: 0, bottom: 0 }}
      />
      <div
        className={pane}
        style={{ top, left: 0, width: left, height }}
      />
      <div
        className={pane}
        style={{ top, left: left + width, right: 0, height }}
      />
      <div
        className={cn(
          "pointer-events-none absolute rounded-input ring-2 ring-white/70",
          modalActive && "opacity-0",
          !reduced && "transition-all duration-200"
        )}
        style={{ top, left, width, height }}
      />
    </>
  );
}

export function useReducedMotion(): boolean {
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

  return reduced;
}

export function useGuideTarget(selector?: string, id?: string) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [missing, setMissing] = useState(false);

  useLayoutEffect(() => {
    let missingTimer: number | undefined;
    let ro: ResizeObserver | null = null;
    let observedEl: HTMLElement | null = null;
    // Typing in a form mutates the DOM on every keystroke, which fires the
    // MutationObserver below. Re-measuring is fine — but scrolling and
    // re-rendering on every keystroke made the ring jitter and stole the
    // scroll position while the user typed. Only commit a change when the
    // measured box has actually moved or resized.
    let last: SpotlightRect | null = null;

    const sameRect = (a: SpotlightRect | null, b: SpotlightRect | null) =>
      a === b ||
      (a !== null &&
        b !== null &&
        Math.abs(a.top - b.top) < 0.5 &&
        Math.abs(a.left - b.left) < 0.5 &&
        Math.abs(a.width - b.width) < 0.5 &&
        Math.abs(a.height - b.height) < 0.5);

    const update = () => {
      const el = selector ? findGuideTarget(selector) : null;
      if (!el) {
        if (last !== null) {
          last = null;
          setRect(null);
        }
        if (missingTimer === undefined) {
          // Give async content a couple of seconds to appear before we show
          // the "target not found" fallback copy.
          missingTimer = window.setTimeout(() => setMissing(true), 2000);
        }
        return;
      }

      const box = el.getBoundingClientRect();

      const next = {
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      };

      if (missingTimer !== undefined) {
        window.clearTimeout(missingTimer);
        missingTimer = undefined;
      }
      setMissing(false);

      // Track the resolved element's own size/position changes (e.g. it
      // grows after data loads) without polling on a timer.
      if (el !== observedEl) {
        ro?.disconnect();
        ro = new ResizeObserver(update);
        ro.observe(el);
        observedEl = el;
      }

      if (sameRect(last, next)) return;
      last = next;
      // Only scroll for real moves — never as a side effect of typing.
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      setRect(next);
    };

    update();

    // The target may not exist yet (route transition, async content).
    // A MutationObserver reacts the instant it appears, instead of
    // waiting on an arbitrary polling interval.
    const mo = new MutationObserver(update);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      mo.disconnect();
      ro?.disconnect();
      if (missingTimer !== undefined) window.clearTimeout(missingTimer);
    };
  }, [selector, id]);

  return { rect, missing };
}

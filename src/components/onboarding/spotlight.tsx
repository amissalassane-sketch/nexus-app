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

/**
 * True while a visible modal dialog owns the screen. Shared by the tour
 * card and the spotlight so both agree through a single DOM observation
 * instead of each running its own MutationObserver over the document.
 *
 * Only a *visible* modal dialog counts. A hidden or leftover dialog
 * (route transition, closing animation, display:none panel) would
 * otherwise dim the tour card and steal its pointer events.
 *
 * Pre-paint (`useLayoutEffect`): when a dialog and the tour mount in the
 * same commit (e.g. the `/projects?create=1` deep link), detection runs
 * before the browser paints — the tour never flashes a frame over the
 * dialog it is supposed to yield to.
 */
export function useModalActive(): boolean {
  const [modalActive, setModalActive] = useState(false);

  useLayoutEffect(() => {
    const checkModal = () => {
      const dialogs = document.querySelectorAll<HTMLElement>(
        "[role='dialog'][aria-modal='true']"
      );
      const modal = Array.from(dialogs).find(
        (el) => el.getBoundingClientRect().width >= 2
      );
      setModalActive((current) => {
        const next = Boolean(modal);
        return current === next ? current : next;
      });
    };
    checkModal();
    const mo = new MutationObserver(checkModal);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => mo.disconnect();
  }, []);

  return modalActive;
}

/**
 * Four-pane overlay so the target stays clickable, yielding pointer events
 * if a modal dialog is active.
 *
 * INVARIANT: the parent tour wrapper MUST be pointer-events-none, or the
 * wrapper itself swallows every click (spotlight hole included) and the
 * product underneath — including open modals — becomes unclickable.
 */
export function Spotlight({
  rect,
  reduced,
  modalActive = false,
}: {
  rect: SpotlightRect | null;
  reduced: boolean;
  /**
   * Owned by the tour via `useModalActive()` and passed down, so the
   * spotlight and the card always agree through one observation instead
   * of each watching the document separately.
   */
  modalActive?: boolean;
}) {

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

  // While a modal dialog owns the screen the tour steps out entirely:
  // no pointer interception and no residual dim over the form the user
  // is completing — the panes fade back in when the dialog closes.
  const pane = cn(
    "absolute bg-black/50 transition-opacity duration-200",
    modalActive ? "pointer-events-none opacity-0" : "pointer-events-auto"
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

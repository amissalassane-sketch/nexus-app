"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { cn } from "@/lib/cn";

export type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function measureGuide(selector?: string): SpotlightRect | null {
  if (!selector || typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  if (box.width < 2 && box.height < 2) return null;
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
  return {
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
  };
}

/** Four-pane overlay so the target stays clickable. */
export function Spotlight({
  rect,
  reduced,
}: {
  rect: SpotlightRect | null;
  reduced: boolean;
}) {
  const pad = 8;
  if (!rect) {
    return (
      <div
        className="pointer-events-none absolute inset-0 bg-black/40"
        aria-hidden="true"
      />
    );
  }

  const top = Math.max(0, rect.top - pad);
  const left = Math.max(0, rect.left - pad);
  const width = rect.width + pad * 2;
  const height = rect.height + pad * 2;

  const pane = "pointer-events-auto absolute bg-black/50";

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
    let attempts = 0;
    const update = () => {
      const next = measureGuide(selector);
      setRect(next);
      attempts += 1;
      if (!next && attempts >= 8) setMissing(true);
      if (next) setMissing(false);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const timer = window.setInterval(update, 250);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(timer);
    };
  }, [selector, id]);

  return { rect, missing };
}

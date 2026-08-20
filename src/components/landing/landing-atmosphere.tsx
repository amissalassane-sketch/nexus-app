"use client";

import { useEffect } from "react";

/**
 * Landing-wide pointer-reactive ambient light.
 *
 * One faint light source drifts with the cursor across the whole landing
 * page (`.nexus-landing-light` in globals.css reads `--nexus-glow-x` /
 * `--nexus-glow-y` from `<html>`). Amplitude is deliberately small — the
 * page should feel present, never seasick — and only transform is used,
 * so nothing reflows and no layout is ever measured.
 *
 * Disabled on coarse pointers and under `prefers-reduced-motion`: the
 * light simply stays at its resting position, and content never depends
 * on pointer movement to render.
 */
export function LandingAtmosphere() {
  useEffect(() => {
    const canTrack = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!canTrack.matches || reducedMotion.matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const render = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;

      const root = document.documentElement;
      root.style.setProperty("--nexus-glow-x", `${(currentX * 48).toFixed(2)}px`);
      root.style.setProperty("--nexus-glow-y", `${(currentY * 32).toFixed(2)}px`);

      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
        frame = window.requestAnimationFrame(render);
      } else {
        frame = 0;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY = (event.clientY / window.innerHeight - 0.5) * 2;
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div className="nexus-landing-light" aria-hidden="true" />;
}

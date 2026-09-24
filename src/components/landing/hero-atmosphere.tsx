"use client";

import { useEffect, useRef } from "react";

/** Subtle pointer-reactive depth field. No content or controls are moved. */
export function HeroAtmosphere() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const canTrack = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!canTrack.matches || reducedMotion.matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const render = () => {
      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;
      root.style.setProperty("--light-x", `${(currentX * 18).toFixed(2)}px`);
      root.style.setProperty("--light-y", `${(currentY * 12).toFixed(2)}px`);
      root.style.setProperty("--grid-x", `${(currentX * -5).toFixed(2)}px`);
      root.style.setProperty("--grid-y", `${(currentY * -3).toFixed(2)}px`);
      root.style.setProperty("--far-x", `${(currentX * -9).toFixed(2)}px`);
      root.style.setProperty("--far-y", `${(currentY * -6).toFixed(2)}px`);
      root.style.setProperty("--near-x", `${(currentX * 12).toFixed(2)}px`);
      root.style.setProperty("--near-y", `${(currentY * 8).toFixed(2)}px`);
      root.style.setProperty("--axis-x", `${(currentX * 5).toFixed(2)}px`);
      root.style.setProperty("--axis-y", `${(currentY * 3).toFixed(2)}px`);

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

  return (
    <div ref={rootRef} className="nexus-hero-atmosphere" aria-hidden="true">
      <div className="nexus-hero-light" />
      <div className="nexus-hero-orbit nexus-hero-orbit-one" />
      <div className="nexus-hero-orbit nexus-hero-orbit-two" />
      <div className="nexus-hero-axis" />
    </div>
  );
}

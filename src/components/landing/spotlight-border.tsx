"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A one-pixel pointer-reactive ring. Pointer coordinates are written directly
 * to CSS custom properties, so movement never enters React's render cycle.
 * Fine-pointer and reduced-motion checks keep the effect off touch devices and
 * for visitors who request less motion.
 */
export function SpotlightBorder({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const resetSpotlight = () => {
      element.style.setProperty("--spot-x", "-9999px");
      element.style.setProperty("--spot-y", "-9999px");
    };

    const moveSpotlight = (event: PointerEvent) => {
      if (!finePointer.matches || reducedMotion.matches) {
        resetSpotlight();
        return;
      }

      const bounds = element.getBoundingClientRect();
      element.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
      element.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
    };

    element.addEventListener("pointermove", moveSpotlight, { passive: true });
    element.addEventListener("pointerleave", resetSpotlight);
    finePointer.addEventListener("change", resetSpotlight);
    reducedMotion.addEventListener("change", resetSpotlight);

    return () => {
      element.removeEventListener("pointermove", moveSpotlight);
      element.removeEventListener("pointerleave", resetSpotlight);
      finePointer.removeEventListener("change", resetSpotlight);
      reducedMotion.removeEventListener("change", resetSpotlight);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn("pricing-spotlight relative h-full rounded-pricing", className)}
    >
      {children}
    </div>
  );
}

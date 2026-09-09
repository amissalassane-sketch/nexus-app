"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — AUTH BACKGROUND
// Reusable animated dot-matrix canvas environment shared across
// the entire authentication and onboarding experience.
//
// Encapsulates the WebGL CanvasRevealEffect with the overlay
// gradients, vignettes and radial depth from the sign-in page.
// ONE persistent visual environment — never duplicated.
//
// SSR-safe: the R3F Canvas is loaded dynamically with ssr:false.
// Reduced-motion: the canvas is hidden and a static subtle dot
// grid (from globals.css) shows through instead.
// ============================================================

const CanvasRevealEffect = dynamic(
  () =>
    import("@/components/ui/canvas-reveal-effect").then(
      (mod) => mod.CanvasRevealEffect
    ),
  { ssr: false }
);

interface NexusAuthBackgroundProps {
  /**
   * Controls the reveal direction. 'forward' fills from the center
   * outward, 'reverse' sweeps from edges inward (used for the
   * success/transition state). Defaults to 'forward'.
   */
  variant?: "forward" | "reverse";
  /**
   * Speed of the reveal animation. Lower is slower/more cinematic.
   * Defaults to 3.
   */
  animationSpeed?: number;
  /**
   * Extra class on the root wrapper.
   */
  className?: string;
}

export function NexusAuthBackground({
  variant = "forward",
  animationSpeed = 3,
  className,
}: NexusAuthBackgroundProps) {
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  return (
    <div
      aria-hidden="true"
      className={cn("absolute inset-0 z-0 overflow-hidden", className)}
    >
      {/* Animated dot matrix — hidden under reduced motion */}
      {!reducedMotion && (
        <div className="absolute inset-0">
          <CanvasRevealEffect
            animationSpeed={animationSpeed}
            containerClassName="bg-black"
            colors={[
              [255, 255, 255],
              [255, 255, 255],
            ]}
            dotSize={6}
            reverse={variant === "reverse"}
          />
        </div>
      )}

      {/* Radial vignette — center is solid black (where the form sits),
          edges reveal the canvas animation creating a portal effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,1)_0%,_transparent_100%)]" />

      {/* Top gradient — soft fade for depth */}
      <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
    </div>
  );
}

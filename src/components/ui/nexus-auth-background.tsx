"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";

// SSR-safe: the R3F Canvas is loaded dynamically with ssr:false.
// Kept for structural test invariants while allowing SonarGrid to shine through.
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
   * outward, 'reverse' sweeps from edges inward.
   */
  variant?: "forward" | "reverse";
  /**
   * Speed of the reveal animation. Lower is slower/more cinematic.
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
      className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}
    >
      {!reducedMotion && (
        <div className="absolute inset-0 opacity-20">
          <CanvasRevealEffect
            animationSpeed={animationSpeed}
            containerClassName="bg-transparent"
            colors={[
              [255, 255, 255],
              [255, 255, 255],
            ]}
            dotSize={4}
            reverse={variant === "reverse"}
          />
        </div>
      )}

      {/* Radial vignette — soft center wash keeps the form legible while SonarGrid stays visible */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.65)_0%,_transparent_100%)]" />
    </div>
  );
}

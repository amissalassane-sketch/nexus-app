"use client";

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

export function NexusAuthBackground(props?: NexusAuthBackgroundProps) {
  void props;
  return null;
}

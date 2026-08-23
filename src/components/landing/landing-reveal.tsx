"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Scroll-reveal wrapper used across the NEXUS landing page.
 *
 * Adds `.is-visible` once the element enters the viewport; all motion
 * lives in CSS (`.landing-reveal` in globals.css), so:
 *   - `prefers-reduced-motion` disables the entrance without JS,
 *   - a no-JS fallback (`@media (scripting: none)`) keeps the content
 *     visible even when hydration never runs,
 *   - the transition is GPU-friendly (opacity + transform only).
 *
 * The initial state is the same on the server and the client (hidden),
 * so hydration never mismatches.
 *
 * `delay` staggers sibling blocks (kept very small on purpose).
 */
export function LandingReveal({
  children,
  className,
  delay = 0,
  amount = 0.12,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Visible proportion required before revealing. */
  amount?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      // Engines without IntersectionObserver: reveal right after paint
      // instead of never. Async on purpose (post-hydration).
      const id = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(id);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: amount, rootMargin: "0px 0px -48px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [amount]);

  const style = delay
    ? ({ "--landing-reveal-delay": `${delay}ms` } as CSSProperties)
    : undefined;

  return (
    <div ref={ref} style={style} className={cn("landing-reveal", visible && "is-visible", className)}>
      {children}
    </div>
  );
}

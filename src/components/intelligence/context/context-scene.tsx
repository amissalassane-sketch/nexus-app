"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { hasFinePointer, prefersReducedMotion } from "@/components/nexus-intelligence";
import { ContextSceneEngine } from "./engine";
import { ContextNode } from "./context-node";
import { IntelligenceCore } from "./intelligence-core";
import { ConnectionsBehind, ConnectionsFront } from "./connection-network";
import { CONTEXT_NODES, PARTICLES } from "./config";

// ============================================================
// CONTEXT SCENE
//
// The spatial assembly of "What it sees": atmosphere (light, grid,
// particles) → behind connections → the workspace objects and the
// core → front connections and signals → vignette.
//
// The markup below is the complete static scene — every element has
// a meaningful position and opacity with no JavaScript at all. On
// mount, a ContextSceneEngine is constructed that takes ownership
// of positions, connections and motion; it parks itself off-screen,
// and is never constructed under prefers-reduced-motion, where the
// static scene is the final state.
//
// The whole visual field is decorative — the same eight objects are
// exposed to assistive technology as a plain list by the section.
// ============================================================

export function ContextScene({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Reduced motion: the static CSS scene is the deliverable — no
    // engine, no loop, no listener, no parallax. Depth and hierarchy
    // remain exactly as rendered by the server.
    if (prefersReducedMotion()) return;

    const engine = new ContextSceneEngine(root, {
      interactive: hasFinePointer(),
    });
    if (!engine.init()) return;

    let onScreen = false;
    let pageVisible = true;
    let introPlayed = false;

    const sync = () => {
      if (onScreen && pageVisible) engine.start();
      else engine.stop();
    };

    if (typeof IntersectionObserver === "undefined") {
      introPlayed = true;
      engine.playIntro();
      onScreen = true;
      sync();
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          onScreen = entries.some((entry) => entry.isIntersecting);
          if (onScreen && !introPlayed) {
            introPlayed = true;
            engine.playIntro();
          }
          sync();
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );
      observer.observe(root);
    }

    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(root);

    const onVisibility = () => {
      pageVisible = document.visibilityState === "visible";
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Font swaps change card sizes, which moves the connection rims —
    // one quiet re-measure once the final metrics are known.
    let fontsCancelled = false;
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready
        .then(() => {
          if (!fontsCancelled) engine.resize();
        })
        .catch(() => undefined);
    }

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onPointerMove = (event: PointerEvent) =>
      engine.setPointer(event.clientX, event.clientY);
    const onPointerLeave = () => engine.clearPointer();
    if (finePointer.matches) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerLeave);
    }

    // Scrolling invalidates the cached viewport rect used to convert
    // client coordinates into scene space.
    const onScroll = () => engine.invalidateRect();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      fontsCancelled = true;
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
      engine.destroy();
    };
  }, []);

  return (
    <div ref={rootRef} className={cn("nexus-context-scene", className)} aria-hidden="true">
      {/* Atmosphere — light, computational grid, drifting particles */}
      <div className="nexus-context-light" data-nx-light />
      <div className="nexus-context-grid" />
      <div className="nexus-context-particles" data-nx-fade>
        {PARTICLES.map((particle, index) => (
          <span
            key={index}
            className="nexus-context-particle"
            data-nx-particle
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size,
              opacity: particle.opacity,
            }}
          />
        ))}
      </div>

      {/* Connections travelling behind the card plane */}
      <ConnectionsBehind />

      {/* Workspace objects + the intelligence core */}
      {CONTEXT_NODES.map((node) => (
        <ContextNode key={node.id} config={node} />
      ))}
      <IntelligenceCore />

      {/* Connections crossing in front, and the signals riding them */}
      <ConnectionsFront />

      {/* Lighting finish — the edges fall into darkness */}
      <div className="nexus-context-vignette" />
    </div>
  );
}

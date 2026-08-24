"use client";

import { useEffect, useRef } from "react";
import type { IntelligenceEngine } from "./scene/intelligence-engine";
import type { IntelligenceProfileName } from "./scene/config";
import type { IntelligenceStateName } from "./scene/state";

// ============================================================
// NEXUS INTELLIGENCE — SCENE MOUNT
//
// The only React component that touches the engine, and the only place
// that imports it.
//
// The engine (and therefore all of Three.js) is loaded with a real
// `import()` inside an effect rather than a static import or
// `next/dynamic`. That matters: a static import would put ~500 kB of
// renderer into the page's eager chunk graph, and `next/dynamic` on a
// component that renders in the initial tree still gets merged into a
// shared chunk by the bundler. A dynamic import inside an effect is a
// boundary the bundler cannot merge, so the 3D payload is fetched only
// after the hero copy has painted and the main thread is idle.
//
// There is no state here that changes after mount: the simulation
// lives entirely inside the engine, so this component renders once.
// ============================================================

export interface NexusIntelligenceSceneProps {
  className?: string;
  /** Force a device class instead of measuring the viewport. */
  profile?: IntelligenceProfileName;
  /** Set false to disable pointer reaction entirely. */
  interactive?: boolean;
  /** Called once after init: true = live canvas, false = no WebGL. */
  onAvailability?: (available: boolean) => void;
  /** Optional state telemetry (diagnostics, tests, analytics). */
  onStateChange?: (state: IntelligenceStateName) => void;
}

/** Start the load as soon as the main thread is free, but never later
 *  than `timeout` — the hero should not wait on a busy page. */
const onIdle = (callback: () => void, timeout = 400): (() => void) => {
  if (typeof window === "undefined") return () => {};

  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback?.(id);
  }

  const id = window.setTimeout(callback, 120);
  return () => window.clearTimeout(id);
};

export function NexusIntelligenceScene({
  className,
  profile,
  interactive = true,
  onAvailability,
  onStateChange,
}: NexusIntelligenceSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  // Held in refs so the callbacks can change without tearing the
  // engine down and rebuilding the whole world. Written after render:
  // mutating a ref during render is not safe under concurrent rendering.
  const availabilityRef = useRef(onAvailability);
  const stateRef = useRef(onStateChange);
  useEffect(() => {
    availabilityRef.current = onAvailability;
    stateRef.current = onStateChange;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

    let engine: IntelligenceEngine | null = null;
    let cancelled = false;
    let cancelIdle: (() => void) | null = null;

    const build = async () => {
      const { IntelligenceEngine: Engine } = await import(
        "./scene/intelligence-engine"
      );
      if (cancelled || !host.isConnected) return;

      const instance = new Engine({
        container: host,
        profile,
        reducedMotion: motionQuery.matches,
        // Touch devices have no cursor, and the interaction model is
        // pointer proximity — so it is switched off, not faked.
        interactive: interactive && pointerQuery.matches,
        onStateChange: (state) => stateRef.current?.(state),
      });

      engine?.dispose();
      engine = instance;
      availabilityRef.current?.(instance.init());
    };

    cancelIdle = onIdle(() => {
      void build();
    });

    // Reduced motion is a live preference: flipping it in OS settings
    // rebuilds the scene into (or out of) its static form.
    const onMotionChange = () => {
      void build();
    };
    motionQuery.addEventListener("change", onMotionChange);

    return () => {
      cancelled = true;
      cancelIdle?.();
      motionQuery.removeEventListener("change", onMotionChange);
      engine?.dispose();
      engine = null;
    };
  }, [profile, interactive]);

  return (
    <div
      ref={hostRef}
      className={className}
      aria-hidden="true"
      // Defensive: the engine also sets pointer-events on the canvas,
      // but the wrapper must never become interactive either.
      style={{ pointerEvents: "none" }}
    />
  );
}

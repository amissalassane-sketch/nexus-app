"use client";

import { useCallback, useReducer, useSyncExternalStore } from "react";
import { isWebGLAvailable } from "./scene/capabilities";
import { NexusIntelligenceFallback } from "./nexus-intelligence-fallback";
import { NexusIntelligenceScene } from "./nexus-intelligence-scene";
import type { IntelligenceProfileName } from "./scene/config";

// ============================================================
// NEXUS INTELLIGENCE — STAGE
//
// Decides what the hero's visual layer actually is:
//
//   pending  → nothing. The section is black, which is exactly the
//              first frame of the entrance animation, so there is no
//              flash and no placeholder to remove.
//   webgl    → the live scene (which loads its own Three.js chunk on
//              idle — see nexus-intelligence-scene).
//   fallback → the static SVG core, for browsers with no WebGL and for
//              the case where context creation fails at runtime.
//
// The capability probe lives in its own module precisely so this
// decision can be made without importing the renderer.
// ============================================================

type StageMode = "pending" | "webgl" | "fallback";

/* The capability never changes during a session, so the subscription is
   a no-op and the probe result is cached. Reading it through
   `useSyncExternalStore` (rather than a `useState` + effect) is what
   keeps the server render and the first client render in agreement
   without an extra render pass. */
let probed: boolean | null = null;
const probe = (): boolean => {
  if (probed === null) probed = isWebGLAvailable();
  return probed;
};
const subscribe = (): (() => void) => () => {};
const getSnapshot = (): StageMode => (probe() ? "webgl" : "fallback");
const getServerSnapshot = (): StageMode => "pending";

export interface NexusIntelligenceStageProps {
  className?: string;
  profile?: IntelligenceProfileName;
  interactive?: boolean;
}

export function NexusIntelligenceStage({
  className,
  profile,
  interactive = true,
}: NexusIntelligenceStageProps) {
  const mode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  // Context creation can still fail after the probe succeeds (driver
  // blocklists, exhausted contexts). `degraded` is the escape hatch so
  // the hero falls back rather than showing a dead canvas.
  const [degraded, setDegraded] = useReducer(() => true, false);
  const handleAvailability = useCallback((available: boolean) => {
    if (!available) setDegraded();
  }, []);

  const resolved: StageMode = degraded ? "fallback" : mode;

  if (resolved === "fallback") {
    return <NexusIntelligenceFallback className={className} />;
  }

  if (resolved === "pending") {
    return <div className={className} aria-hidden="true" />;
  }

  return (
    <NexusIntelligenceScene
      className={className}
      profile={profile}
      interactive={interactive}
      onAvailability={handleAvailability}
    />
  );
}

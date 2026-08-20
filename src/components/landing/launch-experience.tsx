"use client";

import { useEffect, useState } from "react";
import { NexusLogo } from "@/components/nexus-logo";

const LAUNCH_KEY = "nexus:launch-seen";

// Sequence (CSS in globals.css owns every keyframe):
//   0–1200ms   the N builds at the centre, the Volt signal line fires
//   1200ms     `data-nexus-launch-reveal` opens → the hero starts rising
//              in while the overlay fades (the landing appears behind
//              the transition, not after it)
//   1380ms     `data-nexus-launch-seen` dismisses the overlay
const REVEAL_MS = 1200;
const FINISH_MS = 1380;

/**
 * Product activation signature shown once per browser tab.
 * The official locked mark is the only visual asset; CSS handles the short
 * transform/opacity sequence so the landing is rendered underneath from the
 * first frame and never waits on JavaScript or a network request.
 */
export function LaunchExperience() {
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;

    try {
      seen = sessionStorage.getItem(LAUNCH_KEY) === "1";
      sessionStorage.setItem(LAUNCH_KEY, "1");
    } catch {
      // Storage can be unavailable in strict privacy modes. The intro remains
      // safe and short; reduced-motion is still honoured by CSS and JS.
    }

    if (seen || reducedMotion) {
      // Repeat visit or reduced motion: the landing enters immediately with
      // its own short stagger — no intro, no waiting.
      document.documentElement.dataset.nexusLaunchReveal = "true";
      document.documentElement.dataset.nexusLaunchSeen = "true";
      const skipTimer = window.setTimeout(() => setFinished(true), 0);
      return () => window.clearTimeout(skipTimer);
    }

    const revealTimer = window.setTimeout(() => {
      document.documentElement.dataset.nexusLaunchReveal = "true";
    }, REVEAL_MS);

    const finishTimer = window.setTimeout(() => {
      document.documentElement.dataset.nexusLaunchSeen = "true";
      setFinished(true);
    }, FINISH_MS);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(finishTimer);
    };
  }, []);

  if (finished) return null;

  return (
    <div className="nexus-launch" aria-hidden="true">
      <div className="nexus-launch-grid" />
      <div className="nexus-launch-signal" />
      <div className="nexus-launch-mark">
        <NexusLogo size={120} priority />
      </div>
      <p className="nexus-launch-status font-mono">SYSTEM / ACTIVE</p>
    </div>
  );
}

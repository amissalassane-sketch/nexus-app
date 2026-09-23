"use client";

/**
 * Landing-wide pointer-reactive ambient light.
 *
 * One faint light source drifts with the cursor across the whole landing
 * page (`.nexus-landing-light` in globals.css reads `--nexus-glow-x` /
 * `--nexus-glow-y` from `<html>`). Amplitude is deliberately small — the
 * page should feel present, never seasick — and only transform is used,
 * so nothing reflows and no layout is ever measured.
 *
 * Disabled on coarse pointers and under `prefers-reduced-motion`: the
 * light simply stays at its resting position, and content never depends
 * on pointer movement to render.
 */
export function LandingAtmosphere() {
  return null;
}

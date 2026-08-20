"use client";

import { useEffect, useRef, type CSSProperties } from "react";

// ============================================================
// NEXUS INTELLIGENCE — THE FIELD
// The hero visual: the locked NEXUS "N" forming out of signal
// points and connected lines, exactly where the launch signature
// leaves the mark. The official PNG is never redrawn — it is used
// as a mask so the light travels through the real geometry.
//
// One pointermove listener, one requestAnimationFrame loop, CSS
// variables only: no layout is ever moved, no content shifts.
// Everything renders identically without JavaScript.
// ============================================================

/** Key vertices of the locked mark, in % of the mark box. */
const NODES = [
  { x: 24.9, y: 22.7, r: 0.45, delay: 620 },
  { x: 75.7, y: 22.7, r: 0.45, delay: 700 },
  { x: 24.9, y: 76.7, r: 0.45, delay: 780 },
  { x: 75.7, y: 76.7, r: 0.45, delay: 860 },
  { x: 37.6, y: 37.4, r: 0.32, delay: 940 },
  { x: 62.4, y: 62.6, r: 0.32, delay: 1020 },
  { x: 50, y: 50, r: 0.62, delay: 1120 },
] as const;

/** Hairline connections drawn before the mark resolves. */
const LINKS = [
  { d: "M24.9 22.7 H75.7", delay: 120 },
  { d: "M24.9 76.7 H75.7", delay: 200 },
  { d: "M24.9 22.7 V76.7", delay: 280 },
  { d: "M75.7 22.7 V76.7", delay: 360 },
  { d: "M24.9 22.7 L75.7 76.7", delay: 440 },
  { d: "M50 8 V92", delay: 520 },
] as const;

/**
 * Deterministic dust field — generated from a fixed seed so the server and
 * the client always render the exact same specks (no hydration mismatch,
 * no randomness at runtime).
 */
const DUST = (() => {
  let seed = 20260820;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: 96 }, (_, index) => ({
    id: index,
    x: random() * 100,
    y: random() * 100,
    r: 0.05 + random() * 0.14,
    delay: Math.round(random() * 6000),
    // Only a quarter of the field breathes: the rest is still dust.
    twinkle: index % 4 === 0,
  }));
})();

export function IntelligenceField() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const canTrack = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!canTrack.matches || reducedMotion.matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let cursorX = 50;
    let cursorY = 42;

    const render = () => {
      currentX += (targetX - currentX) * 0.07;
      currentY += (targetY - currentY) * 0.07;

      const set = (name: string, value: number) =>
        root.style.setProperty(name, `${value.toFixed(2)}px`);

      set("--field-light-x", currentX * 26);
      set("--field-light-y", currentY * 14);
      set("--field-mark-x", currentX * -7);
      set("--field-mark-y", currentY * -4);
      set("--field-node-x", currentX * -12);
      set("--field-node-y", currentY * -7);
      set("--field-dust-x", currentX * 16);
      set("--field-dust-y", currentY * 10);
      set("--field-line-x", currentX * 10);
      root.style.setProperty("--field-cursor-x", `${cursorX.toFixed(2)}%`);
      root.style.setProperty("--field-cursor-y", `${cursorY.toFixed(2)}%`);

      if (
        Math.abs(targetX - currentX) > 0.0008 ||
        Math.abs(targetY - currentY) > 0.0008
      ) {
        frame = window.requestAnimationFrame(render);
      } else {
        frame = 0;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY = (event.clientY / window.innerHeight - 0.5) * 2;

      const bounds = root.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        cursorX = ((event.clientX - bounds.left) / bounds.width) * 100;
        cursorY = ((event.clientY - bounds.top) / bounds.height) * 100;
      }

      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={rootRef} className="nexus-intel-field" aria-hidden="true">
      <div className="nexus-intel-halo" />
      <div className="nexus-intel-grid" />
      <div className="nexus-intel-cursor-light" />

      {/* Data paths running edge to edge, through the mark. */}
      <div className="nexus-intel-paths">
        {[-190, -96, 0, 96, 190].map((offset, index) => (
          <div
            key={offset}
            className="nexus-intel-path"
            style={
              {
                top: `${offset}px`,
                "--path-delay": `${140 + index * 90}ms`,
              } as CSSProperties
            }
          >
            {index % 2 === 0 ? (
              <span
                className="nexus-intel-pulse"
                style={{ "--pulse-delay": `${2400 + index * 2100}ms` } as CSSProperties}
              />
            ) : null}
          </div>
        ))}
      </div>

      {/* Ambient signal dust. */}
      <svg
        className="nexus-intel-dust"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        focusable="false"
      >
        {DUST.map((speck) => (
          <circle
            key={speck.id}
            className={speck.twinkle ? "nexus-intel-speck" : undefined}
            cx={speck.x}
            cy={speck.y}
            r={speck.r}
            fill="rgba(255,255,255,0.28)"
            style={{ "--speck-delay": `${speck.delay}ms` } as CSSProperties}
          />
        ))}
      </svg>

      {/* The locked N, carrying the light. */}
      <div className="nexus-intel-mark">
        <div className="nexus-intel-mark-halo">
          <div className="nexus-intel-mark-layer nexus-intel-mark-glow" />
        </div>
        <div className="nexus-intel-mark-layer nexus-intel-mark-core" />
        <div className="nexus-intel-mark-layer nexus-intel-mark-texture" />
        <div className="nexus-intel-mark-layer nexus-intel-mark-sweep">
          <div className="nexus-intel-mark-sheen" />
        </div>
        <div className="nexus-intel-mark-layer nexus-intel-mark-edge" />
      </div>

      {/* Signal points and the connections that form the mark. */}
      <svg className="nexus-intel-svg" viewBox="0 0 100 100" focusable="false">
        {LINKS.map((link) => (
          <path
            key={link.d}
            className="nexus-intel-link"
            d={link.d}
            pathLength={1}
            style={{ "--link-delay": `${link.delay}ms` } as CSSProperties}
          />
        ))}
        {NODES.map((node) => (
          <g
            key={`${node.x}-${node.y}`}
            style={{ "--node-delay": `${node.delay}ms` } as CSSProperties}
          >
            <circle
              className="nexus-intel-node-ring"
              cx={node.x}
              cy={node.y}
              r={node.r * 2.6}
            />
            <circle className="nexus-intel-node" cx={node.x} cy={node.y} r={node.r} />
          </g>
        ))}
      </svg>
    </div>
  );
}

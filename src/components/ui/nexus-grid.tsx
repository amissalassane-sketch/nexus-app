"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";

// ============================================================
// NEXUS GRID — PREMIUM INTERACTIVE HERO BACKGROUND
//
// A cinematic dot matrix on #050505. Hidden in its centre is a
// gigantic "N" that is never drawn as a logo: it exists only as
// geometry. Pulses are born on the letter's strokes and propagate
// outward — dots that belong to the N ignite first and brightest,
// so the letter surfaces subconsciously through movement, then
// sinks back into the field when idle.
//
// Craft rules:
//   * soft white light only — no colour, no neon
//   * organic cadence: a pulse every 2–4 s, random origin on the
//     N, random velocity — never a repeating pattern
//   * cursor magnetism: nearby dots lean toward the pointer and a
//     faint light follows the movement
//   * gentle breathing on every dot, slight depth parallax
//   * reduced motion: parallax, magnetism and pulses are disabled;
//     only the opacity breathing remains
//   * 60 fps budget: plain Canvas 2D, one rAF loop, DPR capped,
//     coarser grid and fewer waves on small screens
//   * ResizeObserver + full teardown on unmount
//   * pointer-events-none, aria-hidden — decoration, never UI
// ============================================================

export type NexusGridProps = {
  /** Pulse expansion speed, px per second. */
  speed?: number;
  /** Dot spacing in px (lower = denser grid). */
  density?: number;
  /** Glow brightness multiplier. */
  intensity?: number;
  /** Enable cursor magnetism and pointer light. */
  interactive?: boolean;
  className?: string;
};

type Dot = {
  x: number;
  y: number;
  /** Static base opacity — the depth variation of the field. */
  baseA: number;
  /** Breathing phase offset. */
  phase: number;
  /** 0..2 depth layer, drives parallax strength. */
  layer: number;
  /** 0..1 membership of the hidden N (Gaussian around the strokes). */
  nW: number;
};

type Pulse = {
  x: number;
  y: number;
  r: number;
  v: number;
  maxR: number;
};

// --- The hidden N ---------------------------------------------------
// Three segments in normalized space (x right, y down, origin centre).
const N_SEGMENTS: ReadonlyArray<
  readonly [number, number, number, number]
> = [
  [-0.42, -0.62, -0.42, 0.62], // left stem
  [-0.42, -0.62, 0.42, 0.62], // diagonal
  [0.42, -0.62, 0.42, 0.62], // right stem
];

function distToSegment(
  px: number,
  py: number,
  [x1, y1, x2, y2]: readonly [number, number, number, number]
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Distance from a normalized point to the hidden N. */
function distToN(nx: number, ny: number): number {
  let best = Infinity;
  for (const segment of N_SEGMENTS) {
    const d = distToSegment(nx, ny, segment);
    if (d < best) best = d;
  }
  return best;
}

/** A uniformly random point on one of the N's strokes. */
function randomPointOnN(): [number, number] {
  const segment =
    N_SEGMENTS[Math.floor(Math.random() * N_SEGMENTS.length)];
  const t = Math.random();
  return [
    segment[0] + (segment[2] - segment[0]) * t,
    segment[1] + (segment[3] - segment[1]) * t,
  ];
}

export function NexusGrid({
  speed = 210,
  density = 26,
  intensity = 1,
  interactive = true,
  className,
}: NexusGridProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [canvasSupported, setCanvasSupported] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCanvasSupported(false);
      return;
    }

    let width = 0;
    let height = 0;
    let dots: Dot[] = [];
    let pulses: Pulse[] = [];
    let step = density;
    let maxPulses = 4;
    let pulseDue = 1.2; // first pulse arrives shortly after mount
    let time = 0;
    let raf = 0;
    let last = performance.now();
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const pointer = {
      x: -9999,
      y: -9999,
      tx: -9999,
      ty: -9999,
      active: false,
    };
    const magnetEnabled =
      interactive &&
      !reducedMotion &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    const buildGrid = () => {
      const compact =
        window.innerWidth < 768 ||
        window.matchMedia("(pointer: coarse)").matches;
      step = compact ? Math.round(density * 1.5) : density;
      maxPulses = compact ? 2 : 4;

      // Height of the hidden letter: dominant, but never edge-to-edge.
      const letterScale = Math.min(width, height) * 0.62;

      dots = [];
      for (let gx = step * 0.5; gx < width; gx += step) {
        for (let gy = step * 0.5; gy < height; gy += step) {
          const nx = (gx - width / 2) / letterScale;
          const ny = (gy - height / 2) / letterScale;
          const dN = distToN(nx, ny);
          dots.push({
            x: gx,
            y: gy,
            baseA: 0.055 + Math.random() * 0.05,
            phase: Math.random() * Math.PI * 2,
            layer: Math.floor(Math.random() * 3),
            // Gaussian membership: 1 on the stroke, ~0 beyond ~7% of
            // the letter size. The N lives in this field.
            nW: Math.exp(-(dN * dN) / (2 * 0.055 * 0.055)),
          });
        }
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = wrapper.clientWidth || window.innerWidth;
      height = wrapper.clientHeight || window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGrid();
    };

    const spawnPulse = () => {
      if (pulses.length >= maxPulses) return;
      const [nx, ny] = randomPointOnN();
      const letterScale = Math.min(width, height) * 0.62;
      pulses.push({
        x: width / 2 + nx * letterScale,
        y: height / 2 + ny * letterScale,
        r: 0,
        // ±20% velocity variance: waves never march in lockstep.
        v: speed * (0.8 + Math.random() * 0.4),
        maxR: Math.hypot(width, height) * 0.62,
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const parX = pointer.active ? (pointer.x / width - 0.5) * 2 : 0;
      const parY = pointer.active ? (pointer.y / height - 0.5) * 2 : 0;

      for (const dot of dots) {
        // --- Breathing + the faintest idle trace of the N ---------
        let alpha =
          dot.baseA * (0.8 + 0.2 * Math.sin(time * 0.6 + dot.phase)) +
          0.012 * dot.nW;

        // --- Pulse illumination ------------------------------------
        // Dots on the N are reached slightly earlier and burn
        // brighter: the letter emerges through the wave, not ink.
        let lit = 0;
        if (!reducedMotion) {
          for (const pulse of pulses) {
            const d =
              Math.hypot(dot.x - pulse.x, dot.y - pulse.y) - 16 * dot.nW;
            const band = (d - pulse.r) / 58;
            const g = Math.exp(-band * band);
            const attenuation = Math.max(0, 1 - pulse.r / pulse.maxR);
            lit += g * attenuation * (0.25 + 0.75 * dot.nW);
          }
          lit = Math.min(1, lit);
          alpha += lit * 0.5 * intensity;
        }

        // --- Cursor: magnetic lean + a light that follows ----------
        let dxDraw = 0;
        let dyDraw = 0;
        if (magnetEnabled && pointer.active) {
          const mdx = pointer.x - dot.x;
          const mdy = pointer.y - dot.y;
          const md = Math.hypot(mdx, mdy);
          if (md < 130 && md > 0.001) {
            const pull = Math.pow(1 - md / 130, 2);
            dxDraw = (mdx / md) * pull * 7;
            dyDraw = (mdy / md) * pull * 7;
            alpha += pull * 0.07;
          }
        }

        // --- Depth parallax ----------------------------------------
        if (!reducedMotion && pointer.active) {
          const depth = 2 + dot.layer * 2;
          dxDraw += parX * depth;
          dyDraw += parY * depth;
        }

        if (alpha <= 0.004) continue;

        const x = dot.x + dxDraw;
        const y = dot.y + dyDraw;

        // Premium bloom: a soft halo under the core, white only.
        if (lit > 0.08) {
          ctx.globalAlpha = Math.min(0.16, lit * 0.12 * intensity);
          ctx.beginPath();
          ctx.arc(x, y, 0.85 + lit * 3.1, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
        }

        ctx.globalAlpha = Math.min(0.95, alpha);
        ctx.beginPath();
        ctx.arc(x, y, 0.85 + lit * 1.15, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (document.hidden) return;

      time += dt;

      if (!reducedMotion) {
        // Smooth light following the pointer.
        if (pointer.active) {
          pointer.x += (pointer.tx - pointer.x) * 0.08;
          pointer.y += (pointer.ty - pointer.y) * 0.08;
        }

        // Autonomous heartbeat: a pulse every 2–4 s, born on the N.
        pulseDue -= dt;
        if (pulseDue <= 0) {
          spawnPulse();
          pulseDue = 2 + Math.random() * 2;
        }

        for (const pulse of pulses) pulse.r += pulse.v * dt;
        pulses = pulses.filter((pulse) => pulse.r < pulse.maxR);
      }

      draw();
    };

    // Reduced motion keeps only the breathing, at a modest cadence.
    const reducedFrame = (now: number) => {
      raf = requestAnimationFrame(reducedFrame);
      if (now - last < 42) return; // ~24 fps is plenty for breathing
      last = now;
      if (document.hidden) return;
      time += 1 / 24;
      draw();
    };

    resize();

    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        draw();
      }, 150);
    });
    observer.observe(wrapper);

    let onPointerMove: ((event: PointerEvent) => void) | null = null;
    let onPointerLeave: (() => void) | null = null;
    if (magnetEnabled) {
      onPointerMove = (event: PointerEvent) => {
        if (!pointer.active) {
          pointer.x = event.clientX;
          pointer.y = event.clientY;
        }
        pointer.tx = event.clientX;
        pointer.ty = event.clientY;
        pointer.active = true;
      };
      onPointerLeave = () => {
        pointer.active = false;
      };
      window.addEventListener("pointermove", onPointerMove, {
        passive: true,
      });
      window.addEventListener("pointerleave", onPointerLeave);
    }

    last = performance.now();
    raf = requestAnimationFrame(reducedMotion ? reducedFrame : frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
      if (onPointerMove) {
        window.removeEventListener("pointermove", onPointerMove);
      }
      if (onPointerLeave) {
        window.removeEventListener("pointerleave", onPointerLeave);
      }
    };
  }, [speed, density, intensity, interactive, reducedMotion]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-[1] overflow-hidden bg-[#050505] ${
        className ?? ""
      }`}
    >
      {canvasSupported ? (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      ) : null}

      {/* Cinematic gradients — readability first: a dark heart behind
          the typography, a soft blur wash, and a radial vignette. */}
      <div className="absolute inset-0 bg-[radial-gradient(58%_48%_at_50%_42%,rgba(5,5,5,0.62),transparent_78%)] backdrop-blur-[1.5px] [mask-image:radial-gradient(58%_48%_at_50%_42%,black,transparent_78%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(115%_105%_at_50%_45%,transparent_52%,rgba(0,0,0,0.7)_100%)]" />
    </div>
  );
}

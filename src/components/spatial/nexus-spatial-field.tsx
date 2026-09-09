"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";

// ============================================================
// NEXUS — SPATIAL FIELD
// The dashboard rests on a quiet, living space: a slow particle
// field around a gigantic, barely-there "N" built from nodes and
// hairlines. The N is never "placed" — it emerges from the field,
// brighter in some zones, dimmer in others, as a slow wave travels
// through it.
//
// Discipline:
//   * 2D canvas — no WebGL contexts to leak on long sessions
//   * ~30 fps budget, paused when the tab is hidden
//   * DPR capped at 1.5, particle count halved on mobile
//   * prefers-reduced-motion -> one static frame, no loop
//   * no canvas support -> pure CSS atmosphere fallback
//   * full cleanup: rAF, listeners and timers are released
//   * pointer-events-none forever — the field never intercepts
// ============================================================

type Dust = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  /** 0..2 — deeper layers drift less with the cursor. */
  layer: number;
  phase: number;
};

type Node = {
  /** Normalized position on the N, x/y in roughly [-0.5, 0.5]. */
  bx: number;
  by: number;
  phase: number;
  amp: number;
};

/** The N as three strokes in normalized space (y grows downward). */
function buildNStrokes(): Array<Array<{ x: number; y: number }>> {
  const H = 0.62; // half height
  const W = 0.44; // half width
  const left: Array<{ x: number; y: number }> = [];
  const right: Array<{ x: number; y: number }> = [];
  const diag: Array<{ x: number; y: number }> = [];

  const VERTICAL_STEPS = 22;
  for (let i = 0; i <= VERTICAL_STEPS; i += 1) {
    const y = -H + (2 * H * i) / VERTICAL_STEPS;
    left.push({ x: -W, y });
    right.push({ x: W, y });
  }

  const DIAGONAL_STEPS = 30;
  for (let i = 0; i <= DIAGONAL_STEPS; i += 1) {
    const t = i / DIAGONAL_STEPS;
    diag.push({ x: -W + 2 * W * t, y: -H + 2 * H * t });
  }

  return [left, diag, right];
}

const N_STROKES = buildNStrokes();

/** Brightness wave travelling through the structure. */
function wave(x: number, y: number, t: number): number {
  const s = Math.sin(t * 0.22 + y * 1.1 + x * 0.45);
  return 0.4 + 0.6 * (0.5 + 0.5 * s);
}

export function NexusSpatialField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();
  const [canvasSupported, setCanvasSupported] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCanvasSupported(false);
      return;
    }

    let width = 0;
    let height = 0;
    let dust: Dust[] = [];
    let strokeNodes: Node[][] = [];
    let time = 0;
    let raf = 0;
    let last = performance.now();
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    const buildScene = () => {
      const isMobile = window.innerWidth < 768;
      const dustCount = isMobile ? 32 : 72;
      dust = Array.from({ length: dustCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 4 - 1.2,
        r: 0.4 + Math.random() * 1.1,
        a: 0.02 + Math.random() * 0.065,
        layer: Math.floor(Math.random() * 3),
        phase: Math.random() * Math.PI * 2,
      }));

      strokeNodes = N_STROKES.map((stroke) =>
        stroke.map((point) => ({
          bx: point.x,
          by: point.y,
          phase: Math.random() * Math.PI * 2,
          amp: 0.6 + Math.random() * 1.4,
        }))
      );
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildScene();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;

      // --- Dust ------------------------------------------------------
      ctx.fillStyle = "#ffffff";
      for (const d of dust) {
        const parallax = (d.layer + 1) * 2.4;
        const px = d.x + pointer.x * parallax;
        const py = d.y + pointer.y * parallax;
        ctx.globalAlpha = d.a * (0.7 + 0.3 * Math.sin(time * 0.4 + d.phase));
        ctx.beginPath();
        ctx.arc(px, py, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- The N: hairlines first, nodes above ------------------------
      const size = Math.min(width, height);
      const scale = (size * 1.08) / 1.24; // normalized height spans 1.24
      const cx = width * 0.5;
      const cy = height * 0.5;

      const project = (node: Node): [number, number] => {
        // Slight perspective: the structure narrows toward the top.
        const depth = 1 + node.by * 0.1;
        const x =
          cx +
          node.bx * scale * depth +
          Math.sin(time * 0.3 + node.phase) * node.amp +
          pointer.x * 3;
        const y =
          cy +
          node.by * scale +
          Math.cos(time * 0.26 + node.phase) * node.amp * 0.8 +
          pointer.y * 3;
        return [x, y];
      };

      ctx.lineWidth = 1;
      for (const nodes of strokeNodes) {
        for (let i = 1; i < nodes.length; i += 1) {
          const a = nodes[i - 1];
          const b = nodes[i];
          const w = wave((a.bx + b.bx) / 2, (a.by + b.by) / 2, time);
          const [ax, ay] = project(a);
          const [bx, by] = project(b);
          ctx.globalAlpha = 0.05 * w;
          ctx.strokeStyle = "rgba(233,228,255,1)";
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }

      for (const nodes of strokeNodes) {
        for (const node of nodes) {
          const w = wave(node.bx, node.by, time);
          const [x, y] = project(node);
          ctx.globalAlpha = 0.11 * w;
          ctx.fillStyle = "rgba(233,228,255,1)";
          ctx.beginPath();
          ctx.arc(x, y, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
    };

    const step = (dt: number) => {
      time += dt;
      for (const d of dust) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.x < -8) d.x = width + 8;
        else if (d.x > width + 8) d.x = -8;
        if (d.y < -8) d.y = height + 8;
        else if (d.y > height + 8) d.y = -8;
      }
      draw();
    };

    resize();

    if (reducedMotion) {
      // One calm, static frame — no loop, no listeners.
      draw();
      return () => {
        if (resizeTimer) clearTimeout(resizeTimer);
      };
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      // ~30 fps is plenty for motion this slow — halves the cost.
      if (now - last < 33) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (document.hidden) return;
      step(dt);
    };

    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        draw();
      }, 200);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.tx = (event.clientX / width - 0.5) * 2;
      pointer.ty = (event.clientY / height - 0.5) * 2;
    };

    const onVisibility = () => {
      if (!document.hidden) last = performance.now();
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Atmosphere — also the full fallback when canvas is missing. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_-12%,rgba(233,228,255,0.05),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(105%_105%_at_50%_50%,transparent_52%,rgba(0,0,0,0.6)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
      {canvasSupported ? (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

// ============================================================
// NEXUS LANDING — HERO SIGNAL FIELD (3D)
//
// The relationship field behind the headline, rebuilt in real 3D:
// a shallow volume of instanced nodes bound to their nearest
// neighbours, with signal pulses travelling the links and a slow
// system rotation. Pointer parallax moves the camera, never the
// content. Monochrome throughout; one pulse in four carries the
// lavender intelligence accent.
//
// Discipline (mirrors the /intelligence hero):
// - Three.js is imported inside the effect, so it never enters the
//   eager bundle — the hero copy paints first.
// - The loop is parked when the field is off-screen or the tab is
//   hidden, not throttled.
// - prefers-reduced-motion renders one settled frame and never
//   starts the loop; the preference is watched live.
// - No post-processing, no shadows, ~4 draw calls.
// - The canvas is decorative: pointer-events none, aria hidden.
// ============================================================

/** Deterministic PRNG so the field is the same on every visit. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NODE_COUNT = 110;
const BRIGHT_COUNT = 26;
const SIGNAL_COUNT = 10;
const LINK_DEGREE = 2;
const MAX_LINK_DISTANCE = 2.7;
const FIELD_X = 7.6;
const FIELD_Z = 4.6;
const FIELD_Y = 1.7;
const CORE_CLEAR_RADIUS = 2.2;
const ROTATION_SPEED = 0.018;
const LAVENDER = { r: 0.914, g: 0.894, b: 1 };

export function HeroSignalField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let teardown: (() => void) | null = null;

    void (async () => {
      const THREE = await import("three");
      if (disposed || !canvasRef.current) return;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 1.75)
      );

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x000000, 7.5, 14.5);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
      camera.position.set(0, 0.9, 11.2);
      camera.lookAt(0, 0, 0);

      const world = new THREE.Group();
      scene.add(world);

      const random = mulberry32(20260825);

      // ---- nodes -------------------------------------------------
      const positions = new Float32Array(NODE_COUNT * 3);
      const basePositions: number[][] = [];
      const phases: number[] = [];
      const bobSpeeds: number[] = [];

      let placed = 0;
      while (placed < NODE_COUNT) {
        const x = (random() * 2 - 1) * FIELD_X;
        const y = (random() * 2 - 1) * FIELD_Y;
        const z = (random() * 2 - 1) * FIELD_Z;
        // Keep the core column quiet so the headline stays the hero.
        if (Math.hypot(x, z * 1.4) < CORE_CLEAR_RADIUS) continue;
        positions[placed * 3] = x;
        positions[placed * 3 + 1] = y;
        positions[placed * 3 + 2] = z;
        basePositions.push([x, y, z]);
        phases.push(random() * Math.PI * 2);
        bobSpeeds.push(0.24 + random() * 0.4);
        placed += 1;
      }

      const sprite = makeSoftSprite(THREE);

      const nodeColors = new Float32Array(NODE_COUNT * 3);
      for (let i = 0; i < NODE_COUNT; i += 1) {
        const brightness = 0.22 + random() * 0.3;
        nodeColors[i * 3] = brightness;
        nodeColors[i * 3 + 1] = brightness;
        nodeColors[i * 3 + 2] = brightness * 1.04;
      }

      const nodeGeometry = new THREE.BufferGeometry();
      nodeGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
      nodeGeometry.setAttribute(
        "color",
        new THREE.BufferAttribute(nodeColors, 3)
      );

      const nodeMaterial = new THREE.PointsMaterial({
        size: 0.075,
        map: sprite,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        sizeAttenuation: true,
      });
      world.add(new THREE.Points(nodeGeometry, nodeMaterial));

      // A sparse second layer of brighter nodes gives the depth cue.
      const brightColors = new Float32Array(BRIGHT_COUNT * 3);
      const brightPositions = new Float32Array(BRIGHT_COUNT * 3);
      const brightLookup = new Map<number, number>();
      for (let i = 0; i < BRIGHT_COUNT; i += 1) {
        const index = Math.floor((i / BRIGHT_COUNT) * NODE_COUNT);
        brightLookup.set(index, i);
        brightPositions[i * 3] = positions[index * 3];
        brightPositions[i * 3 + 1] = positions[index * 3 + 1];
        brightPositions[i * 3 + 2] = positions[index * 3 + 2];
        brightColors[i * 3] = 0.62;
        brightColors[i * 3 + 1] = 0.62;
        brightColors[i * 3 + 2] = 0.68;
      }
      const brightGeometry = new THREE.BufferGeometry();
      brightGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(brightPositions, 3)
      );
      brightGeometry.setAttribute(
        "color",
        new THREE.BufferAttribute(brightColors, 3)
      );
      const brightMaterial = new THREE.PointsMaterial({
        size: 0.16,
        map: sprite,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        sizeAttenuation: true,
      });
      world.add(new THREE.Points(brightGeometry, brightMaterial));

      // ---- links (k-nearest, deduped) -----------------------------
      const links: [number, number][] = [];
      const linkKeys = new Set<string>();
      for (let i = 0; i < NODE_COUNT; i += 1) {
        const distances: { j: number; d: number }[] = [];
        for (let j = 0; j < NODE_COUNT; j += 1) {
          if (i === j) continue;
          const dx = basePositions[i][0] - basePositions[j][0];
          const dy = basePositions[i][1] - basePositions[j][1];
          const dz = basePositions[i][2] - basePositions[j][2];
          const d = Math.hypot(dx, dy, dz);
          if (d <= MAX_LINK_DISTANCE) distances.push({ j, d });
        }
        distances.sort((a, b) => a.d - b.d);
        for (const { j } of distances.slice(0, LINK_DEGREE)) {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (linkKeys.has(key)) continue;
          linkKeys.add(key);
          links.push([i, j]);
        }
      }

      const linePositions = new Float32Array(links.length * 6);
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(linePositions, 3)
      );
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.05,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      world.add(new THREE.LineSegments(lineGeometry, lineMaterial));

      // ---- signals -------------------------------------------------
      const signalPositions = new Float32Array(SIGNAL_COUNT * 3);
      const signalColors = new Float32Array(SIGNAL_COUNT * 3);
      for (let i = 0; i < SIGNAL_COUNT; i += 1) {
        const lavender = i % 4 === 0;
        const brightness = lavender ? 0.85 : 0.8;
        signalColors[i * 3] = lavender ? LAVENDER.r * brightness : brightness;
        signalColors[i * 3 + 1] = lavender ? LAVENDER.g * brightness : brightness;
        signalColors[i * 3 + 2] = lavender ? LAVENDER.b * brightness : brightness;
        signalPositions[i * 3 + 1] = 9999; // parked until first assignment
      }
      const signalGeometry = new THREE.BufferGeometry();
      signalGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(signalPositions, 3)
      );
      signalGeometry.setAttribute(
        "color",
        new THREE.BufferAttribute(signalColors, 3)
      );
      const signalMaterial = new THREE.PointsMaterial({
        size: 0.21,
        map: sprite,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        sizeAttenuation: true,
      });
      world.add(new THREE.Points(signalGeometry, signalMaterial));

      const signals = Array.from({ length: SIGNAL_COUNT }, (_, i) => ({
        link: Math.floor(random() * links.length),
        t: random(),
        speed: 0.25 + random() * 0.3,
        reversed: random() > 0.5,
        index: i,
      }));

      const animated = new Float32Array(NODE_COUNT * 3);

      const resize = () => {
        const width = canvas.clientWidth || 1;
        const height = canvas.clientHeight || 1;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();

      let t = 12.3; // start mid-phase so the field never looks "reset"
      const update = (dt: number) => {
        t += dt;

        // Individual node bobbing in local space.
        for (let i = 0; i < NODE_COUNT; i += 1) {
          const bob = Math.sin(t * bobSpeeds[i] + phases[i]) * 0.14;
          animated[i * 3] = basePositions[i][0];
          animated[i * 3 + 1] = basePositions[i][1] + bob;
          animated[i * 3 + 2] = basePositions[i][2];
          const b = brightLookup.get(i);
          if (b !== undefined) {
            brightPositions[b * 3] = animated[i * 3];
            brightPositions[b * 3 + 1] = animated[i * 3 + 1];
            brightPositions[b * 3 + 2] = animated[i * 3 + 2];
          }
        }

        for (let i = 0; i < links.length; i += 1) {
          const [a, b] = links[i];
          linePositions[i * 6] = animated[a * 3];
          linePositions[i * 6 + 1] = animated[a * 3 + 1];
          linePositions[i * 6 + 2] = animated[a * 3 + 2];
          linePositions[i * 6 + 3] = animated[b * 3];
          linePositions[i * 6 + 4] = animated[b * 3 + 1];
          linePositions[i * 6 + 5] = animated[b * 3 + 2];
        }

        for (const signal of signals) {
          signal.t += dt * signal.speed;
          if (signal.t >= 1) {
            signal.t = 0;
            signal.link = Math.floor(random() * links.length);
            signal.reversed = random() > 0.5;
          }
          const [a, b] = links[signal.link];
          const from = signal.reversed ? b : a;
          const to = signal.reversed ? a : b;
          const ease =
            signal.t * signal.t * (3 - 2 * signal.t); // smoothstep
          signalPositions[signal.index * 3] =
            animated[from * 3] +
            (animated[to * 3] - animated[from * 3]) * ease;
          signalPositions[signal.index * 3 + 1] =
            animated[from * 3 + 1] +
            (animated[to * 3 + 1] - animated[from * 3 + 1]) * ease;
          signalPositions[signal.index * 3 + 2] =
            animated[from * 3 + 2] +
            (animated[to * 3 + 2] - animated[from * 3 + 2]) * ease;
        }

        nodeGeometry.attributes.position.needsUpdate = true;
        brightGeometry.attributes.position.needsUpdate = true;
        lineGeometry.attributes.position.needsUpdate = true;
        signalGeometry.attributes.position.needsUpdate = true;

        world.rotation.y = t * ROTATION_SPEED;

        camera.position.x += (pointerX * 0.42 - camera.position.x) * Math.min(dt * 3.2, 1);
        camera.position.y +=
          (0.9 + pointerY * 0.22 - camera.position.y) * Math.min(dt * 3.2, 1);
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
      };

      // ---- lifecycle -----------------------------------------------
      let frame = 0;
      let last = 0;
      let running = false;
      let onScreen = true;
      let pageVisible = true;
      let pointerX = 0;
      let pointerY = 0;

      const loop = (now: number) => {
        frame = requestAnimationFrame(loop);
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        update(dt);
      };

      const sync = () => {
        const shouldRun = onScreen && pageVisible && !reducedMotion();
        if (shouldRun && !running) {
          running = true;
          last = performance.now();
          frame = requestAnimationFrame(loop);
        } else if (!shouldRun && running) {
          running = false;
          cancelAnimationFrame(frame);
          update(0); // settle one frame so a parked scene still shows
        }
      };

      const reducedMotion = () =>
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      let observer: IntersectionObserver | null = null;
      if (typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver(
          (entries) => {
            onScreen = entries.some((entry) => entry.isIntersecting);
            sync();
          },
          { threshold: 0.05 }
        );
        observer.observe(canvas);
      }

      const onVisibility = () => {
        pageVisible = document.visibilityState === "visible";
        sync();
      };
      document.addEventListener("visibilitychange", onVisibility);

      const resizeObserver = new ResizeObserver(() => {
        resize();
        if (!running) update(0);
      });
      resizeObserver.observe(canvas);

      const finePointer = window.matchMedia(
        "(hover: hover) and (pointer: fine)"
      );
      const onPointerMove = (event: PointerEvent) => {
        pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
        pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
      };
      if (finePointer.matches) {
        window.addEventListener("pointermove", onPointerMove, {
          passive: true,
        });
      }

      const motionQuery = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      );
      const onMotionChange = () => sync();
      motionQuery.addEventListener?.("change", onMotionChange);

      // One settled frame even before anything runs, so the field is
      // present from the first paint.
      update(0);
      sync();

      teardown = () => {
        if (frame) cancelAnimationFrame(frame);
        observer?.disconnect();
        resizeObserver.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pointermove", onPointerMove);
        motionQuery.removeEventListener?.("change", onMotionChange);
        nodeGeometry.dispose();
        brightGeometry.dispose();
        lineGeometry.dispose();
        signalGeometry.dispose();
        nodeMaterial.dispose();
        brightMaterial.dispose();
        lineMaterial.dispose();
        signalMaterial.dispose();
        sprite.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      teardown?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
    />
  );
}

/** A soft radial sprite so points render as glows, not squares. */
function makeSoftSprite(THREE: typeof import("three")) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.35, "rgba(255, 255, 255, 0.55)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

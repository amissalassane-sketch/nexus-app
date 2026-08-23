"use client";

import { useEffect, useRef } from "react";

// ============================================================
// NEXUS INTELLIGENCE — THE NETWORK
//
// A single <canvas> running one requestAnimationFrame loop. It renders
// the computational field that sits behind the Intelligence hero:
//
//   OBSERVE    nodes drift and read the field
//   UNDERSTAND nearby nodes converge into a cluster
//   CONNECT    the cluster binds, connections strengthen
//   ACT        a pulse propagates outward and the field settles
//
// Everything below is deliberate:
//   • no React state — the engine owns its own mutable world, so the
//     component never re-renders after mount
//   • deterministic seeded RNG — the same field every load, no
//     hydration mismatch, no "random particles"
//   • density is a function of distance from the hero copy, so the
//     centre of the viewport stays quiet and the edges stay alive
//   • the loop is parked when the tab is hidden or the hero scrolls
//     out of view, and never starts at all under reduced motion
//     (a single static frame is drawn instead)
// ============================================================

export interface IntelligenceNetworkConfig {
  /** Number of points in the field. */
  nodeCount: number;
  /** Distance (CSS px) under which two nodes are considered related. */
  connectionDistance: number;
  /** Multiplier on the drift clock. 1 = the calibrated NEXUS pace. */
  particleSpeed: number;
  /** Radius (CSS px) of the pointer's influence on the field. */
  interactionRadius: number;
  /** Maximum displacement (CSS px) the pointer can induce on a node. */
  maxDisplacement: number;
  /** Average seconds between two data pulses. */
  pulseFrequency: number;
  /** Average seconds between two cluster (insight) sequences. */
  clusterFrequency: number;
  /** Radius (CSS px) of the quiet zone protecting the hero copy. */
  calmRadius: number;
  /** Vertical position of the quiet zone, as a ratio of the height. */
  calmCenterY: number;
  /** Pale lavender used for active nodes, pulses and bound links. */
  accentColor: string;
  /** Resting opacity range for nodes. */
  nodeOpacity: [number, number];
  /** Resting opacity range for connections. */
  linkOpacity: [number, number];
  /** Disable pointer interaction entirely (mobile / coarse pointers). */
  interactive: boolean;
}

export type IntelligenceNetworkProps = {
  className?: string;
  /** Overrides merged on top of the resolved responsive profile. */
  config?: Partial<IntelligenceNetworkConfig>;
};

/* ------------------------------------------------------------------
   Responsive profiles
   ------------------------------------------------------------------ */

type Profile = "mobile" | "tablet" | "desktop";

const PROFILES: Record<Profile, IntelligenceNetworkConfig> = {
  desktop: {
    nodeCount: 116,
    connectionDistance: 152,
    particleSpeed: 1,
    interactionRadius: 220,
    maxDisplacement: 14,
    pulseFrequency: 3.2,
    clusterFrequency: 7.5,
    calmRadius: 520,
    calmCenterY: 0.52,
    accentColor: "#c7c9ff",
    nodeOpacity: [0.15, 0.55],
    linkOpacity: [0.04, 0.18],
    interactive: true,
  },
  tablet: {
    nodeCount: 68,
    connectionDistance: 138,
    particleSpeed: 0.82,
    interactionRadius: 190,
    maxDisplacement: 10,
    pulseFrequency: 3.8,
    clusterFrequency: 9,
    calmRadius: 400,
    calmCenterY: 0.52,
    accentColor: "#c7c9ff",
    nodeOpacity: [0.14, 0.5],
    linkOpacity: [0.035, 0.15],
    interactive: true,
  },
  mobile: {
    nodeCount: 36,
    connectionDistance: 124,
    particleSpeed: 0.7,
    interactionRadius: 0,
    maxDisplacement: 0,
    pulseFrequency: 4.6,
    clusterFrequency: 11,
    calmRadius: 260,
    calmCenterY: 0.5,
    accentColor: "#c7c9ff",
    nodeOpacity: [0.14, 0.48],
    linkOpacity: [0.035, 0.14],
    interactive: false,
  },
};

const profileFor = (width: number): Profile =>
  width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop";

/* ------------------------------------------------------------------
   Small deterministic helpers
   ------------------------------------------------------------------ */

/** mulberry32 — tiny, fast, and identical on every machine. */
function createRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** cubic-bezier(0.16, 1, 0.3, 1) — the NEXUS entrance curve. */
const easeOutExpo = (t: number) => 1 - Math.pow(1 - t, 5);

/** Smooth acceleration then deceleration, for travelling pulses. */
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function parseRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) return [199, 201, 255];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/* ------------------------------------------------------------------
   World model
   ------------------------------------------------------------------ */

type Node = {
  /** Normalised home position — survives resize without re-seeding. */
  nx: number;
  ny: number;
  /** Resolved position for the current frame, in CSS px. */
  x: number;
  y: number;
  /** Drift oscillators: two per axis, slow and out of phase. */
  ax: number;
  ay: number;
  wx: number;
  wy: number;
  px: number;
  py: number;
  ax2: number;
  ay2: number;
  wx2: number;
  wy2: number;
  px2: number;
  py2: number;
  /** Resting radius and opacity. */
  radius: number;
  alpha: number;
  /** 0..1 activation, decays back to rest. */
  energy: number;
  /** Convergence offset contributed by the cluster this node belongs to. */
  ox: number;
  oy: number;
  /** Density weight: 0 in the quiet centre, 1 at the edges. */
  calm: number;
  /** Entrance stagger, in seconds. */
  delay: number;
  /** Neighbours for this frame, filled by the connection pass. */
  links: number[];
};

type Pulse = {
  from: number;
  to: number;
  t: number;
  /** Seconds the pulse takes to travel the connection. */
  duration: number;
  intensity: number;
  /** Remaining propagation hops. */
  hops: number;
};

type Cluster = {
  members: number[];
  cx: number;
  cy: number;
  t: number;
  duration: number;
  fired: boolean;
};

const MAX_LINKS_PER_NODE = 7;
const MAX_CLUSTERS = 3;
const MAX_PULSES = 22;
const ALPHA_BUCKETS = 7;

/* ------------------------------------------------------------------
   The engine
   ------------------------------------------------------------------ */

class NetworkEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  private cfg: IntelligenceNetworkConfig;
  private overrides: Partial<IntelligenceNetworkConfig>;
  private profile: Profile;

  private width = 0;
  private height = 0;
  private dpr = 1;

  private nodes: Node[] = [];
  private pulses: Pulse[] = [];
  private clusters: Cluster[] = [];

  /** Spatial hash rebuilt every frame — keeps the pair scan near-linear. */
  private cells = new Map<number, number[]>();
  private cellSize = 1;
  private cols = 0;

  private time = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  /** 0..1 entrance progress. */
  private reveal = 0;
  /** 0..1 global activity — IDLE → THINKING → INSIGHT. */
  private arousal = 0;

  private nextPulseAt = 1.8;
  private nextClusterAt = 3.2;

  private pointerX = -9999;
  private pointerY = -9999;
  private pointerTargetX = -9999;
  private pointerTargetY = -9999;
  private pointerAmount = 0;
  private pointerInside = false;

  private accent: [number, number, number];
  private glowSprite: HTMLCanvasElement | null = null;
  private pulseSprite: HTMLCanvasElement | null = null;

  private readonly reducedMotion: boolean;

  /** Reusable per-frame buckets — never reallocated. */
  private readonly restBuckets: number[][] = [];
  private readonly activeBuckets: number[][] = [];

  constructor(
    canvas: HTMLCanvasElement,
    overrides: Partial<IntelligenceNetworkConfig>,
    reducedMotion: boolean
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;

    this.overrides = overrides;
    this.reducedMotion = reducedMotion;
    this.profile = profileFor(window.innerWidth);
    this.cfg = { ...PROFILES[this.profile], ...overrides };
    this.accent = parseRgb(this.cfg.accentColor);

    for (let i = 0; i < ALPHA_BUCKETS; i += 1) {
      this.restBuckets.push([]);
      this.activeBuckets.push([]);
    }
  }

  /* ---------------- lifecycle ---------------- */

  resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;

    const nextProfile = profileFor(window.innerWidth);
    const profileChanged = nextProfile !== this.profile;
    if (profileChanged) {
      this.profile = nextProfile;
      this.cfg = { ...PROFILES[nextProfile], ...this.overrides };
      this.accent = parseRgb(this.cfg.accentColor);
    }

    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.cellSize = this.cfg.connectionDistance * 1.5;
    this.cols = Math.max(1, Math.ceil(width / this.cellSize) + 1);

    if (profileChanged || this.nodes.length === 0) {
      this.seed();
    }
    this.buildSprites();

    if (this.reducedMotion) this.renderStatic();
  }

  start() {
    if (this.running || this.reducedMotion) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    this.stop();
    this.nodes = [];
    this.pulses = [];
    this.clusters = [];
    this.cells.clear();
  }

  /* ---------------- pointer ---------------- */

  setPointer(x: number, y: number) {
    if (!this.cfg.interactive || this.reducedMotion) return;
    this.pointerTargetX = x;
    this.pointerTargetY = y;
    if (!this.pointerInside) {
      // First contact: drop the smoothed pointer straight onto the cursor
      // so the field does not sweep across the screen to reach it.
      this.pointerX = x;
      this.pointerY = y;
    }
    this.pointerInside = true;
  }

  clearPointer() {
    this.pointerInside = false;
  }

  /**
   * The interface answering the user's intent: a short, local activation
   * around a point in viewport space (used when the CTA is hovered).
   */
  intent(clientX: number, clientY: number) {
    if (this.reducedMotion || this.nodes.length === 0) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    let seed = -1;
    let best = Infinity;
    for (let i = 0; i < this.nodes.length; i += 1) {
      const node = this.nodes[i];
      const d = (node.x - x) ** 2 + (node.y - y) ** 2;
      if (d < best) {
        best = d;
        seed = i;
      }
    }
    if (seed < 0) return;

    // Brighten the immediate neighbourhood, then send one or two pulses
    // outward — 400–700ms of recognition, nothing more.
    const radius = 260;
    for (let i = 0; i < this.nodes.length; i += 1) {
      const node = this.nodes[i];
      const d = Math.hypot(node.x - x, node.y - y);
      if (d > radius) continue;
      node.energy = Math.min(1, node.energy + 0.55 * (1 - d / radius));
    }

    this.arousal = Math.min(1, this.arousal + 0.28);
    const links = this.nodes[seed].links;
    for (let i = 0; i < Math.min(2, links.length); i += 1) {
      this.spawnPulse(seed, links[i], 0.85, 2);
    }
  }

  /* ---------------- world construction ---------------- */

  /**
   * Density is sampled against the quiet zone: the centre of the viewport,
   * where the headline lives, receives very few points; the edges receive
   * the rest. Roughly a third of the field is placed as satellites of an
   * existing node, which is what makes natural clusters appear instead of
   * an even scatter.
   */
  private seed() {
    const random = createRandom(0x4e455855); // "NEXU"
    const count = this.cfg.nodeCount;
    const nodes: Node[] = [];

    const push = (x: number, y: number) => {
      const nx = clamp(x / this.width, 0.01, 0.99);
      const ny = clamp(y / this.height, 0.01, 0.99);
      const calm = this.calmAt(nx * this.width, ny * this.height);
      const bright = random() < 0.14;
      const [minA, maxA] = this.cfg.nodeOpacity;

      nodes.push({
        nx,
        ny,
        x: nx * this.width,
        y: ny * this.height,
        ax: 6 + random() * 11,
        ay: 5 + random() * 9,
        wx: 0.05 + random() * 0.1,
        wy: 0.045 + random() * 0.095,
        px: random() * Math.PI * 2,
        py: random() * Math.PI * 2,
        ax2: 2 + random() * 5,
        ay2: 2 + random() * 4,
        wx2: 0.16 + random() * 0.14,
        wy2: 0.15 + random() * 0.13,
        px2: random() * Math.PI * 2,
        py2: random() * Math.PI * 2,
        radius: bright ? 1.15 + random() * 0.5 : 0.55 + random() * 0.45,
        alpha: minA + random() * (maxA - minA) * (bright ? 1 : 0.72),
        energy: 0,
        ox: 0,
        oy: 0,
        calm,
        delay: random() * 0.42,
        links: [],
      });
    };

    let guard = 0;
    while (nodes.length < count && guard < count * 60) {
      guard += 1;

      // Satellite placement — this is where clusters come from.
      if (nodes.length > 6 && random() < 0.34) {
        const host = nodes[Math.floor(random() * nodes.length)];
        const angle = random() * Math.PI * 2;
        const distance = 22 + random() * 62;
        const x = host.nx * this.width + Math.cos(angle) * distance;
        const y = host.ny * this.height + Math.sin(angle) * distance;
        if (x < 4 || y < 4 || x > this.width - 4 || y > this.height - 4) continue;
        if (random() > 0.16 + 0.84 * this.calmAt(x, y)) continue;
        push(x, y);
        continue;
      }

      const x = random() * this.width;
      const y = random() * this.height;
      if (random() > 0.1 + 0.9 * this.calmAt(x, y)) continue;
      push(x, y);
    }

    this.nodes = nodes;
    this.pulses = [];
    this.clusters = [];
    this.time = 0;
    this.reveal = 0;
    this.nextPulseAt = 1.8;
    this.nextClusterAt = 3.2;
  }

  /**
   * 0 at the centre of the hero copy, 1 out at the edges. Slightly wider
   * than tall, because the headline block is wider than it is tall.
   */
  private calmAt(x: number, y: number) {
    const cx = this.width / 2;
    const cy = this.height * this.cfg.calmCenterY;
    const rx = this.cfg.calmRadius;
    const ry = this.cfg.calmRadius * 0.68;
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
    return 0.06 + 0.94 * smoothstep(0.5, 1.3, d);
  }

  private buildSprites() {
    const [r, g, b] = this.accent;

    // Pointer field — a soft radial presence, never a spotlight.
    const glowSize = Math.max(2, Math.round(this.cfg.interactionRadius * 2));
    if (glowSize > 2) {
      const glow = document.createElement("canvas");
      glow.width = glowSize;
      glow.height = glowSize;
      const gctx = glow.getContext("2d");
      if (gctx) {
        const half = glowSize / 2;
        const gradient = gctx.createRadialGradient(half, half, 0, half, half, half);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
        gradient.addColorStop(0.28, `rgba(${r}, ${g}, ${b}, 0.030)`);
        gradient.addColorStop(0.6, `rgba(255, 255, 255, 0.014)`);
        gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        gctx.fillStyle = gradient;
        gctx.fillRect(0, 0, glowSize, glowSize);
      }
      this.glowSprite = glow;
    }

    // Travelling pulse — a luminous point with a short blur, pre-rendered
    // once so the loop never touches ctx.filter or createRadialGradient.
    const pulseSize = 28;
    const pulse = document.createElement("canvas");
    pulse.width = pulseSize;
    pulse.height = pulseSize;
    const pctx = pulse.getContext("2d");
    if (pctx) {
      const half = pulseSize / 2;
      const gradient = pctx.createRadialGradient(half, half, 0, half, half, half);
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.18, `rgba(${r}, ${g}, ${b}, 0.85)`);
      gradient.addColorStop(0.42, `rgba(${r}, ${g}, ${b}, 0.22)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      pctx.fillStyle = gradient;
      pctx.fillRect(0, 0, pulseSize, pulseSize);
    }
    this.pulseSprite = pulse;
  }

  /* ---------------- simulation ---------------- */

  private frame = (now: number) => {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, 1 / 30);
    this.last = now;
    this.time += dt;

    this.update(dt);
    this.render();

    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    this.reveal = Math.min(1, this.reveal + dt / 1.1);

    // Pointer easing — the field follows intent, it is never dragged.
    if (this.cfg.interactive) {
      const follow = 1 - Math.exp(-dt * 7);
      if (this.pointerInside) {
        this.pointerX += (this.pointerTargetX - this.pointerX) * follow;
        this.pointerY += (this.pointerTargetY - this.pointerY) * follow;
      }
      const target = this.pointerInside ? 1 : 0;
      this.pointerAmount += (target - this.pointerAmount) * (1 - Math.exp(-dt * 4));
    }

    this.updatePositions(dt);
    this.buildSpatialHash();
    // Connections are resolved here, not at paint time: the pulse and
    // cluster systems below both need this frame's adjacency lists.
    this.computeConnections();
    this.scheduleActivity(dt);
    this.updateClusters(dt);
    this.updatePulses(dt);

    // Arousal decays back to IDLE. Transitions are always eased, so the
    // three states blend rather than switch.
    this.arousal *= Math.exp(-dt / 1.7);
  }

  private updatePositions(dt: number) {
    const t = this.time * this.cfg.particleSpeed;
    const { interactionRadius, maxDisplacement } = this.cfg;
    const pointerLive =
      this.cfg.interactive && this.pointerAmount > 0.01 && interactionRadius > 0;

    for (let i = 0; i < this.nodes.length; i += 1) {
      const node = this.nodes[i];

      const homeX = node.nx * this.width;
      const homeY = node.ny * this.height;

      let x =
        homeX +
        Math.sin(t * node.wx + node.px) * node.ax +
        Math.sin(t * node.wx2 + node.px2) * node.ax2;
      let y =
        homeY +
        Math.cos(t * node.wy + node.py) * node.ay +
        Math.sin(t * node.wy2 + node.py2) * node.ay2;

      // Cluster convergence, applied as a decaying offset.
      x += node.ox;
      y += node.oy;

      if (pointerLive) {
        const dx = x - this.pointerX;
        const dy = y - this.pointerY;
        const distance = Math.hypot(dx, dy);
        if (distance < interactionRadius && distance > 0.001) {
          const falloff = 1 - distance / interactionRadius;
          const push = maxDisplacement * falloff * falloff * this.pointerAmount;
          x += (dx / distance) * push;
          y += (dy / distance) * push;
        }
      }

      node.x = x;
      node.y = y;
      node.energy *= Math.exp(-dt / 0.62);
      node.links.length = 0;
    }
  }

  private buildSpatialHash() {
    this.cells.clear();
    const size = this.cellSize;
    for (let i = 0; i < this.nodes.length; i += 1) {
      const node = this.nodes[i];
      const key =
        Math.floor(node.y / size) * this.cols + Math.floor(node.x / size);
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(i);
      else this.cells.set(key, [i]);
    }
  }

  /** Decides when the system thinks, and when it produces an insight. */
  private scheduleActivity(dt: number) {
    if (this.reveal < 0.55) return;

    this.nextPulseAt -= dt;
    if (this.nextPulseAt <= 0) {
      this.nextPulseAt =
        this.cfg.pulseFrequency * (0.6 + Math.random() * 0.9);
      this.emitThought();
    }

    this.nextClusterAt -= dt;
    if (this.nextClusterAt <= 0) {
      this.nextClusterAt =
        this.cfg.clusterFrequency * (0.75 + Math.random() * 0.7);
      this.formCluster();
    }
  }

  /** STATE 2 — THINKING: one signal travels, a couple of nodes answer. */
  private emitThought() {
    const from = this.pickEdgeBiasedNode();
    if (from < 0) return;
    const links = this.nodes[from].links;
    if (links.length === 0) return;

    const to = links[Math.floor(Math.random() * links.length)];
    this.nodes[from].energy = Math.min(1, this.nodes[from].energy + 0.7);
    this.spawnPulse(from, to, 0.75, 2 + Math.floor(Math.random() * 2));
    this.arousal = Math.min(1, this.arousal + 0.12);
  }

  /** STATE 3 — INSIGHT: a neighbourhood binds, resolves, and dissolves. */
  private formCluster() {
    if (this.clusters.length >= MAX_CLUSTERS) return;

    const seed = this.pickEdgeBiasedNode();
    if (seed < 0) return;

    const origin = this.nodes[seed];
    const radius = this.cfg.connectionDistance * 1.35;
    const members: number[] = [seed];

    for (let i = 0; i < this.nodes.length && members.length < 9; i += 1) {
      if (i === seed) continue;
      const node = this.nodes[i];
      if (Math.hypot(node.x - origin.x, node.y - origin.y) < radius) {
        members.push(i);
      }
    }
    if (members.length < 4) return;

    let cx = 0;
    let cy = 0;
    for (const index of members) {
      cx += this.nodes[index].x;
      cy += this.nodes[index].y;
    }

    this.clusters.push({
      members,
      cx: cx / members.length,
      cy: cy / members.length,
      t: 0,
      duration: 3.4 + Math.random() * 2.4, // 3–6s, per cluster, unsynchronised
      fired: false,
    });
  }

  /**
   * Edge-biased selection: the field is more active away from the copy,
   * so activity is picked in proportion to a node's calm weight.
   */
  private pickEdgeBiasedNode() {
    if (this.nodes.length === 0) return -1;
    let best = -1;
    let bestScore = -1;
    // Three candidates, keep the most peripheral — cheap weighted pick.
    for (let i = 0; i < 3; i += 1) {
      const index = Math.floor(Math.random() * this.nodes.length);
      const score = this.nodes[index].calm * (0.7 + Math.random() * 0.3);
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    }
    return best;
  }

  private spawnPulse(from: number, to: number, intensity: number, hops: number) {
    if (this.pulses.length >= MAX_PULSES) return;
    if (from === to || !this.nodes[from] || !this.nodes[to]) return;

    const a = this.nodes[from];
    const b = this.nodes[to];
    const distance = Math.hypot(b.x - a.x, b.y - a.y);

    this.pulses.push({
      from,
      to,
      t: 0,
      duration: clamp(distance / 190, 0.5, 1.5),
      intensity,
      hops,
    });
  }

  private updatePulses(dt: number) {
    for (let i = this.pulses.length - 1; i >= 0; i -= 1) {
      const pulse = this.pulses[i];
      pulse.t += dt / pulse.duration;

      const target = this.nodes[pulse.to];
      const source = this.nodes[pulse.from];
      if (!target || !source) {
        this.pulses.splice(i, 1);
        continue;
      }

      // The connection itself lights up while a signal is on it.
      source.energy = Math.max(source.energy, pulse.intensity * (1 - pulse.t) * 0.8);

      if (pulse.t < 1) continue;

      target.energy = Math.min(1, target.energy + pulse.intensity * 0.85);
      this.pulses.splice(i, 1);

      // Propagate onward — this is how a signal reaches another cluster.
      // The next hop always leaves from the node just reached, and never
      // doubles straight back along the connection it arrived on.
      if (pulse.hops > 0 && pulse.intensity > 0.22) {
        const candidates = target.links.filter((index) => index !== pulse.from);
        if (candidates.length > 0) {
          const next = candidates[Math.floor(Math.random() * candidates.length)];
          this.spawnPulse(pulse.to, next, pulse.intensity * 0.72, pulse.hops - 1);
        }
      }
    }
  }

  private updateClusters(dt: number) {
    for (let i = this.clusters.length - 1; i >= 0; i -= 1) {
      const cluster = this.clusters[i];
      cluster.t += dt / cluster.duration;

      if (cluster.t >= 1) {
        for (const index of cluster.members) {
          const node = this.nodes[index];
          if (node) {
            node.ox = 0;
            node.oy = 0;
          }
        }
        this.clusters.splice(i, 1);
        continue;
      }

      // gather → bind → resolve → release
      const gather =
        cluster.t < 0.36
          ? easeOutExpo(cluster.t / 0.36)
          : cluster.t < 0.68
            ? 1
            : 1 - easeOutExpo((cluster.t - 0.68) / 0.32);

      for (const index of cluster.members) {
        const node = this.nodes[index];
        if (!node) continue;
        const dx = cluster.cx - node.x + node.ox;
        const dy = cluster.cy - node.y + node.oy;
        const distance = Math.hypot(dx, dy);
        if (distance < 0.001) continue;
        const pull = Math.min(distance * 0.2, 15) * gather;
        node.ox = (dx / distance) * pull;
        node.oy = (dy / distance) * pull;
        node.energy = Math.max(node.energy, gather * 0.3);
      }

      // The moment it understands: one pulse through the bound cluster.
      if (!cluster.fired && cluster.t >= 0.4) {
        cluster.fired = true;
        this.arousal = Math.min(1, this.arousal + 0.22);
        const seed = cluster.members[0];
        const links = this.nodes[seed]?.links ?? [];
        let sent = 0;
        for (const link of links) {
          if (sent >= 2) break;
          this.spawnPulse(seed, link, 0.9, 3);
          sent += 1;
        }
      }
    }
  }

  /* ---------------- rendering ---------------- */

  private render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const revealed = easeOutExpo(clamp(this.reveal, 0, 1));
    const lift = 1 + this.arousal * 0.22;

    this.drawPointerField();
    this.drawConnections();
    this.drawNodes(revealed, lift);
    this.drawPulses(revealed);
  }

  /** A single static frame, for prefers-reduced-motion. */
  private renderStatic() {
    if (this.nodes.length === 0) return;
    this.reveal = 1;
    this.arousal = 0;
    for (const node of this.nodes) {
      node.x = node.nx * this.width;
      node.y = node.ny * this.height;
      node.energy = 0;
      node.ox = 0;
      node.oy = 0;
      node.links.length = 0;
    }
    this.buildSpatialHash();
    this.computeConnections();
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.drawConnections();
    this.drawNodes(1, 1);
  }

  private drawPointerField() {
    if (!this.glowSprite || this.pointerAmount < 0.02) return;
    const size = this.glowSprite.width;
    this.ctx.globalAlpha = this.pointerAmount;
    this.ctx.drawImage(
      this.glowSprite,
      this.pointerX - size / 2,
      this.pointerY - size / 2
    );
    this.ctx.globalAlpha = 1;
  }

  /**
   * One pass over neighbouring cells builds both the adjacency lists used
   * by the pulse system and the batched draw buckets. Segments are grouped
   * by opacity so the whole field costs a handful of strokes per frame.
   *
   * This runs during update — the pulse and cluster systems read `links`.
   */
  private computeConnections() {
    const revealed = easeOutExpo(clamp(this.reveal, 0, 1));
    const lift = 1 + this.arousal * 0.22;
    const maxDistance = this.cfg.connectionDistance;
    const extended = maxDistance * 1.42;
    const [minL, maxL] = this.cfg.linkOpacity;

    for (let i = 0; i < ALPHA_BUCKETS; i += 1) {
      this.restBuckets[i].length = 0;
      this.activeBuckets[i].length = 0;
    }

    const pointerLive = this.cfg.interactive && this.pointerAmount > 0.02;
    const pointerRadius = this.cfg.interactionRadius;

    // Half-neighbourhood scan: each pair is visited exactly once.
    const offsets = [0, 1, this.cols - 1, this.cols, this.cols + 1];

    for (const [key, bucket] of this.cells) {
      for (let oi = 0; oi < offsets.length; oi += 1) {
        const other = this.cells.get(key + offsets[oi]);
        if (!other) continue;
        const same = oi === 0;

        for (let a = 0; a < bucket.length; a += 1) {
          const ia = bucket[a];
          const na = this.nodes[ia];
          const start = same ? a + 1 : 0;

          for (let b = start; b < other.length; b += 1) {
            const ib = other[b];
            if (ib === ia) continue;
            const nb = this.nodes[ib];

            const dx = nb.x - na.x;
            const dy = nb.y - na.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > extended * extended) continue;

            const distance = Math.sqrt(d2);
            const energy = (na.energy + nb.energy) * 0.5;

            let strength: number;
            if (distance <= maxDistance) {
              strength = 1 - distance / maxDistance;
            } else {
              // Connections that only exist while the system is thinking.
              if (energy < 0.16) continue;
              const t = 1 - (distance - maxDistance) / (extended - maxDistance);
              strength = t * energy * 0.85;
            }
            if (strength <= 0.02) continue;

            if (na.links.length < MAX_LINKS_PER_NODE) na.links.push(ib);
            if (nb.links.length < MAX_LINKS_PER_NODE) nb.links.push(ia);

            const calm = Math.min(na.calm, nb.calm);
            let alpha =
              (minL + (maxL - minL) * strength) *
              strength *
              calm *
              revealed *
              lift;

            if (energy > 0.02) alpha += energy * 0.16 * calm;

            if (pointerLive) {
              const mx = (na.x + nb.x) * 0.5;
              const my = (na.y + nb.y) * 0.5;
              const pd = Math.hypot(mx - this.pointerX, my - this.pointerY);
              if (pd < pointerRadius) {
                alpha += (1 - pd / pointerRadius) * 0.055 * this.pointerAmount * calm;
              }
            }

            if (alpha < 0.006) continue;
            alpha = Math.min(alpha, 0.3);

            const bucketIndex = Math.min(
              ALPHA_BUCKETS - 1,
              Math.floor((alpha / 0.3) * ALPHA_BUCKETS)
            );
            const target =
              energy > 0.14 ? this.activeBuckets[bucketIndex] : this.restBuckets[bucketIndex];
            target.push(na.x, na.y, nb.x, nb.y);
          }
        }
      }
    }
  }

  /** Paints the buckets filled by computeConnections(). */
  private drawConnections() {
    const ctx = this.ctx;
    const [ar, ag, ab] = this.accent;

    ctx.lineWidth = 0.7;
    ctx.lineCap = "butt";

    for (let i = 0; i < ALPHA_BUCKETS; i += 1) {
      const alpha = ((i + 0.5) / ALPHA_BUCKETS) * 0.3;

      const rest = this.restBuckets[i];
      if (rest.length > 0) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(4)})`;
        ctx.beginPath();
        for (let s = 0; s < rest.length; s += 4) {
          ctx.moveTo(rest[s], rest[s + 1]);
          ctx.lineTo(rest[s + 2], rest[s + 3]);
        }
        ctx.stroke();
      }

      const active = this.activeBuckets[i];
      if (active.length > 0) {
        ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${(alpha * 1.25).toFixed(4)})`;
        ctx.beginPath();
        for (let s = 0; s < active.length; s += 4) {
          ctx.moveTo(active[s], active[s + 1]);
          ctx.lineTo(active[s + 2], active[s + 3]);
        }
        ctx.stroke();
      }
    }
  }

  private drawNodes(revealed: number, lift: number) {
    const ctx = this.ctx;
    const [ar, ag, ab] = this.accent;
    const pointerLive = this.cfg.interactive && this.pointerAmount > 0.02;
    const pointerRadius = this.cfg.interactionRadius;

    for (let i = 0; i < this.nodes.length; i += 1) {
      const node = this.nodes[i];

      // Staggered entrance: the field materialises rather than appearing.
      const entrance = clamp((this.reveal - node.delay) / 0.58, 0, 1);
      if (entrance <= 0) continue;

      const calmFade = 0.2 + 0.8 * node.calm;
      let alpha = node.alpha * calmFade * easeOutExpo(entrance) * revealed * lift;
      let radius = node.radius;

      if (pointerLive) {
        const d = Math.hypot(node.x - this.pointerX, node.y - this.pointerY);
        if (d < pointerRadius) {
          const f = 1 - d / pointerRadius;
          alpha += f * f * 0.22 * this.pointerAmount;
        }
      }

      if (node.energy > 0.01) {
        alpha += node.energy * 0.42;
        radius += node.energy * 0.7;
      }

      alpha = Math.min(alpha, 0.95);
      if (alpha < 0.01) continue;

      // Active nodes drift toward the intelligence accent; resting nodes
      // stay cool white. No node is ever saturated.
      if (node.energy > 0.05) {
        const mix = Math.min(node.energy, 1);
        const r = Math.round(255 + (ar - 255) * mix * 0.7);
        const g = Math.round(255 + (ag - 255) * mix * 0.7);
        const b = Math.round(255 + (ab - 255) * mix * 0.7);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(4)})`;
      } else {
        ctx.fillStyle = `rgba(248, 249, 255, ${alpha.toFixed(4)})`;
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // A single halo on strongly activated nodes — the visual equivalent
      // of "this one just mattered".
      if (node.energy > 0.4 && this.pulseSprite) {
        const size = 18 + node.energy * 14;
        ctx.globalAlpha = (node.energy - 0.4) * 0.5;
        ctx.drawImage(
          this.pulseSprite,
          node.x - size / 2,
          node.y - size / 2,
          size,
          size
        );
        ctx.globalAlpha = 1;
      }
    }
  }

  private drawPulses(revealed: number) {
    if (!this.pulseSprite) return;
    const ctx = this.ctx;

    for (let i = 0; i < this.pulses.length; i += 1) {
      const pulse = this.pulses[i];
      const a = this.nodes[pulse.from];
      const b = this.nodes[pulse.to];
      if (!a || !b) continue;

      const t = easeInOut(clamp(pulse.t, 0, 1));
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;

      // Fades in and out at the ends of its journey.
      const life = Math.sin(clamp(pulse.t, 0, 1) * Math.PI);
      const alpha = life * pulse.intensity * 0.62 * revealed;
      if (alpha < 0.01) continue;

      const size = 9 + pulse.intensity * 7;
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.pulseSprite, x - size / 2, y - size / 2, size, size);
      ctx.globalAlpha = 1;
    }
  }
}

/* ------------------------------------------------------------------
   Component
   ------------------------------------------------------------------ */

/** Fired by the hero CTAs so the field can answer the user's intent. */
export const INTELLIGENCE_INTENT_EVENT = "nexus:intelligence-intent";

export type IntelligenceIntentDetail = { x: number; y: number };

export function IntelligenceNetwork({
  className,
  config,
}: IntelligenceNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The config is read once per mount; keeping it in a ref stops an inline
  // object literal from tearing down the engine on every parent render.
  const configRef = useRef(config);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

    let engine: NetworkEngine;
    try {
      engine = new NetworkEngine(
        canvas,
        {
          ...configRef.current,
          ...(finePointerQuery.matches ? null : { interactive: false }),
        },
        reducedMotionQuery.matches
      );
    } catch {
      // No 2D context (very old or locked-down browser): the hero keeps
      // its CSS atmosphere and the page stays complete.
      return;
    }

    const measure = () => {
      const rect = host.getBoundingClientRect();
      engine.resize(rect.width, rect.height);
    };
    measure();

    let visible = true;
    let onScreen = true;
    const sync = () => {
      if (visible && onScreen) engine.start();
      else engine.stop();
    };
    sync();

    const resizeObserver = new ResizeObserver(() => {
      measure();
      // A fresh frame right away keeps the field from tearing while the
      // browser window is being dragged.
      if (visible && onScreen) engine.start();
    });
    resizeObserver.observe(host);

    // Park the loop when the hero is not on screen — the rest of the
    // Intelligence page scrolls at full speed.
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        sync();
      },
      { rootMargin: "120px" }
    );
    intersectionObserver.observe(host);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < -60 || y < -60 || x > rect.width + 60 || y > rect.height + 60) {
        engine.clearPointer();
        return;
      }
      engine.setPointer(x, y);
    };
    const onPointerLeave = () => engine.clearPointer();

    const onIntent = (event: Event) => {
      const detail = (event as CustomEvent<IntelligenceIntentDetail>).detail;
      if (!detail) return;
      engine.intent(detail.x, detail.y);
    };

    if (finePointerQuery.matches && !reducedMotionQuery.matches) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener(INTELLIGENCE_INTENT_EVENT, onIntent);
    }

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener(INTELLIGENCE_INTENT_EVENT, onIntent);
      engine.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

/** Dispatches an intent so the network can respond to a hovered action. */
export function signalIntelligenceIntent(element: HTMLElement | null) {
  if (!element || typeof window === "undefined") return;
  const rect = element.getBoundingClientRect();
  window.dispatchEvent(
    new CustomEvent<IntelligenceIntentDetail>(INTELLIGENCE_INTENT_EVENT, {
      detail: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    })
  );
}

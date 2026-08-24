// ============================================================
// NEXUS INTELLIGENCE — CONTEXT SCENE ENGINE
//
// A single requestAnimationFrame loop that treats the "What it
// sees" diagram as a small 3D world:
//
//   • every workspace object holds a true 3D position (x/y in the
//     stage plane, z toward the viewer) projected each frame with
//     a perspective divide — cards always face the reader, their
//     positions live in space
//   • the camera is slightly elevated, wanders almost
//     imperceptibly, and eases toward the cursor; parallax falls
//     out of the projection plus depth-scaled translation
//   • connections are curves recomputed per frame, so they ride
//     the same projection as the cards they bind
//   • relationships activate in chains: an object lights, a
//     signal travels to the core, the core answers, the next
//     related object lights. Slow, irregular, never simultaneous
//
// Like the network engine it sits beside, the engine owns mutable
// state and talks to the DOM directly — React never re-renders
// after mount, the loop parks when the section is off-screen or
// the tab is hidden, and under prefers-reduced-motion it is never
// constructed at all (the static CSS scene remains).
// ============================================================

import {
  CONTEXT_CHAINS,
  CONTEXT_NODES,
  MOBILE_CHAINS,
  PARTICLES,
  PROFILE_TUNING,
  corePlacement,
  createRandom,
  placementFor,
  profileForWidth,
  scaleForZ,
  type ContextNodeConfig,
  type ContextNodeId,
  type LineLayer,
  type SceneProfile,
} from "./config";

/* ------------------------------------------------------------------
   Small math helpers
   ------------------------------------------------------------------ */

const TAU = Math.PI * 2;

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** cubic-bezier(0.16, 1, 0.3, 1) — the NEXUS entrance curve. */
const easeOutExpo = (t: number) => 1 - Math.pow(1 - t, 5);

/** Smooth acceleration then deceleration, for travelling signals. */
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Distance from centre to a rect edge along a unit vector, + pad. */
const rectRadius = (ux: number, uy: number, hw: number, hh: number, pad: number) => {
  const tx = ux === 0 ? Infinity : hw / Math.abs(ux);
  const ty = uy === 0 ? Infinity : hh / Math.abs(uy);
  return Math.min(tx, ty) + pad;
};

/** Distance from centre to an ellipse edge along a unit vector, + pad. */
const ellipseRadius = (ux: number, uy: number, hw: number, hh: number, pad: number) => {
  const d = Math.hypot(ux / hw, uy / hh);
  return (d === 0 ? Math.max(hw, hh) : 1 / d) + pad;
};

/* ------------------------------------------------------------------
   World model
   ------------------------------------------------------------------ */

type NodeRuntime = {
  id: ContextNodeId;
  el: HTMLElement;
  config: ContextNodeConfig;
  /** Resolved home position for the current stage size, in px. */
  x0: number;
  y0: number;
  z: number;
  dim: number;
  bend: number;
  introAt: number;
  lineLayer: LineLayer;
  /** Measured half extents (for the connection rim). */
  halfW: number;
  halfH: number;
  /** Depth normalised 0..1 across the field (parallax weight). */
  depthNorm: number;
  /** Idle drift oscillators — two per axis, slow and out of phase. */
  fx1: number;
  fx2: number;
  fy1: number;
  fy2: number;
  fw1: number;
  fw2: number;
  fw3: number;
  fw4: number;
  fp1: number;
  fp2: number;
  fp3: number;
  fp4: number;
  /** Live state. */
  near: number;
  lit: number;
  litTarget: number;
  releaseAt: number;
  cooldownUntil: number;
  /** Last projected values (used by connections and proximity). */
  sx: number;
  sy: number;
  scale: number;
  nearWritten: number;
  litWritten: number;
};

type LineRuntime = {
  id: ContextNodeId;
  path: SVGPathElement;
  halo: SVGPathElement;
  node: NodeRuntime;
  layer: LineLayer;
  hidden: boolean;
  introAt: number;
  alpha: number;
  haloAlpha: number;
  /** Last geometry written to the DOM — small movements are skipped so
      the line layer is not re-rastered every frame at idle. */
  dx1: number;
  dy1: number;
  dcx: number;
  dcy: number;
  dx2: number;
  dy2: number;
};

type ConnectionGeometry = {
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  x2: number;
  y2: number;
  length: number;
};

type Signal = {
  active: boolean;
  dot: SVGCircleElement;
  line: LineRuntime | null;
  node: NodeRuntime | null;
  t: number;
  duration: number;
  strength: number;
};

type ChainRuntime = {
  steps: ContextNodeId[];
  index: number;
  nextStepAt: number;
};

type ParticleRuntime = {
  el: HTMLElement;
  x0: number;
  y0: number;
  z: number;
  drift: number;
  period: number;
  phase: number;
  baseOpacity: number;
  depthNorm: number;
};

const SIGNAL_POOL = 5;

/* ------------------------------------------------------------------
   The engine
   ------------------------------------------------------------------ */

export class ContextSceneEngine {
  private readonly root: HTMLElement;
  private readonly interactive: boolean;

  private coreEl: HTMLElement | null = null;
  private corePillEl: HTMLElement | null = null;
  private lightEl: HTMLElement | null = null;
  private backSvg: SVGSVGElement | null = null;
  private frontSvg: SVGSVGElement | null = null;

  private nodes = new Map<ContextNodeId, NodeRuntime>();
  private lines = new Map<ContextNodeId, LineRuntime>();
  private signals: Signal[] = [];
  private particles: ParticleRuntime[] = [];

  private width = 0;
  private height = 0;
  private profile: SceneProfile = "desktop";

  /** Perspective camera distance in px. */
  private persp = 1150;
  /** Baseline elevation — the camera looks slightly down at the field. */
  private baseTilt = 0.062;

  /** Engine clock; only advances while the loop runs. */
  private time = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  /** Assembly (scroll intro). */
  private introBeganAt = -1;
  private introPlayed = false;

  /** Cursor state — targets are set by events, smoothed values eased. */
  private pointerNx = 0;
  private pointerNy = 0;
  private cursorX = 0;
  private cursorY = 0;
  private pointerPx = 0;
  private pointerPy = 0;
  private pointerInside = false;
  private rectDirty = true;
  private rectLeft = 0;
  private rectTop = 0;

  /** Core state. */
  private coreX = 0;
  private coreY = 0;
  private coreZ = 0;
  private coreSx = 0;
  private coreSy = 0;
  private coreScale = 1;
  private coreHalfW = 96;
  private coreHalfH = 20;
  private coreHeat = 0;
  private coreHeatWritten = -1;

  /** Relationship system. */
  private chain: ChainRuntime | null = null;
  private chainCursor = 0;
  private nextChainAt = Infinity;
  private pendingSignals: { at: number; id: ContextNodeId; strength: number }[] = [];

  /** Depth bounds for parallax normalisation. */
  private zMin = -75;
  private zMax = 70;

  constructor(root: HTMLElement, options?: { interactive?: boolean }) {
    this.root = root;
    this.interactive = options?.interactive ?? true;
  }

  /* ---------------- lifecycle ---------------- */

  /**
   * Queries the scene's elements, switches the stage from its static
   * CSS layout into managed mode, and writes a complete first frame.
   */
  init(): boolean {
    const root = this.root;

    this.coreEl = root.querySelector<HTMLElement>("[data-nx-core]");
    this.corePillEl = root.querySelector<HTMLElement>("[data-nx-core-pill]");
    this.lightEl = root.querySelector<HTMLElement>("[data-nx-light]");
    this.backSvg = root.querySelector<SVGSVGElement>('[data-nx-svg="behind"]');
    this.frontSvg = root.querySelector<SVGSVGElement>('[data-nx-svg="front"]');
    if (!this.coreEl || !this.backSvg || !this.frontSvg) return false;

    for (const config of CONTEXT_NODES) {
      const el = root.querySelector<HTMLElement>(`[data-nx-node="${config.id}"]`);
      const path = root.querySelector<SVGPathElement>(`[data-nx-line="${config.id}"]`);
      const halo = root.querySelector<SVGPathElement>(`[data-nx-halo="${config.id}"]`);
      if (!el || !path || !halo) return false;

      const random = createRandom(0x9e37 + config.id.length * 131 + config.id.charCodeAt(0) * 17);
      this.nodes.set(config.id, {
        id: config.id,
        el,
        config,
        x0: 0,
        y0: 0,
        z: 0,
        dim: 1,
        bend: 0,
        introAt: config.desktop.introAt,
        lineLayer: config.desktop.line,
        halfW: 60,
        halfH: 24,
        depthNorm: 0.5,
        fx1: 2.4 + random() * 1.6,
        fx2: 0.9 + random() * 0.9,
        fy1: 1.7 + random() * 1.3,
        fy2: 0.7 + random() * 0.7,
        fw1: TAU / (9 + random() * 6),
        fw2: TAU / (16 + random() * 8),
        fw3: TAU / (11 + random() * 6),
        fw4: TAU / (18 + random() * 8),
        fp1: random() * TAU,
        fp2: random() * TAU,
        fp3: random() * TAU,
        fp4: random() * TAU,
        near: 0,
        lit: 0,
        litTarget: 0,
        releaseAt: 0,
        cooldownUntil: 0,
        sx: 0,
        sy: 0,
        scale: 1,
        nearWritten: -1,
        litWritten: -1,
      });
      this.lines.set(config.id, {
        id: config.id,
        path,
        halo,
        node: null as unknown as NodeRuntime,
        layer: "front",
        hidden: false,
        introAt: 0,
        alpha: 0,
        haloAlpha: -1,
        dx1: NaN,
        dy1: NaN,
        dcx: NaN,
        dcy: NaN,
        dx2: NaN,
        dy2: NaN,
      });
    }
    for (const [id, line] of this.lines) {
      const node = this.nodes.get(id);
      if (!node) return false;
      line.node = node;
    }

    const dotEls = root.querySelectorAll<SVGCircleElement>("[data-nx-signal]");
    const dotCount = Math.min(dotEls.length, SIGNAL_POOL);
    for (let i = 0; i < dotCount; i += 1) {
      this.signals.push({
        active: false,
        dot: dotEls[i],
        line: null,
        node: null,
        t: 0,
        duration: 1,
        strength: 1,
      });
    }

    const particleEls = root.querySelectorAll<HTMLElement>("[data-nx-particle]");
    particleEls.forEach((el, index) => {
      const spec = PARTICLES[index];
      if (!spec) return;
      this.particles.push({
        el,
        x0: 0,
        y0: 0,
        z: spec.z,
        drift: spec.drift,
        period: spec.period,
        phase: spec.phase,
        baseOpacity: spec.opacity,
        depthNorm: 0.5,
      });
    });

    // Managed mode: elements momentarily lose their % homes below and
    // are fully engine-positioned from the first written frame. The
    // class is added only after that frame is computed.
    this.measure();
    this.buildWorld();
    this.writeFrame(0);
    root.classList.add("nx-live");
    return true;
  }

  start() {
    if (this.running) return;
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
    this.root.classList.remove("nx-live");
    this.nodes.clear();
    this.lines.clear();
    this.signals = [];
    this.particles = [];
    this.pendingSignals = [];
    this.chain = null;
  }

  /** The scroll intro: the network assembles itself once. */
  playIntro() {
    if (this.introPlayed) return;
    this.introPlayed = true;
    this.introBeganAt = this.time;
    this.nextChainAt = this.time + 2.9;
  }

  /* ---------------- geometry & layout ---------------- */

  /** Measures the stage. Called by the component's ResizeObserver. */
  resize() {
    const timeFrozen = this.time;
    this.measure();
    this.buildWorld();
    // Re-render at the same clock value so a resize never replays
    // or advances the animation.
    this.time = timeFrozen;
    this.writeFrame(0);
  }

  private measure() {
    const rect = this.root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.width = rect.width;
    this.height = rect.height;
    this.rectLeft = rect.left;
    this.rectTop = rect.top;
    this.rectDirty = true;

    // The profile follows the viewport, not the stage: the stage is
    // capped at 960px so it never reaches the desktop threshold on its
    // own. Same rule the hero's network engine uses.
    this.profile = profileForWidth(window.innerWidth);
    this.persp =
      this.profile === "mobile" ? 980 : Math.max(1050, rect.width * 1.18);
    this.baseTilt = this.profile === "mobile" ? 0.04 : 0.062;

    const viewBox = `0 0 ${Math.round(rect.width)} ${Math.round(rect.height)}`;
    this.backSvg?.setAttribute("viewBox", viewBox);
    this.frontSvg?.setAttribute("viewBox", viewBox);
  }

  /** Rebuilds every runtime home position for the current size/profile. */
  private buildWorld() {
    const tuning = PROFILE_TUNING[this.profile];
    const w = this.width;
    const h = this.height;

    let zMin = Infinity;
    let zMax = -Infinity;
    for (const config of CONTEXT_NODES) {
      const p = placementFor(config, this.profile);
      zMin = Math.min(zMin, p.z);
      zMax = Math.max(zMax, p.z);
    }
    const core = corePlacement(this.profile);
    zMin = Math.min(zMin, core.z);
    zMax = Math.max(zMax, core.z);
    this.zMin = zMin;
    this.zMax = zMax;
    const zSpan = Math.max(1, zMax - zMin);

    this.coreX = (core.x / 100) * w;
    this.coreY = (core.y / 100) * h;
    this.coreZ = core.z * tuning.zScale;

    // Managed mode: the core leaves its static % home for engine space.
    if (this.coreEl) {
      this.coreEl.style.left = "0px";
      this.coreEl.style.top = "0px";
    }

    if (this.corePillEl) {
      this.coreHalfW = this.corePillEl.offsetWidth / 2 || this.coreHalfW;
      this.coreHalfH = this.corePillEl.offsetHeight / 2 || this.coreHalfH;
    }

    for (const config of CONTEXT_NODES) {
      const node = this.nodes.get(config.id);
      if (!node) continue;
      const p = placementFor(config, this.profile);
      node.x0 = (p.x / 100) * w;
      node.y0 = (p.y / 100) * h;
      node.z = p.z * tuning.zScale;
      node.dim = p.dim;
      node.bend = p.bend * tuning.bendScale;
      node.introAt = p.introAt;
      node.lineLayer = p.line;
      node.depthNorm = (node.z - zMin) / zSpan;
      node.halfW = node.el.offsetWidth / 2 || node.halfW;
      node.halfH = node.el.offsetHeight / 2 || node.halfH;

      const line = this.lines.get(config.id);
      if (line) {
        line.layer = p.line;
        line.introAt = Math.max(0.2, p.introAt - 0.22);
        line.hidden = p.line === "none";
        line.path.style.display = line.hidden ? "none" : "";
        line.halo.style.display = line.hidden ? "none" : "";
      }

      // Managed mode: the element leaves its % home for engine space.
      node.el.style.left = "0px";
      node.el.style.top = "0px";
    }

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index];
      const spec = PARTICLES[index];
      const visible = index < tuning.particles;
      particle.el.style.display = visible ? "" : "none";
      if (!visible || !spec) continue;
      particle.x0 = (spec.x / 100) * w;
      particle.y0 = (spec.y / 100) * h;
      particle.depthNorm = (particle.z + 140) / 280;
    }
  }

  /* ---------------- pointer ---------------- */

  setPointer(clientX: number, clientY: number) {
    if (!this.interactive) return;
    if (this.rectDirty) {
      const rect = this.root.getBoundingClientRect();
      this.rectLeft = rect.left;
      this.rectTop = rect.top;
      this.rectDirty = false;
    }
    const lx = clientX - this.rectLeft;
    const ly = clientY - this.rectTop;
    if (
      lx < -90 ||
      ly < -90 ||
      lx > this.width + 90 ||
      ly > this.height + 90
    ) {
      this.pointerInside = false;
      return;
    }
    this.pointerPx = lx;
    this.pointerPy = ly;
    this.pointerNx = clamp((lx / this.width) * 2 - 1, -1, 1);
    this.pointerNy = clamp((ly / this.height) * 2 - 1, -1, 1);
    this.pointerInside = true;
  }

  clearPointer() {
    this.pointerInside = false;
  }

  /**
   * Scrolling moves the scene through the viewport without resizing
   * it — the next pointer event must re-measure before converting
   * client coordinates into scene space.
   */
  invalidateRect() {
    this.rectDirty = true;
  }

  /* ---------------- simulation ---------------- */

  private frame = (now: number) => {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, 1 / 30);
    this.last = now;
    this.time += dt;
    this.writeFrame(dt);
    this.raf = requestAnimationFrame(this.frame);
  };

  /** One full update + DOM write pass. dt = 0 renders a frozen frame. */
  private writeFrame(dt: number) {
    if (this.width <= 0) return;
    const t = this.time;
    const tuning = PROFILE_TUNING[this.profile];

    const introT = this.introBeganAt < 0 ? -1 : t - this.introBeganAt;
    const idleRamp = introT < 0 ? 0 : smoothstep(1.1, 2.6, introT);

    // ---- camera ------------------------------------------------
    const follow = dt > 0 ? 1 - Math.exp(-dt * 5.2) : 1;
    const targetX = this.pointerInside ? this.pointerNx : 0;
    const targetY = this.pointerInside ? this.pointerNy : 0;
    this.cursorX += (targetX - this.cursorX) * follow;
    this.cursorY += (targetY - this.cursorY) * follow;

    // Very slow global wander — the field is never perfectly still.
    const wanderX = Math.sin((t / 23) * TAU) * 0.006 * idleRamp;
    const wanderY = Math.sin((t / 31) * TAU + 1.7) * 0.008 * idleRamp;

    const ry = this.cursorX * tuning.tiltX + wanderY;
    const rx = this.baseTilt - this.cursorY * tuning.tiltY + wanderX;
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);

    const cx = this.width / 2;
    const cy = this.height / 2;
    const persp = this.persp;

    const project = (x: number, y: number, z: number, out: { x: number; y: number; s: number }) => {
      const dx = x - cx;
      const dy = y - cy;
      const x1 = dx * cosY + z * sinY;
      const z1 = z * cosY - dx * sinY;
      const y2 = dy * cosX - z1 * sinX;
      const z2 = dy * sinX + z1 * cosX;
      const s = persp / (persp - z2);
      out.x = cx + x1 * s;
      out.y = cy + y2 * s;
      out.s = s;
    };

    const parallaxFor = (depthNorm: number) => {
      const amp = tuning.parallaxFar + (tuning.parallaxNear - tuning.parallaxFar) * depthNorm;
      return {
        x: this.cursorX * amp,
        y: this.cursorY * amp * 0.66,
      };
    };

    const projected = { x: 0, y: 0, s: 1 };

    // ---- core -------------------------------------------------
    if (this.coreEl) {
      const coreIntro = introT < 0 ? 0 : clamp(introT / 0.62, 0, 1);
      const coreEase = easeOutExpo(coreIntro);
      const coreFloat = idleRamp * tuning.floatScale;
      const fx = Math.sin(t * 0.31 + 0.8) * 1.3 * coreFloat;
      const fy = Math.cos(t * 0.26) * 1.1 * coreFloat;

      project(this.coreX + fx, this.coreY + fy, this.coreZ, projected);

      // The core follows the cursor a touch more than any node.
      const coreDepth = (this.coreZ - this.zMin) / Math.max(1, this.zMax - this.zMin);
      const par = parallaxFor(coreDepth);
      const sx = projected.x + par.x * 1.35;
      const sy = projected.y + par.y * 1.35;
      const scale = projected.s * scaleForZ(this.coreZ) * (0.9 + 0.1 * coreEase);

      this.coreSx = sx;
      this.coreSy = sy;
      this.coreScale = scale;
      this.coreEl.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(4)})`;
      this.coreEl.style.opacity = coreEase.toFixed(3);

      // Heat decays; the CSS overlay eases the visible result.
      if (dt > 0) this.coreHeat *= Math.exp(-dt * 1.45);
      if (Math.abs(this.coreHeat - this.coreHeatWritten) > 0.01) {
        this.coreEl.style.setProperty("--core-heat", this.coreHeat.toFixed(2));
        this.coreHeatWritten = this.coreHeat;
      }
    }

    // ---- nodes -------------------------------------------------
    for (const node of this.nodes.values()) {
      const nodeIntro = introT < 0 ? 0 : clamp((introT - node.introAt) / 0.55, 0, 1);
      const nodeEase = easeOutExpo(nodeIntro);

      const floatAmp = idleRamp * tuning.floatScale;
      const fx =
        (Math.sin(t * node.fw1 + node.fp1) * node.fx1 +
          Math.sin(t * node.fw2 + node.fp2) * node.fx2) *
        floatAmp;
      const fy =
        (Math.cos(t * node.fw3 + node.fp3) * node.fy1 +
          Math.cos(t * node.fw4 + node.fp4) * node.fy2) *
        floatAmp;

      project(node.x0 + fx, node.y0 + fy, node.z, projected);

      const par = parallaxFor(node.depthNorm);
      const sx = projected.x + par.x;
      const sy = projected.y + par.y;
      node.sx = sx;
      node.sy = sy;
      node.scale = projected.s * scaleForZ(node.z) * (0.92 + 0.08 * nodeEase);

      // Proximity — the system is aware of the cursor near a card.
      if (this.interactive && this.pointerInside && dt > 0) {
        const d = Math.hypot(sx - this.pointerPx, sy - this.pointerPy);
        const target = smoothstep(150, 56, d);
        node.near += (target - node.near) * (1 - Math.exp(-dt * 7));
      } else if (dt > 0) {
        node.near += (0 - node.near) * (1 - Math.exp(-dt * 7));
      }

      // Lit state eases toward its target.
      if (dt > 0) {
        const rate = node.litTarget > node.lit ? 4.2 : 1.6;
        node.lit += (node.litTarget - node.lit) * (1 - Math.exp(-dt * rate));
        if (node.releaseAt > 0 && t > node.releaseAt) {
          node.litTarget = 0;
          node.releaseAt = 0;
        }
      }

      const scale = node.scale * (1 + node.near * 0.032 + node.lit * 0.022);
      node.el.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(4)})`;
      node.el.style.opacity = (node.dim * nodeEase).toFixed(3);

      if (Math.abs(node.near - node.nearWritten) > 0.008) {
        node.el.style.setProperty("--near", node.near.toFixed(2));
        node.nearWritten = node.near;
      }
      if (Math.abs(node.lit - node.litWritten) > 0.008) {
        node.el.style.setProperty("--lit", node.lit.toFixed(2));
        node.litWritten = node.lit;
      }

      // Hovering an object asks the network about it.
      if (
        node.near > 0.66 &&
        t > node.cooldownUntil &&
        introT > 1.6 &&
        dt > 0
      ) {
        node.cooldownUntil = t + 3.8;
        this.activateNode(node.id, t, 0.8);
      }
    }

    // ---- connections -------------------------------------------
    const connectionGeometries = new Map<ContextNodeId, ConnectionGeometry>();
    let lineIndex = 0;
    for (const line of this.lines.values()) {
      lineIndex += 1;
      if (line.hidden) continue;
      const node = line.node;

      const ux0 = node.sx - this.coreSx;
      const uy0 = node.sy - this.coreSy;
      const len = Math.hypot(ux0, uy0) || 1;
      const ux = ux0 / len;
      const uy = uy0 / len;

      // Rim-to-rim: from the pill's edge to the card's edge.
      const rCore = ellipseRadius(ux, uy, this.coreHalfW / this.coreScale, this.coreHalfH / this.coreScale, 6);
      const rNode = rectRadius(ux, uy, node.halfW, node.halfH, 5);
      const x1 = this.coreSx + ux * rCore * this.coreScale;
      const y1 = this.coreSy + uy * rCore * this.coreScale;
      const x2 = node.sx - ux * rNode;
      const y2 = node.sy - uy * rNode;

      // Gentle curvature — a cable in space, never a ruler line.
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const segLen = Math.hypot(x2 - x1, y2 - y1) || 1;
      const nx = -(y2 - y1) / segLen;
      const ny = (x2 - x1) / segLen;
      const curveX = mx + nx * node.bend;
      const curveY = my + ny * node.bend;

      // Only re-raster the path when it has visibly moved — at idle the
      // drift is so slow that most frames can leave the SVG untouched.
      if (
        Number.isNaN(line.dx1) ||
        Math.abs(x1 - line.dx1) > 0.2 ||
        Math.abs(y1 - line.dy1) > 0.2 ||
        Math.abs(curveX - line.dcx) > 0.2 ||
        Math.abs(curveY - line.dcy) > 0.2 ||
        Math.abs(x2 - line.dx2) > 0.2 ||
        Math.abs(y2 - line.dy2) > 0.2
      ) {
        const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${curveX.toFixed(2)} ${curveY.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
        line.path.setAttribute("d", d);
        line.halo.setAttribute("d", d);
        line.dx1 = x1;
        line.dy1 = y1;
        line.dcx = curveX;
        line.dcy = curveY;
        line.dx2 = x2;
        line.dy2 = y2;
      }

      connectionGeometries.set(line.id, {
        x1,
        y1,
        cx: curveX,
        cy: curveY,
        x2,
        y2,
        length: segLen,
      });

      // Opacity: depth falloff, slow breathing, activity lift.
      const lineIntro = introT < 0 ? 0 : clamp((introT - line.introAt) / 0.5, 0, 1);
      const depthFade = 0.35 + 0.65 * node.depthNorm;
      const shimmer = 0.9 + 0.1 * Math.sin(t * 0.45 + lineIndex * 2.13) * idleRamp;
      let alpha =
        0.115 * depthFade * node.dim * easeOutExpo(lineIntro) * shimmer;
      alpha += node.lit * 0.34 + node.near * 0.26;
      alpha = clamp(alpha, 0, 0.6);
      if (Math.abs(alpha - line.alpha) > 0.006) {
        line.path.style.strokeOpacity = alpha.toFixed(3);
        line.alpha = alpha;
      }
      const haloAlpha = node.lit * 0.16 + node.near * 0.1;
      if (Math.abs(haloAlpha - line.haloAlpha) > 0.006) {
        line.halo.style.strokeOpacity = haloAlpha.toFixed(3);
        line.haloAlpha = haloAlpha;
      }
    }

    // ---- relationship scheduler ---------------------------------
    this.updateChains(t);
    this.flushPendingSignals(t);

    // ---- signals -------------------------------------------------
    for (const signal of this.signals) {
      if (!signal.active || !signal.line) continue;
      const geometry = connectionGeometries.get(signal.line.id);
      if (!geometry) {
        signal.active = false;
        signal.dot.setAttribute("opacity", "0");
        continue;
      }
      signal.t += dt / signal.duration;
      const life = clamp(signal.t, 0, 1);
      const tt = easeInOut(life);
      const q = 1 - tt;

      // Signals appear at the object, travel to the core — so the
      // curve is evaluated from the node's rim toward the core's rim.
      const sx =
        q * q * geometry.x2 + 2 * q * tt * geometry.cx + tt * tt * geometry.x1;
      const sy =
        q * q * geometry.y2 + 2 * q * tt * geometry.cy + tt * tt * geometry.y1;

      const glow = Math.sin(life * Math.PI);
      signal.dot.setAttribute("cx", sx.toFixed(2));
      signal.dot.setAttribute("cy", sy.toFixed(2));
      signal.dot.setAttribute("r", (1.4 + signal.strength * 0.8 + glow * 0.6).toFixed(2));
      signal.dot.setAttribute("opacity", (glow * 0.85).toFixed(3));

      if (signal.t >= 1) {
        signal.active = false;
        signal.dot.setAttribute("opacity", "0");
        this.coreHeat = Math.min(1, this.coreHeat + 0.6 * signal.strength);
        if (signal.node) {
          signal.node.releaseAt = Math.max(signal.node.releaseAt, t + 0.45);
        }
      }
    }

    // ---- particles ------------------------------------------------
    for (const particle of this.particles) {
      if (particle.el.style.display === "none") continue;
      const angle = (t / particle.period) * TAU + particle.phase;
      const fx = Math.cos(angle) * particle.drift;
      const fy = Math.sin(angle * 0.83) * particle.drift * 0.6;
      const par = parallaxFor(particle.depthNorm);
      const sx = particle.x0 + fx + par.x * 0.55;
      const sy = particle.y0 + fy + par.y * 0.55;
      particle.el.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0)`;
      particle.el.style.opacity = (
        particle.baseOpacity *
        (0.55 + 0.45 * smoothstep(0.3, 1.2, introT < 0 ? 0 : introT))
      ).toFixed(3);
    }

    // ---- ambient layers -------------------------------------------
    if (this.lightEl) {
      const lx = (this.cursorX * 12).toFixed(2);
      const ly = (this.cursorY * 9).toFixed(2);
      this.lightEl.style.transform = `translate3d(calc(-50% + ${lx}px), calc(-50% + ${ly}px), 0)`;
    }
  }

  /* ---------------- relationships ---------------- */

  /**
   * The reasoning loop: now and then the engine picks a relationship
   * chain and walks it in sequence — object lights, signal travels,
   * core answers, next related object. Occasionally two chains
   * overlap (the intelligence processing state).
   */
  private updateChains(t: number) {
    if (this.introBeganAt < 0 || t < this.nextChainAt) {
      this.stepChain(t);
      return;
    }

    if (!this.chain) {
      const pool = this.profile === "mobile" ? MOBILE_CHAINS : CONTEXT_CHAINS;
      this.chain = {
        steps: pool[this.chainCursor % pool.length],
        index: 0,
        nextStepAt: t,
      };
      this.chainCursor += 1;
      this.nextChainAt = Infinity;
    }
    this.stepChain(t);
  }

  private stepChain(t: number) {
    if (!this.chain || t < this.chain.nextStepAt) return;
    const id = this.chain.steps[this.chain.index];
    this.activateNode(id, t, 1);
    this.chain.index += 1;
    this.chain.nextStepAt = t + 1.18 + Math.random() * 0.35;

    if (this.chain.index >= this.chain.steps.length) {
      this.chain = null;
      // Mostly the field rests between chains; occasionally a second
      // chain follows close behind and the core stays warm — the
      // "intelligence processing" moment.
      const quick = Math.random() < 0.3;
      this.nextChainAt = t + (quick ? 1.6 + Math.random() * 1.2 : 4.8 + Math.random() * 3.8);
    }
  }

  /**
   * One object becomes active: it brightens, its connection to the
   * core opens, and a moment later a signal leaves for NEXUS.
   */
  private activateNode(id: ContextNodeId, t: number, strength: number) {
    const node = this.nodes.get(id);
    if (!node) return;
    node.litTarget = 1;
    node.releaseAt = t + 2.4; // safety release
    const line = this.lines.get(id);
    if (!line || line.hidden) return;
    if (this.pendingSignals.length > 5) return;
    this.pendingSignals.push({ at: t + 0.3, id, strength });
  }

  private flushPendingSignals(t: number) {
    for (let i = this.pendingSignals.length - 1; i >= 0; i -= 1) {
      const pending = this.pendingSignals[i];
      if (t < pending.at) continue;
      this.pendingSignals.splice(i, 1);
      this.spawnSignal(pending.id, pending.strength);
    }
  }

  private spawnSignal(id: ContextNodeId, strength: number) {
    const line = this.lines.get(id);
    const node = this.nodes.get(id);
    if (!line || !node || line.hidden) return;
    const slot = this.signals.find((signal) => !signal.active);
    if (!slot) return;
    // Travel time scales with the current visual length.
    const distance = Math.hypot(node.sx - this.coreSx, node.sy - this.coreSy);
    slot.active = true;
    slot.line = line;
    slot.node = node;
    slot.t = 0;
    slot.duration = clamp(distance / 320, 0.62, 1.15);
    slot.strength = strength;
  }
}

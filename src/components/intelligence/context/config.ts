// ============================================================
// NEXUS INTELLIGENCE — CONTEXT NETWORK CONFIGURATION
//
// Every visual decision the "What it sees" scene makes lives here
// as data: what the eight workspace objects are, where each one
// floats in the spatial field, which layer its connection travels
// in, how the assembly (scroll intro) is staged, which relationship
// chains the engine walks when it "reasons", and how each
// responsive profile damps the effect.
//
// Both the React components and the engine read this file. Nothing
// here renders; nothing in the components places a node by hand.
// ============================================================

export type ContextNodeId =
  | "tasks"
  | "projects"
  | "goals"
  | "deadlines"
  | "progress"
  | "dependencies"
  | "activity"
  | "workload";

export type SceneProfile = "desktop" | "tablet" | "mobile";

/** Which spatial layer a connection travels in. */
export type LineLayer = "behind" | "front" | "none";

export interface NodePlacement {
  /** Home position, % of the stage. */
  x: number;
  y: number;
  /** Depth in px. Positive = toward the viewer. */
  z: number;
  /** Resting opacity — atmospheric falloff toward the edges. */
  dim: number;
  /** Depth blur in px. */
  blur: number;
  /** Connection curvature in px (at desktop scale). */
  bend: number;
  /** Spatial layer of the connection to the core. */
  line: LineLayer;
  /** Seconds into the assembly when this node materialises. */
  introAt: number;
}

export interface ContextNodeConfig {
  id: ContextNodeId;
  label: string;
  detail: string;
  /** Lucide icon rendered in the node's tile. */
  icon:
    | "check-square"
    | "folder-kanban"
    | "target"
    | "calendar-clock"
    | "trending-up"
    | "git-branch"
    | "activity"
    | "layers";
  desktop: NodePlacement;
  mobile: NodePlacement;
}

/* ------------------------------------------------------------------
   The workspace objects
   Desktop: controlled asymmetry across three depth layers — nothing
   sits on the same plane as the core.
   Mobile: two quiet columns around the core, connections reduced to
   the four primary corners.
   ------------------------------------------------------------------ */

export const CONTEXT_NODES: ContextNodeConfig[] = [
  {
    id: "tasks",
    label: "Tasks",
    detail: "status, priority, due date",
    icon: "check-square",
    desktop: { x: 19.5, y: 17, z: 70, dim: 1, blur: 0, bend: -18, line: "front", introAt: 0.42 },
    mobile: { x: 25, y: 7, z: 30, dim: 1, blur: 0, bend: -6, line: "front", introAt: 0.42 },
  },
  {
    id: "projects",
    label: "Projects",
    detail: "scope and state",
    icon: "folder-kanban",
    desktop: { x: 49, y: 8.5, z: -5, dim: 0.94, blur: 0.15, bend: -14, line: "front", introAt: 0.5 },
    mobile: { x: 75, y: 7, z: 0, dim: 0.96, blur: 0, bend: -6, line: "front", introAt: 0.5 },
  },
  {
    id: "goals",
    label: "Goals",
    detail: "progress vs. target",
    icon: "target",
    desktop: { x: 79.5, y: 17.5, z: 60, dim: 1, blur: 0, bend: -18, line: "front", introAt: 0.56 },
    mobile: { x: 25, y: 26, z: 30, dim: 1, blur: 0, bend: -5, line: "none", introAt: 0.56 },
  },
  {
    id: "deadlines",
    label: "Deadlines",
    detail: "what is already past",
    icon: "calendar-clock",
    desktop: { x: 10.8, y: 46.5, z: -15, dim: 0.95, blur: 0.15, bend: -10, line: "front", introAt: 0.62 },
    mobile: { x: 75, y: 26, z: -10, dim: 0.94, blur: 0, bend: -5, line: "none", introAt: 0.62 },
  },
  {
    id: "progress",
    label: "Progress",
    detail: "what actually moved",
    icon: "trending-up",
    desktop: { x: 89.2, y: 46.5, z: -15, dim: 0.95, blur: 0.15, bend: -10, line: "front", introAt: 0.68 },
    mobile: { x: 25, y: 66.5, z: -10, dim: 0.94, blur: 0, bend: 5, line: "none", introAt: 0.68 },
  },
  {
    id: "dependencies",
    label: "Dependencies",
    detail: "what blocks what",
    icon: "git-branch",
    desktop: { x: 21.5, y: 79, z: -70, dim: 0.8, blur: 0.45, bend: 20, line: "behind", introAt: 0.74 },
    mobile: { x: 75, y: 66.5, z: -40, dim: 0.8, blur: 0, bend: 5, line: "none", introAt: 0.74 },
  },
  {
    id: "activity",
    label: "Activity",
    detail: "the last real change",
    icon: "activity",
    desktop: { x: 50, y: 83.5, z: 55, dim: 1, blur: 0, bend: 16, line: "front", introAt: 0.8 },
    mobile: { x: 25, y: 87, z: 25, dim: 1, blur: 0, bend: 6, line: "front", introAt: 0.8 },
  },
  {
    id: "workload",
    label: "Workload",
    detail: "what is open right now",
    icon: "layers",
    desktop: { x: 78.5, y: 77.5, z: -75, dim: 0.78, blur: 0.45, bend: 20, line: "behind", introAt: 0.86 },
    mobile: { x: 75, y: 87, z: -45, dim: 0.76, blur: 0, bend: 6, line: "front", introAt: 0.86 },
  },
];

/* ------------------------------------------------------------------
   The intelligence core — kept slightly above the node plane.
   ------------------------------------------------------------------ */

export const CORE_HOME = {
  desktop: { x: 50, y: 46, z: 40 },
  mobile: { x: 50, y: 46, z: 25 },
} as const;

/* ------------------------------------------------------------------
   Relationships — what NEXUS understands, not just sees. Chains are
   walked sequentially by the engine: one object lights, a signal
   travels to the core, then the next related object answers.
   Every consecutive pair is a true edge of RELATIONS.
   ------------------------------------------------------------------ */

export const RELATIONS: Record<ContextNodeId, ContextNodeId[]> = {
  tasks: ["dependencies", "deadlines", "projects"],
  projects: ["tasks", "goals"],
  goals: ["projects", "progress"],
  deadlines: ["tasks", "progress"],
  progress: ["deadlines", "goals", "activity"],
  dependencies: ["tasks", "deadlines"],
  activity: ["progress", "workload"],
  workload: ["tasks", "activity"],
};

export const CONTEXT_CHAINS: ContextNodeId[][] = [
  ["tasks", "dependencies", "deadlines"],
  ["workload", "activity", "progress"],
  ["goals", "projects", "tasks"],
  ["deadlines", "progress", "goals"],
  ["dependencies", "deadlines", "tasks"],
  ["projects", "goals", "progress"],
];

/** Mobile walks shorter chains across the four connected corners. */
export const MOBILE_CHAINS: ContextNodeId[][] = [
  ["projects", "tasks"],
  ["activity", "workload"],
  ["tasks", "activity"],
  ["workload", "tasks"],
];

/* ------------------------------------------------------------------
   Responsive profiles — desktop keeps the full spatial system,
   tablet damps depth and parallax, mobile strips pointer motion
   entirely and keeps only a quiet drift.
   ------------------------------------------------------------------ */

export interface SceneTuning {
  /** Visible atmospheric particles. */
  particles: number;
  /** Cursor-driven scene rotation, radians at full deflection. */
  tiltX: number;
  tiltY: number;
  /** Screen-space parallax in px at the back / front of the field. */
  parallaxFar: number;
  parallaxNear: number;
  /** Multiplier on idle card drift. */
  floatScale: number;
  /** Multiplier on configured depth. */
  zScale: number;
  /** Multiplier on connection curvature. */
  bendScale: number;
}

export const PROFILE_TUNING: Record<SceneProfile, SceneTuning> = {
  desktop: {
    particles: 18,
    tiltX: 0.026,
    tiltY: 0.017,
    parallaxFar: -4,
    parallaxNear: 12.5,
    floatScale: 1,
    zScale: 1,
    bendScale: 1,
  },
  tablet: {
    particles: 12,
    tiltX: 0.014,
    tiltY: 0.01,
    parallaxFar: -2,
    parallaxNear: 6.5,
    floatScale: 0.8,
    zScale: 0.55,
    bendScale: 0.8,
  },
  mobile: {
    particles: 8,
    tiltX: 0,
    tiltY: 0,
    parallaxFar: 0,
    parallaxNear: 0,
    floatScale: 0.5,
    zScale: 0.55,
    bendScale: 1,
  },
};

export const profileForWidth = (width: number): SceneProfile =>
  width < 768 ? "mobile" : width < 1100 ? "tablet" : "desktop";

/* ------------------------------------------------------------------
   Placement resolution
   ------------------------------------------------------------------ */

export function placementFor(
  config: ContextNodeConfig,
  profile: SceneProfile
): NodePlacement {
  if (profile === "mobile") return config.mobile;
  if (profile === "tablet") {
    const d = config.desktop;
    const tuning = PROFILE_TUNING.tablet;
    return {
      ...d,
      z: d.z * tuning.zScale,
      bend: d.bend * tuning.bendScale,
      blur: d.blur * 0.6,
      // Less atmospheric falloff in the reduced space.
      dim: d.dim + (1 - d.dim) * 0.35,
    };
  }
  return config.desktop;
}

export const corePlacement = (profile: SceneProfile) =>
  profile === "mobile" ? CORE_HOME.mobile : CORE_HOME.desktop;

/** Depth → base card scale, keeping back cards quietly smaller. */
export const scaleForZ = (z: number): number => 1 + z / 1500;

/* ------------------------------------------------------------------
   Deterministic helpers — the scene must be identical on the server
   and on the client, so every "random" value is seeded.
   ------------------------------------------------------------------ */

/** mulberry32 — tiny, fast, and identical on every machine. */
export function createRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------
   Atmospheric particles — barely visible, they exist only to sell
   the depth of the space. Rendered statically by the server; the
   engine gently drifts them once live.
   ------------------------------------------------------------------ */

export interface ParticleSpec {
  /** Home position, % of the stage. */
  x: number;
  y: number;
  /** Fake depth for parallax, in px. */
  z: number;
  /** Diameter in px. */
  size: number;
  /** Resting opacity. */
  opacity: number;
  /** Drift amplitude in px. */
  drift: number;
  /** Drift period in seconds. */
  period: number;
  phase: number;
}

export const PARTICLE_COUNT = 18;

export const PARTICLES: ParticleSpec[] = (() => {
  const random = createRandom(0x4e455855); // "NEXU"
  const particles: ParticleSpec[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    particles.push({
      x: 4 + random() * 92,
      y: 3 + random() * 92,
      z: -120 + random() * 260,
      size: 1 + (random() < 0.22 ? 1 : 0) + random() * 0.5,
      opacity: 0.04 + random() * 0.09,
      drift: 8 + random() * 16,
      period: 24 + random() * 22,
      phase: random() * Math.PI * 2,
    });
  }
  return particles;
})();

/* ------------------------------------------------------------------
   Static connection geometry (% of the stage, desktop layout).
   Drawn by the server for the no-JS / pre-hydration / reduced-motion
   fallback. Once the engine is live it replaces these with exact
   pixel-quadratic paths every frame.
   ------------------------------------------------------------------ */

const round2 = (value: number) => Math.round(value * 100) / 100;

export function staticConnectionPath(placement: NodePlacement): string {
  const core = CORE_HOME.desktop;
  const dx = placement.x - core.x;
  const dy = placement.y - core.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;

  // Pull both ends away from the centres so the line reads as
  // travelling from rim to rim rather than through the surfaces.
  const x1 = core.x + ux * 9;
  const y1 = core.y + uy * 4;
  const x2 = placement.x - ux * 7.5;
  const y2 = placement.y - uy * 3.5;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + placement.bend * 0.14;

  return `M ${round2(x1)} ${round2(y1)} Q ${round2(mx)} ${round2(my)} ${round2(x2)} ${round2(y2)}`;
}

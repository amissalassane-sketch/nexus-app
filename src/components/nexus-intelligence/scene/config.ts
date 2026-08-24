// ============================================================
// NEXUS INTELLIGENCE — CONFIGURATION
//
// One resolved profile per device class. Everything tunable about the
// experience lives here: how much geometry exists, how fast it moves,
// where the camera sits, and which interactions are legal.
//
// The numbers are deliberately small. This is a hero background on a
// SaaS landing page, not a demo reel — the target is a full scene in
// ~6 draw calls and a few hundred instances, comfortably inside one
// frame budget on integrated graphics.
// ============================================================

export type IntelligenceProfileName = "desktop" | "tablet" | "mobile";

export interface IntelligenceProfile {
  /* ---- Network ------------------------------------------------ */
  /** Free-floating nodes around the core. */
  nodeCount: number;
  /** Nearest neighbours each node binds to. */
  linkDegree: number;
  /** Hard ceiling on a link length, in world units. */
  maxLinkDistance: number;
  /** Travelling data particles. */
  signalCount: number;
  /** Small nodes riding the outer orbital pathways. */
  orbitalNodeCount: number;
  /** Vertices per orbital pathway ring. */
  ringSegments: number;
  /** Nodes in the core's mid layer. */
  coreNodeCount: number;

  /* ---- Camera ------------------------------------------------- */
  fov: number;
  distance: number;
  /** Camera height above the look-at plane. */
  cameraLift: number;
  /** Look-at height. Raising it pushes the core down the frame. */
  targetLift: number;
  /** Where the core sits horizontally, in normalised device coords
   *  (-1 left edge, +1 right edge). Desktop pushes it clear of the
   *  headline; mobile centres it under the copy. */
  coreOffsetX: number;
  /** Global multiplier on every core radius. */
  coreScale: number;
  /** Maximum camera drift induced by the pointer, in world units. */
  cameraParallax: number;

  /* ---- Rhythm ------------------------------------------------- */
  /** Slow system rotation, radians/second. */
  rotationSpeed: number;
  /** Reasoning cycle interval, seconds, randomised within the range. */
  reasoningInterval: [number, number];
  /** Ambient single-link activation interval, seconds. */
  ambientInterval: [number, number];
  /** Multiplier on signal travel speed. */
  signalSpeed: number;

  /* ---- Rendering ---------------------------------------------- */
  pixelRatioCap: number;
  antialias: boolean;
  /** Pointer interaction is meaningless without a pointer. */
  interactive: boolean;
}

const DESKTOP: IntelligenceProfile = {
  nodeCount: 78,
  linkDegree: 2,
  maxLinkDistance: 2.5,
  signalCount: 24,
  orbitalNodeCount: 7,
  ringSegments: 180,
  coreNodeCount: 26,
  fov: 30,
  distance: 8.6,
  cameraLift: 0.62,
  targetLift: 0,
  coreOffsetX: 0.3,
  coreScale: 1,
  cameraParallax: 0.11,
  rotationSpeed: 0.028,
  reasoningInterval: [5, 9],
  ambientInterval: [2.4, 5],
  signalSpeed: 1,
  pixelRatioCap: 1.75,
  antialias: true,
  interactive: true,
};

const TABLET: IntelligenceProfile = {
  ...DESKTOP,
  nodeCount: 48,
  signalCount: 15,
  orbitalNodeCount: 5,
  ringSegments: 128,
  coreNodeCount: 20,
  fov: 34,
  distance: 9.2,
  cameraLift: 0.55,
  coreOffsetX: 0.16,
  coreScale: 0.94,
  cameraParallax: 0.07,
  rotationSpeed: 0.024,
  reasoningInterval: [6.5, 11],
  ambientInterval: [3.2, 6.5],
  signalSpeed: 0.9,
  pixelRatioCap: 1.5,
};

const MOBILE: IntelligenceProfile = {
  ...TABLET,
  nodeCount: 28,
  signalCount: 9,
  orbitalNodeCount: 4,
  ringSegments: 96,
  coreNodeCount: 16,
  fov: 42,
  distance: 10.6,
  cameraLift: 1.5,
  targetLift: 1.1,
  coreOffsetX: 0,
  coreScale: 0.9,
  cameraParallax: 0,
  rotationSpeed: 0.02,
  reasoningInterval: [8, 14],
  ambientInterval: [4, 8],
  signalSpeed: 0.8,
  pixelRatioCap: 1.5,
  antialias: false,
  interactive: false,
};

const PROFILES: Record<IntelligenceProfileName, IntelligenceProfile> = {
  desktop: DESKTOP,
  tablet: TABLET,
  mobile: MOBILE,
};

export const profileForViewport = (width: number): IntelligenceProfileName =>
  width < 720 ? "mobile" : width < 1180 ? "tablet" : "desktop";

export const resolveProfile = (
  name: IntelligenceProfileName,
  overrides?: Partial<IntelligenceProfile>
): IntelligenceProfile => ({ ...PROFILES[name], ...overrides });

/** Radius of the quiet shell the core occupies; nodes are never placed
 *  inside it, so the core always reads as a separate structure. */
export const CORE_EXCLUSION_RADIUS = 1.95;

/** Outer bound of the network volume. */
export const NETWORK_OUTER_RADIUS = 4.7;

/** Vertical squash of the network volume — the field is a shallow
 *  operational plane, not a ball of confetti. */
export const NETWORK_VERTICAL_SQUASH = 0.58;

/** Total duration of the "coming online" entrance, in seconds. */
export const INTRO_DURATION = 2.5;

/** Radius used to decide whether the pointer is "over" the core, in
 *  normalised device coordinate units. */
export const CORE_HOVER_RADIUS = 0.19;

/** Radius inside which the pointer counts as "near", NDC units. */
export const CORE_NEAR_RADIUS = 0.62;

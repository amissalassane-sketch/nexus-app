// ============================================================
// NEXUS INTELLIGENCE — MATH UTILITIES
//
// Small, dependency-free helpers shared by every scene module.
// Two rules shape this file:
//
//   1. Everything random is seeded. The system must look identical on
//      every load and every device class — no hydration surprise, no
//      "different constellation each refresh".
//   2. Everything that moves is frame-rate independent. `damp` is an
//      exponential approach, never a fixed `+= 0.05` step, so a 120Hz
//      display and a throttled 30Hz tab converge at the same speed.
// ============================================================

export const TAU = Math.PI * 2;

/** Deterministic 32-bit PRNG (mulberry32). Same seed → same world. */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Random = ReturnType<typeof createRandom>;

/** Uniform float in [min, max). */
export const range = (random: Random, min: number, max: number) =>
  min + random() * (max - min);

/** Frame-rate independent exponential approach. */
export const damp = (
  current: number,
  target: number,
  lambda: number,
  dt: number
) => target + (current - target) * Math.exp(-lambda * dt);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

export const clamp01 = (value: number) => clamp(value, 0, 1);

export const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0 || 1));
  return t * t * (3 - 2 * t);
};

/** Normalised progress of `time` inside the window [start, end]. */
export const windowProgress = (
  time: number,
  start: number,
  end: number
): number => smoothstep(start, end, time);

export const easeOutExpo = (t: number) =>
  t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(t));

export const easeOutCubic = (t: number) => {
  const c = clamp01(t) - 1;
  return c * c * c + 1;
};

export const easeInOutSine = (t: number) =>
  -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;

/** sRGB channel → linear channel. Instance colours are written straight
 *  into the renderer's working (linear) space, so perceptual greys have
 *  to be converted here or every node would read far too dim. */
export const srgbToLinear = (value: number) => {
  const v = clamp01(value);
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

/** Symmetric attack/decay envelope — used for every pulse in the scene.
 *  `attack` and `decay` are fractions of the total duration. */
export function pulseEnvelope(t: number, attack = 0.22, decay = 0.78): number {
  const p = clamp01(t);
  if (p === 0) return 0;
  return p < attack
    ? easeOutCubic(p / attack)
    : 1 - easeInOutSine((p - attack) / (1 - attack)) * decay;
}

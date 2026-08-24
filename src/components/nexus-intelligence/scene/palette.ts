// ============================================================
// NEXUS INTELLIGENCE — PALETTE
//
// The scene is monochrome by rule. Everything below is a value from
// the NEXUS V3 token ramp expressed as a hex triplet so the WebGL
// layer can never drift into colour that the design system does not
// own. There is exactly one "cool" value in the whole file — the key
// light — and it is a 4-unit shift toward blue-white, invisible as a
// hue but enough to separate metal from emissive.
// ============================================================

export const PALETTE = {
  /** The void the system sits in. Never lifted, never tinted. */
  void: 0x000000,

  /** Emissive ramp — signals, nodes hearts, line highlights. */
  emissiveHigh: 0xffffff,
  emissive: 0xf5f5f5,
  emissiveSoft: 0xd8d8d8,
  emissiveDim: 0x9a9a9a,

  /** Structural ramp — metal shells, struts, rings, plates. */
  structureLight: 0x555555,
  structureMid: 0x222222,
  structureDark: 0x111111,
  structureDeep: 0x0b0b0b,

  /** Key light. A hair cooler than pure white so lit metal reads as
   *  metal and emissive reads as light. Not a blue. */
  key: 0xf4f6f8,
  /** Rim light. Neutral. */
  rim: 0xffffff,
} as const;

/** Greyscale ramp used to build the environment probe (see engine). */
export const ENV_STOPS: readonly [number, string][] = [
  [0.0, "#050505"],
  [0.34, "#0d0e0f"],
  [0.5, "#1a1c1e"],
  [0.62, "#2a2c2f"],
  [0.72, "#141517"],
  [1.0, "#040404"],
] as const;

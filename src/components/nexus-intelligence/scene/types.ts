// ============================================================
// NEXUS INTELLIGENCE — SHARED SCENE CONTRACTS
//
// Every scene module implements the same three-method shape so the
// engine can drive them uniformly, and none of them owns state that
// React can see. The engine is the only thing that mutates the world.
// ============================================================

import type { IntelligenceChannels } from "./state";

/** Normalised pointer, in NDC (-1..1 on both axes, y up). */
export interface PointerSample {
  x: number;
  y: number;
  /** 0 when far away, 1 when the pointer is on top of the core. */
  proximity: number;
  overCore: boolean;
  /** True when the pointer is inside the viewport at all. */
  active: boolean;
}

export interface FrameContext {
  /** Seconds since the engine started, excluding parked time. */
  time: number;
  /** Seconds since the previous frame, clamped to a sane maximum. */
  dt: number;
  channels: IntelligenceChannels;
  pointer: PointerSample;
  /** Multiplier on every rate, from the resolved profile. */
  motionScale: number;
  reducedMotion: boolean;
}

export interface SceneModule {
  update(ctx: FrameContext): void;
  dispose(): void;
}

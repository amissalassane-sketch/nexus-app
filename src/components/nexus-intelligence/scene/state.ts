// ============================================================
// NEXUS INTELLIGENCE — STATE SYSTEM
//
// The five states from the brief:
//
//   INTRO            the system is coming online
//   IDLE             running, unattended
//   CURSOR_NEAR      the pointer is close; the system notices
//   CURSOR_OVER_CORE the pointer is on the core; activity rises
//   REASONING        an autonomous cycle is executing
//
// INTRO and REASONING are *phases*, the other three are *pointer
// states*: they are orthogonal, so the resolver composes them instead
// of forcing a single enum that would have to snap between values.
//
// Nothing ever assigns a channel directly. Every value the renderer
// reads is produced by easing the current channel toward a target, so
// a state change is a curve, never a step.
// ============================================================

import { clamp01, damp } from "./math";

export type PointerState = "idle" | "near" | "over-core";

export type IntelligencePhase = "intro" | "live";

export type IntelligenceStateName =
  | "INTRO"
  | "IDLE"
  | "CURSOR_NEAR"
  | "CURSOR_OVER_CORE"
  | "REASONING";

/** The continuous quantities every scene module reads each frame.
 *  All are 0..1 unless documented otherwise. */
export interface IntelligenceChannels {
  /** Overall system activity: drives signal rate, node flicker, drift. */
  activity: number;
  /** Core brightness multiplier. */
  luminosity: number;
  /** Link and node visibility in the surrounding network. */
  networkPresence: number;
  /** Internal motion multiplier inside the core. */
  coreMotion: number;
  /** Entrance progress, 0 → 1 across INTRO_DURATION. */
  intro: number;
}

interface ChannelTargets {
  activity: number;
  luminosity: number;
  networkPresence: number;
  coreMotion: number;
}

const TARGETS: Record<PointerState, ChannelTargets> = {
  idle: {
    activity: 0.18,
    luminosity: 0.44,
    networkPresence: 0.6,
    coreMotion: 0.5,
  },
  near: {
    activity: 0.34,
    luminosity: 0.62,
    networkPresence: 0.82,
    coreMotion: 0.7,
  },
  "over-core": {
    activity: 0.56,
    luminosity: 0.88,
    networkPresence: 1,
    coreMotion: 1,
  },
};

/** How much a running reasoning cycle adds on top of the pointer
 *  state. Modulated by the cycle's own envelope upstream. */
export const REASONING_BOOST: ChannelTargets = {
  activity: 0.42,
  luminosity: 0.3,
  networkPresence: 0.22,
  coreMotion: 0.34,
};

/** Easing rates (per second). Slower release than attack so the system
 *  always settles rather than switching off. */
const ATTACK = 3.1;
const RELEASE = 1.9;

export class IntelligenceStateMachine {
  readonly channels: IntelligenceChannels = {
    activity: 0,
    luminosity: 0,
    networkPresence: 0,
    coreMotion: 0,
    intro: 0,
  };

  phase: IntelligencePhase = "intro";
  pointerState: PointerState = "idle";
  /** 0..1 envelope supplied by the reasoning cycle. */
  reasoningEnvelope = 0;

  private readonly target: ChannelTargets = { ...TARGETS.idle };

  /** Jump straight to the settled idle state (reduced motion). */
  settle(): void {
    this.phase = "live";
    this.channels.intro = 1;
    this.pointerState = "idle";
    this.reasoningEnvelope = 0;
    Object.assign(this.channels, TARGETS.idle);
  }

  /** Human-readable state, used for tests and diagnostics. */
  get state(): IntelligenceStateName {
    if (this.phase === "intro") return "INTRO";
    if (this.reasoningEnvelope > 0.35) return "REASONING";
    if (this.pointerState === "over-core") return "CURSOR_OVER_CORE";
    if (this.pointerState === "near") return "CURSOR_NEAR";
    return "IDLE";
  }

  update(dt: number, introProgress: number): void {
    this.channels.intro = introProgress;

    const base = TARGETS[this.pointerState];
    const boost = this.reasoningEnvelope;
    this.target.activity = clamp01(base.activity + REASONING_BOOST.activity * boost);
    this.target.luminosity = clamp01(
      base.luminosity + REASONING_BOOST.luminosity * boost
    );
    this.target.networkPresence = clamp01(
      base.networkPresence + REASONING_BOOST.networkPresence * boost
    );
    this.target.coreMotion = clamp01(
      base.coreMotion + REASONING_BOOST.coreMotion * boost
    );

    const channels = this.channels;
    (Object.keys(this.target) as (keyof ChannelTargets)[]).forEach((key) => {
      const target = this.target[key];
      const rate = target > channels[key] ? ATTACK : RELEASE;
      channels[key] = damp(channels[key], target, rate, dt);
    });

    // The entrance gates everything: a system that is still assembling
    // cannot be idle, near, or reasoning.
    const gate = introProgress;
    channels.activity *= gate;
    channels.luminosity *= gate;
    channels.networkPresence *= gate;
    channels.coreMotion *= gate;
  }
}

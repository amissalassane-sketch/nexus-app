// ============================================================
// NEXUS INTELLIGENCE — WORLD
//
// Everything that simulates, nothing that renders. The world owns the
// core, the network, the signals, the reasoning cycle, the lighting
// and the camera rig, plus the single `step(dt)` that advances them in
// the correct order.
//
// It is deliberately DOM-free and renderer-free: the engine feeds it
// normalised pointer coordinates and a delta time, and it produces a
// scene graph. That separation is what makes the whole behaviour of
// the hero — entrance, idle, proximity, hover, reasoning cycles —
// testable without a GPU.
// ============================================================

import { Group, Vector3, type Texture } from "three";
import { clamp01, createRandom, damp } from "./math";
import {
  CORE_HOVER_RADIUS,
  CORE_NEAR_RADIUS,
  INTRO_DURATION,
  type IntelligenceProfile,
} from "./config";
import { IntelligenceStateMachine, type IntelligenceStateName } from "./state";
import { IntelligenceCamera } from "./intelligence-camera";
import { IntelligenceLighting } from "./intelligence-lighting";
import { IntelligenceCore } from "./intelligence-core";
import { IntelligenceNetwork } from "./intelligence-network";
import { BackgroundField } from "./background-field";
import { DataSignals } from "./data-signal";
import { ReasoningCycle } from "./reasoning-cycle";
import type { FrameContext, PointerSample } from "./types";

export interface IntelligenceWorldOptions {
  profile: IntelligenceProfile;
  glowTexture: Texture;
  reducedMotion?: boolean;
  interactive?: boolean;
  onStateChange?: (state: IntelligenceStateName) => void;
}

export class IntelligenceWorld {
  /** Root transform added to the scene. */
  readonly root = new Group();

  readonly cameraRig: IntelligenceCamera;
  readonly lighting: IntelligenceLighting;
  readonly core: IntelligenceCore;
  readonly network: IntelligenceNetwork;
  readonly signals: DataSignals;
  readonly background: BackgroundField;
  readonly reasoning: ReasoningCycle;

  readonly pointer: PointerSample = {
    x: 0,
    y: 0,
    proximity: 0,
    overCore: false,
    active: false,
  };

  private readonly state = new IntelligenceStateMachine();
  private readonly reducedMotion: boolean;
  private readonly interactive: boolean;
  private readonly onStateChange?: (state: IntelligenceStateName) => void;
  private readonly profile: IntelligenceProfile;

  private elapsed: number;
  private pointerInside = false;
  private lastHoverTrigger = -Infinity;
  private lastStateName: IntelligenceStateName = "INTRO";

  constructor(options: IntelligenceWorldOptions) {
    const { profile, glowTexture } = options;
    this.profile = profile;
    this.reducedMotion = options.reducedMotion ?? false;
    // Both gates have to agree: the caller knows whether a fine pointer
    // exists, the profile knows whether this layout was designed for one.
    this.interactive = (options.interactive ?? true) && profile.interactive;
    this.onStateChange = options.onStateChange;

    const random = createRandom(0x524e43); // "RNC"

    this.cameraRig = new IntelligenceCamera(profile);
    this.lighting = new IntelligenceLighting(this.root);
    this.core = new IntelligenceCore(profile);
    this.core.setGlowTexture(glowTexture);

    this.network = new IntelligenceNetwork(profile);
    this.network.setCamera(this.cameraRig.camera);

    this.signals = new DataSignals({
      nodes: this.network.topology.positions,
      links: this.network.topology.links,
      count: profile.signalCount,
      texture: glowTexture,
      random,
      speedScale: profile.signalSpeed,
    });

    this.background = new BackgroundField(
      Math.round(profile.nodeCount * 0.5),
      glowTexture
    );

    this.reasoning = new ReasoningCycle(
      { network: this.network, core: this.core, signals: this.signals },
      {
        random,
        interval: profile.reasoningInterval,
        ambientInterval: profile.ambientInterval,
      }
    );
    this.reasoning.setEnabled(!this.reducedMotion);

    // Signals live inside the network's transform so their endpoints
    // stay glued to nodes as the field rotates.
    this.network.root.add(this.signals.root);

    this.root.add(this.background.root, this.network.root, this.core.root);

    // Reduced motion starts at the finished state: no entrance, no
    // loop, just the settled system.
    this.elapsed = this.reducedMotion ? INTRO_DURATION : 0;
    if (this.reducedMotion) this.state.settle();
  }

  /** Resize / device-class relayout. */
  layout(width: number, height: number, profile = this.profile): void {
    this.cameraRig.layout(width, height, profile);
    this.network.setCamera(this.cameraRig.camera);
  }

  /** Normalised pointer, in NDC. Fed by the engine from DOM events. */
  setPointer(x: number, y: number, inside: boolean): void {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointerInside = inside;
  }

  get time(): number {
    return this.elapsed;
  }

  getState(): IntelligenceStateName {
    return this.state.state;
  }

  getChannels() {
    return { ...this.state.channels };
  }

  get introProgress(): number {
    return clamp01(this.elapsed / INTRO_DURATION);
  }

  /** Advance the simulation and resolve state. Pure math, no GPU. */
  step(dt: number): FrameContext {
    this.elapsed += dt;
    const introProgress = this.introProgress;
    if (introProgress >= 1 && this.state.phase === "intro") {
      this.state.phase = "live";
    }

    this.resolvePointer(dt);

    // The reasoning envelope has to be known before the state machine
    // resolves its targets, otherwise every cycle runs a frame behind.
    this.reasoning.update(dt);
    this.state.reasoningEnvelope = this.reasoning.envelope;
    this.state.update(dt, introProgress);

    const ctx: FrameContext = {
      time: this.elapsed,
      dt,
      channels: this.state.channels,
      pointer: this.pointer,
      motionScale: 1,
      reducedMotion: this.reducedMotion,
    };

    this.background.update(ctx);
    this.network.update(ctx);
    this.core.update(ctx);
    this.signals.update(ctx, {
      onReachNode: (index, strength) =>
        this.reasoning.handleNodeReached(index, strength),
      onReachCore: (strength) => this.reasoning.handleCoreReached(strength),
      onTraverseLink: (index, strength) =>
        this.network.activateLink(index, strength),
    });
    this.lighting.update(ctx);
    this.cameraRig.update(ctx);

    this.emitState();
    return ctx;
  }

  /** Draw-ready settled frame for reduced motion. Advances nothing. */
  settle(): FrameContext {
    this.elapsed = Math.max(this.elapsed, INTRO_DURATION);
    this.state.settle();
    this.reasoning.setEnabled(false);

    const ctx: FrameContext = {
      time: this.elapsed,
      dt: 0,
      channels: this.state.channels,
      pointer: { x: 0, y: 0, proximity: 0, overCore: false, active: false },
      motionScale: 0,
      reducedMotion: true,
    };

    this.background.update(ctx);
    this.network.update(ctx);
    this.core.update(ctx);
    this.lighting.update(ctx);
    this.cameraRig.update(ctx);
    this.emitState();
    return ctx;
  }

  /** Skip the entrance (used when the device class changes at runtime:
   *  the system is already online, it only changed density). */
  skipIntro(): void {
    this.elapsed = Math.max(this.elapsed, INTRO_DURATION);
  }

  /* ------------------------------------------------------------ */

  private readonly projectedCore = new Vector3();

  private resolvePointer(dt: number): void {
    if (!this.interactive || !this.pointerInside) {
      this.pointer.active = false;
      this.pointer.proximity = damp(this.pointer.proximity, 0, 3.5, dt);
      this.pointer.overCore = false;
      this.applyPointerState();
      return;
    }

    this.pointer.active = true;

    // Distance from the pointer to the core in screen space. Projecting
    // one point is cheaper than raycasting, and it is exactly what
    // "over the core" means to the person looking at it.
    this.projectedCore.set(0, 0, 0).project(this.cameraRig.camera);
    const distance = Math.hypot(
      this.pointer.x - this.projectedCore.x,
      this.pointer.y - this.projectedCore.y
    );

    this.pointer.proximity = damp(
      this.pointer.proximity,
      clamp01(1 - distance / CORE_NEAR_RADIUS),
      5,
      dt
    );
    this.pointer.overCore = distance < CORE_HOVER_RADIUS;

    this.applyPointerState();
  }

  private applyPointerState(): void {
    const previous = this.state.pointerState;
    this.state.pointerState = this.pointer.overCore
      ? "over-core"
      : this.pointer.proximity > 0.12
        ? "near"
        : "idle";

    // Entering the core answers once, and not again for a few seconds,
    // so hovering back and forth cannot pump the system.
    if (
      this.state.pointerState === "over-core" &&
      previous !== "over-core" &&
      this.elapsed - this.lastHoverTrigger > 4
    ) {
      this.lastHoverTrigger = this.elapsed;
      this.reasoning.trigger();
    }
  }

  private emitState(): void {
    const name = this.state.state;
    if (name === this.lastStateName) return;
    this.lastStateName = name;
    this.onStateChange?.(name);
  }

  dispose(): void {
    this.signals.dispose();
    this.background.dispose();
    this.network.dispose();
    this.core.dispose();
    this.lighting.dispose();
    this.cameraRig.dispose();
    this.root.clear();
  }
}

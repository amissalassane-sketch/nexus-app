// ============================================================
// NEXUS INTELLIGENCE — DATA SIGNALS
//
// The particles that carry information through the network. A fixed
// pool — never grown, never allocated per frame — of small additive
// points that travel a straight line between two nodes, or between a
// node and the core.
//
// Three rules keep them from becoming a starfield:
//   • the pool is tiny (9 on mobile, 24 on desktop);
//   • a signal only exists because something asked for it — the
//     reasoning cycle, an ambient activation, or the cursor;
//   • it is drawn as one soft dot with no trail, and it is gone the
//     moment it arrives.
// ============================================================

import {
  AdditiveBlending,
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  Vector3,
  type Texture,
} from "three";
import { PALETTE } from "./palette";
import { clamp01, easeInOutSine, range, srgbToLinear } from "./math";
import type { Link } from "./graph";
import type { FrameContext } from "./types";

const ORIGIN = new Vector3(0, 0, 0);

export type SignalHandlers = {
  /** A signal finished a hop and lit its destination node. */
  onReachNode?: (index: number, strength: number) => void;
  /** A signal reached the intelligence core. */
  onReachCore?: (strength: number) => void;
  /** Called every frame a signal is inside a link, so the link itself
   *  can brighten while the light travels along it. */
  onTraverseLink?: (index: number, strength: number) => void;
};

interface Signal {
  active: boolean;
  from: Vector3;
  to: Vector3;
  t: number;
  duration: number;
  /** Node that lights up on arrival, or -1 when the core is the target. */
  destinationNode: number;
  /** Link being traversed, or -1 for a core hop. */
  linkIndex: number;
  strength: number;
}

export class DataSignals {
  readonly root: Points;

  private readonly geometry: BufferGeometry;
  private readonly material: PointsMaterial;
  private readonly positionAttribute: Float32BufferAttribute;
  private readonly colorAttribute: Float32BufferAttribute;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;

  private readonly signals: Signal[];
  private readonly nodes: readonly Vector3[];
  private readonly links: readonly Link[];
  private readonly random: () => number;
  private readonly speedScale: number;

  constructor(options: {
    nodes: readonly Vector3[];
    links: readonly Link[];
    count: number;
    texture: Texture;
    random: () => number;
    speedScale: number;
  }) {
    const { nodes, links, count, texture, random, speedScale } = options;
    this.nodes = nodes;
    this.links = links;
    this.random = random;
    this.speedScale = speedScale;

    this.signals = Array.from({ length: count }, () => ({
      active: false,
      from: new Vector3(),
      to: new Vector3(),
      t: 0,
      duration: 1,
      destinationNode: -1,
      linkIndex: -1,
      strength: 1,
    }));

    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);

    this.geometry = new BufferGeometry();
    this.positionAttribute = new Float32BufferAttribute(this.positions, 3);
    this.colorAttribute = new Float32BufferAttribute(this.colors, 3);
    this.positionAttribute.setUsage(DynamicDrawUsage);
    this.colorAttribute.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute("position", this.positionAttribute);
    this.geometry.setAttribute("color", this.colorAttribute);
    // The pool is scattered across the whole field; culling it would
    // cost more than it saves.
    this.geometry.boundingSphere = null;

    this.material = new PointsMaterial({
      color: PALETTE.emissiveHigh,
      size: 0.085,
      sizeAttenuation: true,
      map: texture,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    this.root = new Points(this.geometry, this.material);
    this.root.frustumCulled = false;
  }

  get activeCount(): number {
    let total = 0;
    for (const signal of this.signals) if (signal.active) total += 1;
    return total;
  }

  get capacity(): number {
    return this.signals.length;
  }

  /* ------------------------------------------------------------
     Spawning
     ------------------------------------------------------------ */

  private acquire(): Signal | null {
    for (const signal of this.signals) {
      if (!signal.active) return signal;
    }
    return null;
  }

  /** A light travelling along a link.
   *
   *  `destination` names the node the signal must arrive at. Without it
   *  the direction is random — fine for ambient flicker, wrong for a
   *  reasoning cycle, which has already decided where the signal is
   *  going and is waiting on that specific arrival. */
  spawnLink(linkIndex: number, strength = 1, destination?: number): boolean {
    const link = this.links[linkIndex];
    const a = link && this.nodes[link.a];
    const b = link && this.nodes[link.b];
    const signal = this.acquire();
    if (!link || !a || !b || !signal) return false;

    const forward =
      destination === link.b ? true : destination === link.a ? false : this.random() > 0.5;
    signal.active = true;
    signal.from.copy(forward ? a : b);
    signal.to.copy(forward ? b : a);
    signal.destinationNode = forward ? link.b : link.a;
    signal.linkIndex = linkIndex;
    signal.t = 0;
    signal.duration = range(this.random, 1.1, 1.9) / this.speedScale;
    signal.strength = strength;
    return true;
  }

  /** Information converging on the core. */
  spawnToCore(nodeIndex: number, strength = 1): boolean {
    const from = this.nodes[nodeIndex];
    const signal = this.acquire();
    if (!from || !signal) return false;

    signal.active = true;
    signal.from.copy(from);
    signal.to.copy(ORIGIN);
    signal.destinationNode = -1;
    signal.linkIndex = -1;
    signal.t = 0;
    signal.duration = range(this.random, 1.4, 2.3) / this.speedScale;
    signal.strength = strength;
    return true;
  }

  /** A decision travelling back out into the network. */
  spawnFromCore(nodeIndex: number, strength = 1): boolean {
    const to = this.nodes[nodeIndex];
    const signal = this.acquire();
    if (!to || !signal) return false;

    signal.active = true;
    signal.from.copy(ORIGIN);
    signal.to.copy(to);
    signal.destinationNode = nodeIndex;
    signal.linkIndex = -1;
    signal.t = 0;
    signal.duration = range(this.random, 1.3, 2.1) / this.speedScale;
    signal.strength = strength;
    return true;
  }

  /* ------------------------------------------------------------
     Frame
     ------------------------------------------------------------ */

  update({ dt, channels, reducedMotion }: FrameContext, handlers: SignalHandlers): void {
    const visibility = channels.intro;
    let dirty = false;

    for (let i = 0; i < this.signals.length; i += 1) {
      const signal = this.signals[i];
      if (!signal) continue;
      const offset = i * 3;

      if (!signal.active) {
        if (this.colors[offset] !== 0) {
          this.colors[offset] = 0;
          this.colors[offset + 1] = 0;
          this.colors[offset + 2] = 0;
          dirty = true;
        }
        continue;
      }

      dirty = true;
      signal.t += dt / signal.duration;

      if (signal.t >= 1) {
        signal.active = false;
        this.colors[offset] = 0;
        this.colors[offset + 1] = 0;
        this.colors[offset + 2] = 0;

        if (signal.destinationNode >= 0) {
          handlers.onReachNode?.(signal.destinationNode, signal.strength);
        } else {
          handlers.onReachCore?.(signal.strength);
        }
        continue;
      }

      const eased = easeInOutSine(signal.t);
      this.positions[offset] = signal.from.x + (signal.to.x - signal.from.x) * eased;
      this.positions[offset + 1] =
        signal.from.y + (signal.to.y - signal.from.y) * eased;
      this.positions[offset + 2] =
        signal.from.z + (signal.to.z - signal.from.z) * eased;

      // Fade in and out at the ends so a signal never pops into
      // existence in the middle of the frame.
      const envelope =
        Math.min(1, signal.t * 7) * Math.min(1, (1 - signal.t) * 7);
      const brightness = srgbToLinear(
        clamp01(envelope * (0.55 + channels.luminosity * 0.45) * signal.strength) *
          visibility
      );
      this.colors[offset] = brightness;
      this.colors[offset + 1] = brightness;
      this.colors[offset + 2] = brightness;

      if (signal.linkIndex >= 0) {
        handlers.onTraverseLink?.(signal.linkIndex, envelope * 0.6);
      }
    }

    if (dirty) {
      this.positionAttribute.needsUpdate = true;
      this.colorAttribute.needsUpdate = true;
    }

    this.material.opacity = reducedMotion ? 0 : 0.9;
  }

  dispose(): void {
    this.geometry.dispose();
    // The sprite map is shared and owned by the engine.
    this.material.dispose();
  }
}

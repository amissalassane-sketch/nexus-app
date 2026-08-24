// ============================================================
// NEXUS INTELLIGENCE — THE NETWORK
//
// The field of nodes around the core: information, business entities,
// workflows, dependencies, actions, knowledge. It is a real k-nearest
// neighbour graph computed once at startup, not a scatter plot.
//
// Rendering budget: two instanced meshes (metal shells + emissive
// centres) and one LineSegments for every connection. Three draw calls
// for the entire field.
//
// Three things drive it per frame:
//   • the state channels (presence, activity),
//   • pointer proximity, computed in screen space so "nearby" means
//     what the user actually sees as nearby,
//   • per-node and per-link energy written by signals and by the
//     reasoning cycle. Both decay on their own, so nothing ever has to
//     be reset and nothing can get stuck bright.
// ============================================================

import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  SphereGeometry,
  Vector3,
  type Camera,
} from "three";
import { PALETTE } from "./palette";
import {
  clamp01,
  createRandom,
  range,
  srgbToLinear,
  TAU,
} from "./math";
import { buildAdjacency, buildNearestLinks, type Link } from "./graph";
import {
  CORE_EXCLUSION_RADIUS,
  NETWORK_OUTER_RADIUS,
  NETWORK_VERTICAL_SQUASH,
  type IntelligenceProfile,
} from "./config";
import { disposeSubtree } from "./intelligence-core";
import type { FrameContext, SceneModule } from "./types";

const scratchObject = new Object3D();
const scratchWorld = new Vector3();
const scratchNdc = new Vector3();

export interface NetworkTopology {
  positions: Vector3[];
  links: Link[];
  adjacency: number[][];
}

export class IntelligenceNetwork implements SceneModule {
  readonly root = new Group();
  readonly topology: NetworkTopology;

  private readonly shells: InstancedMesh;
  private readonly hearts: InstancedMesh;
  private readonly heartAttribute: InstancedBufferAttribute;
  private readonly heartColors: Float32Array;

  private readonly lines: LineSegments;
  private readonly lineColors: Float32Array;
  private readonly lineAttribute: Float32BufferAttribute;
  private readonly lineMaterial: LineBasicMaterial;

  private readonly nodeEnergy: Float32Array;
  private readonly linkEnergy: Float32Array;
  private readonly nodeRotationSpeed: Float32Array;
  private readonly nodeBaseScale: Float32Array;

  private camera: Camera | null = null;
  private lastLinkBase = -1;

  constructor(profile: IntelligenceProfile) {
    const random = createRandom(0x4e4558); // "NEX"
    const count = profile.nodeCount;

    this.topology = IntelligenceNetwork.buildTopology(
      random,
      count,
      profile.linkDegree,
      profile.maxLinkDistance
    );

    this.nodeEnergy = new Float32Array(count);
    this.nodeRotationSpeed = new Float32Array(count);
    this.nodeBaseScale = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      this.nodeRotationSpeed[i] = range(random, -0.4, 0.4);
      this.nodeBaseScale[i] = range(random, 0.7, 1.35);
    }

    /* ---- nodes ---- */

    const shellGeometry = new OctahedronGeometry(0.05, 0);
    const shellMaterial = new MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.88,
      roughness: 0.34,
      flatShading: true,
      envMapIntensity: 1.3,
      transparent: true,
      opacity: 1,
    });
    this.shells = new InstancedMesh(shellGeometry, shellMaterial, count);
    this.shells.frustumCulled = false;

    const heartGeometry = new SphereGeometry(0.026, 8, 6);
    const heartMaterial = new MeshBasicMaterial({
      color: PALETTE.emissiveHigh,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.hearts = new InstancedMesh(heartGeometry, heartMaterial, count);
    this.hearts.frustumCulled = false;

    this.heartColors = new Float32Array(count * 3);
    this.heartAttribute = new InstancedBufferAttribute(this.heartColors, 3);
    this.hearts.instanceColor = this.heartAttribute;

    this.topology.positions.forEach((position, index) => {
      scratchObject.position.copy(position);
      scratchObject.rotation.set(
        range(random, 0, TAU),
        range(random, 0, TAU),
        range(random, 0, TAU)
      );
      scratchObject.scale.setScalar(this.nodeBaseScale[index] ?? 1);
      scratchObject.updateMatrix();
      this.shells.setMatrixAt(index, scratchObject.matrix);
      this.hearts.setMatrixAt(index, scratchObject.matrix);
    });
    this.shells.instanceMatrix.needsUpdate = true;
    this.hearts.instanceMatrix.needsUpdate = true;

    /* ---- links ---- */

    const { links, positions } = this.topology;
    const linePositions = new Float32Array(links.length * 6);
    this.lineColors = new Float32Array(links.length * 6);
    links.forEach((link, index) => {
      const a = positions[link.a];
      const b = positions[link.b];
      if (!a || !b) return;
      linePositions.set([a.x, a.y, a.z, b.x, b.y, b.z], index * 6);
    });

    const lineGeometry = new BufferGeometry();
    lineGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(linePositions, 3)
    );
    this.lineAttribute = new Float32BufferAttribute(this.lineColors, 3);
    lineGeometry.setAttribute("color", this.lineAttribute);

    this.lineMaterial = new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.lines = new LineSegments(lineGeometry, this.lineMaterial);
    this.lines.frustumCulled = false;

    this.linkEnergy = new Float32Array(links.length);

    this.root.add(this.lines, this.shells, this.hearts);
  }

  /** Deterministic field: a flattened shell with a hard exclusion zone
   *  around the core, biased slightly toward the viewer so the field
   *  has a front rather than being an even ball. */
  static buildTopology(
    random: () => number,
    count: number,
    degree: number,
    maxDistance: number
  ): NetworkTopology {
    const positions: Vector3[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i += 1) {
      // Fibonacci shell with jitter, then pushed outward until it
      // clears the core.
      const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i + range(random, -0.3, 0.3);
      const radius = range(
        random,
        CORE_EXCLUSION_RADIUS,
        NETWORK_OUTER_RADIUS
      );

      const position = new Vector3(
        Math.cos(theta) * ring * radius,
        y * radius * NETWORK_VERTICAL_SQUASH,
        Math.sin(theta) * ring * radius * range(random, 0.82, 1.12)
      );

      // The squash and the depth jitter both pull points toward the
      // origin, so the exclusion shell is re-asserted after they are
      // applied. Without this a node can end up inside the core.
      const length = position.length();
      if (length < CORE_EXCLUSION_RADIUS && length > 1e-6) {
        position.multiplyScalar(CORE_EXCLUSION_RADIUS / length);
      }

      positions.push(position);
    }

    const links = buildNearestLinks(positions, degree, maxDistance);
    return { positions, links, adjacency: buildAdjacency(count, links) };
  }

  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  /* ------------------------------------------------------------
     Reactions
     ------------------------------------------------------------ */

  activateNode(index: number, strength = 1): void {
    if (index < 0 || index >= this.nodeEnergy.length) return;
    this.nodeEnergy[index] = Math.min(1.2, this.nodeEnergy[index] + strength);
  }

  activateLink(index: number, strength = 1): void {
    if (index < 0 || index >= this.linkEnergy.length) return;
    this.linkEnergy[index] = Math.min(1, this.linkEnergy[index] + strength);
  }

  /** Links touching a node — used when a cycle lights a neighbourhood. */
  linksOf(node: number): number[] {
    const result: number[] = [];
    this.topology.links.forEach((link, index) => {
      if (link.a === node || link.b === node) result.push(index);
    });
    return result;
  }

  neighboursOf(node: number): number[] {
    return this.topology.adjacency[node] ?? [];
  }

  get nodeCount(): number {
    return this.nodeEnergy.length;
  }

  get linkCount(): number {
    return this.linkEnergy.length;
  }

  /* ------------------------------------------------------------
     Frame
     ------------------------------------------------------------ */

  update({ time, dt, channels, pointer, motionScale, reducedMotion }: FrameContext): void {
    const { intro, networkPresence, activity, luminosity } = channels;

    if (!reducedMotion) {
      this.root.rotation.y += dt * 0.016 * motionScale * (0.5 + activity);
      this.root.rotation.x = Math.sin(time * 0.13) * 0.02;
    }
    this.root.updateMatrixWorld();

    // Screen-space proximity. Recomputed every frame — 78 projections
    // is well under a hundredth of a millisecond and it is what makes
    // "nearby" match what the user is looking at.
    const proximityRadius = 0.42;
    const camera = this.camera;

    for (let i = 0; i < this.nodeEnergy.length; i += 1) {
      const position = this.topology.positions[i];
      if (!position) continue;

      this.nodeEnergy[i] = Math.max(0, this.nodeEnergy[i] - dt * 0.95);

      let proximityBoost = 0;
      if (pointer.active && camera) {
        scratchWorld.copy(position).applyMatrix4(this.root.matrixWorld);
        scratchNdc.copy(scratchWorld).project(camera);
        const distance = Math.hypot(
          scratchNdc.x - pointer.x,
          scratchNdc.y - pointer.y
        );
        proximityBoost = clamp01(1 - distance / proximityRadius) * 0.5;
      }

      const energy = this.nodeEnergy[i];
      const flicker = reducedMotion
        ? 0
        : (Math.sin(time * 0.9 + i * 1.7) * 0.5 + 0.5) * 0.06 * activity;

      const brightness =
        (0.1 + networkPresence * 0.3 + luminosity * 0.1 + flicker) *
          intro +
        energy * 0.7 +
        proximityBoost * networkPresence;

      const linear = srgbToLinear(clamp01(brightness));
      this.heartColors[i * 3] = linear;
      this.heartColors[i * 3 + 1] = linear;
      this.heartColors[i * 3 + 2] = linear;

      scratchObject.position.copy(position);
      scratchObject.rotation.set(
        time * (this.nodeRotationSpeed[i] ?? 0) * motionScale,
        time * (this.nodeRotationSpeed[i] ?? 0) * 0.6 * motionScale,
        0
      );
      scratchObject.scale.setScalar(
        (this.nodeBaseScale[i] ?? 1) *
          intro *
          (1 + energy * 0.55 + proximityBoost * 0.35)
      );
      scratchObject.updateMatrix();
      this.shells.setMatrixAt(i, scratchObject.matrix);

      scratchObject.scale.setScalar(
        (this.nodeBaseScale[i] ?? 1) *
          intro *
          (0.5 + energy * 1.4 + proximityBoost * 0.6)
      );
      scratchObject.updateMatrix();
      this.hearts.setMatrixAt(i, scratchObject.matrix);
    }

    this.shells.instanceMatrix.needsUpdate = true;
    this.hearts.instanceMatrix.needsUpdate = true;
    this.heartAttribute.needsUpdate = true;

    (this.shells.material as MeshStandardMaterial).opacity = intro;

    /* ---- links ---- */

    const base = (0.028 + networkPresence * 0.062 + luminosity * 0.02) * intro;
    let active = false;

    for (let i = 0; i < this.linkEnergy.length; i += 1) {
      this.linkEnergy[i] = Math.max(0, this.linkEnergy[i] - dt * 1.4);
      if (this.linkEnergy[i] > 0.001) active = true;
    }

    // Repaint the colour buffer only when something actually changed:
    // while a signal is running, or while the resting brightness is
    // still easing. Otherwise this loop is skipped entirely.
    const baseChanged = this.lastLinkBase !== base;
    if (active || baseChanged) {
      for (let i = 0; i < this.linkEnergy.length; i += 1) {
        const value = srgbToLinear(
          clamp01(base + this.linkEnergy[i] * 0.42 * networkPresence)
        );
        const offset = i * 6;
        this.lineColors[offset] = value;
        this.lineColors[offset + 1] = value;
        this.lineColors[offset + 2] = value;
        this.lineColors[offset + 3] = value;
        this.lineColors[offset + 4] = value;
        this.lineColors[offset + 5] = value;
      }
      this.lineAttribute.needsUpdate = true;
      this.lastLinkBase = base;
    }
  }

  dispose(): void {
    disposeSubtree(this.root);
    this.root.clear();
  }
}

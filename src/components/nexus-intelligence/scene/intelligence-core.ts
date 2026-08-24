// ============================================================
// NEXUS INTELLIGENCE — THE CORE
//
// One abstract computational structure at the world origin. It is
// deliberately not a sphere, not a brain and not a logo: it is a
// faceted engine, built from three concentric layers that each do
// something different.
//
//   INNER   a solid faceted mass inside two offset icosahedral cages,
//           joined by radial struts and three stacked compute plates.
//           Dense, opaque, engineered.
//   MID     a shell of small metallic nodes bound by structural lines,
//           plus two thin containment rings. This is the layer that
//           visibly reacts — each node carries an emissive centre that
//           can be driven individually.
//   OUTER   three elliptical orbital pathways on different tilts, each
//           carrying a few travelling nodes. Information in, decisions
//           out.
//
// A translucent glass shell sits between inner and mid: enough to catch
// the key light and give the mass a volume, not enough to look like a
// crystal ball.
//
// Everything is instanced or merged. The core costs ~14 draw calls and
// has no per-frame allocation.
// ============================================================

import {
  AdditiveBlending,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Euler,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { PALETTE } from "./palette";
import {
  clamp01,
  createRandom,
  damp,
  lerp,
  range,
  srgbToLinear,
  TAU,
  windowProgress,
} from "./math";
import { buildNearestLinks } from "./graph";
import type { IntelligenceProfile } from "./config";
import type { Texture } from "three";
import type { FrameContext, SceneModule } from "./types";

/** Radii, in world units, before the profile's coreScale. */
const R = {
  innerSolid: 0.3,
  cageInner: 0.36,
  cageOuter: 0.46,
  glassShell: 0.56,
  midMin: 0.68,
  midMax: 0.98,
  plateInner: 0.2,
  ring: [1.24, 1.42, 1.58],
} as const;

const RING_TILTS: readonly [number, number, number][] = [
  [1.32, 0.24, 0.1],
  [0.42, -0.5, 0.72],
  [-0.94, 0.36, -0.28],
];

const RING_SQUASH = [0.86, 0.94, 0.78] as const;
const RING_SPEED = [0.075, -0.052, 0.041] as const;
const RING_BRIGHTNESS = [0.3, 0.22, 0.16] as const;

/** Entrance windows, in seconds (see INTRO_DURATION). */
const INTRO = {
  heart: [0.4, 0.8],
  cage: [0.8, 1.15],
  midNodes: [1.1, 1.5],
  mass: [1.4, 1.85],
  rings: [1.8, 2.2],
} as const;

const scratchObject = new Object3D();
const scratchPosition = new Vector3();
const scratchQuaternion = new Quaternion();
const UP = new Vector3(0, 1, 0);

/** Release every GPU resource under `root`. Textures are deliberately
 *  left alone: they are shared across modules and owned by the caller. */
export function disposeSubtree(root: Object3D): void {
  root.traverse((object) => {
    const mesh = object as Partial<Mesh> & Partial<InstancedMesh>;
    mesh.geometry?.dispose();

    const material = mesh.material as
      | { dispose(): void }
      | { dispose(): void }[]
      | undefined;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material?.dispose();

    if (mesh.isInstancedMesh) (object as InstancedMesh).dispose();
  });
}

export class IntelligenceCore implements SceneModule {
  /** Parent transform. Everything the core owns lives under here. */
  readonly root = new Group();

  private readonly profile: IntelligenceProfile;

  /* ---- inner ------------------------------------------------ */
  private readonly innerGroup = new Group();
  private readonly cageOuter: LineSegments;
  private readonly cageInner: LineSegments;
  private readonly mass: Mesh;
  private readonly glass: Mesh;
  private readonly heart: Mesh;
  private readonly heartGlow: Points;
  private readonly heartGlowMaterial: PointsMaterial;
  private readonly strutMaterial: MeshStandardMaterial;

  /* ---- mid -------------------------------------------------- */
  private readonly midGroup = new Group();
  private readonly midNodes: InstancedMesh;
  private readonly midHearts: InstancedMesh;
  private readonly midLines: LineSegments;
  private readonly midNodePositions: Vector3[] = [];
  private readonly midRotations: Euler[] = [];
  private readonly midEnergy: Float32Array;
  private readonly midHeartColors: Float32Array;
  private readonly midHeartAttribute: InstancedBufferAttribute;

  /* ---- outer ------------------------------------------------ */
  private readonly outerGroup = new Group();
  private readonly rings: LineLoop[] = [];
  private readonly ringMaterials: LineBasicMaterial[] = [];
  private readonly orbitalNodes: InstancedMesh;
  private readonly orbitalState: {
    ring: number;
    angle: number;
    speed: number;
  }[] = [];

  /* ---- motion ----------------------------------------------- */
  private pulseValue = 0;
  private breath = 0;

  constructor(profile: IntelligenceProfile) {
    this.profile = profile;
    const random = createRandom(0x4e5855); // "NXU"

    /* ================= MATERIALS ================= */

    const metalDark = new MeshStandardMaterial({
      color: PALETTE.structureDark,
      metalness: 0.94,
      roughness: 0.32,
      flatShading: true,
      envMapIntensity: 1.25,
    });

    const metalNode = new MeshStandardMaterial({
      color: 0x1c1c1c,
      metalness: 0.9,
      roughness: 0.28,
      flatShading: true,
      envMapIntensity: 1.4,
    });

    const glass = new MeshStandardMaterial({
      color: 0x2e2e2e,
      metalness: 0.15,
      roughness: 0.16,
      transparent: true,
      opacity: 0.075,
      side: DoubleSide,
      depthWrite: false,
      envMapIntensity: 0.9,
    });

    const heartMaterial = new MeshBasicMaterial({
      color: PALETTE.emissiveHigh,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    this.strutMaterial = metalDark;

    /* ================= INNER LAYER ================= */

    const massGeometry = new IcosahedronGeometry(R.innerSolid, 0);
    this.mass = new Mesh(massGeometry, metalDark);
    // Slightly non-uniform so it never reads as a perfect solid.
    this.mass.scale.set(1, 0.86, 1.08);
    this.innerGroup.add(this.mass);

    const glassGeometry = new IcosahedronGeometry(R.glassShell, 1);
    this.glass = new Mesh(glassGeometry, glass);
    this.innerGroup.add(this.glass);

    this.cageOuter = this.buildCage(R.cageOuter, 0.24, new Euler(0, 0, 0));
    this.cageInner = this.buildCage(
      R.cageInner,
      0.13,
      new Euler(0.42, 0.71, 0.19)
    );
    this.innerGroup.add(this.cageOuter, this.cageInner);

    // Radial struts from the centre to the outer cage vertices — the
    // detail that turns "polyhedron" into "structure".
    const strutGeometry = new CylinderGeometry(0.0055, 0.0055, 1, 5, 1, true);
    strutGeometry.translate(0, 0.5, 0);
    const cageVertices = this.icosahedronVertices(R.cageOuter);
    const struts = new InstancedMesh(
      strutGeometry,
      this.strutMaterial,
      cageVertices.length
    );
    cageVertices.forEach((vertex, index) => {
      scratchQuaternion.setFromUnitVectors(UP, vertex.clone().normalize());
      scratchObject.position.set(0, 0, 0);
      scratchObject.quaternion.copy(scratchQuaternion);
      scratchObject.scale.set(1, vertex.length(), 1);
      scratchObject.updateMatrix();
      struts.setMatrixAt(index, scratchObject.matrix);
    });
    struts.instanceMatrix.needsUpdate = true;
    struts.frustumCulled = false;
    this.innerGroup.add(struts);

    // Three stacked compute plates inside the cage.
    const plateGeometry = new TorusGeometry(0.19, 0.006, 3, 40);
    const plates = new InstancedMesh(plateGeometry, metalDark, 3);
    for (let i = 0; i < 3; i += 1) {
      scratchObject.position.set(0, (i - 1) * 0.11, 0);
      scratchObject.rotation.set(Math.PI / 2 + (i - 1) * 0.16, 0, i * 0.3);
      scratchObject.scale.setScalar(1 - Math.abs(i - 1) * 0.14);
      scratchObject.updateMatrix();
      plates.setMatrixAt(i, scratchObject.matrix);
    }
    plates.instanceMatrix.needsUpdate = true;
    plates.frustumCulled = false;
    this.innerGroup.add(plates);

    // The heart: one bright point plus a soft halo. This is the "tiny
    // point of light" the entrance starts from.
    this.heart = new Mesh(new SphereGeometry(0.05, 12, 10), heartMaterial);
    this.innerGroup.add(this.heart);

    this.heartGlowMaterial = new PointsMaterial({
      color: PALETTE.emissiveHigh,
      size: 0.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const glowGeometry = new BufferGeometry();
    glowGeometry.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0], 3)
    );
    this.heartGlow = new Points(glowGeometry, this.heartGlowMaterial);
    this.heartGlow.frustumCulled = false;
    this.innerGroup.add(this.heartGlow);

    /* ================= MID LAYER ================= */

    const nodeCount = profile.coreNodeCount;
    this.midNodePositions = this.scatterShell(
      random,
      nodeCount,
      R.midMin,
      R.midMax,
      0.84
    );
    this.midEnergy = new Float32Array(nodeCount);

    const nodeGeometry = new OctahedronGeometry(0.042, 0);
    this.midNodes = new InstancedMesh(nodeGeometry, metalNode, nodeCount);
    this.midNodes.frustumCulled = false;

    const heartGeometry = new SphereGeometry(0.017, 8, 6);
    const heartInstancedMaterial = new MeshBasicMaterial({
      color: PALETTE.emissiveHigh,
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.midHearts = new InstancedMesh(
      heartGeometry,
      heartInstancedMaterial,
      nodeCount
    );
    this.midHearts.frustumCulled = false;

    this.midHeartColors = new Float32Array(nodeCount * 3);
    this.midRotations = [];
    this.midNodePositions.forEach((position, index) => {
      const rotation = new Euler(
        range(random, 0, TAU),
        range(random, 0, TAU),
        range(random, 0, TAU)
      );
      this.midRotations.push(rotation);

      scratchObject.position.copy(position);
      scratchObject.rotation.copy(rotation);
      scratchObject.scale.setScalar(1);
      scratchObject.updateMatrix();
      this.midNodes.setMatrixAt(index, scratchObject.matrix);
      this.midHearts.setMatrixAt(index, scratchObject.matrix);
    });
    this.midNodes.instanceMatrix.needsUpdate = true;
    this.midHearts.instanceMatrix.needsUpdate = true;

    this.midHeartAttribute = new InstancedBufferAttribute(
      this.midHeartColors,
      3
    );
    this.midHearts.instanceColor = this.midHeartAttribute;

    const midLinks = buildNearestLinks(this.midNodePositions, 2, 0.72);
    const linePositions = new Float32Array(midLinks.length * 6);
    midLinks.forEach((link, index) => {
      const a = this.midNodePositions[link.a];
      const b = this.midNodePositions[link.b];
      if (!a || !b) return;
      linePositions.set([a.x, a.y, a.z, b.x, b.y, b.z], index * 6);
    });
    const midLineGeometry = new BufferGeometry();
    midLineGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(linePositions, 3)
    );
    const midLineMaterial = new LineBasicMaterial({
      color: PALETTE.emissiveSoft,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.midLines = new LineSegments(midLineGeometry, midLineMaterial);
    this.midLines.frustumCulled = false;

    // Two thin containment rings, offset from each other.
    const containmentGeometry = new TorusGeometry(0.82, 0.004, 3, 96);
    const containment = new InstancedMesh(containmentGeometry, metalNode, 2);
    for (let i = 0; i < 2; i += 1) {
      scratchObject.position.set(0, 0, 0);
      scratchObject.rotation.set(
        i === 0 ? Math.PI / 2.35 : Math.PI / 1.7,
        i === 0 ? 0.22 : -0.44,
        i === 0 ? 0 : 0.5
      );
      scratchObject.scale.setScalar(i === 0 ? 1 : 1.24);
      scratchObject.updateMatrix();
      containment.setMatrixAt(i, scratchObject.matrix);
    }
    containment.instanceMatrix.needsUpdate = true;
    containment.frustumCulled = false;

    this.midGroup.add(this.midLines, this.midNodes, this.midHearts, containment);

    /* ================= OUTER LAYER ================= */

    for (let i = 0; i < 3; i += 1) {
      const tilt = RING_TILTS[i] ?? [0, 0, 0];
      const radius = R.ring[i] ?? 1.3;
      const squash = RING_SQUASH[i] ?? 1;
      const segments = profile.ringSegments;

      const positions = new Float32Array((segments + 1) * 3);
      for (let s = 0; s <= segments; s += 1) {
        const angle = (s / segments) * TAU;
        positions[s * 3] = Math.cos(angle) * radius;
        positions[s * 3 + 1] = 0;
        positions[s * 3 + 2] = Math.sin(angle) * radius * squash;
      }

      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));

      const material = new LineBasicMaterial({
        color: PALETTE.emissiveSoft,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const ring = new LineLoop(geometry, material);
      ring.rotation.set(tilt[0], tilt[1], tilt[2]);
      ring.frustumCulled = false;

      this.rings.push(ring);
      this.ringMaterials.push(material);
      this.outerGroup.add(ring);
    }

    // Travelling nodes on the pathways. One instanced mesh; positions
    // are computed against each ring's current orientation.
    const orbitalGeometry = new OctahedronGeometry(0.036, 0);
    this.orbitalNodes = new InstancedMesh(
      orbitalGeometry,
      metalNode,
      profile.orbitalNodeCount
    );
    this.orbitalNodes.frustumCulled = false;
    for (let i = 0; i < profile.orbitalNodeCount; i += 1) {
      this.orbitalState.push({
        ring: i % 3,
        angle: range(random, 0, TAU),
        speed: range(random, 0.12, 0.26) * (i % 2 === 0 ? 1 : -1),
      });
    }
    this.outerGroup.add(this.orbitalNodes);

    /* ================= ASSEMBLY ================= */

    // A slight global tilt keeps the composition asymmetric without
    // making it look accidental.
    this.midGroup.rotation.set(0.14, 0, -0.09);
    this.outerGroup.rotation.set(-0.08, 0.2, 0.05);

    this.root.add(this.innerGroup, this.midGroup, this.outerGroup);
    this.root.rotation.set(0.1, -0.24, 0);

  }

  /** Shared soft-dot sprite, injected by the engine. */
  setGlowTexture(texture: Texture | null): void {
    this.heartGlowMaterial.map = texture;
    this.heartGlowMaterial.needsUpdate = true;
  }

  /* ------------------------------------------------------------
     Public reactions
     ------------------------------------------------------------ */

  /** A brief luminous response. `strength` is 0..1. */
  pulse(strength = 1): void {
    this.pulseValue = Math.min(1.25, this.pulseValue + strength);
  }

  /** Drive one mid-layer node's emissive centre. */
  activateNode(index: number, strength = 1): void {
    if (index < 0 || index >= this.midEnergy.length) return;
    this.midEnergy[index] = Math.min(1, this.midEnergy[index] + strength);
  }

  /** Light a handful of mid-layer nodes, as a reasoning cycle does. */
  activateCluster(count: number, random: () => number): void {
    const total = this.midEnergy.length;
    for (let i = 0; i < count; i += 1) {
      this.activateNode(Math.floor(random() * total), range(random, 0.5, 1));
    }
  }

  get nodeCount(): number {
    return this.midEnergy.length;
  }

  /* ------------------------------------------------------------
     Frame
     ------------------------------------------------------------ */

  update({ time, dt, channels, motionScale, reducedMotion }: FrameContext): void {
    const { intro, luminosity, coreMotion, activity } = channels;
    const motion = reducedMotion ? 0 : coreMotion * motionScale;

    // The pulse decays on its own; nothing has to reset it.
    this.pulseValue = damp(this.pulseValue, 0, 2.4, dt);
    const pulse = clamp01(this.pulseValue);

    /* ---- entrance ---- */
    const heartIn = windowProgress(time, INTRO.heart[0], INTRO.heart[1]);
    const cageIn = windowProgress(time, INTRO.cage[0], INTRO.cage[1]);
    const nodesIn = windowProgress(time, INTRO.midNodes[0], INTRO.midNodes[1]);
    const massIn = windowProgress(time, INTRO.mass[0], INTRO.mass[1]);
    const ringsIn = windowProgress(time, INTRO.rings[0], INTRO.rings[1]);

    /* ---- breath + rotation ---- */
    this.breath = damp(
      this.breath,
      reducedMotion ? 0 : Math.sin(time * 0.42) * 0.008 + pulse * 0.012,
      4,
      dt
    );
    const scale = this.profile.coreScale * (1 + this.breath);
    this.root.scale.setScalar(scale);

    this.root.rotation.y += dt * this.profile.rotationSpeed * motion * 1.6;
    this.innerGroup.rotation.y -= dt * 0.055 * motion;
    this.innerGroup.rotation.x += dt * 0.012 * motion;
    this.midGroup.rotation.y += dt * 0.031 * motion;
    this.outerGroup.rotation.y -= dt * 0.019 * motion;
    this.outerGroup.rotation.z += dt * 0.006 * motion;

    /* ---- inner ---- */
    const massOpacity = massIn;
    this.mass.visible = massOpacity > 0.001;
    this.mass.scale.set(massOpacity, 0.86 * massOpacity, 1.08 * massOpacity);
    this.glass.visible = massOpacity > 0.001;
    this.glass.scale.setScalar(lerp(0.72, 1, massOpacity));
    (this.glass.material as MeshStandardMaterial).opacity = 0.075 * massOpacity;

    this.cageOuter.scale.setScalar(lerp(0.86, 1, cageIn));
    this.cageInner.scale.setScalar(lerp(0.8, 1, cageIn));
    const cageCount = this.cageOuter.geometry.getAttribute("position").count;
    const drawn = Math.floor((cageCount / 2) * cageIn) * 2;
    this.cageOuter.geometry.setDrawRange(0, drawn);
    this.cageInner.geometry.setDrawRange(
      0,
      Math.floor((cageCount / 2) * cageIn * 0.8) * 2
    );
    (this.cageOuter.material as LineBasicMaterial).opacity =
      (0.24 + pulse * 0.16 + luminosity * 0.1) * intro;
    (this.cageInner.material as LineBasicMaterial).opacity =
      0.13 * intro * (0.6 + luminosity * 0.4);

    // Heart: the first thing to appear, the last to dim.
    const heartBrightness =
      heartIn * (0.4 + luminosity * 0.5 + pulse * 0.7 + activity * 0.12);
    (this.heart.material as MeshBasicMaterial).opacity = Math.min(
      1,
      heartBrightness
    );
    this.heart.scale.setScalar(
      lerp(0.4, 1, heartIn) * (1 + pulse * 0.55 + luminosity * 0.14)
    );
    this.heartGlowMaterial.opacity = Math.min(0.85, heartBrightness * 0.8);
    this.heartGlowMaterial.size =
      (0.42 + pulse * 0.5 + luminosity * 0.18) * lerp(0.3, 1, heartIn);

    /* ---- mid ---- */
    (this.midLines.material as LineBasicMaterial).opacity =
      (0.06 + luminosity * 0.1 + pulse * 0.08) * nodesIn;

    const nodeBase = 0.3 + luminosity * 0.45 + activity * 0.15;
    for (let i = 0; i < this.midEnergy.length; i += 1) {
      const energy = (this.midEnergy[i] = Math.max(
        0,
        this.midEnergy[i] - dt * 1.15
      ));
      const brightness = clamp01(nodeBase + energy * 0.85) * nodesIn;
      const linear = srgbToLinear(brightness);
      this.midHeartColors[i * 3] = linear;
      this.midHeartColors[i * 3 + 1] = linear;
      this.midHeartColors[i * 3 + 2] = linear;

      const position = this.midNodePositions[i];
      const rotation = this.midRotations[i];
      if (!position || !rotation) continue;

      scratchObject.position.copy(position);
      scratchObject.rotation.copy(rotation);
      scratchObject.scale.setScalar(nodesIn * (1 + energy * 0.7));
      scratchObject.updateMatrix();
      this.midNodes.setMatrixAt(i, scratchObject.matrix);

      scratchObject.scale.setScalar(nodesIn * (1 + energy * 1.6));
      scratchObject.updateMatrix();
      this.midHearts.setMatrixAt(i, scratchObject.matrix);
    }
    this.midNodes.instanceMatrix.needsUpdate = true;
    this.midHearts.instanceMatrix.needsUpdate = true;
    this.midHeartAttribute.needsUpdate = true;

    /* ---- outer ---- */
    for (let i = 0; i < this.rings.length; i += 1) {
      const material = this.ringMaterials[i];
      if (material) {
        material.opacity =
          (RING_BRIGHTNESS[i] ?? 0.2) *
          ringsIn *
          (0.5 + luminosity * 0.5 + pulse * 0.35);
      }
      const ring = this.rings[i];
      if (ring) ring.rotation.y += dt * RING_SPEED[i]! * motion * 2.2;
    }

    for (let i = 0; i < this.orbitalState.length; i += 1) {
      const state = this.orbitalState[i];
      if (!state) continue;
      state.angle += dt * state.speed * (0.4 + motion * 1.4);

      const ring = this.rings[state.ring];
      if (!ring) continue;
      const radius = R.ring[state.ring] ?? 1.3;
      const squash = RING_SQUASH[state.ring] ?? 1;

      scratchPosition.set(
        Math.cos(state.angle) * radius,
        0,
        Math.sin(state.angle) * radius * squash
      );
      scratchPosition.applyQuaternion(ring.quaternion);

      scratchObject.position.copy(scratchPosition);
      scratchObject.rotation.set(state.angle * 2, state.angle, 0);
      scratchObject.scale.setScalar(ringsIn * (0.85 + pulse * 0.4));
      scratchObject.updateMatrix();
      this.orbitalNodes.setMatrixAt(i, scratchObject.matrix);
    }
    this.orbitalNodes.instanceMatrix.needsUpdate = true;
  }

  /* ------------------------------------------------------------
     Builders
     ------------------------------------------------------------ */

  private buildCage(
    radius: number,
    opacity: number,
    rotation: Euler
  ): LineSegments {
    const source = new IcosahedronGeometry(radius, 0);
    const geometry = new EdgesGeometry(source, 1);
    source.dispose();
    const material = new LineBasicMaterial({
      color: PALETTE.emissive,
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const lines = new LineSegments(geometry, material);
    lines.rotation.copy(rotation);
    lines.frustumCulled = false;
    return lines;
  }

  /** The 12 vertices of a base icosahedron, used for strut placement. */
  private icosahedronVertices(radius: number): Vector3[] {
    const geometry = new IcosahedronGeometry(radius, 0);
    const attribute = geometry.getAttribute("position");
    const seen = new Map<string, Vector3>();
    for (let i = 0; i < attribute.count; i += 1) {
      const x = attribute.getX(i);
      const y = attribute.getY(i);
      const z = attribute.getZ(i);
      const key = `${x.toFixed(4)}|${y.toFixed(4)}|${z.toFixed(4)}`;
      if (!seen.has(key)) seen.set(key, new Vector3(x, y, z));
    }
    geometry.dispose();
    return [...seen.values()];
  }

  private scatterShell(
    random: () => number,
    count: number,
    min: number,
    max: number,
    squash: number
  ): Vector3[] {
    const points: Vector3[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i += 1) {
      const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
      const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i + range(random, -0.18, 0.18);
      const radius = range(random, min, max);
      points.push(
        new Vector3(
          Math.cos(theta) * ringRadius * radius,
          y * radius * squash,
          Math.sin(theta) * ringRadius * radius
        )
      );
    }
    return points;
  }

  dispose(): void {
    // Traversal rather than a hand-maintained list: anything added to the
    // graph is released, and shared materials surviving a second
    // `dispose()` is a no-op in Three.js.
    disposeSubtree(this.root);
    this.root.clear();
  }
}

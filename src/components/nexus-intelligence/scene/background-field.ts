// ============================================================
// NEXUS INTELLIGENCE — BACKGROUND FIELD
//
// The furthest depth layer. A few dozen points, far away, very dim,
// drifting almost imperceptibly. Their only job is to stop the void
// behind the network from looking like an empty CSS background — the
// scene needs *some* depth cue, and this is the cheapest one that is
// not a starfield.
//
// One draw call. No per-frame allocation.
// ============================================================

import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  type Texture,
} from "three";
import { PALETTE } from "./palette";
import { createRandom, range, srgbToLinear, TAU } from "./math";
import type { FrameContext, SceneModule } from "./types";

export class BackgroundField implements SceneModule {
  readonly root: Points;

  private readonly geometry: BufferGeometry;
  private readonly material: PointsMaterial;
  private readonly count: number;

  constructor(count: number, texture: Texture) {
    const random = createRandom(0x424744); // "BGD"
    this.count = count;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const angle = range(random, 0, TAU);
      const radius = range(random, 5.4, 11);
      const height = range(random, -3.4, 3.4);

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius - 3;

      // Barely there. Anything brighter and this becomes decoration.
      const value = srgbToLinear(range(random, 0.06, 0.17));
      colors[i * 3] = value;
      colors[i * 3 + 1] = value;
      colors[i * 3 + 2] = value;
    }

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

    this.material = new PointsMaterial({
      color: PALETTE.emissiveSoft,
      size: 0.07,
      sizeAttenuation: true,
      map: texture,
      transparent: true,
      opacity: 0,
      vertexColors: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    this.root = new Points(this.geometry, this.material);
    this.root.frustumCulled = false;
  }

  update({ dt, channels, reducedMotion }: FrameContext): void {
    this.material.opacity = channels.intro * 0.75;
    if (!reducedMotion) this.root.rotation.y += dt * 0.004;
  }

  dispose(): void {
    this.geometry.dispose();
    // The sprite map is shared and owned by the engine.
    this.material.dispose();
  }
}

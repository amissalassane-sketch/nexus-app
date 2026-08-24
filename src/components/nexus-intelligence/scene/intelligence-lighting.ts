// ============================================================
// NEXUS INTELLIGENCE — LIGHTING
//
// The scene emerges from darkness, so almost everything here is off.
// Three sources, no shadows, no visible fixtures:
//
//   key  — cool white from above-left-front. It is the only light
//          strong enough to describe a surface.
//   rim  — neutral from behind-right. Separates metal from the void
//          without ever becoming a visible edge.
//   core — a point light inside the intelligence core. It is the one
//          light that responds to the system's state, which is what
//          makes the core read as the source of illumination rather
//          than an object being lit.
//
// Plus a very low ambient so geometry never crushes to pure black.
// Shadows are never enabled: at this scale they cost a full extra pass
// and would be invisible anyway.
// ============================================================

import {
  AmbientLight,
  DirectionalLight,
  PointLight,
  type Object3D,
} from "three";
import { PALETTE } from "./palette";
import { damp } from "./math";
import type { FrameContext, SceneModule } from "./types";

export class IntelligenceLighting implements SceneModule {
  readonly ambient: AmbientLight;
  readonly key: DirectionalLight;
  readonly rim: DirectionalLight;
  readonly core: PointLight;

  private readonly baseCoreIntensity: number;

  constructor(parent: Object3D) {
    this.ambient = new AmbientLight(PALETTE.emissiveDim, 0.16);

    this.key = new DirectionalLight(PALETTE.key, 0.62);
    this.key.position.set(-3.4, 4.2, 5.1);

    this.rim = new DirectionalLight(PALETTE.rim, 0.34);
    this.rim.position.set(4.6, -1.6, -4.4);

    // Sits at the origin, i.e. inside the core. Range is short on
    // purpose: it should light the inner cage and nothing else.
    this.baseCoreIntensity = 1.5;
    this.core = new PointLight(PALETTE.emissive, this.baseCoreIntensity, 5.4, 2);
    this.core.position.set(0, 0, 0);

    parent.add(this.ambient, this.key, this.rim, this.core);
  }

  update({ channels, pointer, dt }: FrameContext): void {
    const { luminosity, intro, activity } = channels;

    // The core light tracks luminosity, with a small pointer-linked
    // lift so the scene brightens *slightly* as the cursor approaches.
    const pointerLift = pointer.active ? pointer.proximity * 0.16 : 0;
    const target =
      this.baseCoreIntensity *
      intro *
      (0.55 + luminosity * 0.75 + pointerLift + activity * 0.12);

    this.core.intensity = damp(this.core.intensity, target, 4.2, dt);

    // Key and rim fade in with the entrance and otherwise stay put —
    // moving lights read as a lighting rig, which is exactly what this
    // must not look like.
    const structural = 0.35 + luminosity * 0.3 + intro * 0.35;
    this.key.intensity = damp(this.key.intensity, 0.62 * structural, 2.4, dt);
    this.rim.intensity = damp(this.rim.intensity, 0.34 * structural, 2.4, dt);
    this.ambient.intensity = damp(this.ambient.intensity, 0.16 * intro, 2.4, dt);
  }

  dispose(): void {
    this.ambient.dispose();
    this.key.dispose();
    this.rim.dispose();
    this.core.dispose();
  }
}

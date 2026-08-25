// ============================================================
// NEXUS INTELLIGENCE — CAMERA
//
// A cinematic perspective camera that is, by design, almost static.
// It sits slightly above the core and in front of it, at a focal
// length long enough (fov 30–42) to avoid perspective distortion, so
// the structure reads as an object rather than a wide-angle effect.
//
// Two things move it:
//   • the responsive layout, which slides the camera laterally so the
//     core lands clear of the headline on desktop and below the copy
//     on mobile;
//   • a sub-tenth-of-a-unit parallax from the pointer.
//
// It never orbits. An orbiting camera turns a product surface into a
// screensaver.
// ============================================================

import { PerspectiveCamera, Vector3 } from "three";
import { damp } from "./math";
import type { IntelligenceProfile } from "./config";
import type { FrameContext, SceneModule } from "./types";

export class IntelligenceCamera implements SceneModule {
  readonly camera: PerspectiveCamera;

  private readonly base = new Vector3();
  private readonly lookAt = new Vector3();
  private readonly drift = new Vector3();
  private readonly driftTarget = new Vector3();

  private profile: IntelligenceProfile;
  private halfWidth = 1;

  constructor(profile: IntelligenceProfile) {
    this.profile = profile;
    this.camera = new PerspectiveCamera(profile.fov, 16 / 9, 0.1, 60);
    this.layout(1440, 900);
  }

  /** Recompute the resting position for a viewport size. Called on
   *  resize and whenever the device class changes. */
  layout(width: number, height: number, profile = this.profile): void {
    this.profile = profile;
    const { camera } = this;

    camera.fov = profile.fov;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();

    // Half the visible width at the plane the core sits on.
    const halfHeight =
      Math.tan((profile.fov * Math.PI) / 360) * profile.distance;
    this.halfWidth = halfHeight * camera.aspect;

    // Slide the camera (and its target) left so the core — which lives
    // at the world origin — renders right of centre.
    const offsetX = -profile.coreOffsetX * this.halfWidth;

    this.base.set(offsetX, profile.targetLift + profile.cameraLift, profile.distance);
    this.lookAt.set(offsetX, profile.targetLift, 0);

    camera.position.copy(this.base);
    camera.lookAt(this.lookAt);
    // Keep the projection matrices valid outside the render loop: both
    // the network and the pointer resolver project points against this
    // camera before the frame is drawn. `Camera.updateMatrixWorld`
    // refreshes `matrixWorldInverse` as part of the same call.
    camera.updateMatrixWorld();
  }

  update({ pointer, dt, motionScale, time, reducedMotion }: FrameContext): void {
    const parallax = this.profile.cameraParallax;

    this.driftTarget.set(
      pointer.active ? -pointer.x * parallax : 0,
      pointer.active ? -pointer.y * parallax * 0.6 : 0,
      0
    );

    this.drift.x = damp(this.drift.x, this.driftTarget.x, 2.6, dt);
    this.drift.y = damp(this.drift.y, this.driftTarget.y, 2.6, dt);

    // A very slow autonomous breathing (~20s and ~37s periods) keeps
    // the scene alive with no pointer at all — a fraction of the
    // parallax the pointer itself is allowed to produce, and fully
    // parked under reduced motion.
    const idle = reducedMotion ? 0 : 1;
    const breatheX = Math.sin(time * 0.17 + 1.7) * 0.03 * idle;
    const breatheY = Math.sin(time * 0.31) * 0.045 * idle;

    this.camera.position.set(
      this.base.x + this.drift.x + breatheX,
      this.base.y + this.drift.y + breatheY,
      this.base.z
    );
    // Looking at a point that drifts a fraction of the camera drift is
    // what produces the sense of the scene being *observed* rather
    // than translated.
    this.camera.lookAt(
      this.lookAt.x + (this.drift.x + breatheX) * 0.4,
      this.lookAt.y + (this.drift.y + breatheY) * 0.4,
      0
    );
    this.camera.updateMatrixWorld();

    void motionScale;
  }

  /** Half visible width at the core plane, in world units. */
  get visibleHalfWidth(): number {
    return this.halfWidth;
  }

  dispose(): void {
    // Nothing to release: the camera owns no GPU resources.
  }
}

// ============================================================
// NEXUS INTELLIGENCE — PROCEDURAL TEXTURES
//
// Nothing in this scene is downloaded. Two tiny canvases, generated
// once, give the system the two things it cannot get from geometry
// alone: soft light without a bloom pass, and metal that reflects
// something other than the void.
// ============================================================

import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  PMREMGenerator,
  SRGBColorSpace,
  type Texture,
  type WebGLRenderer,
} from "three";
import { ENV_STOPS } from "./palette";

/** A radial falloff used for every emissive dot in the scene. Drawing
 *  it once is dramatically cheaper than a post-processing bloom, and
 *  it keeps highlights from clipping into the "glowing orb" look. */
export function createSoftDotTexture(size = 64): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.18, "rgba(255,255,255,0.72)");
    gradient.addColorStop(0.42, "rgba(255,255,255,0.20)");
    gradient.addColorStop(0.72, "rgba(255,255,255,0.04)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * A greyscale environment probe.
 *
 * Dark metal is unreadable against a black background unless it has
 * something to reflect. Rather than load an HDR, a 128×64 vertical
 * ramp is prefiltered through PMREM once at startup: metals pick up a
 * faint gradient across their facets and stop looking like flat black
 * polygons, while staying far away from mirror-like.
 *
 * Returns the prefiltered cube target; the caller owns disposal.
 */
export function createEnvironmentProbe(
  renderer: WebGLRenderer
): { texture: Texture; dispose: () => void } {
  const width = 128;
  const height = 64;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    for (const [stop, color] of ENV_STOPS) gradient.addColorStop(stop, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // One broad highlight so there is a discernible key direction.
    const highlight = ctx.createRadialGradient(
      width * 0.3,
      height * 0.22,
      0,
      width * 0.3,
      height * 0.22,
      width * 0.3
    );
    highlight.addColorStop(0, "rgba(210,214,220,0.55)");
    highlight.addColorStop(1, "rgba(210,214,220,0)");
    ctx.fillStyle = highlight;
    ctx.fillRect(0, 0, width, height);
  }

  const source = new CanvasTexture(canvas);
  source.mapping = EquirectangularReflectionMapping;
  source.colorSpace = SRGBColorSpace;
  source.needsUpdate = true;

  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(source);

  source.dispose();
  pmrem.dispose();

  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}

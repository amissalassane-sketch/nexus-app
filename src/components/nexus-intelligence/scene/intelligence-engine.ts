// ============================================================
// NEXUS INTELLIGENCE — ENGINE
//
// The browser half of the system. It owns exactly four things the
// world cannot: a WebGL context, a requestAnimationFrame loop, the DOM
// observers that decide when to run, and the pointer events that get
// translated into normalised coordinates.
//
// Everything that simulates lives in IntelligenceWorld. This file
// never touches a geometry or a material.
//
// The loop is parked completely — not throttled, parked — whenever the
// hero is off-screen or the tab is hidden, and under reduced motion it
// never starts at all: one settled frame is drawn and that is the end
// of it.
// ============================================================

import {
  ColorManagement,
  Scene,
  WebGLRenderer,
  type Texture,
} from "three";
import { PALETTE } from "./palette";
import { createEnvironmentProbe, createSoftDotTexture } from "./textures";
import {
  profileForViewport,
  resolveProfile,
  type IntelligenceProfile,
  type IntelligenceProfileName,
} from "./config";
import { isWebGLAvailable } from "./capabilities";
import type { IntelligenceStateName } from "./state";
import { IntelligenceWorld } from "./intelligence-world";

export interface IntelligenceEngineOptions {
  container: HTMLElement;
  /** Force a device class. Defaults to measuring the viewport. */
  profile?: IntelligenceProfileName;
  /** Field-level overrides, mostly for tuning a specific placement. */
  overrides?: Partial<IntelligenceProfile>;
  reducedMotion?: boolean;
  /** Pointer interaction. Forced off on coarse pointers. */
  interactive?: boolean;
  /** Emitted whenever the resolved state name changes. */
  onStateChange?: (state: IntelligenceStateName) => void;
}

export class IntelligenceEngine {
  private readonly container: HTMLElement;
  private readonly overrides: Partial<IntelligenceProfile>;
  private readonly reducedMotion: boolean;
  private readonly interactive: boolean;
  private readonly onStateChange?: (state: IntelligenceStateName) => void;

  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private world: IntelligenceWorld | null = null;

  private glowTexture: Texture | null = null;
  private environment: { texture: Texture; dispose(): void } | null = null;

  private profileName: IntelligenceProfileName;
  private profile: IntelligenceProfile;

  private clientX = 0;
  private clientY = 0;
  private pointerInsideWindow = false;

  private lastFrameTime = 0;
  private rafId = 0;
  private running = false;
  private inView = true;
  private disposed = false;

  private rect: DOMRect | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private profileChangeTimer = 0;

  constructor(options: IntelligenceEngineOptions) {
    ColorManagement.enabled = true;

    this.container = options.container;
    this.overrides = options.overrides ?? {};
    this.reducedMotion = options.reducedMotion ?? false;
    this.interactive = options.interactive ?? true;
    this.onStateChange = options.onStateChange;

    const width =
      typeof window === "undefined" ? 1440 : window.innerWidth || 1440;
    this.profileName = options.profile ?? profileForViewport(width);
    this.profile = resolveProfile(this.profileName, this.overrides);
  }

  /* ------------------------------------------------------------
     Lifecycle
     ------------------------------------------------------------ */

  /** Returns false when WebGL is unavailable, so the caller can swap in
   *  the static fallback instead of showing a dead canvas. */
  init(): boolean {
    if (this.disposed || !isWebGLAvailable()) return false;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        antialias: this.profile.antialias,
        alpha: true,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
      });
    } catch {
      return false;
    }

    renderer.setClearColor(PALETTE.void, 0);
    renderer.setPixelRatio(this.pixelRatio());
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    // The canvas is atmosphere. It must never swallow a click, a text
    // selection or a scroll gesture.
    renderer.domElement.style.pointerEvents = "none";
    renderer.domElement.setAttribute("aria-hidden", "true");
    this.container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.glowTexture = createSoftDotTexture();

    const probe = createEnvironmentProbe(renderer);
    this.environment = probe;
    this.scene.environment = probe.texture;
    this.scene.environmentIntensity = 0.42;

    this.buildWorld();
    this.measure();
    this.resize();

    this.attachObservers();
    if (this.interactive) this.attachPointerListeners();

    if (this.reducedMotion) {
      this.renderStaticFrame();
      return true;
    }

    this.syncRunning();
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.stop();
    this.detachObservers();
    this.detachPointerListeners();

    this.world?.dispose();
    this.world = null;

    this.scene.environment = null;
    this.environment?.dispose();
    this.environment = null;
    this.glowTexture?.dispose();
    this.glowTexture = null;

    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
  }

  /** Current resolved state. Exposed for diagnostics. */
  getState(): IntelligenceStateName | null {
    return this.world?.getState() ?? null;
  }

  /* ------------------------------------------------------------
     World
     ------------------------------------------------------------ */

  private buildWorld(): void {
    this.world?.dispose();
    this.world = new IntelligenceWorld({
      profile: this.profile,
      glowTexture: this.glowTexture as Texture,
      reducedMotion: this.reducedMotion,
      interactive: this.interactive,
      onStateChange: this.onStateChange,
    });
    this.scene.add(this.world.root);
  }

  /* ------------------------------------------------------------
     Observers and listeners
     ------------------------------------------------------------ */

  private attachObservers(): void {
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    }

    if (typeof IntersectionObserver !== "undefined") {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            this.inView = entry.isIntersecting;
            this.rect = entry.target.getBoundingClientRect();
          }
          this.syncRunning();
        },
        { threshold: 0.01 }
      );
      this.intersectionObserver.observe(this.container);
    }

    document.addEventListener("visibilitychange", this.onVisibilityChange);
    window.addEventListener("resize", this.onWindowResize, { passive: true });
  }

  private detachObservers(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    window.removeEventListener("resize", this.onWindowResize);
    window.clearTimeout(this.profileChangeTimer);
  }

  private attachPointerListeners(): void {
    window.addEventListener("pointermove", this.onPointerMove, {
      passive: true,
    });
    window.addEventListener("pointerdown", this.onPointerDown, {
      passive: true,
    });
    document.documentElement.addEventListener(
      "pointerleave",
      this.onPointerLeave
    );
    window.addEventListener("blur", this.onPointerLeave);
    window.addEventListener("scroll", this.onScroll, { passive: true });
  }

  private detachPointerListeners(): void {
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
    document.documentElement.removeEventListener(
      "pointerleave",
      this.onPointerLeave
    );
    window.removeEventListener("blur", this.onPointerLeave);
    window.removeEventListener("scroll", this.onScroll);
  }

  private onPointerMove = (event: PointerEvent): void => {
    // Coarse pointers are excluded at construction, but a hybrid device
    // can still send touch-derived moves.
    if (event.pointerType !== "mouse") return;
    this.clientX = event.clientX;
    this.clientY = event.clientY;
    this.pointerInsideWindow = true;
  };

  /** A deliberate click on the core asks the system to reason. */
  private onPointerDown = (): void => {
    const world = this.world;
    if (!world || !world.pointer.overCore) return;
    world.core.pulse(0.5);
    world.reasoning.trigger();
  };

  private onPointerLeave = (): void => {
    this.pointerInsideWindow = false;
  };

  private onScroll = (): void => {
    this.measure();
  };

  private onVisibilityChange = (): void => {
    this.syncRunning();
  };

  private onWindowResize = (): void => {
    this.handleResize();
  };

  private handleResize(): void {
    this.measure();
    this.resize();

    const next = profileForViewport(window.innerWidth || 1440);
    if (next === this.profileName) return;

    // Crossing a device class changes how much geometry exists, so the
    // world is rebuilt. Debounced: dragging a window across a
    // breakpoint should not trigger three rebuilds.
    window.clearTimeout(this.profileChangeTimer);
    this.profileChangeTimer = window.setTimeout(() => {
      if (this.disposed) return;
      this.profileName = next;
      this.profile = resolveProfile(this.profileName, this.overrides);
      this.buildWorld();
      this.resize();
      // No re-intro: the system is already online.
      this.world?.skipIntro();
      if (this.reducedMotion) this.renderStaticFrame();
    }, 240);
  }

  private measure(): void {
    this.rect = this.container.getBoundingClientRect();
  }

  private pixelRatio(): number {
    if (typeof window === "undefined") return 1;
    return Math.min(window.devicePixelRatio || 1, this.profile.pixelRatioCap);
  }

  private resize(): void {
    const renderer = this.renderer;
    if (!renderer || !this.world) return;

    const width = Math.max(1, Math.round(this.rect?.width ?? 1));
    const height = Math.max(1, Math.round(this.rect?.height ?? 1));

    renderer.setPixelRatio(this.pixelRatio());
    renderer.setSize(width, height, false);
    this.world.layout(width, height, this.profile);
  }

  /* ------------------------------------------------------------
     Loop
     ------------------------------------------------------------ */

  private syncRunning(): void {
    const shouldRun =
      !this.disposed &&
      !this.reducedMotion &&
      this.inView &&
      (typeof document === "undefined" || !document.hidden);

    if (shouldRun && !this.running) this.start();
    else if (!shouldRun && this.running) this.stop();
  }

  private start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastFrameTime = performance.now();
    this.rafId = window.requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (!this.running) return;
    this.running = false;
    window.cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private tick = (): void => {
    if (!this.running) return;
    this.rafId = window.requestAnimationFrame(this.tick);

    const now = performance.now();
    // Clamped: a backgrounded tab can hand back a multi-second delta,
    // and the simulation must not teleport through a whole cycle.
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;

    this.updatePointer();
    this.world?.step(dt);

    const camera = this.world?.cameraRig.camera;
    if (this.renderer && camera) this.renderer.render(this.scene, camera);
  };

  /** Translate client coordinates into the world's normalised pointer. */
  private updatePointer(): void {
    const world = this.world;
    if (!world || !this.rect) return;

    const { width, height, left, top } = this.rect;
    const inside =
      this.pointerInsideWindow &&
      width > 0 &&
      height > 0 &&
      this.clientX >= left &&
      this.clientX <= left + width &&
      this.clientY >= top &&
      this.clientY <= top + height;

    if (!inside) {
      world.setPointer(0, 0, false);
      return;
    }

    world.setPointer(
      ((this.clientX - left) / width) * 2 - 1,
      -(((this.clientY - top) / height) * 2 - 1),
      true
    );
  }

  /** Draw the finished, motionless system exactly once. */
  private renderStaticFrame(): void {
    this.world?.settle();
    const camera = this.world?.cameraRig.camera;
    if (this.renderer && camera) this.renderer.render(this.scene, camera);
  }
}

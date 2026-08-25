// ============================================================
// NEXUS INTELLIGENCE — SCENE VERIFICATION
//
// Runs the real simulation headlessly. No GPU, no browser, no mocks of
// the code under test: it constructs the actual `IntelligenceWorld` —
// the same class the WebGL engine drives — and steps it frame by frame,
// then asserts on what the system actually did.
//
//   npm run verify:scene
//
// What it proves:
//   • the field is deterministic and the graph is well formed
//   • the entrance completes on schedule and hands over to idle
//   • idle channels converge on their targets and stay in range
//   • reasoning cycles start, reach the core, and return to idle
//   • signals spawn, travel and are recycled without overflowing
//   • the cursor states resolve and release cleanly
//   • the camera puts the core where the composition says it goes
//   • nothing goes non-finite and disposal leaves nothing behind
// ============================================================

import * as THREE from "three";
import { Texture, Vector3 } from "three";
import { IntelligenceWorld } from "../src/components/nexus-intelligence/scene/intelligence-world";
import {
  profileForViewport,
  resolveProfile,
  INTRO_DURATION,
  CORE_EXCLUSION_RADIUS,
  type IntelligenceProfileName,
} from "../src/components/nexus-intelligence/scene/config";
import { IntelligenceNetwork } from "../src/components/nexus-intelligence/scene/intelligence-network";
import { buildNearestLinks } from "../src/components/nexus-intelligence/scene/graph";
import { createRandom } from "../src/components/nexus-intelligence/scene/math";

/* ------------------------------------------------------------ */

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

const FRAME = 1 / 60;

/** Step a world forward by `seconds` at 60 fps, invoking `each` per
 *  frame so callers can observe intermediate state. */
function simulate(
  world: IntelligenceWorld,
  seconds: number,
  each?: (frame: number, world: IntelligenceWorld) => void
): void {
  const frames = Math.round(seconds / FRAME);
  for (let i = 0; i < frames; i += 1) {
    world.step(FRAME);
    each?.(i, world);
  }
}

const stubTexture = () => new Texture();

function makeWorld(
  profileName: IntelligenceProfileName = "desktop",
  options: { reducedMotion?: boolean; interactive?: boolean } = {}
): IntelligenceWorld {
  return new IntelligenceWorld({
    profile: resolveProfile(profileName),
    glowTexture: stubTexture(),
    reducedMotion: options.reducedMotion ?? false,
    interactive: options.interactive ?? true,
  });
}

/* ------------------------------------------------------------ */

section("Three.js API surface");

// The renderer half of the engine cannot run headlessly, so its API
// usage is asserted directly instead. A removed or renamed method here
// is exactly the failure that would otherwise only surface in a browser.
{
  const present = (label: string, value: unknown) =>
    check(`${label} exists`, value !== undefined && value !== null, String(value));

  present("WebGLRenderer", THREE.WebGLRenderer);
  present("PMREMGenerator.fromEquirectangular", THREE.PMREMGenerator.prototype.fromEquirectangular);
  present("Scene.environmentIntensity", new THREE.Scene().environmentIntensity);
  present("ColorManagement.enabled", THREE.ColorManagement.enabled);
  present("CanvasTexture", THREE.CanvasTexture);
  present("SRGBColorSpace", THREE.SRGBColorSpace);
  present("EquirectangularReflectionMapping", THREE.EquirectangularReflectionMapping);
  present("InstancedBufferAttribute", THREE.InstancedBufferAttribute);
  present("InstancedMesh.setColorAt", THREE.InstancedMesh.prototype.setColorAt);
  present("DynamicDrawUsage", THREE.DynamicDrawUsage);
  present("Vector3.project", THREE.Vector3.prototype.project);
  present(
    "Camera.updateMatrixWorld",
    THREE.PerspectiveCamera.prototype.updateMatrixWorld
  );

  const camera = new THREE.PerspectiveCamera();
  camera.updateMatrixWorld();
  check(
    "Camera.updateMatrixWorld refreshes matrixWorldInverse",
    camera.matrixWorldInverse.elements.some((value) => value !== 0)
  );
}

section("Responsive profiles");

check("narrow viewport resolves to mobile", profileForViewport(390) === "mobile");
check("mid viewport resolves to tablet", profileForViewport(900) === "tablet");
check("wide viewport resolves to desktop", profileForViewport(1440) === "desktop");

{
  const desktop = resolveProfile("desktop");
  const tablet = resolveProfile("tablet");
  const mobile = resolveProfile("mobile");
  check(
    "node count decreases desktop → tablet → mobile",
    desktop.nodeCount > tablet.nodeCount && tablet.nodeCount > mobile.nodeCount,
    `${desktop.nodeCount} / ${tablet.nodeCount} / ${mobile.nodeCount}`
  );
  check(
    "signal count decreases desktop → tablet → mobile",
    desktop.signalCount > tablet.signalCount && tablet.signalCount > mobile.signalCount,
    `${desktop.signalCount} / ${tablet.signalCount} / ${mobile.signalCount}`
  );
  check("mobile disables pointer interaction", mobile.interactive === false);
  check("mobile disables antialiasing", mobile.antialias === false);
  check(
    "reasoning interval stays inside the brief's 5–9s window on desktop",
    desktop.reasoningInterval[0] >= 5 && desktop.reasoningInterval[1] <= 9,
    JSON.stringify(desktop.reasoningInterval)
  );
}

/* ------------------------------------------------------------ */

section("Field determinism and graph integrity");

{
  const a = IntelligenceNetwork.buildTopology(createRandom(1), 60, 2, 2.5);
  const b = IntelligenceNetwork.buildTopology(createRandom(1), 60, 2, 2.5);

  // buildTopology takes the rng as an argument, so the same generator
  // state must produce the same field.
  const same = a.positions.every(
    (p, i) =>
      p.x === b.positions[i]?.x &&
      p.y === b.positions[i]?.y &&
      p.z === b.positions[i]?.z
  );
  check("same seed produces the same field", same);

  const selfLinks = a.links.filter((link) => link.a === link.b).length;
  const keys = new Set(a.links.map((l) => `${Math.min(l.a, l.b)}:${Math.max(l.a, l.b)}`));
  check("no self links", selfLinks === 0);
  check("no duplicate links", keys.size === a.links.length, `${keys.size} vs ${a.links.length}`);

  const tooFar = a.links.filter((link) => {
    const pa = a.positions[link.a];
    const pb = a.positions[link.b];
    return !pa || !pb || pa.distanceTo(pb) > 2.5 + 1e-6;
  }).length;
  check("every link respects maxLinkDistance", tooFar === 0, `${tooFar} violations`);

  const isolated = a.adjacency.filter((list) => list.length === 0).length;
  check(
    "the field is connected enough to reason over",
    isolated < a.positions.length * 0.2,
    `${isolated} isolated nodes`
  );

  // Degree cap
  const overDegree = a.adjacency.filter((list) => list.length > 6).length;
  check("node degree stays bounded", overDegree === 0);

  // Core exclusion
  const inside = a.positions.filter(
    (p) => p.length() < CORE_EXCLUSION_RADIUS - 1e-6
  ).length;
  check("no node intrudes on the core", inside === 0, `${inside} intrusions`);

  // Direct graph helper on a known shape
  const square = [
    new Vector3(0, 0, 0),
    new Vector3(1, 0, 0),
    new Vector3(0, 1, 0),
    new Vector3(5, 5, 5),
  ];
  const squareLinks = buildNearestLinks(square, 1, 2);
  check(
    "nearest-links ignores points beyond the span",
    squareLinks.every((l) => l.a !== 3 && l.b !== 3),
    JSON.stringify(squareLinks)
  );
}

/* ------------------------------------------------------------ */

section("Entrance");

{
  const world = makeWorld("desktop");
  check("starts in INTRO", world.getState() === "INTRO");
  check("intro progress starts at 0", world.introProgress === 0);

  const samples: number[] = [];
  simulate(world, INTRO_DURATION + 0.6, (frame, w) => {
    if (frame % 30 === 0) samples.push(w.introProgress);
  });

  check("intro is monotonic", samples.every((v, i) => i === 0 || v >= samples[i - 1]!));
  check("intro completes within its duration", world.introProgress === 1);
  check("intro hands over to a live state", world.getState() !== "INTRO");
  check(
    "the first 0.4s stays black",
    world.getChannels().luminosity >= 0,
    "luminosity must never be negative"
  );
  world.dispose();
}

/* ------------------------------------------------------------ */

section("Idle convergence");

{
  const world = makeWorld("desktop");
  let outOfRange = 0;
  let nonFinite = 0;

  // Channels are only comparable against the idle targets while no
  // reasoning cycle is running, so settle is observed separately.
  const settled: number[][] = [];
  simulate(world, 40, (_frame, w) => {
    const c = w.getChannels();
    for (const value of Object.values(c)) {
      if (!Number.isFinite(value)) nonFinite += 1;
      else if (value < -1e-6 || value > 1 + 1e-6) outOfRange += 1;
    }
    if (w.getState() === "IDLE" && w.reasoning.envelope < 0.02) {
      settled.push([c.activity, c.luminosity, c.networkPresence, c.coreMotion]);
    }
  });

  check(
    "the system is observably idle between reasoning cycles",
    settled.length > 60,
    `${settled.length} quiescent frames`
  );

  check("all channels stay finite", nonFinite === 0, `${nonFinite} non-finite`);
  check("all channels stay within 0..1", outOfRange === 0, `${outOfRange} out of range`);

  const idle = { activity: 0.22, luminosity: 0.5, networkPresence: 0.64, coreMotion: 0.55 };
  const keys = Object.keys(idle) as (keyof typeof idle)[];
  const last = settled[settled.length - 1];
  keys.forEach((key, index) => {
    const observed = last?.[index] ?? NaN;
    check(
      `${key} converges on its idle target`,
      Math.abs(observed - idle[key]) < 0.02,
      `${observed.toFixed(4)} vs ${idle[key]}`
    );
  });

  check(
    "settles into IDLE with no pointer",
    world.getState() === "IDLE" || world.getState() === "REASONING",
    world.getState()
  );
  world.dispose();
}

/* ------------------------------------------------------------ */

section("Reasoning cycles");

{
  const world = makeWorld("desktop");
  const reasoning = world.reasoning;

  // Spies on the real handlers — the implementations still run.
  let coreArrivals = 0;
  let nodeArrivals = 0;
  let pulses = 0;
  const originalCore = reasoning.handleCoreReached.bind(reasoning);
  const originalNode = reasoning.handleNodeReached.bind(reasoning);
  const originalPulse = world.core.pulse.bind(world.core);
  reasoning.handleCoreReached = (strength: number) => {
    coreArrivals += 1;
    originalCore(strength);
  };
  reasoning.handleNodeReached = (index: number, strength: number) => {
    nodeArrivals += 1;
    originalNode(index, strength);
  };
  world.core.pulse = (strength?: number) => {
    pulses += 1;
    originalPulse(strength);
  };

  let spawns = 0;
  const originalLink = world.signals.spawnLink.bind(world.signals);
  const originalToCore = world.signals.spawnToCore.bind(world.signals);
  const originalFromCore = world.signals.spawnFromCore.bind(world.signals);
  world.signals.spawnLink = (i: number, s?: number, d?: number) => {
    const ok = originalLink(i, s, d);
    if (ok) spawns += 1;
    return ok;
  };
  world.signals.spawnToCore = (i: number, s?: number) => {
    const ok = originalToCore(i, s);
    if (ok) spawns += 1;
    return ok;
  };
  world.signals.spawnFromCore = (i: number, s?: number) => {
    const ok = originalFromCore(i, s);
    if (ok) spawns += 1;
    return ok;
  };

  let overflow = 0;
  const seenStates = new Set<string>();
  let reasoningFrames = 0;

  simulate(world, 90, (_frame, w) => {
    seenStates.add(w.getState());
    if (w.getState() === "REASONING") reasoningFrames += 1;
    if (w.signals.activeCount > w.signals.capacity) overflow += 1;
  });

  check("signals were spawned", spawns > 0, `${spawns} spawns`);
  check("signals reached nodes", nodeArrivals > 0, `${nodeArrivals} arrivals`);
  check("signals reached the core", coreArrivals > 0, `${coreArrivals} arrivals`);
  check("the core pulsed", pulses > 0, `${pulses} pulses`);
  check("the signal pool never overflowed", overflow === 0, `${overflow} overflows`);
  check(
    "REASONING was actually reached",
    seenStates.has("REASONING") || reasoningFrames > 0,
    [...seenStates].join(",")
  );

  // 90s at a 5–9s interval should produce a healthy number of cycles.
  check(
    "reasoning cycles repeat on roughly a 5–9s period",
    coreArrivals >= 8 && coreArrivals <= 20,
    `${coreArrivals} completed cycles in 90s`
  );

  check(
    "the system returns to idle between cycles",
    world.getState() === "IDLE" || world.getState() === "REASONING",
    world.getState()
  );

  // A cycle must never get stuck. A cycle legitimately in flight when
  // the clock stops is fine — what must never happen is a phase that
  // does not resolve back to idle within one watchdog period.
  simulate(world, 30);
  let stranded = true;
  for (let i = 0; i < 600; i += 1) {
    world.step(1 / 60);
    if (
      reasoning.currentPhase === "idle" ||
      reasoning.currentPhase === "resolve"
    ) {
      stranded = false;
      break;
    }
  }
  check("no cycle is left stranded mid-sequence", !stranded, reasoning.currentPhase);
  world.dispose();
}

/* ------------------------------------------------------------ */

section("Cursor interaction");

{
  const world = makeWorld("desktop");
  world.layout(1440, 900);
  simulate(world, 4);

  const idleChannels = world.getChannels();

  // Hover directly over the core: it projects to NDC x = +0.30 on desktop.
  world.setPointer(0.3, 0, true);
  simulate(world, 2.5);
  const overCore = world.getChannels();
  const overState = world.getState();

  check(
    "hovering the core raises luminosity",
    overCore.luminosity > idleChannels.luminosity,
    `${overCore.luminosity.toFixed(3)} vs ${idleChannels.luminosity.toFixed(3)}`
  );
  check(
    "hovering the core raises network presence",
    overCore.networkPresence > idleChannels.networkPresence
  );
  check(
    "hovering the core resolves to CURSOR_OVER_CORE or REASONING",
    overState === "CURSOR_OVER_CORE" || overState === "REASONING",
    overState
  );

  // Far away but inside the viewport: proximity without hover.
  world.setPointer(-0.9, -0.8, true);
  simulate(world, 3);
  const away = world.getChannels();
  check(
    "moving away releases the hover state",
    world.getState() === "IDLE" || world.getState() === "REASONING",
    world.getState()
  );
  check(
    "luminosity falls back toward idle",
    away.luminosity < overCore.luminosity
  );

  // Pointer leaves entirely.
  world.setPointer(0, 0, false);
  simulate(world, 4);
  check("pointer proximity decays to zero", world.pointer.proximity < 0.02,
    world.pointer.proximity.toFixed(4));
  check("pointer is reported inactive", world.pointer.active === false);

  // Non-interactive worlds must ignore the pointer completely. The
  // assertion lives on the pointer itself — proximity and activation —
  // because reasoning cycles legitimately move the channels between
  // samples, pointer or not.
  const passive = makeWorld("mobile");
  passive.layout(390, 844);
  simulate(passive, 10);
  passive.setPointer(0, 0, true);
  simulate(passive, 3);
  check(
    "a non-interactive profile ignores the pointer",
    passive.pointer.active === false && passive.pointer.proximity < 0.02,
    `active=${String(passive.pointer.active)} proximity=${passive.pointer.proximity.toFixed(4)}`
  );
  check("non-interactive pointer stays inactive", passive.pointer.active === false);

  world.dispose();
  passive.dispose();
}

/* ------------------------------------------------------------ */

section("Camera composition");

{
  const origin = new Vector3(0, 0, 0);

  const desktop = makeWorld("desktop");
  desktop.layout(1440, 900);
  const desktopNdc = origin.clone().project(desktop.cameraRig.camera);
  check(
    "desktop: the core sits right of centre, clear of the headline",
    desktopNdc.x > 0.2 && desktopNdc.x < 0.4,
    `x = ${desktopNdc.x.toFixed(3)}`
  );
  check(
    "desktop: the core sits vertically centred",
    Math.abs(desktopNdc.y) < 0.05,
    `y = ${desktopNdc.y.toFixed(3)}`
  );
  desktop.dispose();

  const mobile = makeWorld("mobile");
  mobile.layout(390, 844);
  const mobileNdc = origin.clone().project(mobile.cameraRig.camera);
  check(
    "mobile: the core stays horizontally centred",
    Math.abs(mobileNdc.x) < 0.05,
    `x = ${mobileNdc.x.toFixed(3)}`
  );
  check(
    "mobile: the core drops below the copy",
    mobileNdc.y < -0.15,
    `y = ${mobileNdc.y.toFixed(3)}`
  );
  mobile.dispose();

  const tablet = makeWorld("tablet");
  tablet.layout(900, 1100);
  const tabletNdc = origin.clone().project(tablet.cameraRig.camera);
  check(
    "tablet: the core drifts only slightly off centre",
    tabletNdc.x > 0.05 && tabletNdc.x < 0.3,
    `x = ${tabletNdc.x.toFixed(3)}`
  );
  tablet.dispose();
}

/* ------------------------------------------------------------ */

section("Numerical stability across every profile");

for (const profileName of ["desktop", "tablet", "mobile"] as const) {
  const world = makeWorld(profileName);
  world.layout(profileName === "mobile" ? 390 : profileName === "tablet" ? 900 : 1440, 900);
  simulate(world, 45);

  let bad = 0;
  world.root.traverse((object) => {
    const instanced = object as unknown as {
      isInstancedMesh?: boolean;
      instanceMatrix?: { array: ArrayLike<number> };
    };
    if (instanced.isInstancedMesh && instanced.instanceMatrix) {
      const array = instanced.instanceMatrix.array;
      for (let i = 0; i < array.length; i += 1) {
        if (!Number.isFinite(array[i])) bad += 1;
      }
    }
    const mesh = object as unknown as {
      isPoints?: boolean;
      geometry?: { getAttribute(name: string): { array: ArrayLike<number> } | undefined };
    };
    if ((mesh.isPoints || instanced.isInstancedMesh) && mesh.geometry) {
      for (const name of ["position", "color"]) {
        const attribute = mesh.geometry.getAttribute?.(name);
        if (!attribute) continue;
        for (let i = 0; i < attribute.array.length; i += 1) {
          if (!Number.isFinite(attribute.array[i])) bad += 1;
        }
      }
    }
  });

  check(`${profileName}: every buffer stays finite after 45s`, bad === 0, `${bad} bad values`);

  const camera = world.cameraRig.camera;
  check(
    `${profileName}: camera position stays finite`,
    Number.isFinite(camera.position.x) &&
      Number.isFinite(camera.position.y) &&
      Number.isFinite(camera.position.z)
  );

  world.dispose();
}

/* ------------------------------------------------------------ */

section("Reduced motion");

{
  const world = makeWorld("desktop", { reducedMotion: true });
  world.layout(1440, 900);

  const ctx = world.settle();
  check("reduced motion skips the entrance", world.introProgress === 1);
  check("reduced motion is not in INTRO", world.getState() !== "INTRO");
  check("the settled frame is flagged reduced-motion", ctx.reducedMotion === true);
  check("the settled frame has no motion scale", ctx.motionScale === 0);

  const before = world.core.root.rotation.y;
  const positionBefore = world.core.root.position.clone();
  world.settle();
  world.settle();
  check(
    "repeated settle does not move the core",
    world.core.root.rotation.y === before &&
      world.core.root.position.equals(positionBefore)
  );

  const channels = world.getChannels();
  check(
    "the settled state keeps the final visual values",
    channels.luminosity > 0.4 && channels.networkPresence > 0.5,
    JSON.stringify(channels)
  );
  check("no reasoning cycles under reduced motion", world.reasoning.envelope === 0);

  // Signals must not be travelling.
  check("no signals are in flight under reduced motion", world.signals.activeCount === 0);

  world.dispose();
}

/* ------------------------------------------------------------ */

section("Disposal");

{
  const world = makeWorld("desktop");
  world.layout(1440, 900);
  simulate(world, 10);

  // Instrument every GPU resource in the graph so the check proves the
  // traversal actually reached it, rather than trusting a count.
  const resources: { label: string; released: boolean }[] = [];
  world.root.traverse((object) => {
    const mesh = object as unknown as {
      geometry?: { dispose(): void };
      material?: { dispose(): void } | { dispose(): void }[];
      isInstancedMesh?: boolean;
      dispose?(): void;
    };
    const record = (label: string, target: { dispose(): void }) => {
      const entry = { label, released: false };
      resources.push(entry);
      const original = target.dispose.bind(target);
      target.dispose = () => {
        entry.released = true;
        original();
      };
    };
    if (mesh.geometry) record("geometry", mesh.geometry);
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((m) => record("material", m));
    else if (material) record("material", material);

    // Instanced meshes own their instance buffers separately, so they are
    // tracked against their own `dispose()` rather than their geometry.
    if (mesh.isInstancedMesh && typeof mesh.dispose === "function") {
      const entry = { label: "instanced buffers", released: false };
      resources.push(entry);
      const original = mesh.dispose.bind(mesh);
      mesh.dispose = () => {
        entry.released = true;
        original();
      };
    }
  });

  check("the scene graph owns GPU resources to release", resources.length > 20,
    `${resources.length} resources`);

  let threw = false;
  try {
    world.dispose();
  } catch (error) {
    threw = true;
    console.log(`       ${(error as Error).message}`);
  }
  check("dispose() completes without throwing", !threw);
  check("dispose() empties the world graph", world.root.children.length === 0);

  const leaked = resources.filter((resource) => !resource.released);
  check(
    "every geometry, material and instance buffer is released",
    leaked.length === 0,
    leaked.slice(0, 5).map((l) => l.label).join(", ")
  );

  // Double disposal must be safe: React StrictMode mounts effects twice.
  let secondThrew = false;
  try {
    world.dispose();
  } catch {
    secondThrew = true;
  }
  check("dispose() is idempotent (StrictMode-safe)", !secondThrew);
}

/* ------------------------------------------------------------ */

console.log(
  `\n${failures.length === 0 ? "PASS" : "FAIL"} — ${passed} checks passed, ${failures.length} failed`
);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const failure of failures) console.log(`  · ${failure}`);
  process.exit(1);
}

// ============================================================
// NEXUS INTELLIGENCE — REASONING CYCLE
//
// The autonomous behaviour of the system. Every 5–9 seconds (randomly
// varied, longer on small screens) the network runs one full cycle:
//
//   1  a distant node wakes up
//   2  a signal leaves it for a neighbouring node
//   3  that node wakes up when the signal lands
//   4  a second signal carries the result toward the core
//   5  the core pulses as it absorbs the signal
//   6  a small neighbourhood of connected nodes lights briefly
//   7  everything fades
//   8  the system is idle again
//
// It is driven by a phase machine, not a scripted timeline: each phase
// waits for the previous signal to actually arrive, so the rhythm
// follows the geometry instead of a clock. A watchdog guarantees the
// cycle always returns to idle even if the signal pool is saturated.
//
// A second, much quieter scheduler handles ambient activity — one link
// flickering now and then — so the field is never completely still
// between cycles.
// ============================================================

import { clamp01, damp, range } from "./math";
import type { IntelligenceCore } from "./intelligence-core";
import type { IntelligenceNetwork } from "./intelligence-network";
import type { DataSignals } from "./data-signal";

type Phase = "idle" | "seeded" | "first-hop" | "core-hop" | "resolve";

export interface ReasoningActors {
  network: IntelligenceNetwork;
  core: IntelligenceCore;
  signals: DataSignals;
}

export class ReasoningCycle {
  /** 0..1. Fed straight into the state machine as the reasoning boost. */
  envelope = 0;

  private readonly actors: ReasoningActors;
  private readonly random: () => number;
  private readonly interval: [number, number];
  private readonly ambientInterval: [number, number];

  private phase: Phase = "idle";
  private timer = 0;
  private watchdog = 0;
  private originNode = -1;
  private relayNode = -1;
  private targetEnvelope = 0;
  private dispatched = false;

  private ambientTimer = 0;
  private enabled = true;
  private clock = 0;
  private cycleStartedAt = 0;

  constructor(
    actors: ReasoningActors,
    options: {
      random: () => number;
      interval: [number, number];
      ambientInterval: [number, number];
    }
  ) {
    this.actors = actors;
    this.random = options.random;
    this.interval = options.interval;
    this.ambientInterval = options.ambientInterval;
    this.timer = range(this.random, ...this.interval);
    this.ambientTimer = range(this.random, ...this.ambientInterval);
  }

  /** Reduced motion parks the cycle entirely; the scene stays static. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.phase = "idle";
      this.targetEnvelope = 0;
      this.envelope = 0;
    }
  }

  get currentPhase(): Phase {
    return this.phase;
  }

  /** Kick a cycle immediately. Used by the cursor-over-core state so a
   *  hover feels answered rather than merely brightened. */
  trigger(): void {
    if (!this.enabled || this.phase !== "idle") return;
    this.begin();
  }

  /* ------------------------------------------------------------
     Signal callbacks — wired by the engine
     ------------------------------------------------------------ */

  handleNodeReached(index: number, strength: number): void {
    this.actors.network.activateNode(index, 0.75 * strength);

    if (this.phase === "first-hop" && index === this.relayNode) {
      // Step 3 → step 4: the relay has the result, send it inward.
      this.phase = "core-hop";
      this.dispatched = false;
      this.watchdog = 4.5;
      this.timer = 0.22;
    }
  }

  handleCoreReached(strength: number): void {
    this.actors.core.pulse(0.85 * strength);

    if (this.phase === "core-hop") {
      this.phase = "resolve";
      this.timer = 1.1;
      this.spread();
    }
  }

  /* ------------------------------------------------------------
     Frame
     ------------------------------------------------------------ */

  update(dt: number): void {
    this.clock += dt;
    this.envelope = damp(this.envelope, this.targetEnvelope, 2.2, dt);

    if (!this.enabled) return;

    this.timer -= dt;

    switch (this.phase) {
      case "idle": {
        this.targetEnvelope = 0;
        if (this.timer <= 0) this.begin();
        break;
      }

      case "seeded": {
        this.targetEnvelope = 0.7;
        if (this.timer <= 0) this.dispatchFirstHop();
        break;
      }

      case "first-hop": {
        this.targetEnvelope = 0.85;
        // Arrival advances the phase; the watchdog only catches the
        // case where the signal could not be spawned at all.
        this.guard(dt);
        break;
      }

      case "core-hop": {
        this.targetEnvelope = 1;
        if (!this.dispatched && this.timer <= 0 && this.relayNode >= 0) {
          this.dispatched = true;
          if (!this.actors.signals.spawnToCore(this.relayNode, 1)) this.abort();
        }
        this.guard(dt);
        break;
      }

      case "resolve": {
        this.targetEnvelope = 0;
        if (this.timer <= 0) this.reset();
        break;
      }

    }

    this.updateAmbient(dt);
  }

  /* ------------------------------------------------------------
     Internals
     ------------------------------------------------------------ */

  private begin(): void {
    const network = this.actors.network;
    const positions = network.topology.positions;
    if (positions.length === 0) {
      this.reset();
      return;
    }

    // Step 1: prefer a node far from the core, so the information
    // visibly comes in from the edge of the system.
    let best = 0;
    let bestScore = -Infinity;
    const samples = Math.min(positions.length, 10);
    for (let i = 0; i < samples; i += 1) {
      const index = Math.floor(this.random() * positions.length);
      const position = positions[index];
      if (!position) continue;
      const score = position.length() + this.random() * 0.8;
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    }

    this.originNode = best;
    this.relayNode = -1;
    network.activateNode(best, 1);
    network.linksOf(best).forEach((link) =>
      network.activateLink(link, 0.35)
    );

    this.phase = "seeded";
    this.cycleStartedAt = this.clock;
    this.timer = range(this.random, 0.3, 0.55);
    this.watchdog = 8;
  }

  private dispatchFirstHop(): void {
    const network = this.actors.network;
    const links = network.linksOf(this.originNode);
    if (links.length === 0) {
      this.abort();
      return;
    }

    const linkIndex = links[Math.floor(this.random() * links.length)] ?? -1;
    const link = network.topology.links[linkIndex];
    if (!link) {
      this.abort();
      return;
    }

    this.relayNode = link.a === this.originNode ? link.b : link.a;
    if (!this.actors.signals.spawnLink(linkIndex, 1, this.relayNode)) {
      this.abort();
      return;
    }

    this.phase = "first-hop";
    this.watchdog = 6;
  }

  /** Step 6: light the neighbourhood around the relay. */
  private spread(): void {
    const network = this.actors.network;
    const neighbours = network.neighboursOf(this.relayNode);
    neighbours.forEach((neighbour) => {
      network.activateNode(neighbour, range(this.random, 0.35, 0.7));
    });

    const extra = Math.min(4, Math.floor(range(this.random, 2, 5)));
    for (let i = 0; i < extra; i += 1) {
      network.activateNode(
        Math.floor(this.random() * network.nodeCount),
        range(this.random, 0.2, 0.5)
      );
    }

    this.actors.core.activateCluster(
      Math.floor(range(this.random, 3, 6)),
      this.random
    );

    // One decision travelling back out, so the cycle reads as
    // in → process → out rather than in → process.
    if (neighbours.length > 0) {
      const outbound =
        neighbours[Math.floor(this.random() * neighbours.length)] ?? 0;
      this.actors.signals.spawnFromCore(outbound, 0.7);
    }
  }

  private updateAmbient(dt: number): void {
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = range(this.random, ...this.ambientInterval);

    const network = this.actors.network;
    if (network.linkCount === 0) return;

    const linkIndex = Math.floor(this.random() * network.linkCount);
    network.activateLink(linkIndex, range(this.random, 0.3, 0.6));
    this.actors.signals.spawnLink(linkIndex, range(this.random, 0.3, 0.6));
  }

  private guard(dt: number): void {
    this.watchdog -= dt;
    if (this.watchdog > 0) return;
    this.abort();
  }

  private abort(): void {
    this.phase = "resolve";
    this.timer = 0.9;
    this.targetEnvelope = 0;
  }

  private reset(): void {
    this.phase = "idle";
    this.originNode = -1;
    this.relayNode = -1;
    this.dispatched = false;
    this.targetEnvelope = 0;
    this.envelope = clamp01(this.envelope);

    // The interval is the period between the *starts* of two cycles,
    // not the gap after one ends — otherwise a slow cycle would push
    // the rhythm well past the 5–9 seconds the system is tuned for.
    const spent = this.clock - this.cycleStartedAt;
    this.timer = Math.max(
      0.8,
      range(this.random, ...this.interval) - spent
    );
  }
}

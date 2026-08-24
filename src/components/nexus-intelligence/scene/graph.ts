// ============================================================
// NEXUS INTELLIGENCE — GRAPH CONSTRUCTION
//
// The connections in this scene are a real graph, not decoration:
// each node binds to its k nearest neighbours inside a maximum span,
// which is what makes the structure read as dependencies rather than
// as a random constellation.
//
// Everything is computed once at construction. Nothing here runs per
// frame.
// ============================================================

import type { Vector3 } from "three";

export interface Link {
  a: number;
  b: number;
}

/** Greedy k-nearest-neighbour graph. O(n² · k) at n ≈ 80, run once. */
export function buildNearestLinks(
  points: readonly Vector3[],
  degree: number,
  maxDistance: number
): Link[] {
  const links: Link[] = [];
  const seen = new Set<string>();
  const limit = maxDistance * maxDistance;

  for (let i = 0; i < points.length; i += 1) {
    const origin = points[i];
    if (!origin) continue;

    const candidates: { index: number; distance: number }[] = [];
    for (let j = 0; j < points.length; j += 1) {
      if (j === i) continue;
      const other = points[j];
      if (!other) continue;
      const distance = origin.distanceToSquared(other);
      if (distance <= limit) candidates.push({ index: j, distance });
    }

    candidates.sort((a, b) => a.distance - b.distance);

    let bound = 0;
    for (const candidate of candidates) {
      if (bound >= degree) break;
      const key = i < candidate.index
        ? `${i}:${candidate.index}`
        : `${candidate.index}:${i}`;
      if (seen.has(key)) {
        // Already bound from the other side — it still counts toward
        // this node's degree, it just is not emitted twice.
        bound += 1;
        continue;
      }
      seen.add(key);
      links.push({ a: i, b: candidate.index });
      bound += 1;
    }
  }

  return links;
}

/** Adjacency list derived from a link set, used to pick "nearby" nodes
 *  when a reasoning cycle needs to light a neighbourhood. */
export function buildAdjacency(count: number, links: readonly Link[]): number[][] {
  const adjacency: number[][] = Array.from({ length: count }, () => []);
  for (const link of links) {
    adjacency[link.a]?.push(link.b);
    adjacency[link.b]?.push(link.a);
  }
  return adjacency;
}

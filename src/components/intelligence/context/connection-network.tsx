import { CONTEXT_NODES, staticConnectionPath } from "./config";

// ============================================================
// CONNECTION NETWORK
//
// Two SVG layers so connections genuinely sit in space:
// <ConnectionsBehind /> travels below the card plane (background
// objects), <ConnectionsFront /> crosses above it and also carries
// the signal pool — the tiny points that travel from an object to
// the core. Each connection is drawn as a thin stroke plus a wider
// soft halo that only appears while the relationship is active.
//
// The server renders static percentage-space paths so the scene is
// complete without JavaScript; the engine swaps the viewBox to
// exact pixels on mount and rewrites every path per frame.
// ============================================================

const behind = CONTEXT_NODES.filter((node) => node.desktop.line === "behind");
const front = CONTEXT_NODES.filter((node) => node.desktop.line === "front");

function ConnectionPaths({ nodes }: { nodes: typeof CONTEXT_NODES }) {
  return (
    <>
      {nodes.map((node) => (
        <g key={node.id}>
          <path
            className="nexus-context-halo"
            data-nx-halo={node.id}
            d={staticConnectionPath(node.desktop)}
          />
          <path
            className="nexus-context-line"
            data-nx-line={node.id}
            d={staticConnectionPath(node.desktop)}
          />
        </g>
      ))}
    </>
  );
}

/** Connections that pass behind the workspace objects. */
export function ConnectionsBehind() {
  return (
    <svg
      className="nexus-context-lines nexus-context-lines-behind"
      data-nx-svg="behind"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-nx-fade
      focusable="false"
    >
      <ConnectionPaths nodes={behind} />
    </svg>
  );
}

/** Connections that cross in front, plus the travelling signals. */
export function ConnectionsFront() {
  return (
    <svg
      className="nexus-context-lines nexus-context-lines-front"
      data-nx-svg="front"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-nx-fade
      focusable="false"
    >
      <ConnectionPaths nodes={front} />
      {Array.from({ length: 5 }, (_, index) => (
        <circle
          key={index}
          className="nexus-context-signal"
          data-nx-signal
          cx="-10"
          cy="-10"
          r="2"
          opacity="0"
        />
      ))}
    </svg>
  );
}

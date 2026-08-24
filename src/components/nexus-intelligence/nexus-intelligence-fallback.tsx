// ============================================================
// NEXUS INTELLIGENCE — STATIC FALLBACK
//
// Rendered when WebGL is unavailable: no canvas, no broken frame, no
// empty black rectangle. It is the same composition as the 3D scene —
// a faceted core, a mid layer of bound nodes, three orbital pathways,
// a thin network — drawn once as inline SVG and left alone.
//
// Deliberately server-renderable and dependency-free. The only motion
// is two slow opacity breaths, and both are removed under
// prefers-reduced-motion.
// ============================================================

import { cn } from "@/lib/cn";

/** Node ring for the mid layer. Deterministic, so SSR and client
 *  markup match exactly. */
const MID_NODES = Array.from({ length: 18 }, (_, index) => {
  const angle = (index / 18) * Math.PI * 2 + 0.22;
  const radius = index % 3 === 0 ? 96 : 112;
  return {
    x: 250 + Math.cos(angle) * radius,
    y: 250 + Math.sin(angle) * radius * 0.86,
    r: index % 4 === 0 ? 2.6 : 1.7,
  };
});

/** A sparse field around the core, matching the WebGL network's shape. */
const FIELD_NODES = Array.from({ length: 26 }, (_, index) => {
  const angle = index * 2.399963 + 0.5; // golden angle
  const radius = 150 + ((index * 37) % 130);
  return {
    x: 250 + Math.cos(angle) * radius,
    y: 250 + Math.sin(angle) * radius * 0.56,
  };
});

const FIELD_LINKS = Array.from({ length: 22 }, (_, index) => {
  const a = FIELD_NODES[index % FIELD_NODES.length];
  const b = FIELD_NODES[(index * 5 + 7) % FIELD_NODES.length];
  return { a, b };
});

/** The 30 edges of an icosahedron projected to 2D — the cage. */
const CAGE = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts: [number, number, number][] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const edges = new Set<string>();
  const pairs: [number, number][] = [];
  verts.forEach((v, i) => {
    verts.forEach((w, j) => {
      if (j <= i) return;
      const d = Math.hypot(v[0] - w[0], v[1] - w[1], v[2] - w[2]);
      if (d < 2.1) {
        const key = `${i}-${j}`;
        if (!edges.has(key)) {
          edges.add(key);
          pairs.push([i, j]);
        }
      }
    });
  });

  // Simple oblique projection with a slight rotation, matching the
  // camera's three-quarter view of the core.
  const cos = Math.cos(0.42);
  const sin = Math.sin(0.42);
  const project = ([x, y, z]: [number, number, number]) => {
    const rx = x * cos - z * sin;
    const rz = x * sin + z * cos;
    return { x: 250 + rx * 30, y: 250 + (y * 0.92 + rz * 0.28) * 30 };
  };

  return pairs.map(([i, j]) => ({
    a: project(verts[i]!),
    b: project(verts[j]!),
  }));
})();

export function NexusIntelligenceFallback({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "nexus-intelligence-fallback absolute inset-0 overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      <div className="nexus-intelligence-fallback-glow" />

      <svg
        className="nexus-intelligence-fallback-svg"
        viewBox="0 0 500 500"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="nexus-fallback-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="45%" stopColor="#d8d8d8" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Network */}
        <g className="nexus-intelligence-fallback-fade" stroke="#ffffff">
          {FIELD_LINKS.map((link, index) => (
            <line
              key={`l-${index}`}
              x1={link.a.x}
              y1={link.a.y}
              x2={link.b.x}
              y2={link.b.y}
              strokeWidth="0.5"
              strokeOpacity={index % 3 === 0 ? 0.1 : 0.05}
            />
          ))}
          {FIELD_NODES.map((node, index) => (
            <circle
              key={`n-${index}`}
              cx={node.x}
              cy={node.y}
              r={index % 4 === 0 ? 1.8 : 1.1}
              fill="#d8d8d8"
              fillOpacity={index % 4 === 0 ? 0.42 : 0.2}
            />
          ))}
        </g>

        {/* Orbital pathways */}
        <g stroke="#f5f5f5" fill="none">
          <ellipse
            cx="250"
            cy="250"
            rx="150"
            ry="66"
            strokeWidth="0.6"
            strokeOpacity="0.16"
            transform="rotate(-11 250 250)"
          />
          <ellipse
            cx="250"
            cy="250"
            rx="172"
            ry="94"
            strokeWidth="0.6"
            strokeOpacity="0.11"
            transform="rotate(19 250 250)"
          />
          <ellipse
            cx="250"
            cy="250"
            rx="128"
            ry="112"
            strokeWidth="0.6"
            strokeOpacity="0.08"
            transform="rotate(-38 250 250)"
          />
        </g>

        {/* Mid layer */}
        <g>
          {MID_NODES.map((node, index) => {
            const next = MID_NODES[(index + 1) % MID_NODES.length];
            return (
              <line
                key={`m-${index}`}
                x1={node.x}
                y1={node.y}
                x2={next.x}
                y2={next.y}
                stroke="#d8d8d8"
                strokeWidth="0.5"
                strokeOpacity="0.13"
              />
            );
          })}
          {MID_NODES.map((node, index) => (
            <circle
              key={`mn-${index}`}
              cx={node.x}
              cy={node.y}
              r={node.r}
              fill="#ffffff"
              fillOpacity={index % 3 === 0 ? 0.5 : 0.24}
            />
          ))}
        </g>

        {/* Inner cage + core */}
        <g
          className="nexus-intelligence-fallback-breathe"
          stroke="#ffffff"
          strokeWidth="0.7"
        >
          {CAGE.map((edge, index) => (
            <line
              key={`c-${index}`}
              x1={edge.a.x}
              y1={edge.a.y}
              x2={edge.b.x}
              y2={edge.b.y}
              strokeOpacity="0.3"
            />
          ))}
        </g>
        <circle cx="250" cy="250" r="120" fill="url(#nexus-fallback-core)" />
        <circle cx="250" cy="250" r="5" fill="#ffffff" fillOpacity="0.85" />
      </svg>
    </div>
  );
}

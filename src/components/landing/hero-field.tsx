"use client";

import dynamic from "next/dynamic";

// The field is atmosphere, not content: it loads after the hero copy has
// painted and is never required for the page to be readable.
const IntelligenceNetwork = dynamic(
  () =>
    import("@/components/intelligence/intelligence-network").then(
      (module) => module.IntelligenceNetwork
    ),
  { ssr: false }
);

// ============================================================
// NEXUS LANDING — HERO FIELD
// The relationship field behind the headline: small nodes, thin
// connections, a large translucent NEXUS mark, and a soft floor grid.
// Everything is masked away from the centre so the copy stays the
// brightest thing on the screen. Motion pauses off-screen and is
// disabled entirely under prefers-reduced-motion (engine-level).
// ============================================================

export function HeroField() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* The locked NEXUS mark, very large and very quiet, behind the type */}
      <div
        className="absolute left-1/2 top-[44%] h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 opacity-[0.035] sm:h-[560px] sm:w-[560px]"
        style={{
          maskImage: "url('/logo/nexus.png')",
          WebkitMaskImage: "url('/logo/nexus.png')",
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
          backgroundColor: "#ffffff",
        }}
      />

      {/* Horizontal signal lines — architectural, not decorative */}
      <div className="absolute inset-x-0 top-[22%] h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
      <div className="absolute inset-x-0 top-[68%] h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />

      {/* The network itself */}
      <div className="absolute inset-0 [mask-image:radial-gradient(circle_at_50%_45%,transparent_18%,black_62%)]">
        <IntelligenceNetwork
          className="h-full w-full"
          config={{
            nodeCount: 72,
            connectionDistance: 150,
            calmRadius: 380,
            calmCenterY: 0.46,
            nodeOpacity: [0.12, 0.4],
            linkOpacity: [0.03, 0.12],
          }}
        />
      </div>

      {/* Bottom fade into the page */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg-base" />
    </div>
  );
}

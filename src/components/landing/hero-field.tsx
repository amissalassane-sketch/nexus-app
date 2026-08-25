"use client";

import dynamic from "next/dynamic";

// The field is atmosphere, not content: it loads after the hero copy has
// painted and is never required for the page to be readable. The 3D
// scene imports Three.js itself inside an effect, one level deeper still.
const HeroSignalField = dynamic(
  () =>
    import("@/components/landing/hero-signal-field").then(
      (module) => module.HeroSignalField
    ),
  { ssr: false }
);

// ============================================================
// NEXUS LANDING — HERO FIELD
// The relationship field behind the headline, in real 3D: a shallow
// volume of nodes bound to their nearest neighbours, signal pulses
// travelling the links, slow system rotation, pointer parallax on
// the camera. The large translucent NEXUS mark and the soft floor
// grid stay HTML/CSS, masked away from the centre so the copy stays
// the brightest thing on the screen. Motion parks off-screen and is
// disabled under prefers-reduced-motion (engine-level).
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

      {/* The 3D constellation itself */}
      <div className="absolute inset-0 [mask-image:radial-gradient(circle_at_50%_45%,transparent_16%,black_66%)]">
        <HeroSignalField className="h-full w-full" />
      </div>

      {/* Bottom fade into the page */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg-base" />
    </div>
  );
}

import { NexusLogo } from "@/components/nexus-logo";

// ============================================================
// INTELLIGENCE CORE
//
// "NEXUS INTELLIGENCE" at the centre of the field. Not a button —
// the intelligence layer itself: a dark glass pill with a soft rim
// light, an inner gradient and an extremely subtle glow, floating
// slightly above the node plane.
//
// Layering (each layer animates independently so they never fight):
//   outer   — engine-owned position (projection + cursor follow)
//   glow    — the halo the core casts into the field
//   breath  — the 5s breathing scale/brightness
//   pill    — the physical surface
//   heat    — the answer flare when a signal arrives (--core-heat)
// ============================================================

export function IntelligenceCore() {
  return (
    <div className="nexus-context-core" data-nx-core data-nx-fade>
      <span className="nexus-context-core-glow" aria-hidden="true" />
      <div className="nexus-context-core-breath">
        <div className="nexus-context-core-pill" data-nx-core-pill>
          <NexusLogo size={16} />
          <span className="eyebrow text-text-secondary">
            Nexus Intelligence
          </span>
        </div>
        <span className="nexus-context-core-heat" aria-hidden="true" />
      </div>
    </div>
  );
}

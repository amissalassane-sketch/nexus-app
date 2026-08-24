// ============================================================
// NEXUS INTELLIGENCE — PUBLIC SURFACE
//
// Everything the rest of the application is allowed to import. The
// scene modules under ./scene are an implementation detail: they own
// mutable WebGL state and must only ever be constructed by the engine.
// ============================================================

export { NexusIntelligenceHero } from "./nexus-intelligence-hero";
export type { NexusIntelligenceHeroProps } from "./nexus-intelligence-hero";

export { NexusIntelligenceStage } from "./nexus-intelligence-stage";
export type { NexusIntelligenceStageProps } from "./nexus-intelligence-stage";

export { NexusIntelligenceFallback } from "./nexus-intelligence-fallback";

export { NexusIntelligenceScene } from "./nexus-intelligence-scene";
export type { NexusIntelligenceSceneProps } from "./nexus-intelligence-scene";

export {
  isWebGLAvailable,
  prefersReducedMotion,
  hasFinePointer,
} from "./scene/capabilities";

export type { IntelligenceProfileName } from "./scene/config";
export type { IntelligenceStateName } from "./scene/state";

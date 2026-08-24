import type { CSSProperties } from "react";
import type { ContextNodeConfig } from "./config";
import { scaleForZ } from "./config";

// ============================================================
// CONTEXT NODE
//
// One workspace object in the field — a glass panel with subtle
// physical depth: translucent dark surface, rim highlight, soft
// shadow, depth blur/opacity. The server renders it at its static
// home (CSS variables per responsive profile); once the engine is
// live it owns `left/top/transform/opacity` and the card rides
// the projection instead. Proximity and "lit" state arrive as the
// CSS variables --near / --lit, consumed by the rim ring.
// ============================================================

export function ContextNode({ config }: { config: ContextNodeConfig }) {
  const desktop = config.desktop;
  const mobile = config.mobile;

  const style = {
    "--nx-x": `${desktop.x}%`,
    "--nx-y": `${desktop.y}%`,
    "--nx-mx": `${mobile.x}%`,
    "--nx-my": `${mobile.y}%`,
    "--nx-scale": scaleForZ(desktop.z).toFixed(3),
    "--nx-mscale": scaleForZ(mobile.z).toFixed(3),
    "--nx-blur": `${desktop.blur}px`,
    "--nx-dim": desktop.dim.toFixed(2),
  } as CSSProperties;

  return (
    <div
      className="nexus-context-node"
      data-nx-node={config.id}
      data-nx-fade
      style={style}
    >
      <div className="nexus-context-node-card">
        <p className="text-small font-medium leading-[17px] text-text-primary">
          {config.label}
        </p>
        <p className="mt-0.5 font-mono text-[10px] leading-[13px] uppercase tracking-[0.06em] text-text-quaternary">
          {config.detail}
        </p>
      </div>
    </div>
  );
}

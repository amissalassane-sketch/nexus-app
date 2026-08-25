import type { CSSProperties } from "react";
import {
  Activity,
  CalendarClock,
  CheckSquare,
  FolderKanban,
  GitBranch,
  Layers,
  Target,
  TrendingUp,
} from "lucide-react";
import type { ContextNodeConfig } from "./config";
import { scaleForZ } from "./config";

// ============================================================
// CONTEXT NODE
//
// One workspace object in the field — a real product card, not a
// floating label: an icon tile, the object's name and a mono
// caption of what NEXUS reads from it. Glass surface, rim light,
// soft shadow, depth blur/opacity. The server renders it at its
// static home (CSS variables per responsive profile); once the
// engine is live it owns `left/top/transform/opacity` and the card
// rides the projection instead. Proximity and "lit" state arrive
// as the CSS variables --near / --lit, consumed by the rim ring.
// ============================================================

const ICONS = {
  "check-square": CheckSquare,
  "folder-kanban": FolderKanban,
  target: Target,
  "calendar-clock": CalendarClock,
  "trending-up": TrendingUp,
  "git-branch": GitBranch,
  activity: Activity,
  layers: Layers,
} as const;

export function ContextNode({ config }: { config: ContextNodeConfig }) {
  const desktop = config.desktop;
  const mobile = config.mobile;
  const Icon = ICONS[config.icon];

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
        <span className="nexus-context-node-tile" aria-hidden="true">
          <Icon size={13} strokeWidth={1.75} />
        </span>
        <span className="nexus-context-node-text">
          <span className="nexus-context-node-label">{config.label}</span>
          <span className="nexus-context-node-detail">{config.detail}</span>
        </span>
      </div>
    </div>
  );
}

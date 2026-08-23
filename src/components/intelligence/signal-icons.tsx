import {
  AlertOctagon,
  CalendarClock,
  GitBranch,
  Lightbulb,
  MoonStar,
  Pause,
  TrendingUp,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { InsightSeverity, SignalKind } from "@/lib/intelligence/engine";
import type { BadgeTone } from "@/components/ui/badge";

// ============================================================
// NEXUS — SIGNAL VOCABULARY
// One mapping from the engine's signal model to the visual language,
// shared by every surface that renders a signal (overview, intelligence,
// detail panel, notifications). Severity is carried by icon + label +
// position, never by colour alone.
// ============================================================

export const SIGNAL_ICON: Record<SignalKind, LucideIcon> = {
  blocked: Pause,
  "at-risk": Waves,
  deadline: CalendarClock,
  drifting: MoonStar,
  inactive: Pause,
  dependency: GitBranch,
  opportunity: Lightbulb,
  momentum: TrendingUp,
};

export const SEVERITY_TONE: Record<InsightSeverity, BadgeTone> = {
  critical: "danger",
  warning: "warning",
  info: "info",
  positive: "success",
};

export const SEVERITY_TEXT: Record<InsightSeverity, string> = {
  critical: "text-danger",
  warning: "text-warning",
  info: "text-info",
  positive: "text-success",
};

export const SEVERITY_RAIL: Record<InsightSeverity, string> = {
  critical: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  positive: "bg-success",
};

export const CriticalIcon = AlertOctagon;

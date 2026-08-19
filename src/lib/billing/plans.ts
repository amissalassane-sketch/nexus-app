// ============================================================
// NEXUS — PLAN PRESENTATION METADATA
// Limits themselves stay in src/lib/plan-limits.ts (single source of
// truth, mirrored by the SQL migrations). This file only describes how
// a plan is *presented* on /upgrade and /settings/billing.
//
// NOTE ON PRICING: no payment provider is connected yet, so no price is
// invented here. `priceLabel` stays null until FedaPay (or another
// provider) is wired through /api/billing/upgrade, and the UI shows a
// neutral "pricing announced at launch" state instead of a fake amount.
// ============================================================

import { PLAN_FEATURES, PLAN_LIMITS, type PlanName } from "@/lib/plan-limits";

export interface PlanPresentation {
  name: PlanName;
  tagline: string;
  description: string;
  /** Set once a real payment provider and price list exist. */
  priceLabel: string | null;
  pricePeriod: string | null;
  featured: boolean;
  highlights: string[];
}

function limitLines(plan: PlanName): string[] {
  const limits = PLAN_LIMITS[plan];
  const features = PLAN_FEATURES[plan];

  const lines = [
    `${limits.workspaces} workspace${limits.workspaces > 1 ? "s" : ""}`,
    `${limits.projects} projects`,
    `${limits.activeTasks} active tasks`,
    `${limits.goals} goals`,
    `${limits.members} member${limits.members > 1 ? "s" : ""}`,
  ];

  if (features.advancedAnalytics) lines.push("Advanced analytics");
  if (features.advancedCollaboration) lines.push("Advanced collaboration");
  if (features.advancedPermissions) lines.push("Granular permissions");

  return lines;
}

export const PLAN_PRESENTATION: Record<PlanName, PlanPresentation> = {
  FREE: {
    name: "FREE",
    tagline: "Start",
    description: "Run your personal system and learn how NEXUS thinks.",
    priceLabel: "$0",
    pricePeriod: "forever",
    featured: false,
    highlights: limitLines("FREE"),
  },
  PRO: {
    name: "PRO",
    tagline: "Scale",
    description: "For operators who run several projects in parallel.",
    priceLabel: null,
    pricePeriod: "per month",
    featured: true,
    highlights: limitLines("PRO"),
  },
  TEAM: {
    name: "TEAM",
    tagline: "Collaborate",
    description: "Shared workspaces, higher limits, team permissions.",
    priceLabel: null,
    pricePeriod: "per month",
    featured: false,
    highlights: limitLines("TEAM"),
  },
};

export const PLAN_ORDER: PlanName[] = ["FREE", "PRO", "TEAM"];

export function planRank(plan: PlanName): number {
  return PLAN_ORDER.indexOf(plan);
}

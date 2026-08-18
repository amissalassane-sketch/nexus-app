"use client";

// ============================================================
// NEXUS  UpgradePrompt
// Reusable component displayed when a plan limit is hit.
// Uses existing NEXUS design tokens  no new styles.
// ============================================================

import { X } from "lucide-react";
import { type LimitCheckResult, PLAN_LIMITS, type PlanName } from "@/lib/plan-limits";

const RESOURCE_LABELS: Record<string, string> = {
  projects: "projects",
  activeTasks: "active tasks",
  goals: "goals",
  members: "members",
  workspaces: "workspaces",
};

const NEXT_PLAN: Record<PlanName, PlanName | null> = {
  FREE: "PRO",
  PRO: "TEAM",
  TEAM: null,
};

interface UpgradePromptProps {
  limitResult: LimitCheckResult;
  onDismiss?: () => void;
}

export function UpgradePrompt({ limitResult, onDismiss }: UpgradePromptProps) {
  const { current, limit, plan, resource } = limitResult;
  const resourceLabel = RESOURCE_LABELS[resource] ?? resource;
  const nextPlan = NEXT_PLAN[plan];
  const nextLimits = nextPlan ? PLAN_LIMITS[nextPlan] : null;
  const nextLimit = nextLimits ? nextLimits[resource] : null;

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400 mb-1">
            Plan limit reached
          </p>
          <h3 className="text-body font-semibold text-text-primary">
            You have reached your {resourceLabel} limit
          </h3>

          {/* Current usage */}
          <p className="mt-1 text-small text-text-secondary">
            Your <span className="font-semibold text-text-primary">{plan}</span> plan
            allows <span className="font-mono font-semibold text-text-primary">{limit}</span> {resourceLabel}.
            You currently have <span className="font-mono font-semibold text-text-primary">{current}</span>.
          </p>

          {/* Downgrade note */}
          <p className="mt-2 text-xs text-text-secondary">
            Your existing {resourceLabel} are safe  you can continue using them.
            Creating new {resourceLabel} requires an upgrade.
          </p>

          {/* Upgrade CTA */}
          {nextPlan && nextLimit !== null && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="rounded-md border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-secondary">
                <span className="font-mono font-semibold text-text-primary">{nextPlan}</span>
                {"  "}up to{" "}
                <span className="font-mono font-semibold text-text-primary">{nextLimit}</span>{" "}
                {resourceLabel}
              </div>
              <a
                href="/settings/billing"
                className="rounded-md bg-[#F2F1ED] px-4 py-2 text-xs font-semibold text-[#0C0C0E] transition hover:bg-white"
              >
                Upgrade to {nextPlan}
              </a>
            </div>
          )}

          {!nextPlan && (
            <p className="mt-3 text-xs text-text-tertiary">
              You are on the highest plan. Contact support to request a custom limit.
            </p>
          )}
        </div>

        {/* Dismiss */}
        {onDismiss && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="shrink-0 rounded p-1 text-text-tertiary hover:text-text-primary transition"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}


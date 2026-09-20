"use client";

// ============================================================
// NEXUS V3 — UpgradePrompt
// Shown when a workspace hits a plan limit. Never a silently
// disabled button: it explains what is limited, the current plan,
// what the next plan unlocks, and offers a real upgrade path.
// Server-side enforcement stays in Supabase (triggers + RPC).
// ============================================================

import Link from "next/link";
import { IconArrowUpRight, IconX } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import {
  type LimitCheckResult,
  PLAN_LIMITS,
  type PlanName,
} from "@/lib/plan-limits";
import { Progress } from "@/components/ui/feedback";
import { buttonClasses } from "@/components/ui/button";

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
  const nextLimit = nextPlan ? PLAN_LIMITS[nextPlan][resource] : null;

  return (
    <div
      role="alert"
      className="rounded-card border border-lavender-border bg-bg-subtle p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-lavender">
            Plan limit reached
          </p>
          <h3 className="mt-1 text-h2 text-text-primary">
            You have reached your {resourceLabel} limit
          </h3>

          <p className="mt-1.5 text-small text-text-secondary">
            Your <span className="font-mono text-text-primary">{plan}</span> plan
            includes{" "}
            <span className="font-mono tabular-nums text-text-primary">{limit}</span>{" "}
            {resourceLabel}. You are currently using{" "}
            <span className="font-mono tabular-nums text-text-primary">{current}</span>.
          </p>

          <Progress
            value={limit > 0 ? (current / limit) * 100 : 100}
            label={`${resourceLabel} usage`}
            tone="lavender"
            className="mt-3 max-w-sm"
          />

          <p className="mt-3 text-caption text-text-tertiary">
            Existing {resourceLabel} keep working. Creating new ones requires more
            capacity.
          </p>

          {nextPlan && nextLimit !== null ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="rounded-pill border border-border-default bg-bg-surface px-3 py-1.5 font-mono text-mono text-text-secondary">
                <span className="text-text-primary">{nextPlan}</span> · up to{" "}
                <span className="tabular-nums text-text-primary">{nextLimit}</span>{" "}
                {resourceLabel}
              </div>
              <Link
                href="/upgrade"
                className={buttonClasses({ variant: "primary", size: "md" })}
              >
                Upgrade to {nextPlan}
                <NexusIcon icon={IconArrowUpRight} />
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-caption text-text-tertiary">
              You are on the highest plan. Contact support to request a custom limit.
            </p>
          )}
        </div>

        {onDismiss ? (
          <button
            type="button"
            aria-label="Dismiss upgrade notice"
            onClick={onDismiss}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-input text-text-tertiary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
          >
            <NexusIcon icon={IconX} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

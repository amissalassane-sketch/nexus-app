"use client";

// ============================================================
// NEXUS — FeatureGate
// Wrapper that displays UpgradePrompt when a limit is reached.
// ============================================================

import type { ReactNode } from "react";
import type { LimitCheckResult } from "@/lib/plan-limits";
import { UpgradePrompt } from "@/components/upgrade-prompt";

interface FeatureGateProps {
  limitResult: LimitCheckResult | null;
  onDismiss?: () => void;
  children?: ReactNode;
}

export function FeatureGate({ limitResult, onDismiss, children }: FeatureGateProps) {
  if (!limitResult) return children ? <>{children}</> : null;

  return (
    <div className="space-y-4">
      <UpgradePrompt limitResult={limitResult} onDismiss={onDismiss} />
      {children}
    </div>
  );
}

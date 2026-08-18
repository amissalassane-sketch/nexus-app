"use client";

// ============================================================
// NEXUS — useFeatureGate
// Reusable hook for pre-checking plan limits before create actions.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import type { LimitCheckResult } from "@/lib/plan-limits";
import { isPlanLimitError, parsePlanLimitError } from "@/lib/plan-errors";
import { getWorkspacePlan } from "@/lib/entitlements";

type LimitCheckFn = (workspaceId: string) => Promise<LimitCheckResult>;

export function useFeatureGate(
  workspaceId: string | null,
  checkFn: LimitCheckFn,
  /** Re-run when usage count changes (e.g. items.length) */
  usageVersion = 0
) {
  const [limitResult, setLimitResult] = useState<LimitCheckResult | null>(null);

  const refresh = useCallback(async (): Promise<LimitCheckResult | null> => {
    if (!workspaceId) return null;
    const result = await checkFn(workspaceId);
    setLimitResult(result.allowed ? null : result);
    return result;
  }, [workspaceId, checkFn]);

  useEffect(() => {
    let cancelled = false;

    async function runCheck() {
      if (!workspaceId) {
        setLimitResult(null);
        return;
      }

      const result = await checkFn(workspaceId);
      if (!cancelled) {
        setLimitResult(result.allowed ? null : result);
      }
    }

    void runCheck();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, checkFn, usageVersion]);

  /** Returns true if the action is allowed, false if blocked (shows prompt) */
  const guardCreate = useCallback(async (): Promise<boolean> => {
    const result = await refresh();
    return result?.allowed ?? true;
  }, [refresh]);

  /** Call after a Supabase mutation error to show upgrade prompt */
  const handleMutationError = useCallback(
    async (message: string): Promise<boolean> => {
      if (!isPlanLimitError(message)) return false;
      const plan = workspaceId ? await getWorkspacePlan(workspaceId) : "FREE";
      const parsed = parsePlanLimitError(message, plan);
      if (parsed) {
        setLimitResult(parsed);
        return true;
      }
      await refresh();
      return true;
    },
    [workspaceId, refresh]
  );

  const dismiss = useCallback(() => setLimitResult(null), []);

  return { limitResult, guardCreate, handleMutationError, dismiss, refresh };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, Circle, Loader2, Pause, Target, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IntelligenceMission, MissionStep, MissionStepStatus } from "@/lib/intelligence/types";

// ============================================================
// NEXUS — MISSION PANEL (Phase 4)
// ============================================================
// Displays the active mission: title, progress, steps (with status
// icons), the deterministic next best action, and actions
// (continue / unblock / cancel). Mutations always go through
// POST /api/intelligence/action with human confirmation and a
// verified read-back — a step is never marked completed by the UI.
// Mobile-safe: ≥44px touch targets, no hover-only features.
// ============================================================

const STATUS_ICON: Record<MissionStepStatus, typeof Circle> = {
  planned: Circle,
  ready: ChevronRight,
  in_progress: Loader2,
  blocked: Pause,
  waiting: Circle,
  completed: Check,
  failed: X,
  cancelled: X,
};

const STATUS_LABEL: Record<MissionStepStatus, string> = {
  planned: "Planifiée",
  ready: "Prête",
  in_progress: "En cours",
  blocked: "Bloquée",
  waiting: "En attente",
  completed: "Terminée",
  failed: "Échouée",
  cancelled: "Annulée",
};

export function MissionPanel({ workspaceId }: { workspaceId: string }) {
  const [mission, setMission] = useState<IntelligenceMission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executedResult, setExecutedResult] = useState<{ message: string; verified: boolean } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/intelligence/missions?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "GET" });
      const data = await res.json();
      if (res.ok && data.success) {
        setMission(data.missions?.[0] ?? null);
        setError(null);
      } else {
        setError(data.error ?? "Impossible de charger la mission");
      }
    } catch {
      setError("Réseau indisponible");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const continueMission = async (nextAction: NonNullable<IntelligenceMission["nextBestAction"]>) => {
    const action = nextAction.action;
    // Navigation steps: open the target; no server execution needed.
    if (nextAction.kind === "navigate" && !action) {
      if (nextAction.href) window.location.href = nextAction.href;
      return;
    }
    if (!action) return;
    if (action.type === "navigate" && action.payload?.url) {
      window.location.href = action.payload.url;
      return;
    }
    // Mutation: confirm → execute via the secure server layer.
    setExecuting(true);
    setError(null);
    try {
      const res = await fetch("/api/intelligence/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: action.type,
          missionId: mission!.id,
          missionStepId: nextAction.stepId,
          payload: {
            ...action.payload,
            confirmed: true,
            confirmDeletion: action.risk === "high" ? true : undefined,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setExecutedResult({
          message: data.message ?? "Action terminée",
          verified: data.verification?.verified === true,
        });
        if (data.mission) setMission(data.mission);
        else await refresh();
        window.dispatchEvent(new CustomEvent("nexus:activation", { detail: { type: "mission_step" } }));
      } else {
        setError(data.error ?? "Échec de l'action");
        if (data.mission) setMission(data.mission);
      }
    } catch {
      setError("Erreur réseau pendant l'exécution");
    } finally {
      setExecuting(false);
    }
  };

  const cancel = async () => {
    if (!mission) return;
    await fetch("/api/intelligence/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", id: mission.id }),
    }).catch(() => undefined);
    setMission(null);
  };

  if (loading) return null;
  if (!mission && !error) return null;

  return (
    <section
      aria-label="Mission Intelligence"
      className="relative overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/60"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent"
        aria-hidden="true"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 sm:px-5">
        <div className="flex items-center gap-2">
          <Target size={15} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
          <p className="eyebrow text-text-secondary">Mission</p>
          {mission?.status === "blocked" ? <Badge tone="warning">Bloquée</Badge> : null}
          {mission?.status === "completed" ? <Badge tone="success">Terminée</Badge> : null}
        </div>
        {mission ? (
          <button
            type="button"
            onClick={() => void cancel()}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-input text-text-quaternary transition-colors hover:bg-accent-ghost hover:text-text-primary"
            aria-label="Annuler la mission"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mx-4 mb-3 mt-2 rounded-input border border-danger-border bg-danger-bg/40 px-3.5 py-2.5 text-small text-danger sm:mx-5">
          {error}
        </div>
      ) : null}

      {mission ? (
        <div className="px-4 pb-4 sm:px-5">
          <h3 className="mt-1 text-h3 font-semibold text-text-primary">{mission.title}</h3>
          <p className="mt-0.5 text-small text-text-secondary">{mission.objective}</p>

          {/* Progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-caption text-text-secondary">
              <span>Progression</span>
              <span className="font-mono text-text-primary">{mission.progress}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-pill bg-bg-surface-2" role="progressbar" aria-valuenow={mission.progress} aria-valuemin={0} aria-valuemax={100}>
              <div
                className="h-full rounded-pill bg-accent transition-[width] duration-300"
                style={{ width: `${Math.min(100, Math.max(0, mission.progress))}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <ul className="mt-3 flex flex-col gap-1">
            {mission.steps.map((step: MissionStep) => {
              const Icon = STATUS_ICON[step.status];
              const completed = step.status === "completed";
              const failed = step.status === "failed";
              const blocked = step.status === "blocked";
              return (
                <li key={step.id} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                      completed
                        ? "border-success-border bg-success-bg/40 text-success"
                        : failed
                          ? "border-danger-border bg-danger-bg/40 text-danger"
                          : blocked
                            ? "border-warning-border bg-warning-bg/40 text-warning"
                            : step.status === "ready"
                              ? "border-accent/60 bg-accent/10 text-accent"
                              : "border-border-subtle text-text-quaternary"
                    )}
                  >
                    <Icon size={13} strokeWidth={2} className={step.status === "in_progress" ? "animate-spin" : undefined} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[13px] leading-[19px] font-medium", completed ? "text-text-tertiary line-through" : "text-text-primary")}>
                      {step.title}
                    </p>
                    {blocked && step.blockedReason ? (
                      <p className="mt-0.5 text-caption text-warning">{step.blockedReason}</p>
                    ) : null}
                    {failed ? <p className="mt-0.5 text-caption text-danger">{step.verification?.summary ?? "Étape échouée"}</p> : null}
                  </div>
                  <span className="shrink-0 pt-0.5 text-[10px] font-mono uppercase tracking-wider text-text-quaternary">
                    {STATUS_LABEL[step.status]}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Next best action */}
          {mission.nextBestAction ? (
            <div className="mt-3.5 rounded-input border border-lavender-border/30 bg-bg-surface/60 p-3.5">
              <p className="eyebrow text-lavender">Prochaine meilleure action</p>
              <p className="mt-1 text-[13px] font-medium text-text-primary">{mission.nextBestAction.label}</p>
              <p className="mt-0.5 text-caption text-text-tertiary">{mission.nextBestAction.reason}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Button
                  loading={executing}
                  onClick={() => void continueMission(mission.nextBestAction!)}
                  className="min-h-[44px]"
                >
                  {mission.status === "blocked" ? "Débloquer" : "Continuer"}
                </Button>
              </div>
            </div>
          ) : mission.status === "completed" ? (
            <div className="mt-3.5 rounded-input border border-success-border bg-success-bg/40 px-3 py-2.5 text-small text-success">
              <span className="flex items-center gap-1.5">
                <Check size={14} strokeWidth={2.5} />
                Mission terminée — toutes les étapes sont vérifiées.
              </span>
            </div>
          ) : null}

          {executedResult ? (
            <div className="mt-2.5 animate-fade-in rounded-input border border-success-border bg-success-bg/40 px-3 py-2 text-caption text-success">
              <span className="flex items-center gap-1.5">
                <Check size={13} strokeWidth={2.5} />
                {executedResult.message}
                {executedResult.verified ? " · vérifié côté serveur" : ""}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Circle,
  CircleDot,
  Loader2,
  Pause,
  RotateCcw,
  Target,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/feedback";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import {
  VerificationLifecycle,
} from "@/components/motion/intelligence-states";
import type {
  IntelligenceMission,
  MissionNextBestAction,
  MissionStep,
  MissionStepStatus,
} from "@/lib/intelligence/types";

const STATUS_ICON: Record<MissionStepStatus, typeof Circle> = {
  planned: Circle,
  ready: CircleDot,
  in_progress: Loader2,
  blocked: Pause,
  waiting: Circle,
  completed: Check,
  failed: X,
  cancelled: X,
};

const STATUS_LABEL: Record<MissionStepStatus, string> = {
  planned: "À venir",
  ready: "Prête",
  in_progress: "En cours",
  blocked: "Bloquée",
  waiting: "En attente",
  completed: "Terminée",
  failed: "Échouée",
  cancelled: "Annulée",
};

const OFFLINE_MESSAGE =
  "Connexion perdue. Les dernières informations affichées restent disponibles.";

export function MissionPanel({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [mission, setMission] = useState<IntelligenceMission | null>(null);
  const [, setPrevMission] = useState<IntelligenceMission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [verificationState, setVerificationState] = useState<
    "proposed" | "confirm" | "executing" | "verifying" | "verified" | "failed" | null
  >(null);
  const [executedResult, setExecutedResult] = useState<{
    message: string;
    verified: boolean;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<MissionNextBestAction | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [nextActionTransitioning, setNextActionTransitioning] = useState(false);
  const responseRef = useRef<HTMLDivElement | null>(null);
  const prevNextActionLabel = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingAction) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVerificationState(null);
    }
  }, [pendingAction]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setOffline(false);
    try {
      const res = await fetch(
        `/api/intelligence/missions?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: "GET" }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        const nextMission = data.missions?.[0] ?? null;
        if (nextMission && mission && nextMission.nextBestAction?.label !== prevNextActionLabel.current) {
          if (!reduced && prevNextActionLabel.current) {
            setNextActionTransitioning(true);
            setTimeout(() => setNextActionTransitioning(false), 320);
          }
        }
        if (nextMission?.nextBestAction?.label) {
          prevNextActionLabel.current = nextMission.nextBestAction.label;
        }
        if (mission) setPrevMission(mission);
        setMission(nextMission);
        setError(null);
      } else {
        setError(data.error ?? "Impossible de charger la mission.");
      }
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, mission, reduced]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const runAction = useCallback(
    async (nextAction: MissionNextBestAction) => {
      if (!mission) return;
      const action = nextAction.action;
      if (nextAction.kind === "navigate" || !action) {
        if (nextAction.href) router.push(nextAction.href);
        else if (action?.type === "navigate" && action.payload?.url)
          router.push(String(action.payload.url));
        return;
      }
      if (action.type === "navigate" && action.payload?.url) {
        router.push(String(action.payload.url));
        return;
      }
      setExecuting(true);
      setVerificationState("executing");
      setError(null);

      // Simulate verification lifecycle: executing → verifying → verified
      const verificationTimer1 = setTimeout(() => setVerificationState("verifying"), 600);
      try {
        const res = await fetch("/api/intelligence/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: action.type,
            missionId: mission.id,
            missionStepId: nextAction.stepId,
            payload: {
              ...action.payload,
              confirmed: true,
              confirmDeletion: action.risk === "high" ? true : undefined,
            },
          }),
        });
        clearTimeout(verificationTimer1);
        const data = await res.json();
        if (res.ok && data.success) {
          setVerificationState(data.verification?.verified ? "verified" : "failed");
          setTimeout(() => {
            setExecutedResult({
              message: data.message ?? "Action terminée",
              verified: data.verification?.verified === true,
            });
            setPendingAction(null);
            setVerificationState(null);
            if (data.mission) {
              if (!reduced && data.mission.nextBestAction?.label !== mission.nextBestAction?.label) {
                setNextActionTransitioning(true);
                setTimeout(() => setNextActionTransitioning(false), 320);
              }
              setPrevMission(mission);
              setMission(data.mission);
              prevNextActionLabel.current = data.mission.nextBestAction?.label ?? null;
            } else {
              void refresh();
            }
            window.dispatchEvent(
              new CustomEvent("nexus:activation", { detail: { type: "mission_step" } })
            );
            responseRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 400);
        } else {
          setVerificationState("failed");
          setError(data.error ?? "Échec de l'action.");
          setTimeout(() => setVerificationState(null), 1200);
        }
      } catch {
        clearTimeout(verificationTimer1);
        setVerificationState("failed");
        setError("Erreur réseau pendant l'exécution — l'action n'a pas été appliquée.");
        setTimeout(() => setVerificationState(null), 1200);
      } finally {
        setExecuting(false);
      }
    },
    [mission, refresh, router, reduced]
  );

  const cancelMission = useCallback(async () => {
    if (!mission) return;
    setExecuting(true);
    try {
      await fetch("/api/intelligence/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", id: mission.id }),
      }).catch(() => undefined);
    } finally {
      setExecuting(false);
      setConfirmingCancel(false);
      setMission(null);
    }
  }, [mission]);

  if (loading && !mission) {
    return (
      <section
        aria-label="Mission Intelligence"
        className="rounded-card border border-border-subtle bg-bg-subtle/60 px-4 py-4 sm:px-5 animate-[intelligence-state-in_320ms_var(--ease-nexus)_both]"
      >
        <div className="flex items-center gap-2">
          <Target size={15} strokeWidth={1.75} className="text-accent animate-[signal-pulse_2.6s_var(--ease-nexus)_infinite]" aria-hidden="true" />
          <p className="eyebrow text-text-secondary">Mission</p>
          <span className="ml-auto flex items-center gap-1">
            <span className="h-1 w-1 rounded-pill bg-text-tertiary animate-[intelligence-thinking_1s_var(--ease-nexus)_infinite]" />
            <span className="h-1 w-1 rounded-pill bg-text-tertiary animate-[intelligence-thinking_1s_var(--ease-nexus)_150ms_infinite]" />
            <span className="h-1 w-1 rounded-pill bg-text-tertiary animate-[intelligence-thinking_1s_var(--ease-nexus)_300ms_infinite]" />
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-2" aria-hidden="true">
          <div className="h-3.5 w-2/3 rounded-pill bg-white/[0.05] skeleton-shimmer animate-pulse" />
          <div className="h-2.5 w-1/2 rounded-pill bg-white/[0.04] skeleton-shimmer animate-pulse" style={{ animationDelay: "100ms" }} />
          <div className="mt-2 h-2 rounded-pill bg-white/[0.04] skeleton-shimmer animate-pulse" style={{ animationDelay: "200ms" }} />
        </div>
        <span className="sr-only">Chargement de la mission…</span>
      </section>
    );
  }

  if (!mission) {
    if (offline) {
      return (
        <section
          aria-label="Mission Intelligence"
          className="rounded-card border border-border-subtle bg-bg-subtle/60 px-4 py-4 sm:px-5 animate-[intelligence-state-in_280ms_var(--ease-nexus)_both]"
        >
          <div className="flex items-center gap-2">
            <Target size={15} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
            <p className="eyebrow text-text-secondary">Mission</p>
          </div>
          <p className="mt-2 text-small text-text-secondary">Connexion perdue. La mission sera chargée dès le retour du réseau.</p>
          <Button variant="secondary" onClick={() => void refresh()} className="mt-2.5 min-h-[44px] active:scale-[0.98]">
            <RotateCcw size={13} strokeWidth={1.75} />
            Réessayer
          </Button>
        </section>
      );
    }
    if (!error) return null;
    return (
      <section
        aria-label="Mission Intelligence"
        className="rounded-card border border-border-subtle bg-bg-subtle/60 px-4 py-4 sm:px-5"
      >
        <div className="flex items-center gap-2">
          <Target size={15} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
          <p className="eyebrow text-text-secondary">Mission</p>
        </div>
        <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-text-secondary">{error}</p>
          <Button variant="secondary" onClick={() => void refresh()} className="min-h-[44px]">
            <RotateCcw size={13} strokeWidth={1.75} />
            Réessayer
          </Button>
        </div>
      </section>
    );
  }

  const currentStep = mission.steps.find((step) => step.id === mission.currentStepId);
  const blockedStep = mission.steps.find((step) => step.status === "blocked" && step.blockedReason);
  const whyReason =
    blockedStep?.blockedReason ??
    (currentStep?.status === "blocked" ? currentStep.blockedReason : null) ??
    null;
  const pendingActionStep = mission.steps.find((step) => step.id === pendingAction?.stepId);

  return (
    <section
      id="mission"
      aria-label="Mission Intelligence"
      className="relative scroll-mt-20 overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/60 animate-[intelligence-state-in_340ms_var(--ease-nexus)_both] transition-[border-color] duration-300 ease-nexus hover:border-border-default"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" aria-hidden="true" />

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 sm:px-5">
        <div className="flex items-center gap-2">
          <Target size={15} strokeWidth={1.75} className="text-accent transition-transform duration-200 ease-nexus" aria-hidden="true" />
          <p className="eyebrow text-text-secondary">Mission</p>
          {mission.status === "blocked" ? (
            <Badge tone="warning" className="animate-[badge-in_200ms_var(--ease-nexus)_both]">Bloquée</Badge>
          ) : null}
          {mission.status === "completed" ? (
            <Badge tone="success" className="animate-[badge-in_200ms_var(--ease-nexus)_both]">Terminée</Badge>
          ) : null}
        </div>
        {mission.status !== "completed" ? (
          <button
            type="button"
            onClick={() => {
              setConfirmingCancel(true);
              setPendingAction(null);
            }}
            className="flex min-h-[44px] items-center gap-1.5 rounded-input px-2 text-caption text-text-quaternary transition-[background-color,color,transform] duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary active:bg-accent-ghost-hover active:scale-[0.96]"
            aria-label="Annuler la mission"
          >
            <X size={14} strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden sm:inline">Annuler</span>
          </button>
        ) : null}
      </div>

      {offline ? (
        <div role="status" className="mx-4 mb-3 mt-2 rounded-input border border-warning-border bg-warning-bg/40 px-3.5 py-2.5 text-small text-warning sm:mx-5 animate-[intelligence-state-in_200ms_var(--ease-nexus)_both]">
          {OFFLINE_MESSAGE}
        </div>
      ) : error ? (
        <div role="status" className="mx-4 mb-3 mt-2 rounded-input border border-danger-border bg-danger-bg/40 px-3.5 py-2.5 text-small text-danger sm:mx-5 animate-[intelligence-state-in_200ms_var(--ease-nexus)_both]">
          {error}
        </div>
      ) : null}

      <div className="px-4 pb-4 sm:px-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary">Objectif</span>
            <h3 className="text-h3 font-semibold text-text-primary transition-colors duration-200">{mission.title}</h3>
          </div>
          <span className="font-mono text-[11px] tabular-nums text-text-quaternary">
            {mission.steps.filter((s) => s.status === "completed").length}/{mission.steps.length} étapes
          </span>
        </div>
        <p className="mt-1 text-small text-text-secondary leading-relaxed">{mission.objective}</p>

        <div className="mt-3.5 rounded-input border border-border-subtle bg-bg-surface/40 p-3">
          <div className="flex items-center justify-between text-caption text-text-secondary">
            <span className="font-medium">Progression</span>
            <span className="font-mono text-text-primary tabular-nums font-semibold transition-all duration-500 ease-nexus">{mission.progress}%</span>
          </div>
          <Progress value={mission.progress} tone={mission.status === "blocked" ? "warning" : mission.status === "completed" ? "success" : "white"} className="mt-2" />
        </div>

        {verificationState ? (
          <div className="mt-3 animate-[intelligence-state-in_200ms_var(--ease-nexus)_both]">
            <VerificationLifecycle state={verificationState} />
          </div>
        ) : null}

        {whyReason ? (
          <div className="mt-3.5 rounded-card border border-warning-border/50 bg-warning-bg/15 p-3.5 animate-[intelligence-state-in_260ms_var(--ease-nexus)_both]">
            <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wider text-warning">
              <AlertTriangle size={14} strokeWidth={2} className="shrink-0" aria-hidden="true" />
              <span>Pourquoi ça bloque</span>
            </p>
            <p className="mt-1 text-small leading-relaxed text-text-primary">
              {whyReason}
            </p>
          </div>
        ) : null}

        {currentStep && mission.status !== "completed" ? (
          <div className="mt-3.5 rounded-input border border-border-default bg-bg-surface/60 p-3.5 transition-[border-color,background-color,transform] duration-200 ease-nexus hover:border-border-strong animate-[intelligence-state-in_260ms_var(--ease-nexus)_both]">
            <p className="eyebrow text-text-quaternary">Étape actuelle</p>
            <p className="mt-1 text-[13px] font-medium leading-[19px] text-text-primary">
              <span className="font-mono text-text-tertiary">#{currentStep.order + 1}</span> {currentStep.title}
            </p>
            {currentStep.description ? <p className="mt-1 text-caption text-text-secondary">{currentStep.description}</p> : null}
          </div>
        ) : null}

        {mission.nextBestAction && mission.status !== "completed" ? (
          <div
            className={cn(
              "mt-3.5 rounded-card border-2 border-lavender-border/50 bg-bg-surface/90 p-4 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.6)] transition-all duration-300 ease-nexus",
              nextActionTransitioning
                ? "animate-[nba-exit_220ms_var(--ease-nexus)_both]"
                : "animate-[nba-enter_320ms_var(--ease-nexus)_both] hover:border-lavender-border"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-lavender/10 px-2 py-0.5 eyebrow text-lavender font-semibold tracking-wider">
                <span className="h-1.5 w-1.5 rounded-pill bg-lavender animate-pulse" aria-hidden="true" />
                Prochaine meilleure action
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-text-quaternary">
                Recommandé
              </span>
            </div>
            <p className="mt-2 text-h3 font-semibold text-text-primary transition-colors duration-200">{mission.nextBestAction.label}</p>
            <p className="mt-1 text-small text-text-secondary leading-relaxed">{mission.nextBestAction.reason}</p>

            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              {mission.nextBestAction.kind === "mutate" || mission.nextBestAction.action ? (
                <Button
                  loading={executing && pendingAction?.stepId === mission.nextBestAction.stepId}
                  onClick={() => {
                    setExecutedResult(null);
                    setConfirmingCancel(false);
                    setPendingAction(mission.nextBestAction);
                    setVerificationState("proposed");
                  }}
                  className="min-h-[44px] px-5 text-button font-medium mission-next-action shadow-[0_2px_14px_rgba(255,255,255,0.12)]"
                >
                  {mission.status === "blocked" ? "Débloquer" : "Continuer"}
                </Button>
              ) : mission.nextBestAction.href ? (
                <Button onClick={() => router.push(mission.nextBestAction!.href!)} className="min-h-[44px] px-5 mission-next-action">
                  Ouvrir
                </Button>
              ) : null}
              <button
                type="button"
                onClick={() => setWhyOpen((open) => !open)}
                aria-expanded={whyOpen}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-input px-3 text-caption font-medium text-text-secondary transition-[color,background-color,transform] duration-150 ease-nexus hover:text-text-primary hover:bg-accent-ghost active:text-text-primary active:scale-[0.97]"
              >
                <span>{whyOpen ? "Masquer le contexte" : "Voir pourquoi"}</span>
                <ChevronDown size={13} strokeWidth={1.75} aria-hidden="true" className={cn("transition-transform duration-200 ease-nexus", whyOpen && "rotate-180")} />
              </button>
            </div>

            {whyOpen ? <MissionWhy mission={mission} /> : null}
          </div>
        ) : mission.status === "completed" ? (
          <div className="mt-3.5 rounded-input border border-success-border bg-success-bg/40 px-3 py-2.5 text-small text-success animate-[intelligence-state-in_280ms_var(--ease-nexus)_both]">
            <span className="flex items-center gap-1.5">
              <Check size={14} strokeWidth={2.5} className="animate-[check-pop_320ms_var(--ease-nexus)_both]" />
              Mission terminée — toutes les étapes sont vérifiées.
            </span>
          </div>
        ) : null}

        {pendingAction?.action ? (
          <div role="alertdialog" aria-label="Confirmer l'action" className="mt-3 animate-[scale-in_220ms_var(--ease-nexus)_both] rounded-input border border-border-strong bg-bg-surface p-3.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-small font-medium text-text-primary">Confirmer « {pendingAction.action.label} » ?</p>
              <VerificationLifecycle state={verificationState ?? "confirm"} className="shrink-0 scale-90" />
            </div>
            <p className="mt-0.5 text-caption text-text-secondary">
              {pendingAction.action.description ?? pendingActionStep?.title ?? "Cette action modifiera votre workspace."}
            </p>
            {pendingAction.action.risk === "high" ? (
              <p className="mt-1.5 flex items-start gap-1.5 text-caption text-danger animate-[intelligence-state-in_200ms_var(--ease-nexus)_both]">
                <AlertTriangle size={13} strokeWidth={1.75} className="mt-px shrink-0" aria-hidden="true" />
                Action destructive — exécutée côté serveur puis vérifiée.
              </p>
            ) : null}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button loading={executing} onClick={() => void runAction(pendingAction)} className="min-h-[44px]">
                {executing ? "Exécution & vérification…" : "Confirmer et exécuter"}
              </Button>
              <Button variant="ghost" disabled={executing} onClick={() => setPendingAction(null)} className="min-h-[44px]">
                Annuler
              </Button>
            </div>
          </div>
        ) : null}

        {confirmingCancel ? (
          <div role="alertdialog" aria-label="Confirmer l'annulation de la mission" className="mt-3 animate-[scale-in_220ms_var(--ease-nexus)_both] rounded-input border border-border-strong bg-bg-surface p-3.5">
            <p className="text-small font-medium text-text-primary">Annuler « {mission.title} » ?</p>
            <p className="mt-0.5 text-caption text-text-secondary">La mission et ses étapes ne seront plus proposées. Cette action ne supprime aucune tâche ni aucun projet.</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button variant="danger" loading={executing} onClick={() => void cancelMission()} className="min-h-[44px]">
                Annuler la mission
              </Button>
              <Button variant="ghost" disabled={executing} onClick={() => setConfirmingCancel(false)} className="min-h-[44px]">
                Garder
              </Button>
            </div>
          </div>
        ) : null}

        {executedResult ? (
          <div ref={responseRef} className="mt-3.5 animate-[intelligence-state-in_280ms_var(--ease-nexus)_both] rounded-card border border-success-border bg-success-bg/30 p-3.5 text-small text-success">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-medium">
                <Check size={16} strokeWidth={2.5} className="animate-[check-pop_280ms_var(--ease-nexus)_both] text-success" />
                <span>{executedResult.message}</span>
              </span>
              {executedResult.verified ? (
                <span className="font-mono text-[10px] uppercase tracking-wider text-success/90 border border-success-border/40 rounded px-2 py-0.5 bg-success-bg/20">
                  ✓ vérifié côté serveur
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {mission.steps.length > 0 ? (
          <ol className="mt-4" aria-label="Étapes de la mission">
            {mission.steps
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((step, index) => (
                <MissionStepRow
                  key={step.id}
                  step={step}
                  index={index}
                  executing={executing}
                  onNavigate={(href) => router.push(href)}
                  onMutate={(stepAction) => {
                    setExecutedResult(null);
                    setConfirmingCancel(false);
                    setPendingAction({
                      stepId: step.id,
                      label: stepAction.label,
                      reason: step.blockedReason ?? step.description ?? "",
                      kind: "mutate",
                      action: stepAction,
                    });
                    setVerificationState("proposed");
                  }}
                />
              ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

function MissionStepRow({
  step,
  index,
  executing,
  onNavigate,
  onMutate,
}: {
  step: MissionStep;
  index: number;
  executing: boolean;
  onNavigate: (href: string) => void;
  onMutate: (action: NonNullable<MissionStep["action"]>) => void;
}) {
  const Icon = STATUS_ICON[step.status];
  const completed = step.status === "completed";
  const failed = step.status === "failed";
  const blocked = step.status === "blocked";
  const actionable =
    !completed && !failed && step.status !== "cancelled" && (step.status === "ready" || step.status === "in_progress" || blocked);
  const action = step.action;
  const isNavigation = action?.type === "navigate" || (action && !action.confirmationRequired);

  return (
    <li
      className={cn(
        "flex items-start gap-2.5 border-t border-border-subtle py-2.5 first:border-t-0 mission-step transition-all duration-200 ease-nexus will-change-transform",
        completed && "mission-step-completed",
        blocked && "mission-step-blocked",
        !completed && "hover:bg-white/[0.01] -mx-1 px-1 rounded-nav"
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,color,transform] duration-200 ease-nexus will-change-transform",
          completed ? "border-success-border bg-success-bg/40 text-success" : failed ? "border-danger-border bg-danger-bg/40 text-danger" : blocked ? "border-warning-border bg-warning-bg/40 text-warning animate-[intelligence-state-in_240ms_var(--ease-nexus)_both]" : step.status === "in_progress" || step.status === "ready" ? "border-accent/60 bg-accent/10 text-accent" : "border-border-subtle text-text-quaternary"
        )}
      >
        <Icon size={13} strokeWidth={2} className={cn(step.status === "in_progress" && "animate-spin", completed && "animate-[check-pop_280ms_var(--ease-nexus)_both]")} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13px] leading-[19px] font-medium transition-[color,opacity] duration-200 ease-nexus", completed ? "text-text-tertiary line-through" : "text-text-primary")}>
          <span className="font-mono text-[11px] text-text-quaternary">#{step.order + 1}</span> {step.title}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-4 text-text-tertiary transition-colors duration-200">
          {STATUS_LABEL[step.status]}
          {step.dependencies.length > 0 ? ` · dépend de ${step.dependencies.length} étape${step.dependencies.length > 1 ? "s" : ""}` : ""}
        </p>
        {blocked && step.blockedReason ? <p className="mt-0.5 text-caption text-warning animate-[intelligence-state-in_200ms_var(--ease-nexus)_both]">Dépendance : {step.blockedReason}</p> : null}
        {failed && step.verification ? <p className="mt-0.5 text-caption text-danger">{step.verification.summary || "Étape échouée"}</p> : null}
      </div>
      {actionable && action ? (
        isNavigation && action.payload?.url ? (
          <button type="button" onClick={() => onNavigate(String(action.payload!.url))} className="inline-flex min-h-[44px] shrink-0 items-center rounded-input px-2 text-caption font-medium text-text-secondary transition-[color,transform] duration-150 ease-nexus hover:text-text-primary active:text-text-primary active:scale-[0.96]">
            Ouvrir
          </button>
        ) : (
          <button type="button" disabled={executing} onClick={() => onMutate(action)} className="inline-flex min-h-[44px] shrink-0 items-center rounded-input border border-border-default px-2.5 text-caption font-medium text-text-secondary transition-[border-color,color,background-color,transform] duration-150 ease-nexus hover:border-border-strong hover:text-text-primary active:bg-accent-ghost active:scale-[0.97] disabled:opacity-40">
            {action.risk === "high" ? "Débloquer…" : action.label}
          </button>
        )
      ) : null}
    </li>
  );
}

function MissionWhy({ mission }: { mission: IntelligenceMission }) {
  const { context } = mission;
  return (
    <div className="mt-2.5 animate-[intelligence-state-in_240ms_var(--ease-nexus)_both] rounded-input border border-border-subtle bg-bg-subtle/50 p-3">
      <dl className="flex flex-col gap-1.5">
        {context.keyword ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-text-tertiary">Sujet suivi</dt>
            <dd className="text-right font-mono text-caption text-text-primary">{context.keyword}</dd>
          </div>
        ) : null}
        {context.deadlineLabel ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-text-tertiary">Échéance</dt>
            <dd className="text-right font-mono text-caption text-text-primary">{context.deadlineLabel}</dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-caption text-text-tertiary">Tâches liées</dt>
          <dd className="text-right font-mono text-caption text-text-primary">{context.relatedTaskIds.length}</dd>
        </div>
      </dl>
      {context.blockerLabels.length > 0 ? (
        <div className="mt-2 border-t border-border-subtle pt-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary">Ce qui bloque</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {context.blockerLabels.map((label) => (
              <li key={label} className="text-caption text-text-secondary animate-[list-in_200ms_var(--ease-nexus)_both]">— {label}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {context.signals.length > 0 ? (
        <div className="mt-2 border-t border-border-subtle pt-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary">Signaux liés</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {context.signals.slice(0, 4).map((signal, idx) => (
              <li key={`${signal.type}-${signal.title}`} className="text-caption text-text-secondary" style={{ animationDelay: `${idx * 40}ms` }}>
                {signal.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

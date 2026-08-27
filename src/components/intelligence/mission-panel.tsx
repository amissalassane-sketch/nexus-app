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
import type {
  IntelligenceMission,
  MissionNextBestAction,
  MissionStep,
  MissionStepStatus,
} from "@/lib/intelligence/types";

// ============================================================
// NEXUS — MISSION PANEL (Phase 4, redesigned for Phase 6 mobile)
// The active mission as a phone-first surface:
//
//   MISSION — title, objective, progress
//   WHY IT IS BLOCKED — the reason, always in plain words
//   NEXT BEST ACTION — one visible action + "Voir pourquoi"
//   STEPS — compact list: order, status, dependency, block reason
//
// Contract kept from Phase 4:
//   - every mutation goes through POST /api/intelligence/action
//     with an explicit human confirmation step BEFORE the request
//     (nothing is ever sent with confirmed:true implicitly);
//   - completion is decided by the verified server read-back,
//     never by the UI;
//   - ≥44px touch targets, no hover-only affordance.
// ============================================================

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

/** Network failures keep the last rendered mission: the message says
 *  so instead of pretending the data disappeared. */
const OFFLINE_MESSAGE =
  "Connexion perdue. Les dernières informations affichées restent disponibles.";

export function MissionPanel({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [mission, setMission] = useState<IntelligenceMission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Network-level failure flag: unlike an API error, the network being
  // down does not invalidate what is already on screen.
  const [offline, setOffline] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executedResult, setExecutedResult] = useState<{
    message: string;
    verified: boolean;
  } | null>(null);

  // Confirmation gate — a mutation is only sent after the user pressed
  // "Confirmer" in the inline panel. `pendingAction` holds the exact
  // next-best-action the user asked to run.
  const [pendingAction, setPendingAction] = useState<MissionNextBestAction | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  // "Voir pourquoi" — the mission context disclosure (blockers, signals).
  const [whyOpen, setWhyOpen] = useState(false);

  // Steps that are not relevant anymore once completed are still listed,
  // but the per-step action is only offered on the actionable ones.
  const responseRef = useRef<HTMLDivElement | null>(null);

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
        setMission(data.missions?.[0] ?? null);
        setError(null);
      } else {
        setError(data.error ?? "Impossible de charger la mission.");
      }
    } catch {
      // Keep the previous mission rendered — the surface degrades, it
      // never blanks out what the user was reading.
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const runAction = useCallback(
    async (nextAction: MissionNextBestAction) => {
      if (!mission) return;
      const action = nextAction.action;
      // Pure navigation steps never hit the mutation layer.
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
      // Mutation — only reachable from the inline confirmation.
      setExecuting(true);
      setError(null);
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
        const data = await res.json();
        if (res.ok && data.success) {
          setExecutedResult({
            message: data.message ?? "Action terminée",
            verified: data.verification?.verified === true,
          });
          setPendingAction(null);
          if (data.mission) setMission(data.mission);
          else await refresh();
          window.dispatchEvent(
            new CustomEvent("nexus:activation", { detail: { type: "mission_step" } })
          );
          // Bring the verified result into the viewport on phones.
          responseRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
          setError(data.error ?? "Échec de l'action.");
        }
      } catch {
        setError("Erreur réseau pendant l'exécution — l'action n'a pas été appliquée.");
      } finally {
        setExecuting(false);
      }
    },
    [mission, refresh, router]
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
      // Local mirror of the server outcome — the mission disappears
      // from this surface either way, matching Phase 4 behaviour.
      setExecuting(false);
      setConfirmingCancel(false);
      setMission(null);
    }
  }, [mission]);

  // ------------------------------------------------------------
  // States: skeleton → error-only → mission (possibly with error)
  // ------------------------------------------------------------
  if (loading && !mission) {
    return (
      <section
        aria-label="Mission Intelligence"
        className="rounded-card border border-border-subtle bg-bg-subtle/60 px-4 py-4 sm:px-5"
      >
        <div className="flex items-center gap-2">
          <Target size={15} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
          <p className="eyebrow text-text-secondary">Mission</p>
        </div>
        <div className="mt-3 flex flex-col gap-2" aria-hidden="true">
          <div className="h-3.5 w-2/3 animate-pulse rounded-pill bg-white/[0.05]" />
          <div className="h-2.5 w-1/2 animate-pulse rounded-pill bg-white/[0.04]" />
          <div className="mt-2 h-2 animate-pulse rounded-pill bg-white/[0.04]" />
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
          className="rounded-card border border-border-subtle bg-bg-subtle/60 px-4 py-4 sm:px-5"
        >
          <div className="flex items-center gap-2">
            <Target size={15} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
            <p className="eyebrow text-text-secondary">Mission</p>
          </div>
          <p className="mt-2 text-small text-text-secondary">
            Connexion perdue. La mission sera chargée dès le retour du réseau.
          </p>
          <Button
            variant="secondary"
            onClick={() => void refresh()}
            className="mt-2.5 min-h-[44px]"
          >
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

  const currentStep = mission.steps.find(
    (step) => step.id === mission.currentStepId
  );
  const blockedStep = mission.steps.find(
    (step) => step.status === "blocked" && step.blockedReason
  );
  const whyReason =
    blockedStep?.blockedReason ??
    (currentStep?.status === "blocked" ? currentStep.blockedReason : null) ??
    null;
  const pendingActionStep = mission.steps.find(
    (step) => step.id === pendingAction?.stepId
  );

  return (
    <section
      aria-label="Mission Intelligence"
      className="relative overflow-hidden rounded-card border border-border-subtle bg-bg-subtle/60"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent"
        aria-hidden="true"
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 sm:px-5">
        <div className="flex items-center gap-2">
          <Target size={15} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
          <p className="eyebrow text-text-secondary">Mission</p>
          {mission.status === "blocked" ? <Badge tone="warning">Bloquée</Badge> : null}
          {mission.status === "completed" ? <Badge tone="success">Terminée</Badge> : null}
        </div>
        {mission.status !== "completed" ? (
          <button
            type="button"
            onClick={() => {
              setConfirmingCancel(true);
              setPendingAction(null);
            }}
            className="flex min-h-[44px] items-center gap-1.5 rounded-input px-2 text-caption text-text-quaternary transition-colors hover:bg-accent-ghost hover:text-text-primary active:bg-accent-ghost-hover"
            aria-label="Annuler la mission"
          >
            <X size={14} strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden sm:inline">Annuler</span>
          </button>
        ) : null}
      </div>

      {offline ? (
        <div
          role="status"
          className="mx-4 mb-3 mt-2 rounded-input border border-warning-border bg-warning-bg/40 px-3.5 py-2.5 text-small text-warning sm:mx-5"
        >
          {OFFLINE_MESSAGE}
        </div>
      ) : error ? (
        <div
          role="status"
          className="mx-4 mb-3 mt-2 rounded-input border border-danger-border bg-danger-bg/40 px-3.5 py-2.5 text-small text-danger sm:mx-5"
        >
          {error}
        </div>
      ) : null}

      <div className="px-4 pb-4 sm:px-5">
        {/* Title · objective · progress */}
        <h3 className="mt-1 text-h3 font-semibold text-text-primary">{mission.title}</h3>
        <p className="mt-0.5 text-small text-text-secondary">{mission.objective}</p>

        <div className="mt-3">
          <div className="flex items-center justify-between text-caption text-text-secondary">
            <span>Progression</span>
            <span className="font-mono text-text-primary">{mission.progress}%</span>
          </div>
          <div
            className="mt-1 h-2 overflow-hidden rounded-pill bg-bg-surface-2"
            role="progressbar"
            aria-valuenow={mission.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progression de la mission ${mission.title}`}
          >
            <div
              className="h-full rounded-pill bg-accent transition-[width] duration-300"
              style={{ width: `${Math.min(100, Math.max(0, mission.progress))}%` }}
            />
          </div>
        </div>

        {/* Current step + why it is stuck — the two answers a phone
            user needs before any button press. */}
        {currentStep && mission.status !== "completed" ? (
          <div className="mt-3.5 rounded-input border border-border-default bg-bg-surface/60 p-3.5">
            <p className="eyebrow text-text-quaternary">Étape actuelle</p>
            <p className="mt-1 text-[13px] font-medium leading-[19px] text-text-primary">
              <span className="font-mono text-text-tertiary">#{currentStep.order + 1}</span>{" "}
              {currentStep.title}
            </p>
            {currentStep.description ? (
              <p className="mt-1 text-caption text-text-secondary">{currentStep.description}</p>
            ) : null}
            {whyReason ? (
              <p className="mt-2 flex items-start gap-1.5 text-caption text-warning">
                <AlertTriangle
                  size={13}
                  strokeWidth={1.75}
                  className="mt-px shrink-0"
                  aria-hidden="true"
                />
                <span>
                  <span className="font-medium">Pourquoi ça bloque — </span>
                  {whyReason}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Next best action — reason first, action second, "Voir
            pourquoi" for the full context. */}
        {mission.nextBestAction && mission.status !== "completed" ? (
          <div className="mt-3.5 rounded-input border border-lavender-border/30 bg-bg-surface/60 p-3.5">
            <p className="eyebrow text-lavender">Prochaine meilleure action</p>
            <p className="mt-1 text-[13px] font-medium text-text-primary">
              {mission.nextBestAction.label}
            </p>
            <p className="mt-0.5 text-caption text-text-tertiary">{mission.nextBestAction.reason}</p>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {mission.nextBestAction.kind === "mutate" || mission.nextBestAction.action ? (
                <Button
                  loading={executing && pendingAction?.stepId === mission.nextBestAction.stepId}
                  onClick={() => {
                    setExecutedResult(null);
                    setConfirmingCancel(false);
                    setPendingAction(mission.nextBestAction);
                  }}
                  className="min-h-[44px]"
                >
                  {mission.status === "blocked" ? "Débloquer" : "Continuer"}
                </Button>
              ) : mission.nextBestAction.href ? (
                <Button
                  onClick={() => router.push(mission.nextBestAction!.href!)}
                  className="min-h-[44px]"
                >
                  Ouvrir
                </Button>
              ) : null}
              <button
                type="button"
                onClick={() => setWhyOpen((open) => !open)}
                aria-expanded={whyOpen}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-input px-2 text-caption font-medium text-text-secondary transition-colors hover:text-text-primary active:text-text-primary"
              >
                <span>{whyOpen ? "Masquer le contexte" : "Voir pourquoi"}</span>
                <ChevronDown
                  size={13}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className={cn(
                    "transition-transform duration-200 ease-nexus",
                    whyOpen && "rotate-180"
                  )}
                />
              </button>
            </div>

            {whyOpen ? (
              <MissionWhy mission={mission} />
            ) : null}
          </div>
        ) : mission.status === "completed" ? (
          <div className="mt-3.5 rounded-input border border-success-border bg-success-bg/40 px-3 py-2.5 text-small text-success">
            <span className="flex items-center gap-1.5">
              <Check size={14} strokeWidth={2.5} />
              Mission terminée — toutes les étapes sont vérifiées.
            </span>
          </div>
        ) : null}

        {/* Inline confirmation — the gate every mutation passes
            through. Rendered where the user pressed, on top of the
            mission surface, with the exact payload spelled out. */}
        {pendingAction?.action ? (
          <div
            role="alertdialog"
            aria-label="Confirmer l'action"
            className="mt-3 animate-scale-in rounded-input border border-border-strong bg-bg-surface p-3.5"
          >
            <p className="text-small font-medium text-text-primary">
              Confirmer « {pendingAction.action.label} » ?
            </p>
            <p className="mt-0.5 text-caption text-text-secondary">
              {pendingAction.action.description ??
                pendingActionStep?.title ??
                "Cette action modifiera votre workspace."}
            </p>
            {pendingAction.action.risk === "high" ? (
              <p className="mt-1.5 flex items-start gap-1.5 text-caption text-danger">
                <AlertTriangle size={13} strokeWidth={1.75} className="mt-px shrink-0" aria-hidden="true" />
                Action destructive — exécutée côté serveur puis vérifiée.
              </p>
            ) : null}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button
                loading={executing}
                onClick={() => void runAction(pendingAction)}
                className="min-h-[44px]"
              >
                {executing ? "Exécution & vérification…" : "Confirmer et exécuter"}
              </Button>
              <Button
                variant="ghost"
                disabled={executing}
                onClick={() => setPendingAction(null)}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
            </div>
          </div>
        ) : null}

        {/* Cancel confirmation — also gated, no silent mutation. */}
        {confirmingCancel ? (
          <div
            role="alertdialog"
            aria-label="Confirmer l'annulation de la mission"
            className="mt-3 animate-scale-in rounded-input border border-border-strong bg-bg-surface p-3.5"
          >
            <p className="text-small font-medium text-text-primary">
              Annuler « {mission.title} » ?
            </p>
            <p className="mt-0.5 text-caption text-text-secondary">
              La mission et ses étapes ne seront plus proposées. Cette action ne supprime
              aucune tâche ni aucun projet.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button
                variant="danger"
                loading={executing}
                onClick={() => void cancelMission()}
                className="min-h-[44px]"
              >
                Annuler la mission
              </Button>
              <Button
                variant="ghost"
                disabled={executing}
                onClick={() => setConfirmingCancel(false)}
                className="min-h-[44px]"
              >
                Garder
              </Button>
            </div>
          </div>
        ) : null}

        {executedResult ? (
          <div
            ref={responseRef}
            className="mt-2.5 animate-fade-in rounded-input border border-success-border bg-success-bg/40 px-3 py-2 text-caption text-success"
          >
            <span className="flex items-center gap-1.5">
              <Check size={13} strokeWidth={2.5} />
              {executedResult.message}
              {executedResult.verified ? " · vérifié côté serveur" : ""}
            </span>
          </div>
        ) : null}

        {/* Steps — compact: order, status, dependency, block reason,
            per-step action when one is available. */}
        {mission.steps.length > 0 ? (
          <ol className="mt-4" aria-label="Étapes de la mission">
            {mission.steps
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((step) => (
                <MissionStepRow
                  key={step.id}
                  step={step}
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
                  }}
                />
              ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

/** One step row — status icon, order, title, dependency and the
 *  block reason when relevant. The action stays on the actionable
 *  steps only (ready / in_progress / blocked), 44px tall. */
function MissionStepRow({
  step,
  executing,
  onNavigate,
  onMutate,
}: {
  step: MissionStep;
  executing: boolean;
  onNavigate: (href: string) => void;
  onMutate: (action: NonNullable<MissionStep["action"]>) => void;
}) {
  const Icon = STATUS_ICON[step.status];
  const completed = step.status === "completed";
  const failed = step.status === "failed";
  const blocked = step.status === "blocked";
  const actionable =
    !completed &&
    !failed &&
    step.status !== "cancelled" &&
    (step.status === "ready" || step.status === "in_progress" || blocked);
  const action = step.action;
  const isNavigation =
    action?.type === "navigate" || (action && !action.confirmationRequired);

  return (
    <li className="flex items-start gap-2.5 border-t border-border-subtle py-2.5 first:border-t-0">
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
          completed
            ? "border-success-border bg-success-bg/40 text-success"
            : failed
              ? "border-danger-border bg-danger-bg/40 text-danger"
              : blocked
                ? "border-warning-border bg-warning-bg/40 text-warning"
                : step.status === "in_progress" || step.status === "ready"
                  ? "border-accent/60 bg-accent/10 text-accent"
                  : "border-border-subtle text-text-quaternary"
        )}
      >
        <Icon
          size={13}
          strokeWidth={2}
          className={step.status === "in_progress" ? "animate-spin" : undefined}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13px] leading-[19px] font-medium",
            completed ? "text-text-tertiary line-through" : "text-text-primary"
          )}
        >
          <span className="font-mono text-[11px] text-text-quaternary">#{step.order + 1}</span>{" "}
          {step.title}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-4 text-text-tertiary">
          {STATUS_LABEL[step.status]}
          {step.dependencies.length > 0
            ? ` · dépend de ${step.dependencies.length} étape${step.dependencies.length > 1 ? "s" : ""}`
            : ""}
        </p>
        {blocked && step.blockedReason ? (
          <p className="mt-0.5 text-caption text-warning">Dépendance : {step.blockedReason}</p>
        ) : null}
        {failed && step.verification ? (
          <p className="mt-0.5 text-caption text-danger">
            {step.verification.summary || "Étape échouée"}
          </p>
        ) : null}
      </div>
      {actionable && action ? (
        isNavigation && action.payload?.url ? (
          <button
            type="button"
            onClick={() => onNavigate(String(action.payload!.url))}
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-input px-2 text-caption font-medium text-text-secondary transition-colors hover:text-text-primary active:text-text-primary"
          >
            Ouvrir
          </button>
        ) : (
          <button
            type="button"
            disabled={executing}
            onClick={() => onMutate(action)}
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-input border border-border-default px-2.5 text-caption font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary active:bg-accent-ghost disabled:opacity-40"
          >
            {action.risk === "high" ? "Débloquer…" : action.label}
          </button>
        )
      ) : null}
    </li>
  );
}

/** "Voir pourquoi" — the evidence behind the mission: what it is
 *  tied to in the workspace and what NEXUS detected around it. */
function MissionWhy({ mission }: { mission: IntelligenceMission }) {
  const { context } = mission;
  return (
    <div className="mt-2.5 animate-fade-in rounded-input border border-border-subtle bg-bg-subtle/50 p-3">
      <dl className="flex flex-col gap-1.5">
        {context.keyword ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-text-tertiary">Sujet suivi</dt>
            <dd className="text-right font-mono text-caption text-text-primary">
              {context.keyword}
            </dd>
          </div>
        ) : null}
        {context.deadlineLabel ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-text-tertiary">Échéance</dt>
            <dd className="text-right font-mono text-caption text-text-primary">
              {context.deadlineLabel}
            </dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-caption text-text-tertiary">Tâches liées</dt>
          <dd className="text-right font-mono text-caption text-text-primary">
            {context.relatedTaskIds.length}
          </dd>
        </div>
      </dl>
      {context.blockerLabels.length > 0 ? (
        <div className="mt-2 border-t border-border-subtle pt-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary">
            Ce qui bloque
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {context.blockerLabels.map((label) => (
              <li key={label} className="text-caption text-text-secondary">
                — {label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {context.signals.length > 0 ? (
        <div className="mt-2 border-t border-border-subtle pt-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary">
            Signaux liés
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {context.signals.slice(0, 4).map((signal) => (
              <li key={`${signal.type}-${signal.title}`} className="text-caption text-text-secondary">
                {signal.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

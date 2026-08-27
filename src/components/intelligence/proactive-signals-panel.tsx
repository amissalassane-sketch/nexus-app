"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, RefreshCw, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SIGNAL_CONSTANTS,
  SIGNAL_TYPE_LABEL,
  type ProactiveSeverity,
  type StoredSignalRow,
  type SuggestedSignalAction,
} from "@/lib/intelligence/signals";
import type { ActionVerification } from "@/lib/intelligence/types";

// ============================================================
// NEXUS — PROACTIVE SIGNALS PANEL ("NEEDS YOUR ATTENTION")
// ============================================================
// Displays the verified, scored, deduplicated signals produced by the
// Signal Engine. Every card shows: severity, title, factual summary,
// evidence ("Pourquoi"), score breakdown and suggested actions.
//
// Lifecycle:
//   new → seen (auto, when displayed) → dismissed (user) / acted
//   (verified mutation) → resolved (fingerprint gone on next refresh).
//
// Rules:
//   - silence: no active signal → the panel renders nothing.
//   - the LLM never decides severity; the engine does.
//   - mutations always go through POST /api/intelligence/action with
//     human confirmation — never executed directly by the client.
//   - mobile-safe: ≥44px touch targets, no hover-only features.
// ============================================================

const SEVERITY_TONE: Record<ProactiveSeverity, "danger" | "warning" | "info" | "neutral"> = {
  critical: "danger",
  warning: "warning",
  attention: "info",
  info: "neutral",
};

const SEVERITY_LABEL: Record<ProactiveSeverity, string> = {
  critical: "Critique",
  warning: "Élevé",
  attention: "Moyen",
  info: "Info",
};

/** Entity naming for the "Concerne :" line — the entity the signal is
 *  about, in the user's words, never an internal row key. */
const ENTITY_LABEL: Record<string, string> = {
  task: "Tâche",
  project: "Projet",
  goal: "Objectif",
  workspace: "Workspace",
};

function entityLabelFor(signal: StoredSignalRow): string {
  const kind = ENTITY_LABEL[signal.entityType ?? ""] ?? "Élément";
  return signal.entityLabel ? `${kind} — ${signal.entityLabel}` : kind;
}

interface SignalsResponse {
  signals: StoredSignalRow[];
  attentionCount: number;
  criticalCount: number;
  refreshedAt: string;
  llmEnriched: boolean;
}

export function ProactiveSignalsPanel({ workspaceId }: { workspaceId: string }) {
  const [signals, setSignals] = useState<StoredSignalRow[]>([]);
  const [attentionCount, setAttentionCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Confirmation state for mutation actions (never auto-executed).
  const [confirming, setConfirming] = useState<{ signal: StoredSignalRow; action: SuggestedSignalAction } | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executedResult, setExecutedResult] = useState<{ message: string; verification: ActionVerification } | null>(null);

  // Expanded "Pourquoi" evidence per signal.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const seenSent = useRef<Set<string>>(new Set());

  // Whether a previous pass left signals on screen — lets the offline
  // message say "what you see is still available" without making the
  // refresh callback depend on the signals state.
  const hasSignalsRef = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intelligence/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh", enrich: false, workspaceId }),
      });
      const data = (await res.json()) as SignalsResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Impossible de charger les signaux");
        setSignals([]);
        setAttentionCount(0);
        return;
      }
      const next = data.signals ?? [];
      hasSignalsRef.current = next.length > 0;
      setSignals(next);
      setAttentionCount(data.attentionCount ?? 0);
      setCriticalCount(data.criticalCount ?? 0);
    } catch {
      // Offline ≠ no data: whatever is already rendered stays on screen.
      setError(
        hasSignalsRef.current
          ? "Connexion perdue. Les signaux affichés restent disponibles."
          : "Connexion perdue. Les signaux seront chargés dès le retour du réseau."
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  // Deferred one macrotask so the initial setState is not synchronous
  // inside the effect (avoids cascading renders on mount).
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  // Lifecycle: new → seen (fire-and-forget, once per signal).
  useEffect(() => {
    for (const signal of signals) {
      if (signal.status === "new" && !seenSent.current.has(signal.id)) {
        seenSent.current.add(signal.id);
        void fetch("/api/intelligence/signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "markSeen", id: signal.id }),
        }).catch(() => undefined);
      }
    }
  }, [signals]);

  /** Points the Phase 2 working memory at the signal's entity so the
   *  next questions (« Pourquoi ? », « Débloque-la ») resolve to it. */
  const focusMemory = async (signal: StoredSignalRow) => {
    await fetch("/api/intelligence/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "focus", id: signal.id }),
    }).catch(() => undefined);
  };

  const dismiss = async (signal: StoredSignalRow) => {
    setSignals((prev) => prev.filter((s) => s.id !== signal.id));
    setAttentionCount((count) => Math.max(0, count - 1));
    await fetch("/api/intelligence/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss", id: signal.id }),
    }).catch(() => undefined);
  };

  const executeAction = async (signal: StoredSignalRow, suggested: SuggestedSignalAction) => {
    const action = suggested.action;
    if (!action) return;
    setExecuting(true);
    setError(null);
    try {
      const res = await fetch("/api/intelligence/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: action.type,
          signalId: signal.id,
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
          verification: data.verification,
        });
        setConfirming(null);
        // The mutation may resolve the signal (fingerprint gone) — refresh.
        window.dispatchEvent(new CustomEvent("nexus:activation", { detail: { type: "signal_action" } }));
        void refresh();
      } else {
        setError(data.error ?? "Échec de l'action");
      }
    } catch {
      setError("Erreur réseau pendant l'exécution");
    } finally {
      setExecuting(false);
    }
  };

  // Silence rule: nothing important → render nothing.
  if (!loading && attentionCount === 0 && !error) return null;

  const visible = signals.slice(0, SIGNAL_CONSTANTS.DISPLAY_LIMIT);
  const hiddenCount = Math.max(0, attentionCount - visible.length);

  return (
    <section
      aria-label="Signaux nécessitant votre attention"
      className="relative overflow-hidden rounded-card border border-lavender-border/40 bg-bg-subtle/60"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lavender-border to-transparent"
        aria-hidden="true"
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 sm:px-5">
        <div className="flex items-center gap-2">
          <ShieldAlert size={15} strokeWidth={1.75} className="text-lavender" aria-hidden="true" />
          <p className="eyebrow text-text-secondary">Needs your attention</p>
          {criticalCount > 0 ? (
            <Badge tone="danger">{criticalCount} critique</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          {loading ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary">
              Analyse en cours…
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary">
              {attentionCount} élément{attentionCount === 1 ? "" : "s"}
            </span>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Rafraîchir les signaux"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-input text-text-tertiary transition-colors hover:bg-accent-ghost hover:text-text-primary"
          >
            <RefreshCw size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="mx-4 mt-2 flex items-center justify-between gap-2 rounded-input border border-danger-border bg-danger-bg/40 px-3.5 py-2.5 text-small text-danger sm:mx-5">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex min-h-[44px] items-center gap-1 font-medium underline underline-offset-2"
          >
            <span>Réessayer</span>
          </button>
        </div>
      ) : null}

      {/* Signal cards */}
      <div className="mt-1 flex flex-col px-3 pb-3 sm:px-4">
        {visible.map((signal) => {
          const isExpanded = expanded.has(signal.id);
          return (
            <article
              key={signal.id}
              className={cn(
                "mb-2 rounded-input border p-3.5 transition-colors",
                signal.severity === "critical"
                  ? "border-danger-border/50 bg-danger-bg/10"
                  : signal.severity === "warning"
                    ? "border-warning-border/40 bg-warning-bg/10"
                    : "border-border-subtle bg-bg-surface/50"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge tone={SEVERITY_TONE[signal.severity]}>
                    {SEVERITY_LABEL[signal.severity]}
                  </Badge>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-quaternary">
                    {SIGNAL_TYPE_LABEL[signal.type] ?? signal.type.replace(/_/g, " ")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void dismiss(signal)}
                  aria-label="Ignorer ce signal"
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-input text-text-quaternary transition-colors hover:bg-accent-ghost hover:text-text-primary"
                >
                  <X size={14} strokeWidth={1.75} />
                </button>
              </div>

              <h4 className="mt-1.5 text-body font-semibold text-text-primary">{signal.title}</h4>
              <p className="mt-0.5 text-small text-text-secondary">{signal.summary}</p>
              {signal.entityLabel ? (
                <p className="mt-1 text-caption text-text-tertiary">
                  Concerne : {entityLabelFor(signal)}{" "}
                  {signal.affectedCount > 1 ? (
                    <span className="font-mono text-text-quaternary">
                      · {signal.affectedCount} éléments touchés
                    </span>
                  ) : null}
                </p>
              ) : null}

              {/* Evidence — factual, derived from real rows */}
              <button
                type="button"
                onClick={() => {
                  const willExpand = !expanded.has(signal.id);
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(signal.id)) next.delete(signal.id);
                    else next.add(signal.id);
                    return next;
                  });
                  // Memory integration: make « Pourquoi ? » / « Débloque-la »
                  // resolve to this signal's entity.
                  if (willExpand) void focusMemory(signal);
                }}
                className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-caption font-medium text-text-tertiary hover:text-text-primary"
              >
                <ChevronDown
                  size={12}
                  strokeWidth={1.75}
                  className={cn("transition-transform", isExpanded && "rotate-180")}
                />
                <span>{isExpanded ? "Masquer les preuves" : "Pourquoi ?"}</span>
              </button>

              {isExpanded ? (
                <div className="mt-1 animate-fade-in rounded-input border border-border-subtle bg-bg-subtle/50 p-2.5">
                  <dl className="flex flex-col gap-1.5">
                    {signal.evidence.map((evidence) => (
                      <div key={`${evidence.label}-${evidence.value}`} className="flex items-baseline justify-between gap-3">
                        <dt className="text-caption text-text-tertiary">{evidence.label}</dt>
                        <dd className="text-right font-mono text-caption text-text-primary">{evidence.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {signal.scoreBreakdown.length > 0 ? (
                    <div className="mt-2 border-t border-border-subtle pt-2">
                      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-quaternary">
                        Priorité (score {signal.score}/100)
                      </p>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {signal.scoreBreakdown.map((factor) => (
                          <li key={factor.factor} className="flex items-baseline justify-between gap-3 text-caption">
                            <span className="text-text-tertiary">{factor.factor}</span>
                            <span className="font-mono text-text-quaternary">
                              {factor.points > 0 ? `+${factor.points}` : "0"} · {factor.detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Suggested actions */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {signal.suggestedActions.slice(0, 3).map((suggested) =>
                  suggested.kind === "navigate" && suggested.href ? (
                    <Link
                      key={`${suggested.label}-${suggested.href}`}
                      href={suggested.href}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-input border border-border-default bg-bg-surface px-3 text-caption font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                    >
                      <span>{suggested.label}</span>
                      <ArrowRight size={12} strokeWidth={1.75} />
                    </Link>
                  ) : suggested.kind === "mutate" ? (
                    <button
                      key={`${suggested.label}-mutate`}
                      type="button"
                      onClick={() => {
                        setExecutedResult(null);
                        setConfirming({ signal, action: suggested });
                      }}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-input border border-lavender-border/50 bg-lavender/10 px-3 text-caption font-medium text-lavender transition-colors hover:bg-lavender/20"
                    >
                      <span>{suggested.label}</span>
                    </button>
                  ) : null
                )}
              </div>

              {/* Inline confirmation for mutations (never auto-executed) */}
              {confirming && confirming.signal.id === signal.id ? (
                <div className="mt-3 animate-scale-in rounded-input border border-border-default bg-bg-surface p-3">
                  <p className="text-small font-medium text-text-primary">
                    Confirmer « {confirming.action.label} » dans le workspace ?
                  </p>
                  {confirming.action.action?.risk === "high" ? (
                    <p className="mt-1 text-caption text-danger">
                      Action destructive — elle sera exécutée côté serveur puis vérifiée.
                    </p>
                  ) : null}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <Button
                      loading={executing}
                      onClick={() => void executeAction(signal, confirming.action)}
                      className="min-h-[44px]"
                    >
                      {executing ? "Exécution & vérification…" : "Confirmer et exécuter"}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={executing}
                      onClick={() => setConfirming(null)}
                      className="min-h-[44px]"
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Verified result */}
              {executedResult && !confirming ? (
                <div className="mt-2.5 animate-fade-in rounded-input border border-success-border bg-success-bg/40 px-3 py-2 text-caption text-success">
                  <span className="flex items-center gap-1.5">
                    <Check size={13} strokeWidth={2.5} />
                    {executedResult.message}
                    {executedResult.verification.verified ? (
                      <span className="opacity-80">
                        · Vérifié : {executedResult.verification.matched.join(", ")}
                      </span>
                    ) : null}
                  </span>
                </div>
              ) : null}
            </article>
          );
        })}

        {hiddenCount > 0 ? (
          <p className="px-1 pt-1 text-caption text-text-quaternary">
            + {hiddenCount} autre{hiddenCount === 1 ? "" : "s"} signal{hiddenCount === 1 ? "" : "x"} dans la liste complète
          </p>
        ) : null}
      </div>
    </section>
  );
}

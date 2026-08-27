"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, Bell, UserRound, X, ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { IntelligenceAsk } from "@/components/intelligence/intelligence-ask";

// ============================================================
// NEXUS — MOBILE HOME
// Mobile-first experience: header + attention + mission + next action
// + recent context + chat/ask
// ============================================================

interface Signal {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info";
  reason: string;
  entity?: { type: string; name: string };
  impact?: string;
  action?: { label: string; href?: string };
}

interface Mission {
  id: string;
  title: string;
  objective: string;
  progress: number;
  currentStep: string;
  currentStepBlockedBy?: string;
  nextBestAction?: {
    label: string;
    reason: string;
    action: string; // "continue" | "unblock" | "navigate"
    href?: string;
  };
}

export function MobileHome() {
  const pathname = usePathname();
  const router = useRouter();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [mission, setMission] = useState<Mission | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch signals and mission on mount
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);

      try {
        // Fetch signals
        const signalsRes = await fetch("/api/intelligence/signals", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const signalsData = await signalsRes.json();
        if (!cancelled) {
          if (signalsData.success && signalsData.signals) {
            const parsed: Signal[] = signalsData.signals.map((s: any) => ({
              id: s.id || s.title,
              title: s.title || "Signal",
              severity: s.severity || "info",
              reason: s.body || s.reason || "Aucune raison fournie",
              entity: s.entity
                ? { type: s.entity.type || "entité", name: s.entity.name || "" }
                : undefined,
              impact: s.impact,
              action: s.action
                ? { label: s.action.label || "Voir", href: s.action.href }
                : undefined,
            }));
            setSignals(parsed);
          } else if (signalsData.error) {
            // Offline/resilience: show cached/stale data message
            setSignals([
              {
                id: "offline",
                title: "Connexion perdue",
                severity: "info",
                reason:
                  "Connexion perdue. Les dernières informations affichées restent disponibles.",
                impact: "Données possibles légèrement obsolètes",
              },
            ]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSignals([
            {
              id: "error",
              title: "Erreur de chargement",
              severity: "warning",
              reason:
                "Impossible de charger les signaux. Vérifiez votre connexion.",
              impact: "Données non disponibles",
            },
          ]);
        }
      }

      try {
        // Fetch active mission
        const missionRes = await fetch(
          "/api/intelligence/missions?workspaceId=" +
            (typeof window !== "undefined"
              ? (window as any).workspaceId
              : "")
        );
        const missionData = await missionRes.json();
        if (!cancelled) {
          if (missionData.success && missionData.missions?.[0]) {
            const m = missionData.missions[0];
            setMission({
              id: m.id,
              title: m.title,
              objective: m.objective || "Objectif en cours",
              progress: m.progress ?? 0,
              currentStep:
                m.steps?.[0]?.title || "Étape en cours",
              currentStepBlockedBy:
                m.steps?.[0]?.blockedReason,
              nextBestAction:
                m.nextBestAction
                  ? {
                      label: m.nextBestAction.label,
                      reason: m.nextBestAction.reason,
                      action:
                        m.nextBestAction.action?.type === "navigate"
                          ? "navigate"
                          : "continue",
                      href: m.nextBestAction.action?.payload?.url,
                    }
                  : undefined,
            });
          } else if (missionData.error) {
            // Offline resilience
            setMission({
              id: "offline",
              title: "Mission",
              objective: "Données non disponibles hors ligne",
              progress: 0,
              currentStep: "Hors ligne",
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setMission({
            id: "error",
            title: "Mission",
            objective: "Erreur de chargement",
            progress: 0,
            currentStep: "Erreur",
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (isLoading) return null;

  return (
    <div className="min-h-dvh bg-bg-base text-text-primary">
      {/* =========================
         HEADER
         ========================= */}
      <header
        className="shrink-0 border-b border-border-subtle bg-bg-base lg:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-14 items-center gap-1.5 px-2 sm:px-3">
          <button
            type="button"
            onClick={() => router.openDrawer?.()}
            aria-label="Open navigation drawer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-nav text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
          >
            <Menu size={19} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <p
            className="min-w-0 flex-1 truncate px-1 text-[14px] font-medium tracking-[-0.01em] text-text-primary"
            aria-live="polite"
          >
            {pathname === "/" || pathname === "/mobile"
              ? "Accueil"
              : pathname.split("/")[2] || "NEXUS"}
          </p>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => router.push("/app/intelligence")}
              aria-label="Intelligence"
              className="flex h-10 w-10 items-center justify-center rounded-nav text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary active:bg-accent-ghost-hover focus-visible:ring-1 focus-visible:ring-lavender-border"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
            <Link
              href="/app/notifications"
              aria-label={
                typeof window !== "undefined"
                  ? (window as any).unreadNotifications > 0
                    ? `Notifications — ${(window as any).unreadNotifications} non lus`
                    : "Notifications"
                  : "Notifications"
              }
              className="relative flex h-10 w-10 items-center justify-center rounded-nav text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary focus-visible:ring-1 focus-visible:ring-lavender-border"
            >
              <Bell size={16} strokeWidth={1.75} aria-hidden="true" />
              {typeof window !== "undefined" &&
                (window as any).unreadNotifications > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute right-2 top-2 h-1.5 w-1.5 rounded-pill bg-lavender"
                  />
                )}
            </Link>
            <button
              type="button"
              onClick={() => router.push("/app/settings?tab=profile")}
              aria-label="Profil"
              className="flex h-9 w-9 items-center justify-center rounded-pill border border-border-default bg-bg-surface-2 text-[12px] font-semibold text-text-primary transition-colors duration-150 ease-nexus hover:border-border-strong active:bg-accent-ghost"
            >
              {typeof window !== "undefined" &&
                (window as any).user?.name?.trim()
                  ? (window as any).user.name.trim().slice(0, 1).toUpperCase()
                  : (
                      <UserRound
                        size={14}
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    )}
            </button>
          </div>
        </div>
      </header>

      {/* =========================
         ATTENTION / SIGNALS
         ========================= */}
      <section className="mt-2 px-2 sm:px-3">
        <div className="rounded-card border border-border-subtle bg-bg-subtle/60 p-2 sm:p-3">
          <p className="eyebrow text-lavender mb-2">Attention</p>
          <p className="text-caption text-text-secondary mb-2">
            {signals.length} signal{"s".repeat(signals.length !== 1)}
            nécessitant{"s".repeat(signals.length !== 1)}
            votre attention
          </p>
          <ul className="space-y-1.5">
            {signals.map((signal) => (
              <li key={signal.id} className="flex items-start gap-2 pt-1">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                    signal.severity === "critical"
                      ? "border-danger-border bg-danger-bg/40 text-danger"
                      : signal.severity === "warning"
                        ? "border-warning-border bg-warning-bg/40 text-warning"
                        : "border-border-subtle text-text-quaternary"
                  )}
                >
                  {signal.severity === "critical"
                    ? "⚠️"
                    : signal.severity === "warning"
                      ? "⟳"
                      : "ℹ️"}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-[13px] font-medium",
                      signal.severity === "critical" ? "text-danger" : "text-text-primary"
                    )}
                  >
                    {signal.title}
                  </p>
                  <p className="mt-0.5 text-small text-text-secondary">
                    {signal.reason}
                  </p>
                  {signal.entity && (
                    <p className="mt-0.5 text-caption text-text-tertiary">
                      {signal.entity.type}: {signal.entity.name}
                    </p>
                  )}
                  {signal.impact && (
                    <p className="mt-0.5 text-caption text-text-tertiary">
                      Impact: {signal.impact}
                    </p>
                  )}
                  {signal.action && (
                    <p className="mt-1">
                      <Link
                        href={signal.action.href || "/app/tasks"}
                        className="inline-flex h-7 items-center gap-1 rounded-input border border-border-default px-2 text-caption text-text-secondary transition-colors duration-150 ease-nexus hover:border-border-strong hover:bg-accent-ghost hover:text-text-primary active:bg-accent-ghost-hover"
                      >
                        {signal.action.label || "Voir"}
                        <ChevronRight size={12} strokeWidth={1.75} />
                      </Link>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* =========================
         MISSION ACTIVE
         ========================= */}
      {mission ? (
        <section className="mt-2 px-2 sm:px-3">
          <div className="rounded-card border border-border-subtle bg-bg-subtle/60 p-3 sm:p-4">
            <h3 className="text-[14px] font-medium text-text-primary mb-2">
              Mission active
            </h3>
            <p className="text-small text-text-secondary mb-3">
              {mission.objective}
            </p>

            <div className="mb-3">
              <div className="flex items-center justify-between text-caption text-text-secondary">
                <span>Progression</span>
                <span className="font-mono text-text-primary">
                  {mission.progress}%
                </span>
              </div>
              <div
                className="mt-1 h-2 overflow-hidden rounded-pill bg-bg-surface-2"
                role="progressbar"
                aria-valuenow={mission.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-pill bg-accent transition-[width] duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, mission.progress))}%` }}
                />
              </div>
            </div>

            <p className="text-caption text-text-secondary mb-2">
              {mission.currentStep}
            </p>

            {mission.currentStepBlockedBy && (
              <p className="mt-1 text-caption text-warning">
                Pourquoi elle bloque: {mission.currentStepBlockedBy}
              </p>
            )}

            <div className="mt-3">
              <Button
                loading={false}
                onClick={() => {
                  if (mission.nextBestAction) {
                    if (mission.nextBestAction.action === "navigate") {
                      window.location.href = mission.nextBestAction.href;
                    } else {
                      router.push("/app/missions");
                    }
                  } else {
                    router.push("/app/missions");
                  }
                }}
                className="w-full min-h-[44px] rounded-input px-3.5 text-button font-medium text-accent-fg transition-colors hover:bg-accent-hover"
              >
                {mission.nextBestAction
                  ? mission.nextBestAction.action === "navigate"
                    ? "Ouvrir l'action"
                    : mission.nextBestAction.action === "unblock"
                      ? "Débloquer"
                      : "Continuer"
                  : "Continuer"}
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-2 px-2 sm:px-3">
          <div className="rounded-card border border-border-subtle bg-bg-subtle/60 p-3 sm:p-4">
            <p className="text-caption text-text-tertiary">
              Aucune mission active pour le moment
            </p>
            <Button
              loading={false}
              onClick={() => router.push("/app/missions")}
              className="w-full min-h-[44px] px-3.5 text-button font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            >
              Créer une mission
            </Button>
          </div>
        </section>
      )}

      {/* =========================
         NEXT ACTION (prominent when available)
         ========================= */}
      {mission?.nextBestAction ? (
        <section className="mt-2 px-2 sm:px-3">
          <div
            className="rounded-input border border-lavender-border/30 bg-bg-surface/60 p-3 sm:p-4"
          >
            <p className="eyebrow text-lavender mb-1">Prochaine meilleure action</p>
            <p className="text-[13px] font-medium text-text-primary mb-1">
              {mission.nextBestAction?.label}
            </p>
            <p className="text-caption text-text-tertiary mb-2">
              {mission.nextBestAction?.reason}
            </p>
            <Button
              loading={false}
              onClick={() => {
                if (mission.nextBestAction?.action === "navigate") {
                  window.location.href = mission.nextBestAction.href;
                } else {
                  router.push("/app/missions");
                }
              }}
              className="w-full min-h-[44px] px-3.5 text-button font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            >
              {mission.nextBestAction.label || "Agir maintenant"}
            </Button>
          </div>
        </section>
      ) : null}

      {/* =========================
         RECENT CONTEXT
         ========================= */}
      <section className="mt-2 px-2 sm:px-3">
        <div className="rounded-card border border-border-subtle bg-bg-subtle/60 p-2 sm:p-3">
          <p className="eyebrow text-text-quaternary mb-2">Activité récente</p>
          <div className="space-y-1">
            {typeof window !== "undefined" &&
            (window as any).recentActivity?.length > 0 ? (
              (window as any).recentActivity.map(
                (activity: any, i: number) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-2 py-1.5 border-b border-border-subtle/30 last:border-b-0"
                  >
                    <span className="text-[10px] font-mono text-text-quaternary">
                      {new Date(activity.createdAt).toLocaleTimeString()}
                    </span>
                    <span className={cn("font-medium text-text-primary", "text-small")}>
                      {activity.title}
                    </span>
                  </div>
                )
              )
            ) : (
              <p className="text-caption text-text-tertiary">
                Aucune activité récente
              </p>
            )}
          </div>
        </div>
      </section>

      {/* =========================
         CHAT / ASK
         ========================= */}
      <section className="mt-2 px-2 sm:px-3">
        <div className="rounded-input border border-border-subtle bg-bg-surface/50 p-2 sm:p-3">
          <IntelligenceAsk
            snapshot={{}}
            className="w-full"
          />
        </div>
      </section>
    </div>
  );
}
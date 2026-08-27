"use client";

import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { SignalCard } from "@/components/intelligence/signal-card";

// ============================================================
// NEXUS — MOBILE SIGNALS
// Each signal displays: niveau, problème, pourquoi détecté,
// entité concernée, impact, action disponible.
// Never just show internal codes — always human-readable UX.
// ============================================================

interface MobileSignal {
  id: string;
  niveau: "critical" | "warning" | "info" | "positive";
  titre: string;
  probleme: string; // "Pourquoi NEXUS le détecte"
  entite?: { type: string; name: string }; // "Entité concernée"
  impact?: string; // "Impact"
  action?: { label: string; href?: string }; // "Action disponible"
}

export function MobileSignals({ signals }: { signals: MobileSignal[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {signals.map((signal) => (
        <li
          key={signal.id}
          className="rounded-card border border-border-subtle bg-bg-subtle/60 p-4"
        >
          <div className="flex items-start gap-3">
            {/* Niveau / Sévérité badge */}
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-input border",
                signal.niveau === "critical"
                  ? "border-danger-border bg-danger-bg/40 text-danger"
                  : signal.niveau === "warning"
                    ? "border-warning-border bg-warning-bg/40 text-warning"
                    : signal.niveau === "positive"
                      ? "border-success-border bg-success-bg/40 text-success"
                      : "border-border-subtle text-text-tertiary"
              )}
            >
              {
                signal.niveau === "critical"
                  ? "⚠️"
                  : signal.niveau === "warning"
                    ? "⟳"
                    : signal.niveau === "positive"
                      ? "✅"
                      : "ℹ️"
              }
            </span>

            {/* Signal details */}
            <div className="min-w-0 flex-1">
              <h3 className="mt-1 text-[13px] font-medium text-text-primary">
                {signal.titre}
              </h3>

              <p className="mt-1 text-small text-text-secondary">
                {signal.probleme}
              </p>

              {/* Pourquoi NEXUS le détecte - always human readable */}
              {signal.entite && (
                <p className="mt-1 text-caption text-text-tertiary">
                  {signal.entite.type}: {signal.entite.name}
                </p>
              )}

              {signal.impact && (
                <p className="mt-1 text-caption text-text-tertiary">
                  Impact: {signal.impact}
                </p>
              )}

              {/* Action disponible */}
              {signal.action && (
                <p className="mt-2">
                  <Button
                    loading={false}
                    onClick={() => {
                      if (signal.action.href) {
                        window.location.href = signal.action.href;
                      }
                    }}
                    className="min-h-[40px] px-3 text-caption font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary active:bg-accent-ghost"
                  >
                    {signal.action.label}
                  </Button>
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

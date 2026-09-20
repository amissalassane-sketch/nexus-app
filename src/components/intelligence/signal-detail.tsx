"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { IconArrowRight, IconClock, IconX } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  SEVERITY_LABEL,
  SIGNAL_LABEL,
  type Insight,
} from "@/lib/intelligence/engine";
import {
  SEVERITY_TEXT,
  SEVERITY_TONE,
  SIGNAL_ICON,
} from "@/components/intelligence/signal-icons";

// ============================================================
// NEXUS — SIGNAL DETAIL
// A contextual side panel, not a modal: the signal list stays visible so
// the user keeps their place in the queue. Escape closes, focus is
// trapped inside, and focus returns to the trigger on close.
//
// Dismiss and snooze are local to the session: NEXUS recomputes signals
// from the workspace on every load, so hiding one here never rewrites
// the underlying data.
// ============================================================

export function SignalDetail({
  insight,
  onClose,
  onDismiss,
  onSnooze,
}: {
  insight: Insight | null;
  onClose: () => void;
  onDismiss: (insight: Insight) => void;
  onSnooze: (insight: Insight) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!insight) return;

    restoreFocus.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, a[href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreFocus.current?.focus?.();
    };
  }, [insight, onClose]);

  if (!insight) return null;

  const Icon = SIGNAL_ICON[insight.kind];

  return (
    <>
      {/* Scrim below lg, where the panel takes over the screen */}
      <button
        type="button"
        aria-label="Close signal"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 animate-fade-in lg:hidden"
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={`Signal: ${insight.title}`}
        className="fixed inset-y-0 right-0 z-40 flex w-[min(420px,100vw)] flex-col border-l border-border-default bg-bg-subtle animate-panel-in lg:sticky lg:top-0 lg:z-0 lg:h-[calc(100dvh-140px)] lg:w-auto lg:rounded-card lg:border lg:border-border-subtle"
      >
        <header
          className="flex shrink-0 items-start gap-3 border-b border-border-subtle px-4 py-3.5"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.875rem)" }}
        >
          <span className={cn("mt-0.5 shrink-0", SEVERITY_TEXT[insight.severity])}>
            <NexusIcon icon={Icon} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={SEVERITY_TONE[insight.severity]}>
                {SIGNAL_LABEL[insight.kind]}
              </Badge>
              <span className="eyebrow text-text-quaternary">
                {SEVERITY_LABEL[insight.severity]}
              </span>
            </div>
            <h2 className="mt-2 text-[15px] font-medium leading-[21px] text-text-primary">
              {insight.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close signal"
            className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-input text-text-tertiary transition-colors duration-150 hover:bg-accent-ghost hover:text-text-primary"
          >
            <NexusIcon icon={IconX} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <Section label="Context">
            <p className="text-small text-text-secondary">{insight.reason}</p>
          </Section>

          <Section label="Affected work">
            <div className="flex items-center gap-2.5 rounded-input border border-border-subtle bg-bg-surface/50 px-3 py-2.5">
              <span className="eyebrow shrink-0 text-text-quaternary">
                {insight.entity.type}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">
                {insight.entity.label}
              </span>
              {insight.count && insight.count > 1 ? (
                <span className="shrink-0 font-mono text-mono tabular-nums text-text-tertiary">
                  +{insight.count - 1}
                </span>
              ) : null}
            </div>
          </Section>

          <Section label="Why NEXUS detected it">
            <dl className="flex flex-col divide-y divide-border-subtle rounded-input border border-border-subtle bg-bg-surface/50">
              {insight.evidence.map((item) => (
                <div
                  key={item.label}
                  className="flex items-baseline justify-between gap-3 px-3 py-2"
                >
                  <dt className="truncate text-caption text-text-tertiary">
                    {item.label}
                  </dt>
                  <dd className="shrink-0 font-mono text-mono tabular-nums text-text-primary">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-caption text-text-quaternary">
              Derived from your workspace data at load time. NEXUS recomputes this
              on every visit.
            </p>
          </Section>

          <Section label="Recommended action">
            <p className="text-small text-text-secondary">
              {recommendation(insight)}
            </p>
          </Section>
        </div>

        <footer
          className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border-subtle px-4 py-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <Link
            href={insight.href}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg transition-[background-color,transform] duration-[140ms] ease-nexus hover:bg-accent-hover active:translate-y-px"
          >
            {insight.cta}
            <NexusIcon icon={IconArrowRight} />
          </Link>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              onSnooze(insight);
              toast("info", "Signal snoozed for this session", {
                description: "It will return on your next visit if it still applies.",
              });
            }}
          >
            <NexusIcon icon={IconClock} />
            Snooze
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              onDismiss(insight);
              toast("success", "Signal dismissed");
            }}
          >
            Dismiss
          </Button>
        </footer>
      </aside>
    </>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="eyebrow mb-2 text-text-quaternary">{label}</h3>
      {children}
    </section>
  );
}

/** Turns the signal kind into a concrete instruction. */
function recommendation(insight: Insight): string {
  switch (insight.kind) {
    case "blocked":
      return "Identify what the work is waiting on, then either resolve the dependency or move the task back to in progress so it stops holding the queue.";
    case "deadline":
      return "Either complete the remaining work today, or move the date so the rest of the workspace reflects reality.";
    case "at-risk":
      return "Reduce the scope, reassign the remaining tasks, or move the date. Leaving it unchanged means the plan is already wrong.";
    case "drifting":
      return "Confirm whether this is still active. If it is, give it one dated next action; if it is not, archive it.";
    case "inactive":
      return "Close the project out, or add the next task so progress can be tracked again.";
    case "dependency":
      return "Add dates to the open work so deadline pressure becomes visible before it becomes urgent.";
    case "opportunity":
      return "A small setup step here gives NEXUS the context it needs to detect risk in this area.";
    case "momentum":
      return "Nothing to fix. Use this as the baseline for next week's planning.";
    default:
      return insight.reason;
  }
}

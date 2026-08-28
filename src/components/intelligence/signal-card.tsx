"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import {
  SEVERITY_LABEL,
  SIGNAL_LABEL,
  type Insight,
} from "@/lib/intelligence/engine";
import {
  SEVERITY_RAIL,
  SEVERITY_TEXT,
  SEVERITY_TONE,
  SIGNAL_ICON,
} from "@/components/intelligence/signal-icons";

// ============================================================
// NEXUS — SIGNAL CARD
// Enhanced with graceful entrance, attention indicator, evidence
// available, resolved settling. Critical has priority without flashing.
// ============================================================

export function SignalCard({
  insight,
  onOpen,
  selected,
  index = 0,
  resolving = false,
  resolved = false,
}: {
  insight: Insight;
  onOpen?: (insight: Insight) => void;
  selected?: boolean;
  index?: number;
  resolving?: boolean;
  resolved?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = SIGNAL_ICON[insight.kind];

  return (
    <li
      className={cn(
        "group relative border-b border-border-subtle last:border-b-0 will-change-transform transition-[background-color,transform,opacity] duration-[200ms] ease-nexus",
        "animate-[signal-enter_320ms_var(--ease-nexus)_both]",
        selected ? "bg-accent-ghost" : "hover:bg-white/[0.02]",
        resolving && "animate-[signal-resolve_400ms_var(--ease-nexus)_both] opacity-80",
        resolved && "signal-resolved opacity-60 scale-[0.99]"
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 32}ms` }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-[2px] transition-[opacity,transform] duration-[200ms] ease-nexus will-change-transform",
          SEVERITY_RAIL[insight.severity],
          selected ? "opacity-100 scale-y-100" : "opacity-0 scale-y-75 group-hover:opacity-60 group-hover:scale-y-100"
        )}
      />

      {/* Critical attention — subtle pulse, not flashing */}
      {insight.severity === "critical" && !resolved ? (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 translate-x-[-2px] rounded-pill bg-danger opacity-60 animate-[signal-pulse_2.6s_var(--ease-nexus)_infinite]"
        />
      ) : null}

      <div className="px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("shrink-0 transition-transform duration-150 ease-nexus group-hover:scale-105", SEVERITY_TEXT[insight.severity])}>
            <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <Badge tone={SEVERITY_TONE[insight.severity]} className="transition-transform duration-150 ease-nexus">
            {SIGNAL_LABEL[insight.kind]}
          </Badge>
          <span className="eyebrow text-text-quaternary">
            {SEVERITY_LABEL[insight.severity]} · {insight.entity.type}
          </span>
          {insight.detectedFrom ? (
            <span className="eyebrow ml-auto text-text-quaternary tabular-nums">
              {formatDetected(insight.detectedFrom)}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onOpen?.(insight)}
          className="mt-2.5 block w-full text-left group/title"
          aria-label={`Open signal: ${insight.title}`}
        >
          <p className="text-[14px] font-medium leading-[20px] text-text-primary transition-colors duration-150 ease-nexus group-hover/title:text-white">
            {insight.title}
          </p>
          <p className="mt-1 text-small text-text-secondary transition-colors duration-150 ease-nexus group-hover/title:text-text-secondary">
            {insight.reason}
          </p>
        </button>

        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="-ml-1.5 inline-flex min-h-[40px] items-center gap-1.5 rounded-input px-1.5 text-caption text-text-tertiary transition-[color,background-color,transform] duration-[150ms] ease-nexus hover:text-text-secondary active:bg-accent-ghost active:scale-[0.97] sm:min-h-[28px]"
          >
            <ChevronDown
              size={12}
              strokeWidth={2}
              aria-hidden="true"
              className={cn("transition-transform duration-200 ease-nexus", expanded && "rotate-180")}
            />
            Why NEXUS flagged this
            {!expanded ? (
              <span className="ml-1 hidden h-1 w-1 rounded-pill bg-lavender/60 sm:inline-block animate-[signal-pulse_2.6s_var(--ease-nexus)_infinite]" />
            ) : null}
          </button>

          {expanded ? (
            <dl className="mt-2 grid gap-x-6 gap-y-1.5 rounded-input border border-border-subtle bg-bg-surface/50 px-3 py-2.5 animate-[intelligence-state-in_220ms_var(--ease-nexus)_both] sm:grid-cols-2">
              {insight.evidence.map((item, idx) => (
                <div
                  key={item.label}
                  className="flex items-baseline justify-between gap-3 animate-[list-in_200ms_var(--ease-nexus)_both]"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <dt className="truncate text-caption text-text-tertiary">{item.label}</dt>
                  <dd className="shrink-0 font-mono text-mono tabular-nums text-text-secondary">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Link
            href={insight.href}
            className="inline-flex h-9 items-center gap-1.5 rounded-input border border-border-default px-3 text-caption text-text-secondary transition-[border-color,background-color,color,transform] duration-[150ms] ease-nexus hover:border-border-strong hover:bg-accent-ghost hover:text-text-primary active:bg-accent-ghost-hover active:scale-[0.97] sm:h-7 sm:px-2.5 will-change-transform"
          >
            {insight.cta}
            <ArrowRight size={12} strokeWidth={1.75} aria-hidden="true" className="transition-transform duration-150 ease-nexus group-hover:translate-x-0.5" />
          </Link>
          {onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(insight)}
              className="inline-flex h-9 items-center rounded-input px-3 text-caption text-text-tertiary transition-[background-color,color,transform] duration-[150ms] ease-nexus hover:bg-accent-ghost hover:text-text-primary active:bg-accent-ghost-hover active:scale-[0.97] sm:h-7 sm:px-2.5 will-change-transform"
            >
              View context
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function formatDetected(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
  }).format(date);
}

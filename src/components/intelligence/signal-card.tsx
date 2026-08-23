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
// type · severity · title · explanation · affected entity · evidence ·
// recommended action. The evidence stays collapsed until asked for, so
// the list reads as a priority queue rather than a wall of reasoning.
// ============================================================

export function SignalCard({
  insight,
  onOpen,
  selected,
  index = 0,
}: {
  insight: Insight;
  onOpen?: (insight: Insight) => void;
  selected?: boolean;
  index?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = SIGNAL_ICON[insight.kind];

  return (
    <li
      className={cn(
        "stagger-item group relative border-b border-border-subtle transition-colors duration-150 ease-nexus last:border-b-0",
        selected ? "bg-accent-ghost" : "hover:bg-white/[0.02]"
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-[2px] transition-opacity duration-150",
          SEVERITY_RAIL[insight.severity],
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-60"
        )}
      />

      <div className="px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("shrink-0", SEVERITY_TEXT[insight.severity])}>
            <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <Badge tone={SEVERITY_TONE[insight.severity]}>
            {SIGNAL_LABEL[insight.kind]}
          </Badge>
          <span className="eyebrow text-text-quaternary">
            {SEVERITY_LABEL[insight.severity]} · {insight.entity.type}
          </span>
          {insight.detectedFrom ? (
            <span className="eyebrow ml-auto text-text-quaternary">
              {formatDetected(insight.detectedFrom)}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onOpen?.(insight)}
          className="mt-2.5 block w-full text-left"
          aria-label={`Open signal: ${insight.title}`}
        >
          <p className="text-[14px] font-medium leading-[20px] text-text-primary">
            {insight.title}
          </p>
          <p className="mt-1 text-small text-text-secondary">{insight.reason}</p>
        </button>

        {/* Why NEXUS flagged this — evidence only, never reasoning traces. */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 text-caption text-text-tertiary transition-colors duration-150 hover:text-text-secondary"
          >
            <ChevronDown
              size={12}
              strokeWidth={2}
              aria-hidden="true"
              className={cn(
                "transition-transform duration-200 ease-nexus",
                expanded && "rotate-180"
              )}
            />
            Why NEXUS flagged this
          </button>

          {expanded ? (
            <dl className="mt-2 grid gap-x-6 gap-y-1.5 rounded-input border border-border-subtle bg-bg-surface/50 px-3 py-2.5 sm:grid-cols-2">
              {insight.evidence.map((item) => (
                <div
                  key={item.label}
                  className="flex items-baseline justify-between gap-3"
                >
                  <dt className="truncate text-caption text-text-tertiary">
                    {item.label}
                  </dt>
                  <dd className="shrink-0 font-mono text-mono tabular-nums text-text-secondary">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={insight.href}
            className="inline-flex h-7 items-center gap-1.5 rounded-input border border-border-default px-2.5 text-caption text-text-secondary transition-colors duration-150 ease-nexus hover:border-border-strong hover:bg-accent-ghost hover:text-text-primary"
          >
            {insight.cta}
            <ArrowRight size={12} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          {onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(insight)}
              className="inline-flex h-7 items-center rounded-input px-2.5 text-caption text-text-tertiary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
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

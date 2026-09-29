"use client";

import { useState } from "react";
import {
  IconAlertTriangle,
  IconBolt,
  IconCalendar,
  IconCheck,
  IconChecklist,
  IconCloudCheck,
  IconFolder,
  IconLoader2,
  IconSparkles,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { SegmentedControl, type TabItem } from "@/components/ui/tabs";
import { Badge, Tag } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

// ============================================================
// SHOWCASE 05 — UNIVERSAL CAPTURE & NLP
// ============================================================
// The front door of the operating system, in five discrete motion
// states: idle → typing → understanding → parsed → confirmed.
//
// Everything is the shared control language now:
//   stage selector  SegmentedControl (same object as the task views)
//   omnibar         L3 raise surface + hairline strong, lavender only on
//                   the bolt (that is the intelligence marker)
//   extraction      four Cards, mono field labels, semantic hairline for
//                   the two fields the parser actually inferred
//   confirmation    success hairline + mono "what changed" line — no
//                   green fill block, no celebration
// ============================================================

export type CaptureStage = "idle" | "typing" | "understanding" | "parsed" | "confirmed";

const STAGES: TabItem<CaptureStage>[] = [
  { id: "idle", label: "Idle" },
  { id: "typing", label: "Typing" },
  { id: "understanding", label: "Understanding" },
  { id: "parsed", label: "Parsed" },
  { id: "confirmed", label: "Synced" },
];

const SENTENCE = "Deploy staging tomorrow at 3pm #infra";

const EXTRACTED = [
  {
    id: "task",
    label: "task action",
    value: "Deploy staging",
    detail: "Action verb and target identified",
    icon: IconChecklist,
    inferred: false,
  },
  {
    id: "date",
    label: "due date",
    value: "Tomorrow · 15:00",
    detail: "Sep 29, 2026 · 15:00 UTC",
    icon: IconCalendar,
    inferred: true,
  },
  {
    id: "project",
    label: "project tag",
    value: "#infra",
    detail: "Matched NEXUS Website / Infra",
    icon: IconFolder,
    inferred: false,
  },
  {
    id: "priority",
    label: "priority",
    value: "P1 · High",
    detail: "Inferred from staging deployment",
    icon: IconAlertTriangle,
    inferred: true,
  },
] as const;

export function CaptureShowcaseView() {
  const [stage, setStage] = useState<CaptureStage>("parsed");
  const [inputVal, setInputVal] = useState(SENTENCE);

  const selectStage = (next: CaptureStage) => {
    setStage(next);
    setInputVal(next === "idle" ? "" : SENTENCE);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ---------- Header ---------- */}
      <header className="flex flex-col gap-2">
        <Badge
          tone="lavender"
          icon={<NexusIcon icon={IconBolt} className="size-3" />}
          className="self-start"
        >
          Universal capture
        </Badge>
        <h1 className="text-h1 text-text-primary">One sentence in, one task out</h1>
        <p className="max-w-[68ch] text-small text-text-secondary">
          Write it the way you would say it, in English or French. NEXUS
          extracts the action, the date, the project and the priority, shows
          exactly what it understood, and only then writes to the workspace.
        </p>
      </header>

      {/* ---------- Motion state selector ---------- */}
      <div className="flex flex-wrap items-center gap-3 border-y border-border-subtle py-3">
        <span className="mono-token text-text-quaternary">State</span>
        <SegmentedControl
          items={STAGES}
          value={stage}
          onChange={selectStage}
          label="Capture motion state"
        />
        <span className="mono-meta ml-auto hidden text-text-quaternary sm:block">
          deterministic parser · no network round-trip
        </span>
      </div>

      {/* ---------- Omnibar ---------- */}
      <div className="rounded-surface border border-border-subtle bg-bg-surface p-4">
        <div className="flex items-center gap-3 rounded-control border border-border-strong bg-bg-surface-2 px-3 py-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-xs bg-lavender-subtle text-lavender">
            <NexusIcon icon={IconBolt} className="size-3.5" />
          </span>

          <input
            type="text"
            value={inputVal}
            onChange={(event) => setInputVal(event.target.value)}
            placeholder="Capture a thought, task or priority…"
            aria-label="Capture input"
            className="w-full bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-placeholder"
          />

          {stage === "understanding" ? (
            <span className="mono-meta flex shrink-0 items-center gap-1.5 text-lavender">
              <NexusIcon icon={IconLoader2} className="size-3.5 animate-spin" />
              parsing
            </span>
          ) : (
            <kbd className="mono-token flex shrink-0 items-center gap-1 rounded-xs border border-border-subtle bg-bg-surface-3 px-1.5 py-1 text-text-quaternary">
              ↵
            </kbd>
          )}
        </div>

        {/* ---------- Extraction ---------- */}
        {stage !== "idle" && stage !== "typing" ? (
          <div className="mt-4 border-t border-border-subtle pt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="mono-token text-text-quaternary">
                Extracted intent
              </p>
              <span className="mono-meta flex items-center gap-1.5 text-success">
                <NexusIcon icon={IconSparkles} className="size-3" />
                deterministic · 100% confidence
              </span>
            </div>

            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {EXTRACTED.map((field) => (
                <div
                  key={field.id}
                  className={cn(
                    "rounded-control border bg-bg-surface-2 p-3",
                    field.inferred
                      ? "border-lavender-border"
                      : "border-border-subtle"
                  )}
                >
                  <dt className="flex items-center justify-between gap-2">
                    <span className="mono-token text-text-quaternary">
                      {field.label}
                    </span>
                    <NexusIcon
                      icon={field.icon}
                      className={cn(
                        "size-3.5",
                        field.inferred ? "text-lavender" : "text-text-quaternary"
                      )}
                    />
                  </dt>
                  <dd className="mt-1.5 text-[14px] font-medium text-text-primary">
                    {field.value}
                  </dd>
                  <dd className="mono-meta mt-1 text-text-tertiary">
                    {field.detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {/* ---------- Confirmation ---------- */}
        {stage === "confirmed" ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-control border border-success-border bg-bg-surface-2 p-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-success-bg text-success">
              <NexusIcon icon={IconCheck} className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-small font-medium text-text-primary">
                Task created under NEXUS Website
              </p>
              <p className="mono-meta mt-0.5 text-text-tertiary">
                task_9f2c1a · due 2026-09-29 15:00 UTC · priority P1
              </p>
            </div>
            <Tag tone="success">
              <NexusIcon icon={IconCloudCheck} className="size-3" />
              synced
            </Tag>
          </div>
        ) : null}
      </div>

      {/* ---------- Trace ---------- */}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-border-subtle pt-4 sm:grid-cols-3">
        {[
          { label: "Parser", value: "nexus/capture·v3" },
          { label: "Input", value: `${inputVal.length} characters` },
          { label: "Writes", value: stage === "confirmed" ? "1 task" : "0 (preview)" },
        ].map((item) => (
          <div key={item.label}>
            <dt className="mono-token text-text-quaternary">{item.label}</dt>
            <dd className="mono-meta mt-1 text-text-secondary">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

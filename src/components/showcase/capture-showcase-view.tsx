"use client";

import { useState } from "react";
import {
  IconAlertTriangle,
  IconBolt,
  IconCalendar,
  IconCheck,
  IconChecklist,
  IconCloudCheck,
  IconCornerDownLeft,
  IconFolder,
  IconLoader2,
  IconSparkles,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { cn } from "@/lib/cn";

export type CaptureStage = "idle" | "typing" | "understanding" | "parsed" | "confirmed";

const STAGES: { id: CaptureStage; label: string }[] = [
  { id: "idle", label: "1. Idle" },
  { id: "typing", label: "2. Typing" },
  { id: "understanding", label: "3. Understanding" },
  { id: "parsed", label: "4. Parsed Structure" },
  { id: "confirmed", label: "5. Confirmed & Synced" },
];

export function CaptureShowcaseView() {
  const [stage, setStage] = useState<CaptureStage>("parsed");
  const [inputVal, setInputVal] = useState("Deploy staging tomorrow at 3pm #infra");

  return (
    <div className="space-y-8 max-w-4xl mx-auto pt-6">
      {/* Header */}
      <header className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-lavender/30 bg-lavender/10 px-3 py-1 text-[11px] font-mono text-lavender">
          <NexusIcon icon={IconBolt} className="size-3.5" />
          <span>Universal Natural Language Capture</span>
        </div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-text-primary">
          Instant Intent Parsing
        </h1>
        <p className="text-[14px] text-text-secondary max-w-lg mx-auto">
          Type a sentence in plain English or French. NEXUS extracts the action, due date, project tag and priority without friction.
        </p>
      </header>

      {/* Interactive Motion State Selector */}
      <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-pill border border-border-subtle bg-bg-surface w-fit mx-auto">
        {STAGES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setStage(s.id);
              if (s.id === "idle") setInputVal("");
              else setInputVal("Deploy staging tomorrow at 3pm #infra");
            }}
            className={cn(
              "h-7 rounded-pill px-3 text-[12px] font-medium transition-all duration-150",
              stage === s.id
                ? "bg-white text-black shadow-xs font-semibold"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Main Omnibar Capture Container */}
      <div className="relative rounded-panel border border-border-strong bg-[#141416] p-6 shadow-[0_12px_36px_rgba(0,0,0,0.6)] space-y-6">
        {/* Omnibar Input Box */}
        <div className="relative flex items-center rounded-panel border border-border-strong bg-[#1A1A1D] px-4 py-3.5 shadow-inner">
          <span className="flex size-7 items-center justify-center rounded-lg bg-lavender/15 text-lavender mr-3">
            <NexusIcon icon={IconBolt} className="size-4" />
          </span>

          <input
            type="text"
            value={stage === "idle" ? "" : inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Capture a thought, task or priority (e.g. Deploy staging tomorrow at 3pm #infra)..."
            className="w-full bg-transparent text-[15px] font-medium text-text-primary outline-none placeholder:text-text-quaternary"
          />

          {stage === "understanding" ? (
            <span className="flex items-center gap-1.5 text-caption font-mono text-lavender">
              <NexusIcon icon={IconLoader2} className="size-4 animate-spin" />
              <span>Parsing...</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-mono text-text-quaternary bg-bg-surface-3 border border-border-subtle px-2 py-1 rounded-[6px]">
              <span>Press</span>
              <NexusIcon icon={IconCornerDownLeft} className="size-3 text-text-secondary" />
            </span>
          )}
        </div>

        {/* Parsed Structure Visual Breakdown (Stages: 'understanding', 'parsed', 'confirmed') */}
        {(stage === "parsed" || stage === "confirmed" || stage === "understanding") && (
          <div className="space-y-4 pt-2 border-t border-border-subtle animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-text-quaternary uppercase tracking-wider font-semibold">
                EXTRACTED INTENT STRUCTURE
              </p>
              <span className="text-[11px] font-mono text-success flex items-center gap-1">
                <NexusIcon icon={IconSparkles} className="size-3" />
                Deterministic NLP match (100% confidence)
              </span>
            </div>

            {/* 4 Extraction Cards Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* 1. TASK */}
              <div className="rounded-card border border-border-default bg-bg-surface p-4 space-y-1.5">
                <div className="flex items-center justify-between text-caption text-text-tertiary">
                  <span className="font-mono text-[10px] uppercase">TASK ACTION</span>
                  <NexusIcon icon={IconChecklist} className="size-3.5" />
                </div>
                <p className="text-[15px] font-semibold text-text-primary">
                  Deploy staging
                </p>
                <p className="text-caption text-text-secondary">
                  Action verb &amp; target identified
                </p>
              </div>

              {/* 2. DATE */}
              <div className="rounded-card border border-lavender/30 bg-lavender/5 p-4 space-y-1.5">
                <div className="flex items-center justify-between text-caption text-lavender">
                  <span className="font-mono text-[10px] uppercase">DUE DATE &amp; TIME</span>
                  <NexusIcon icon={IconCalendar} className="size-3.5" />
                </div>
                <p className="text-[15px] font-semibold text-text-primary">
                  Tomorrow · 3:00 PM
                </p>
                <p className="text-caption text-text-secondary font-mono">
                  Sep 29, 2026, 15:00 UTC
                </p>
              </div>

              {/* 3. PROJECT */}
              <div className="rounded-card border border-border-default bg-bg-surface p-4 space-y-1.5">
                <div className="flex items-center justify-between text-caption text-text-tertiary">
                  <span className="font-mono text-[10px] uppercase">PROJECT TAG</span>
                  <NexusIcon icon={IconFolder} className="size-3.5" />
                </div>
                <p className="text-[15px] font-semibold text-text-primary flex items-center gap-1.5">
                  <span className="text-text-tertiary">#</span>
                  <span>Infra</span>
                </p>
                <p className="text-caption text-text-secondary">
                  Matched &ldquo;NEXUS Website / Infra&rdquo;
                </p>
              </div>

              {/* 4. PRIORITY */}
              <div className="rounded-card border border-warning/30 bg-warning/5 p-4 space-y-1.5">
                <div className="flex items-center justify-between text-caption text-warning">
                  <span className="font-mono text-[10px] uppercase">PRIORITY LEVEL</span>
                  <NexusIcon icon={IconAlertTriangle} className="size-3.5" />
                </div>
                <p className="text-[15px] font-semibold text-text-primary">
                  High (P1)
                </p>
                <p className="text-caption text-text-secondary">
                  Inferred from staging deployment
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation & Synced State Banner (Stage: 'confirmed') */}
        {stage === "confirmed" && (
          <div className="flex items-center justify-between rounded-card border border-success/30 bg-success/10 p-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <span className="flex size-7 items-center justify-center rounded-full bg-success text-black font-bold">
                <NexusIcon icon={IconCheck} className="size-4 stroke-[3]" />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-text-primary">
                  Captured successfully
                </p>
                <p className="text-caption text-text-secondary">
                  Task created under <strong className="text-text-primary">NEXUS Website</strong> · Due tomorrow at 15:00
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-bg-surface px-3 py-1 font-mono text-[11px] text-success">
              <NexusIcon icon={IconCloudCheck} className="size-3.5" />
              <span>Synced to NEXUS</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

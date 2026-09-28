"use client";

import { useState } from "react";
import {
  IconChecklist,
  IconCornerDownLeft,
  IconHistory,
  IconLayoutDashboard,
  IconLayoutKanban,
  IconNotebook,
  IconPlus,
  IconRadar,
  IconSearch,
  IconSparkles,
  IconTarget,
  IconCalendarTime,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { cn } from "@/lib/cn";

type ShowcaseCommand = {
  id: string;
  category: "Recent" | "Actions" | "Navigation" | "Entities";
  label: string;
  hint?: string;
  icon: React.ReactNode;
  active?: boolean;
};

const INITIAL_COMMANDS: ShowcaseCommand[] = [
  // ENTITIES (Matching "deploy")
  {
    id: "e-deploy-staging",
    category: "Entities",
    label: "Deploy staging environment #infra",
    hint: "Task · Tomorrow 3 PM",
    icon: <NexusIcon icon={IconChecklist} />,
    active: true,
  },
  {
    id: "e-deploy-prod",
    category: "Entities",
    label: "Deploy production release v3.0",
    hint: "Task · Oct 15",
    icon: <NexusIcon icon={IconChecklist} />,
  },
  {
    id: "e-q4-launch",
    category: "Entities",
    label: "Q4 Launch milestone deployment",
    hint: "Project · 78%",
    icon: <NexusIcon icon={IconLayoutKanban} />,
  },

  // RECENT
  {
    id: "r-staging",
    category: "Recent",
    label: "Deploy staging environment #infra",
    hint: "Task",
    icon: <NexusIcon icon={IconHistory} />,
  },
  {
    id: "r-website",
    category: "Recent",
    label: "NEXUS Website",
    hint: "Project",
    icon: <NexusIcon icon={IconHistory} />,
  },

  // ACTIONS
  {
    id: "a-new-task",
    category: "Actions",
    label: "Create new task",
    hint: "Action",
    icon: <NexusIcon icon={IconPlus} />,
  },
  {
    id: "a-new-proj",
    category: "Actions",
    label: "Create project",
    hint: "Action",
    icon: <NexusIcon icon={IconPlus} />,
  },
  {
    id: "a-note",
    category: "Actions",
    label: "Take a note",
    hint: "Action",
    icon: <NexusIcon icon={IconNotebook} />,
  },
  {
    id: "a-ask-ai",
    category: "Actions",
    label: "Ask NEXUS AI: What's putting the Q4 launch at risk?",
    hint: "Intelligence",
    icon: <NexusIcon icon={IconSparkles} />,
  },

  // NAVIGATION
  {
    id: "n-overview",
    category: "Navigation",
    label: "Go to Overview",
    hint: "Dashboard",
    icon: <NexusIcon icon={IconLayoutDashboard} />,
  },
  {
    id: "n-tasks",
    category: "Navigation",
    label: "Go to Tasks",
    hint: "Kanban",
    icon: <NexusIcon icon={IconChecklist} />,
  },
  {
    id: "n-projects",
    category: "Navigation",
    label: "Go to Projects",
    hint: "Initiatives",
    icon: <NexusIcon icon={IconLayoutKanban} />,
  },
  {
    id: "n-goals",
    category: "Navigation",
    label: "Go to Goals",
    hint: "Strategy",
    icon: <NexusIcon icon={IconTarget} />,
  },
  {
    id: "n-calendar",
    category: "Navigation",
    label: "Go to Calendar",
    hint: "Time Layer",
    icon: <NexusIcon icon={IconCalendarTime} />,
  },
  {
    id: "n-notes",
    category: "Navigation",
    label: "Go to Notes",
    hint: "Knowledge",
    icon: <NexusIcon icon={IconNotebook} />,
  },
  {
    id: "n-intelligence",
    category: "Navigation",
    label: "Go to Intelligence",
    hint: "Signals & Missions",
    icon: <NexusIcon icon={IconRadar} />,
  },
];

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return <>{text}</>;

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <span className="rounded-[3px] bg-white/[0.16] font-semibold text-white px-0.5">
        {match}
      </span>
      {after}
    </>
  );
}

export function CommandShowcaseView() {
  const [query, setQuery] = useState("deploy");
  const [activeId, setActiveId] = useState("e-deploy-staging");

  const categories: Array<ShowcaseCommand["category"]> = [
    "Entities",
    "Actions",
    "Recent",
    "Navigation",
  ];

  const filtered = INITIAL_COMMANDS.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      (cmd.hint && cmd.hint.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center p-4 pt-[10vh] sm:pt-[14vh] bg-black/70 backdrop-blur-sm pointer-events-auto">
      <div className="command-panel relative w-full max-w-[680px] overflow-hidden rounded-panel border border-border-default bg-[#171717] shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
        {/* Top subtle sheen */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" aria-hidden="true" />

        {/* Search Row */}
        <div className="flex h-[52px] items-center gap-3 border-b border-border-subtle pl-4 pr-3 bg-[#171717]">
          <NexusIcon icon={IconSearch} className="text-text-tertiary size-4" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search NEXUS, or type a sentence to capture it…"
            className="h-full w-full bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-quaternary"
            autoFocus
          />
          <kbd className="shrink-0 rounded-[5px] border border-border-subtle bg-bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] leading-[14px] text-text-quaternary">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="command-list max-h-[440px] overflow-y-auto p-2 space-y-2">
          {categories.map((category) => {
            const items = filtered.filter((cmd) => cmd.category === category);
            if (items.length === 0) return null;

            return (
              <div key={category} className="pb-1">
                {/* Sticky Group Header */}
                <div className="sticky top-0 z-10 -mx-2 flex items-center gap-2 bg-[#171717]/95 px-4 pb-1 pt-2 backdrop-blur-sm">
                  <p className="eyebrow text-text-quaternary uppercase tracking-wider text-[10px] font-semibold">
                    {category}
                  </p>
                  <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
                  <span className="font-mono text-[10px] tabular-nums text-text-quaternary">
                    {items.length}
                  </span>
                </div>

                {/* Items */}
                <div className="mt-1 space-y-0.5">
                  {items.map((command) => {
                    const isActive = command.id === activeId;
                    return (
                      <button
                        key={command.id}
                        type="button"
                        onClick={() => setActiveId(command.id)}
                        onMouseEnter={() => setActiveId(command.id)}
                        className={cn(
                          "group relative flex h-10 w-full items-center gap-3 rounded-nav px-2 text-left transition-colors duration-100",
                          isActive
                            ? "bg-white/[0.08] text-text-primary"
                            : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04]"
                        )}
                      >
                        {/* Active Indicator Left Line */}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-pill bg-white transition-opacity",
                            isActive ? "opacity-100" : "opacity-0"
                          )}
                        />

                        {/* Icon Box */}
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-[7px] border transition-colors",
                            isActive
                              ? "border-border-strong bg-[#1C1C1C] text-text-primary"
                              : "border-border-subtle bg-bg-subtle text-text-tertiary"
                          )}
                        >
                          {command.icon}
                        </span>

                        {/* Label */}
                        <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px]">
                          <HighlightedText text={command.label} query={query} />
                        </span>

                        {/* Hint Badge */}
                        {command.hint ? (
                          <span
                            className={cn(
                              "eyebrow shrink-0 text-[10px] uppercase font-mono tracking-wide",
                              isActive ? "text-text-tertiary" : "text-text-quaternary"
                            )}
                          >
                            {command.hint}
                          </span>
                        ) : null}

                        {/* Return Key Icon */}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-[5px] border border-border-subtle bg-bg-surface-2 transition-opacity",
                            isActive ? "opacity-100" : "opacity-0"
                          )}
                        >
                          <NexusIcon
                            icon={IconCornerDownLeft}
                            className="text-text-tertiary size-3"
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Status Footer */}
        <div className="flex h-9 items-center gap-4 border-t border-border-subtle bg-[#111111]/80 px-4 text-[11px] text-text-quaternary">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded-[4px] border border-border-subtle bg-bg-surface-2 px-1 py-0.5 font-mono text-[9.5px]">
              ↑↓
            </kbd>
            <span>Navigate</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded-[4px] border border-border-subtle bg-bg-surface-2 px-1 py-0.5 font-mono text-[9.5px]">
              ↵
            </kbd>
            <span>Open</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded-[4px] border border-border-subtle bg-bg-surface-2 px-1 py-0.5 font-mono text-[9.5px]">
              esc
            </kbd>
            <span>Close</span>
          </span>
          <span className="ml-auto font-mono text-[10.5px] tabular-nums text-text-tertiary">
            {filtered.length} results matching &ldquo;{query}&rdquo;
          </span>
        </div>
      </div>
    </div>
  );
}

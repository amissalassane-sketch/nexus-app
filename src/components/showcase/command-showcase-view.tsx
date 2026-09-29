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

// ============================================================
// SHOWCASE 02 — COMMAND CENTER (⌘K)
// ============================================================
// The palette is an overlay layer: L4 surface + hairline + one shadow.
//
// Audit fixes folded into this file:
//   · double blur removed — the scrim carries the product's single 2px
//     blur; the sticky group header is a solid L4 surface with a hairline
//     (it used to blur again on top of the scrim).
//   · every hardcoded surface (#171717 / #1C1C1C / #111111) replaced by
//     the token ladder.
//   · the decorative top sheen gradient is gone; the header rim is a
//     hairline.
//
// Layer separation for capture: the workspace behind stays a discrete,
// dimmed layer (data-showcase-backdrop) so the palette can be exported
// with or without its context.
// ============================================================

type ShowcaseCommand = {
  id: string;
  category: "Recent" | "Actions" | "Navigation" | "Entities";
  label: string;
  hint?: string;
  icon: React.ReactNode;
};

const INITIAL_COMMANDS: ShowcaseCommand[] = [
  // ENTITIES (matching "deploy")
  {
    id: "e-deploy-staging",
    category: "Entities",
    label: "Deploy staging environment #infra",
    hint: "Task · Tomorrow 3 PM",
    icon: <NexusIcon icon={IconChecklist} />,
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
    label: "Ask NEXUS: what's putting the Q4 launch at risk?",
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
    hint: "Time layer",
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
    hint: "Signals",
    icon: <NexusIcon icon={IconRadar} />,
  },
];

const CATEGORY_ORDER: Array<ShowcaseCommand["category"]> = [
  "Entities",
  "Recent",
  "Actions",
  "Navigation",
];

/**
 * Query match. This is a *system state*, not an intelligence signal, so
 * the highlight stays monochrome (a raised wash + a hairline underline)
 * instead of painting the palette lavender.
 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <span className="rounded-xs bg-accent-ghost-hover px-0.5 font-medium text-text-primary underline decoration-border-strong decoration-1 underline-offset-2">
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
  );
}

export function CommandShowcaseView() {
  const [query, setQuery] = useState("deploy");
  const [activeId, setActiveId] = useState("e-deploy-staging");

  const filtered = INITIAL_COMMANDS.filter((command) => {
    if (!query.trim()) return true;
    const needle = query.toLowerCase();
    return (
      command.label.toLowerCase().includes(needle) ||
      command.category.toLowerCase().includes(needle) ||
      (command.hint ? command.hint.toLowerCase().includes(needle) : false)
    );
  });

  return (
    <div
      data-showcase-backdrop="true"
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 p-4 pt-[10vh] backdrop-blur-[2px] sm:pt-[14vh]"
    >
      <div
        role="dialog"
        aria-label="Command palette"
        className="relative w-full max-w-[680px] overflow-hidden rounded-overlay surface-overlay"
      >
        {/* ---- Search row ---- */}
        <div className="flex h-12 items-center gap-3 border-b border-border-subtle pr-2.5 pl-3.5">
          <NexusIcon icon={IconSearch} className="shrink-0 text-text-quaternary" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search NEXUS, or type a sentence to capture it…"
            aria-label="Search NEXUS"
            className="h-full w-full bg-transparent text-[13.5px] text-text-primary outline-none placeholder:text-text-placeholder"
          />
          <kbd className="mono-token shrink-0 rounded-xs border border-border-subtle bg-bg-surface-2 px-1.5 py-1 text-text-quaternary">
            esc
          </kbd>
        </div>

        {/* ---- Results ---- */}
        <div className="command-list max-h-[440px] overflow-y-auto px-2 py-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-small text-text-secondary">
              Nothing matches “{query.trim()}”. Press Enter to capture it as a
              task.
            </p>
          ) : (
            CATEGORY_ORDER.map((category) => {
              const items = filtered.filter(
                (command) => command.category === category
              );
              if (items.length === 0) return null;

              return (
                <div key={category}>
                  {/* Sticky group header — solid L4 + hairline. No blur. */}
                  <div className="sticky top-0 z-10 -mx-2 flex items-center gap-2 border-b border-border-subtle bg-bg-surface-3 px-4 pt-2 pb-1">
                    <p className="eyebrow text-text-quaternary">{category}</p>
                    <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
                    <span className="mono-token text-text-quaternary">
                      {items.length}
                    </span>
                  </div>

                  <div className="pt-1">
                    {items.map((command) => {
                      const isActive = command.id === activeId;
                      return (
                        <button
                          key={command.id}
                          type="button"
                          aria-selected={isActive}
                          onClick={() => setActiveId(command.id)}
                          onMouseEnter={() => setActiveId(command.id)}
                          className={cn(
                            "relative flex h-9 w-full items-center gap-2.5 rounded-control px-2 text-left transition-colors duration-[120ms] ease-nexus",
                            isActive
                              ? "bg-bg-surface-2 text-text-primary"
                              : "text-text-secondary hover:bg-accent-ghost hover:text-text-primary"
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute top-1/2 left-0 h-3.5 w-0.5 -translate-y-1/2 rounded-pill bg-lavender transition-opacity duration-[120ms]",
                              isActive ? "opacity-100" : "opacity-0"
                            )}
                          />

                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-xs border",
                              isActive
                                ? "border-border-strong bg-bg-surface-2 text-text-primary"
                                : "border-border-subtle bg-bg-surface text-text-tertiary"
                            )}
                          >
                            {command.icon}
                          </span>

                          <span className="min-w-0 flex-1 truncate text-[13px]">
                            <HighlightedText text={command.label} query={query} />
                          </span>

                          {command.hint ? (
                            <span
                              className={cn(
                                "mono-meta shrink-0",
                                isActive
                                  ? "text-text-tertiary"
                                  : "text-text-quaternary"
                              )}
                            >
                              {command.hint}
                            </span>
                          ) : null}

                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-xs border border-border-subtle bg-bg-surface-2 transition-opacity duration-[120ms]",
                              isActive ? "opacity-100" : "opacity-0"
                            )}
                          >
                            <NexusIcon
                              icon={IconCornerDownLeft}
                              px={11}
                              className="text-text-tertiary"
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ---- Status footer ---- */}
        <div className="flex h-9 items-center gap-4 border-t border-border-subtle bg-bg-surface-2 px-4">
          <span className="hidden items-center gap-1.5 sm:flex">
            <kbd className="mono-token rounded-xs border border-border-subtle bg-bg-surface-3 px-1 py-0.5 text-text-quaternary">
              ↑↓
            </kbd>
            <span className="text-caption text-text-tertiary">Navigate</span>
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <kbd className="mono-token rounded-xs border border-border-subtle bg-bg-surface-3 px-1 py-0.5 text-text-quaternary">
              ↵
            </kbd>
            <span className="text-caption text-text-tertiary">Open</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="mono-token rounded-xs border border-border-subtle bg-bg-surface-3 px-1 py-0.5 text-text-quaternary">
              esc
            </kbd>
            <span className="text-caption text-text-tertiary">Close</span>
          </span>
          <span className="mono-meta ml-auto truncate text-text-tertiary">
            {filtered.length} results · “{query}”
          </span>
        </div>
      </div>
    </div>
  );
}

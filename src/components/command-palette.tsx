"use client";

// ============================================================
// NEXUS — COMMAND PALETTE (P6 ⌘K)
//  - Mounted at the SHELL level (client), one global listener:
//    (metaKey || ctrlKey) + k → preventDefault + open
//  - NO setState during useEffect: data loads from the OPEN
//    handler (React Compiler rule — pitfall #5)
//  - Visible "Search… ⌘K" affordance in the sidebar
//  - Content: create ×3, navigate ×8, real workspace search,
//    "Ask NEXUS" brief
//  - Keyboard: ↑ ↓ Enter Escape · role=dialog + aria-modal ·
//    focus restored to the trigger on close
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CheckSquare,
  Crosshair,
  FolderKanban,
  FolderPlus,
  LayoutDashboard,
  Search,
  Settings2,
  Sparkles,
  SquarePen,
  CreditCard,
  Target,
} from "lucide-react";
import type { SearchHit } from "@/app/api/search/route";

type Command = {
  id: string;
  section: "Create" | "Navigate" | "Intelligence" | "Results";
  label: string;
  hint?: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  href: string;
};

const NAV_COMMANDS: Command[] = [
  { id: "create:task", section: "Create", label: "New task", hint: "⏎", icon: SquarePen, href: "/tasks?new=1" },
  { id: "create:project", section: "Create", label: "New project", hint: "⏎", icon: FolderPlus, href: "/projects?new=1" },
  { id: "create:goal", section: "Create", label: "New goal", hint: "⏎", icon: Crosshair, href: "/goals?new=1" },
  { id: "nav:dashboard", section: "Navigate", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "nav:tasks", section: "Navigate", label: "Tasks", icon: CheckSquare, href: "/tasks" },
  { id: "nav:goals", section: "Navigate", label: "Goals", icon: Target, href: "/goals" },
  { id: "nav:projects", section: "Navigate", label: "Projects", icon: FolderKanban, href: "/projects" },
  { id: "nav:intelligence", section: "Navigate", label: "Intelligence", icon: Sparkles, href: "/intelligence" },
  { id: "nav:notifications", section: "Navigate", label: "Notifications", icon: Bell, href: "/notifications" },
  { id: "nav:settings", section: "Navigate", label: "Settings", icon: Settings2, href: "/settings" },
  { id: "nav:billing", section: "Navigate", label: "Billing", icon: CreditCard, href: "/settings/billing" },
  {
    id: "ask:nexus",
    section: "Intelligence",
    label: "Ask NEXUS: what should I work on?",
    hint: "Brief",
    icon: Sparkles,
    href: "/intelligence",
  },
];

const SECTION_ORDER: Command["section"][] = ["Intelligence", "Create", "Navigate", "Results"];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searching, setSearching] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ---- Global listener: ⌘K / Ctrl+K --------------------------
  // Reset happens in the HANDLERS (never setState in an effect —
  // React Compiler rule, pitfall #5).
  const resetAndOpen = useCallback(() => {
    setQuery("");
    setHits([]);
    setActiveIndex(0);
    setOpen(true); // the input mounts with autoFocus
  }, []);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setQuery("");
    setHits([]);
    setActiveIndex(0);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) {
          close(false);
        } else {
          resetAndOpen();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, resetAndOpen]);

  // Escape closes + restores focus.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // ---- Data loading happens in HANDLERS, never in effects ----
  const runSearch = useCallback(async (value: string) => {
    const clean = value.trim();
    if (clean.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(clean)}`);
      if (!response.ok) {
        setHits([]);
        return;
      }
      const payload = (await response.json()) as { hits: SearchHit[] };
      setHits(payload.hits ?? []);
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search — the timer callback sets state, not the effect body.
  const queryTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!open) return;
    if (queryTimer.current !== null) {
      window.clearTimeout(queryTimer.current);
    }
    queryTimer.current = window.setTimeout(() => {
      void runSearch(query);
    }, 160);
    return () => {
      if (queryTimer.current !== null) {
        window.clearTimeout(queryTimer.current);
      }
    };
  }, [query, open, runSearch]);

  // ---- Flat list of visible commands -------------------------
  const hitCommands: Command[] = useMemo(
    () =>
      hits.map((hit) => ({
        id: `hit:${hit.kind}:${hit.id}`,
        section: "Results" as const,
        label: hit.title,
        hint: hit.kind,
        icon: hit.kind === "task" ? CheckSquare : hit.kind === "project" ? FolderKanban : Crosshair,
        href: hit.href,
      })),
    [hits]
  );

  const visibleCommands = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (clean.length === 0) return NAV_COMMANDS;
    const matched = NAV_COMMANDS.filter((command) =>
      `${command.label} ${command.section}`.toLowerCase().includes(clean)
    );
    return [...matched, ...hitCommands];
  }, [hitCommands, query]);

  const activate = useCallback(
    (command: Command | undefined) => {
      if (!command) return;
      close(true);
      router.push(command.href);
    },
    [close, router]
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, visibleCommands.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      activate(visibleCommands[activeIndex]);
    }
  };

  // Scroll the active row into view.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const grouped = SECTION_ORDER.map((section) => ({
    section,
    items: visibleCommands
      .map((command, index) => ({ command, index }))
      .filter(({ command }) => command.section === section),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      {/* VISIBLE affordance — the shortcut is never the only door */}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open command palette"
        onClick={resetAndOpen}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border-default bg-bg-surface px-3 text-small text-text-tertiary transition-all duration-[160ms] ease-out hover:border-border-strong hover:text-text-secondary md:min-h-9"
      >
        <span className="flex items-center gap-2">
          <Search size={14} strokeWidth={1.75} />
          Search…
        </span>
        <kbd className="rounded border border-border-default bg-bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-text-quaternary">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          className="animate-fade-in fixed inset-0 z-[90] flex items-start justify-center bg-black/50 px-4 pt-[15vh] backdrop-blur-sm"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              close(true);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onKeyDown={onKeyDown}
            className="animate-scale-in w-full max-w-[560px] overflow-hidden rounded-xl border border-border-default bg-bg-surface shadow-md"
          >
            {/* Input */}
            <div className="flex min-h-11 items-center gap-3 border-b border-border-subtle px-4">
              <Search size={16} strokeWidth={1.75} className="shrink-0 text-text-tertiary" />
              <input
                ref={inputRef}
                value={query}
                autoFocus
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Search, create, navigate, ask NEXUS…"
                aria-label="Command input"
                className="w-full bg-transparent py-3.5 text-body text-text-primary outline-none placeholder:text-text-quaternary"
                autoComplete="off"
                spellCheck={false}
              />
              {searching ? (
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-volt" aria-hidden="true" />
              ) : null}
            </div>

            {/* Results */}
            <div ref={listRef} role="listbox" aria-label="Commands" className="max-h-[46vh] overflow-y-auto p-2">
              {visibleCommands.length === 0 ? (
                <div className="px-3 py-8 text-center text-small text-text-tertiary">
                  No match. Try a task or project name, or press Escape.
                </div>
              ) : (
                grouped.map((group) => (
                  <div key={group.section} className="mb-1">
                    <div className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-quaternary">
                      {group.section}
                    </div>
                    {group.items.map(({ command, index }) => {
                      const Icon = command.icon;
                      const active = index === activeIndex;
                      return (
                        <button
                          key={command.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          data-index={index}
                          onClick={() => activate(command)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={`flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-body transition-colors duration-[120ms] ${
                            active
                              ? "bg-bg-surface-3 text-text-primary"
                              : "text-text-secondary hover:bg-bg-surface-2"
                          }`}
                        >
                          <Icon size={15} strokeWidth={1.75} className="shrink-0 text-text-tertiary" />
                          <span className="min-w-0 flex-1 truncate">{command.label}</span>
                          {command.hint ? (
                            <span className="shrink-0 font-mono text-mono-small text-text-quaternary">
                              {command.hint}
                            </span>
                          ) : null}
                          {active ? (
                            <ArrowRight size={12} strokeWidth={2} className="shrink-0 text-text-tertiary" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2 font-mono text-[10px] text-text-quaternary">
              <span>↑↓ NAVIGATE · ⏎ OPEN · ESC CLOSE</span>
              <span>NEXUS ⌘K</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

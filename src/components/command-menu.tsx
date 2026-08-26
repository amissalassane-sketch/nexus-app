"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  CornerDownLeft,
  FolderKanban,
  History,
  Plus,
  Radar,
  Search,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { cn } from "@/lib/cn";
import { ALL_NAV_ENTRIES } from "@/components/layout/nav-config";

// ============================================================
// NEXUS — COMMAND PALETTE (⌘K / Ctrl+K)
// The keyboard interface to the whole product. Opens on ⌘K, on "/",
// on the sidebar and top-bar search, or via `nexus:open-command`.
//
// Design: a quiet command surface — icon tiles, matched-text
// highlighting, sticky grouped headers, a status footer. Monochrome
// throughout; the only accent is the active row.
//
// Categories: Recent · Actions · Pages · Projects · Tasks · Goals.
// Entities are read from Supabase under RLS — no fabricated results.
// Matching is scored (prefix > word start > substring) and supports
// multi-word queries; every token must match somewhere.
// Keyboard: ↑ ↓ Home End move, Enter runs, Escape closes.
// ============================================================

type CommandCategory =
  | "Recent"
  | "Actions"
  | "Pages"
  | "Projects"
  | "Tasks"
  | "Goals";

type Command = {
  id: string;
  category: CommandCategory;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  href: string;
  keywords: string;
};

const CREATE_COMMANDS: Command[] = [
  {
    id: "c-task",
    category: "Actions",
    label: "Create task",
    hint: "Task",
    icon: <Plus size={15} strokeWidth={1.75} />,
    href: "/tasks?create=1",
    keywords: "new task add create",
  },
  {
    id: "c-project",
    category: "Actions",
    label: "Create project",
    hint: "Project",
    icon: <Plus size={15} strokeWidth={1.75} />,
    href: "/projects?create=1",
    keywords: "new project add create",
  },
  {
    id: "c-goal",
    category: "Actions",
    label: "Create goal",
    hint: "Goal",
    icon: <Plus size={15} strokeWidth={1.75} />,
    href: "/goals?create=1",
    keywords: "new goal add create objective",
  },
  {
    id: "a-review",
    category: "Actions",
    label: "Review what needs attention",
    hint: "Intelligence",
    icon: <Radar size={15} strokeWidth={1.75} />,
    href: "/app/intelligence",
    keywords: "signals blocked risk attention review intelligence ask",
  },
];

const PAGE_COMMANDS: Command[] = ALL_NAV_ENTRIES.map((entry) => ({
  id: `n-${entry.href}`,
  category: "Pages" as const,
  label: `Go to ${entry.label}`,
  hint: entry.hint,
  icon: <entry.icon size={15} strokeWidth={1.75} />,
  href: entry.href,
  keywords: `${entry.label} ${entry.keywords ?? ""}`.toLowerCase(),
}));

const CATEGORY_ORDER: CommandCategory[] = [
  "Recent",
  "Actions",
  "Pages",
  "Projects",
  "Tasks",
  "Goals",
];

const RECENT_STORAGE_KEY = "nexus.command-recents";
const RECENT_LIMIT = 4;

function readRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string").slice(0, RECENT_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function rememberRecent(id: string) {
  try {
    const next = [id, ...readRecents().filter((recent) => recent !== id)].slice(
      0,
      RECENT_LIMIT
    );
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode) — recents are a convenience only.
  }
}

/**
 * Score one command against one token: 3 = label starts with it,
 * 2.4 = a word inside the label starts with it, 2 = substring of the
 * label, 1.2 = keyword match. 0 = no match. Every token in the query
 * must score somewhere or the command is out.
 */
function tokenScore(command: Command, token: string): number {
  const label = command.label.toLowerCase();
  if (label.startsWith(token)) return 3;
  if (label.includes(` ${token}`)) return 2.4;
  if (label.includes(token)) return 2;
  if (command.keywords.includes(token)) return 1.2;
  return 0;
}

/** Merged, ordered [start, end) ranges of every query token in `text`. */
function matchRanges(text: string, tokens: string[]): [number, number][] {
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const token of tokens) {
    if (!token) continue;
    let from = 0;
    let at = lower.indexOf(token);
    while (at !== -1) {
      ranges.push([at, at + token.length]);
      from = at + token.length;
      at = lower.indexOf(token, from);
    }
  }
  if (ranges.length === 0) return ranges;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [ranges[0]];
  for (const [start, end] of ranges.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

function HighlightedLabel({
  text,
  tokens,
}: {
  text: string;
  tokens: string[];
}) {
  const ranges = useMemo(() => matchRanges(text, tokens), [text, tokens]);
  if (ranges.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], index) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <span
        key={index}
        className="rounded-[3px] bg-white/[0.12] font-medium text-text-primary"
      >
        {text.slice(start, end)}
      </span>
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export function CommandMenu() {
  const router = useRouter();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [entities, setEntities] = useState<Command[]>([]);
  const [recents, setRecents] = useState<Command[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setClosing(false);
      setOpen(false);
      restoreFocus.current?.focus?.();
    }, 160);
  }, [closing]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  // Load real tasks / projects / goals once, lazily.
  const loadEntities = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setState("loading");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setState("ready");
        return;
      }

      const { membership } = await getActiveMembership(supabase, user.id);
      const workspaceId = membership?.workspaceId ?? null;
      if (!workspaceId) {
        setState("ready");
        return;
      }

      const [tasks, projects, goals] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, status")
          .eq("workspace_id", workspaceId)
          .order("updated_at", { ascending: false })
          .limit(60),
        supabase
          .from("projects")
          .select("id, name, status")
          .eq("workspace_id", workspaceId)
          .limit(60),
        supabase
          .from("goals")
          .select("id, title, status")
          .eq("workspace_id", workspaceId)
          .limit(60),
      ]);

      if (tasks.error && projects.error && goals.error) {
        setState("error");
        return;
      }

      const next: Command[] = [];
      for (const project of projects.data ?? []) {
        next.push({
          id: `p-${project.id}`,
          category: "Projects",
          label: project.name as string,
          hint: (project.status as string) ?? undefined,
          icon: <FolderKanban size={15} strokeWidth={1.75} />,
          href: "/projects",
          keywords: (project.name as string).toLowerCase(),
        });
      }
      for (const task of tasks.data ?? []) {
        next.push({
          id: `t-${task.id}`,
          category: "Tasks",
          label: task.title as string,
          hint: (task.status as string)?.replace("_", " "),
          icon: <CheckSquare size={15} strokeWidth={1.75} />,
          href: "/tasks",
          keywords: (task.title as string).toLowerCase(),
        });
      }
      for (const goal of goals.data ?? []) {
        next.push({
          id: `g-${goal.id}`,
          category: "Goals",
          label: goal.title as string,
          hint: (goal.status as string) ?? undefined,
          icon: <Target size={15} strokeWidth={1.75} />,
          href: "/goals",
          keywords: (goal.title as string).toLowerCase(),
        });
      }
      setEntities(next);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  const openMenu = useCallback(
    (initialQuery = "") => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setClosing(false);
      setOpen(true);
      setQuery(initialQuery);
      setActiveIndex(0);
      setRecents(
        readRecents()
          .map((id) => allCommandsById.get(id))
          .filter((command): command is Command => Boolean(command))
      );
      void loadEntities();
    },
    [loadEntities]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) requestClose();
        else openMenu();
      }
    };
    const onOpen = () => openMenu();
    const onCreate = () => openMenu("create");
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("nexus:open-command", onOpen);
    window.addEventListener("nexus:create-command", onCreate);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("nexus:open-command", onOpen);
      window.removeEventListener("nexus:create-command", onCreate);
    };
  }, [open, openMenu, requestClose]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const allCommands = useMemo(
    () => [...CREATE_COMMANDS, ...PAGE_COMMANDS, ...entities],
    [entities]
  );

  const tokens = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query]
  );

  const results = useMemo(() => {
    // Empty query = the shortlist (recents + actions + destinations),
    // not a dump of every row in the workspace.
    if (tokens.length === 0) {
      return [...recents, ...CREATE_COMMANDS, ...PAGE_COMMANDS];
    }

    const scored: { command: Command; score: number }[] = [];
    for (const command of allCommands) {
      let total = 0;
      for (const token of tokens) {
        const score = tokenScore(command, token);
        if (score === 0) {
          total = 0;
          break;
        }
        total += score;
      }
      if (total > 0) scored.push({ command, score: total });
    }

    const categoryWeight = (category: CommandCategory) => {
      const index = CATEGORY_ORDER.indexOf(category);
      return index === -1 ? CATEGORY_ORDER.length : index;
    };

    return scored
      .sort(
        (a, b) =>
          b.score - a.score ||
          categoryWeight(a.command.category) - categoryWeight(b.command.category) ||
          a.command.label.localeCompare(b.command.label)
      )
      .slice(0, 60)
      .map((entry) => entry.command);
  }, [allCommands, recents, tokens]);

  // Grouped for display, flat for keyboard navigation.
  const groups = useMemo(() => {
    const map = new Map<CommandCategory, Command[]>();
    for (const command of results) {
      const list = map.get(command.category) ?? [];
      list.push(command);
      map.set(command.category, list);
    }
    return CATEGORY_ORDER.filter((category) => map.has(category)).map(
      (category) => ({
        category,
        items: map.get(category)!,
      })
    );
  }, [results]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  const runCommand = useCallback(
    (command: Command) => {
      rememberRecent(command.id);
      requestClose();
      router.push(command.href);
    },
    [requestClose, router]
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (closing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      requestClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (flat.length ? (index + 1) % flat.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        flat.length ? (index - 1 + flat.length) % flat.length : 0
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(flat.length - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = flat[currentIndex];
      if (command) runCommand(command);
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      "[data-active='true']"
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Results shrink as the query narrows; clamp at render so the active
  // row can never point past the end of the list.
  const currentIndex = Math.min(activeIndex, Math.max(flat.length - 1, 0));

  if (!open) return null;

  let cursor = -1;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-start justify-center p-4 pt-[9vh] sm:pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-label="Close command palette"
        tabIndex={-1}
        onClick={requestClose}
        className={cn(
          "command-backdrop fixed inset-0",
          closing && "command-backdrop-out"
        )}
      />

      <div
        className={cn(
          "command-panel relative w-full max-w-[680px] overflow-hidden rounded-panel border border-border-default bg-bg-surface shadow-overlay ring-1 ring-inset ring-white/[0.03]",
          closing ? "animate-command-out" : "animate-command-in"
        )}
      >
        {/* Top sheen — one quiet light across the header */}
        <div className="command-sheen pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden="true" />

        {/* ---- Search row ---- */}
        <div className="flex h-[52px] items-center gap-3 border-b border-border-subtle pl-4 pr-3">
          <Search
            size={16}
            strokeWidth={1.75}
            className="shrink-0 text-text-tertiary"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search NEXUS — pages, projects, tasks, actions…"
            aria-label="Search NEXUS"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={
              flat[currentIndex] ? `${listboxId}-opt-${currentIndex}` : undefined
            }
            className="h-full w-full bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-quaternary"
          />
          {state === "loading" ? (
            <span
              className="size-3.5 shrink-0 animate-spin rounded-full border border-border-strong border-t-text-tertiary"
              aria-hidden="true"
            />
          ) : null}
          <kbd className="shrink-0 rounded-[5px] border border-border-subtle bg-bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] leading-[14px] text-text-quaternary">
            ESC
          </kbd>
        </div>

        {/* ---- Results ---- */}
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Command results"
          className="command-list max-h-[min(52vh,392px)] overflow-y-auto overscroll-contain p-2"
        >
          {flat.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <span className="mx-auto flex size-9 items-center justify-center rounded-input border border-border-default bg-bg-surface-2 text-text-quaternary">
                <Search size={15} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <p className="mt-3 text-small text-text-secondary">
                Nothing matches “{query.trim()}”.
              </p>
              <p className="mt-1 text-caption text-text-tertiary">
                Try a project name, a task title, or a page.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                {CREATE_COMMANDS.map((command) => (
                  <button
                    key={command.id}
                    type="button"
                    onClick={() => runCommand(command)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-pill border border-border-default bg-bg-subtle px-2.5 text-caption text-text-secondary transition-colors duration-150 ease-nexus hover:border-border-strong hover:text-text-primary"
                  >
                    {command.icon}
                    {command.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.category} className="pb-1.5 last:pb-0">
                <div className="sticky top-0 z-10 -mx-2 flex items-center gap-2 bg-bg-surface/95 px-4 pb-1 pt-2 backdrop-blur-sm">
                  <p className="eyebrow text-text-quaternary">
                    {group.category}
                  </p>
                  <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
                  <span className="font-mono text-[10px] tabular-nums text-text-quaternary">
                    {group.items.length}
                  </span>
                </div>
                {group.items.map((command) => {
                  cursor += 1;
                  const index = cursor;
                  const active = index === currentIndex;
                  return (
                    <button
                      key={command.id}
                      type="button"
                      id={`${listboxId}-opt-${index}`}
                      role="option"
                      aria-selected={active}
                      data-active={active}
                      onMouseMove={() => setActiveIndex(index)}
                      onClick={() => runCommand(command)}
                      className={cn(
                        "command-row group relative flex h-10 w-full items-center gap-3 rounded-nav px-2 text-left",
                        active ? "text-text-primary" : "text-text-secondary"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "command-rail absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-pill",
                          active ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-[7px] border transition-colors duration-100",
                          active
                            ? "border-border-strong bg-bg-surface-3 text-text-primary"
                            : "border-border-subtle bg-bg-subtle text-text-tertiary group-hover:text-text-secondary"
                        )}
                      >
                        {command.category === "Recent" ? (
                          <History size={15} strokeWidth={1.75} />
                        ) : (
                          command.icon
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px]">
                        <HighlightedLabel text={command.label} tokens={tokens} />
                      </span>
                      {command.hint ? (
                        <span
                          className={cn(
                            "eyebrow shrink-0 uppercase",
                            active ? "text-text-tertiary" : "text-text-quaternary"
                          )}
                        >
                          {command.hint}
                        </span>
                      ) : null}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-[5px] border transition-opacity duration-100",
                          active
                            ? "border-border-subtle bg-bg-surface-2 opacity-100"
                            : "opacity-0"
                        )}
                      >
                        <CornerDownLeft
                          size={11}
                          strokeWidth={1.75}
                          className="text-text-tertiary"
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* ---- Status footer ---- */}
        <div className="flex h-9 items-center gap-4 border-t border-border-subtle bg-bg-subtle/60 px-4">
          <Hint keys="↑↓" label="Navigate" />
          <Hint keys="↵" label="Open" />
          <Hint keys="esc" label="Close" />
          <span className="ml-auto flex items-center gap-3">
            {state === "error" ? (
              <span className="flex items-center gap-1.5 text-caption text-text-tertiary">
                <span className="size-1.5 rounded-pill bg-warning" aria-hidden="true" />
                Workspace results unavailable
              </span>
            ) : state === "loading" ? (
              <span className="flex items-center gap-1.5 text-caption text-text-quaternary">
                <span className="size-1.5 rounded-pill bg-text-quaternary signal-pulse" aria-hidden="true" />
                Indexing workspace
              </span>
            ) : tokens.length > 0 ? (
              <span className="font-mono text-[10.5px] tabular-nums text-text-quaternary">
                {flat.length} result{flat.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Module-level lookup so recents resolve without re-creating the map. */
const allCommandsById = new Map<string, Command>(
  [...CREATE_COMMANDS, ...PAGE_COMMANDS].map((command) => [command.id, command])
);

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded-[4px] border border-border-subtle bg-bg-surface-2 px-1 py-px font-mono text-[9.5px] leading-[14px] text-text-quaternary">
        {keys}
      </kbd>
      <span className="text-[10.5px] text-text-quaternary">{label}</span>
    </span>
  );
}

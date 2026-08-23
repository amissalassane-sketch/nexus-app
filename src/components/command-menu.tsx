"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  CornerDownLeft,
  FolderKanban,
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
// Categories: Actions · Pages · Projects · Tasks · Goals.
// Entities are read from Supabase under RLS — no fabricated results.
// Keyboard: ↑ ↓ move, Enter runs, Escape closes.
// ============================================================

type CommandCategory =
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
    keywords: "signals blocked risk attention review",
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
  "Actions",
  "Pages",
  "Projects",
  "Tasks",
  "Goals",
];

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [entities, setEntities] = useState<Command[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    restoreFocus.current?.focus?.();
  }, []);

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

  const openMenu = useCallback(() => {
    restoreFocus.current = document.activeElement as HTMLElement | null;
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
    void loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) closeMenu();
        else openMenu();
      }
    };
    const onOpen = () => openMenu();
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("nexus:open-command", onOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("nexus:open-command", onOpen);
    };
  }, [open, openMenu, closeMenu]);

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

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();

    // Empty query = the shortlist (actions + destinations), not a dump of
    // every row in the workspace.
    if (!needle) return [...CREATE_COMMANDS, ...PAGE_COMMANDS];

    return allCommands
      .filter(
        (command) =>
          command.label.toLowerCase().includes(needle) ||
          command.keywords.includes(needle)
      )
      .slice(0, 60);
  }, [allCommands, query]);

  // Grouped for display, flat for keyboard navigation.
  const groups = useMemo(() => {
    const map = new Map<CommandCategory, Command[]>();
    for (const command of results) {
      const list = map.get(command.category) ?? [];
      list.push(command);
      map.set(command.category, list);
    }
    return CATEGORY_ORDER.filter((category) => map.has(category)).map(
      (category) => ({ category, items: map.get(category)! })
    );
  }, [results]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  const runCommand = useCallback(
    (command: Command) => {
      setOpen(false);
      router.push(command.href);
    },
    [router]
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % Math.max(flat.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + flat.length) % Math.max(flat.length, 1)
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = flat[activeIndex];
      if (command) runCommand(command);
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>("[data-active='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  let cursor = -1;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-start justify-center p-4 pt-[10vh] sm:pt-[14vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-label="Close command palette"
        tabIndex={-1}
        onClick={closeMenu}
        className="fixed inset-0 bg-black/72 backdrop-blur-[2px] animate-fade-in"
      />

      <div className="relative w-full max-w-[640px] overflow-hidden rounded-card border border-border-default bg-bg-surface shadow-overlay animate-scale-in">
        <div className="flex items-center gap-2.5 border-b border-border-subtle px-4">
          <Search
            size={15}
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
            placeholder="Search projects, tasks, pages and actions…"
            aria-label="Search NEXUS"
            className="h-12 w-full bg-transparent text-body text-text-primary outline-none placeholder:text-text-quaternary"
          />
          <kbd className="shrink-0 rounded-[4px] border border-border-subtle px-1 font-mono text-[10px] leading-[15px] text-text-quaternary">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[min(52vh,380px)] overflow-y-auto p-1.5">
          {state === "loading" && flat.length === 0 ? (
            <div className="flex flex-col gap-1 p-1.5" aria-hidden="true">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="skeleton h-9 rounded-nav" />
              ))}
            </div>
          ) : flat.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-small text-text-secondary">
                Nothing matches “{query.trim()}”.
              </p>
              <p className="mt-1 text-caption text-text-tertiary">
                Try a project name, a task title, or a page.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.category} className="pb-1 last:pb-0">
                <p className="eyebrow px-2.5 pb-1 pt-2 text-text-quaternary">
                  {group.category}
                </p>
                {group.items.map((command) => {
                  cursor += 1;
                  const index = cursor;
                  const active = index === activeIndex;
                  return (
                    <button
                      key={command.id}
                      type="button"
                      data-active={active}
                      onMouseMove={() => setActiveIndex(index)}
                      onClick={() => runCommand(command)}
                      className={cn(
                        "flex h-9 w-full items-center gap-2.5 rounded-nav px-2.5 text-left text-[13px] transition-colors duration-100",
                        active
                          ? "bg-accent-ghost-hover text-text-primary"
                          : "text-text-secondary"
                      )}
                    >
                      <span
                        className={cn(
                          "shrink-0",
                          active ? "text-text-primary" : "text-text-tertiary"
                        )}
                      >
                        {command.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{command.label}</span>
                      {command.hint ? (
                        <span className="eyebrow shrink-0 text-text-quaternary">
                          {command.hint}
                        </span>
                      ) : null}
                      {active ? (
                        <CornerDownLeft
                          size={13}
                          strokeWidth={1.75}
                          className="shrink-0 text-text-tertiary"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border-subtle px-4 py-2">
          <Hint keys="↑ ↓" label="Navigate" />
          <Hint keys="↵" label="Open" />
          <Hint keys="esc" label="Close" />
          {state === "error" ? (
            <span className="ml-auto text-caption text-text-tertiary">
              Workspace results unavailable
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded-[4px] border border-border-subtle px-1 font-mono text-[10px] leading-[15px] text-text-quaternary">
        {keys}
      </kbd>
      <span className="text-[11px] text-text-quaternary">{label}</span>
    </span>
  );
}

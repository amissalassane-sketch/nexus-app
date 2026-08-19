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
  BrainCircuit,
  CheckSquare,
  CornerDownLeft,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Search,
  Settings2,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — COMMAND PALETTE (⌘K / Ctrl+K)
// Global, keyboard-first command menu. Opens on ⌘K, on the sidebar
// "Search…" button, or via the `nexus:open-command` DOM event.
// Commands: create task/project/goal, navigate routes, search real
// tasks/projects/goals, and "Ask NEXUS".
// ============================================================

type Command =
  | { id: string; kind: "action"; label: string; hint: string; icon: React.ReactNode; href: string; keywords: string }
  | { id: string; kind: "entity"; label: string; hint: string; icon: React.ReactNode; href: string; keywords: string };

const NAV_COMMANDS: Command[] = [
  { id: "n-dashboard", kind: "action", label: "Dashboard", hint: "Navigate", icon: <LayoutDashboard size={16} strokeWidth={1.75} />, href: "/dashboard", keywords: "home overview" },
  { id: "n-tasks", kind: "action", label: "Tasks", hint: "Navigate", icon: <CheckSquare size={16} strokeWidth={1.75} />, href: "/tasks", keywords: "task todo" },
  { id: "n-projects", kind: "action", label: "Projects", hint: "Navigate", icon: <FolderKanban size={16} strokeWidth={1.75} />, href: "/projects", keywords: "project" },
  { id: "n-goals", kind: "action", label: "Goals", hint: "Navigate", icon: <Target size={16} strokeWidth={1.75} />, href: "/goals", keywords: "goal objective" },
  { id: "n-intelligence", kind: "action", label: "Ask NEXUS: what should I work on?", hint: "Intelligence", icon: <BrainCircuit size={16} strokeWidth={1.75} />, href: "/intelligence", keywords: "ask nexus focus next action intelligence" },
  { id: "n-settings", kind: "action", label: "Settings", hint: "Navigate", icon: <Settings2 size={16} strokeWidth={1.75} />, href: "/settings", keywords: "settings preferences account" },
];

const CREATE_COMMANDS: Command[] = [
  { id: "c-task", kind: "action", label: "Create task", hint: "Create", icon: <Plus size={16} strokeWidth={1.75} />, href: "/tasks?create=1", keywords: "new task add task create" },
  { id: "c-project", kind: "action", label: "Create project", hint: "Create", icon: <Plus size={16} strokeWidth={1.75} />, href: "/projects?create=1", keywords: "new project add project create" },
  { id: "c-goal", kind: "action", label: "Create goal", hint: "Create", icon: <Plus size={16} strokeWidth={1.75} />, href: "/goals?create=1", keywords: "new goal add goal create" },
];

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [entities, setEntities] = useState<Command[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  const closeMenu = useCallback(() => setOpen(false), []);

  // Load real tasks / projects / goals once, lazily.
  const loadEntities = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoadingEntities(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { membership } = await getActiveMembership(supabase, user.id);
      const workspaceId = membership?.workspaceId ?? null;
      if (!workspaceId) return;

      const [tasks, projects, goals] = await Promise.all([
        supabase.from("tasks").select("id, title").eq("workspace_id", workspaceId).limit(50),
        supabase.from("projects").select("id, name").eq("workspace_id", workspaceId).limit(50),
        supabase.from("goals").select("id, title").eq("workspace_id", workspaceId).limit(50),
      ]);

      const next: Command[] = [];
      for (const task of tasks.data ?? []) {
        next.push({
          id: `t-${task.id}`,
          kind: "entity",
          label: task.title as string,
          hint: "Task",
          icon: <CheckSquare size={16} strokeWidth={1.75} />,
          href: "/tasks",
          keywords: (task.title as string).toLowerCase(),
        });
      }
      for (const project of projects.data ?? []) {
        next.push({
          id: `p-${project.id}`,
          kind: "entity",
          label: project.name as string,
          hint: "Project",
          icon: <FolderKanban size={16} strokeWidth={1.75} />,
          href: "/projects",
          keywords: (project.name as string).toLowerCase(),
        });
      }
      for (const goal of goals.data ?? []) {
        next.push({
          id: `g-${goal.id}`,
          kind: "entity",
          label: goal.title as string,
          hint: "Goal",
          icon: <Target size={16} strokeWidth={1.75} />,
          href: "/goals",
          keywords: (goal.title as string).toLowerCase(),
        });
      }
      setEntities(next);
    } catch {
      // Non-fatal: the static commands remain available.
    } finally {
      setLoadingEntities(false);
    }
  }, []);

  const openMenu = useCallback(() => {
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

  // Focus the input when the menu opens (a DOM side effect, not state).
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const allCommands = useMemo(
    () => [...CREATE_COMMANDS, ...NAV_COMMANDS, ...entities],
    [entities]
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allCommands;
    return allCommands.filter(
      (command) =>
        command.label.toLowerCase().includes(needle) ||
        command.keywords.includes(needle)
    );
  }, [allCommands, query]);

  const runCommand = useCallback(
    (command: Command) => {
      closeMenu();
      router.push(command.href);
    },
    [closeMenu, router]
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = results[activeIndex];
      if (command) runCommand(command);
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>("[data-active='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command menu"
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-label="Close command menu"
        tabIndex={-1}
        onClick={closeMenu}
        className="fixed inset-0 bg-black/70 animate-fade-in"
      />

      <div className="relative w-full max-w-[560px] overflow-hidden rounded-card border border-border-default bg-bg-subtle shadow-dropdown animate-scale-in">
        <div className="flex items-center gap-2.5 border-b border-border-subtle px-4">
          <Search size={16} strokeWidth={1.75} className="shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Ask NEXUS: what should I work on?"
            className="h-12 w-full bg-transparent text-body text-text-primary outline-none placeholder:text-text-quaternary"
          />
          <kbd className="shrink-0 font-mono text-mono text-text-quaternary">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[320px] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-small text-text-tertiary">
              {loadingEntities ? "Loading workspace…" : "No results."}
            </p>
          ) : (
            results.map((command, index) => (
              <button
                key={command.id}
                type="button"
                data-active={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => runCommand(command)}
                className={cn(
                  "flex h-10 w-full items-center gap-2.5 rounded-nav px-2.5 text-left text-body transition-colors duration-100",
                  index === activeIndex
                    ? "bg-accent-ghost-hover text-text-primary"
                    : "text-text-secondary"
                )}
              >
                <span
                  className={cn(
                    "shrink-0",
                    index === activeIndex ? "text-text-primary" : "text-text-tertiary"
                  )}
                >
                  {command.icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{command.label}</span>
                <span className="shrink-0 font-mono text-mono uppercase tracking-[0.06em] text-text-quaternary">
                  {command.hint}
                </span>
                {index === activeIndex ? (
                  <CornerDownLeft size={13} strokeWidth={1.75} className="shrink-0 text-text-tertiary" />
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

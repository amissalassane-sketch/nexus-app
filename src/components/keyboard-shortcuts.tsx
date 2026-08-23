"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// NEXUS — KEYBOARD SHORTCUTS
// A small, meaningful set that maps onto routes that actually exist:
//   G then O / I / P / T / A   navigate
//   C                          create (opens the create route)
//   /                          search
//   ?                          shortcut reference
// ⌘K is owned by the command palette. Every handler ignores keystrokes
// typed into inputs, textareas and contenteditable regions.
// ============================================================

const GOTO: Record<string, string> = {
  o: "/dashboard",
  i: "/app/intelligence",
  p: "/projects",
  t: "/tasks",
  g: "/goals",
  a: "/activity",
  n: "/notifications",
  s: "/settings",
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingGoto = useRef(false);
  const gotoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (event.key === "Escape") {
        setHelpOpen(false);
        return;
      }

      if (pendingGoto.current) {
        pendingGoto.current = false;
        if (gotoTimer.current) clearTimeout(gotoTimer.current);
        const target = GOTO[key];
        if (target) {
          event.preventDefault();
          router.push(target);
        }
        return;
      }

      if (key === "g") {
        pendingGoto.current = true;
        gotoTimer.current = setTimeout(() => {
          pendingGoto.current = false;
        }, 1200);
        return;
      }

      if (key === "c") {
        event.preventDefault();
        window.dispatchEvent(new Event("nexus:create"));
        return;
      }

      if (key === "/") {
        event.preventDefault();
        window.dispatchEvent(new Event("nexus:open-command"));
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (gotoTimer.current) clearTimeout(gotoTimer.current);
    };
  }, [router]);

  if (!helpOpen) return null;

  const rows: [string, string][] = [
    ["⌘K", "Open the command palette"],
    ["/", "Search the workspace"],
    ["G then O", "Go to Overview"],
    ["G then I", "Go to Intelligence"],
    ["G then P", "Go to Projects"],
    ["G then T", "Go to Tasks"],
    ["G then A", "Go to Activity"],
    ["C", "Create"],
    ["Esc", "Close overlay"],
  ];

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <button
        type="button"
        aria-label="Close keyboard shortcuts"
        onClick={() => setHelpOpen(false)}
        className="absolute inset-0 bg-black/70 animate-fade-in"
      />
      <div className="relative w-full max-w-[420px] rounded-card border border-border-default bg-bg-surface p-5 shadow-overlay animate-scale-in">
        <h2 className="text-h3 text-text-primary">Keyboard shortcuts</h2>
        <p className="mt-1 text-caption text-text-tertiary">
          NEXUS is built to be driven without a mouse.
        </p>
        <dl className="mt-4 flex flex-col gap-2">
          {rows.map(([keys, description]) => (
            <div key={keys} className="flex items-center justify-between gap-4">
              <dt className="text-[13px] text-text-secondary">{description}</dt>
              <dd>
                <kbd className="rounded-[4px] border border-border-subtle bg-bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-text-secondary">
                  {keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

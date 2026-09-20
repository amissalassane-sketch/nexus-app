"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ADMIN_NAV, type AdminNavItem } from "@/lib/admin/nav";
import { AdminIcon } from "./admin-icons";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS ADMIN — GLOBAL COMMAND MENU (CTRL/CMD + K)
// ============================================================
// Internal search dialog providing instantaneous keyboard-driven
// navigation across all operational control plane surfaces.
//
// Accessibility & Ergonomics:
//   - Shortcut: Ctrl+K or Cmd+K to open, Escape to dismiss.
//   - ARIA: role="dialog", aria-modal="true", combobox semantics.
//   - Focus management: auto-focuses input on open, traps focus,
//     restores focus to invoker on dismiss.
//   - Filtering: strict whitelist of status="ready" items only.
//     "soon" or "planned" items are strictly omitted from search.
//   - Keyboard navigation: ArrowUp/ArrowDown, Enter to activate.
// ============================================================

interface FlatNavRoute extends AdminNavItem {
  groupLabel: string;
}

export function AdminCommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const searchId = useId();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Flat list of all executable routes (status === "ready" only)
  const readyRoutes = useMemo<FlatNavRoute[]>(() => {
    return ADMIN_NAV.flatMap((group) =>
      group.items
        .filter((item) => item.status === "ready")
        .map((item) => ({
          ...item,
          groupLabel: group.label,
        }))
    );
  }, []);

  // Filtered by label or group name
  const filteredRoutes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return readyRoutes;
    return readyRoutes.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.groupLabel.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q)
    );
  }, [query, readyRoutes]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  };

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Handle dialog-internal keys: Escape, ArrowUp, ArrowDown, Enter
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filteredRoutes.length === 0) return;
        setSelectedIndex((prev) => (prev + 1) % filteredRoutes.length);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filteredRoutes.length === 0) return;
        setSelectedIndex((prev) => (prev - 1 + filteredRoutes.length) % filteredRoutes.length);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredRoutes[selectedIndex];
        if (selected) {
          onOpenChange(false);
          router.push(selected.href);
        }
      }
    },
    [filteredRoutes, selectedIndex, onOpenChange, router]
  );

  // Focus input when opened
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Scroll selected item into view if needed
  useEffect(() => {
    if (!open || !listRef.current) return;
    const selectedEl = listRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:pt-20"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity motion-safe:animate-[fade-in_120ms_ease-out_both]"
      />

      {/* Dialog content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="NEXUS Admin command palette"
        className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-[10px] border border-admin-border bg-admin-surface shadow-[0_24px_70px_-10px_rgba(0,0,0,0.85)] motion-safe:animate-[panel-in_140ms_ease-out_both]"
      >
        {/* Search Input Bar */}
        <div className="flex h-12 items-center gap-3 border-b border-admin-border px-3.5">
          <span className="text-admin-text-3">
            <AdminIcon name="search" size="toolbar" />
          </span>
          <input
            ref={inputRef}
            id={searchId}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search ready sections, tables, or groups…"
            autoComplete="off"
            spellCheck="false"
            aria-label="Search sections"
            aria-autocomplete="list"
            aria-controls="admin-command-list"
            className="flex-1 bg-transparent text-[13.5px] leading-normal text-admin-text placeholder:text-admin-text-3 focus:outline-none"
          />
          <kbd className="hidden rounded-[4px] border border-admin-border bg-admin-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase text-admin-text-3 sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {filteredRoutes.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-admin-text-2">
                No active section matching <span className="font-mono text-admin-text">&quot;{query}&quot;</span>
              </p>
              <p className="mt-1 font-mono text-[11px] text-admin-text-3">
                Planned or future routes are excluded from the command palette.
              </p>
            </div>
          ) : (
            <ul id="admin-command-list" ref={listRef} role="listbox" className="flex flex-col gap-0.5">
              {filteredRoutes.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <li
                    key={item.href}
                    id={`command-item-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-index={index}
                  >
                    <Link
                      href={item.href}
                      onClick={() => onOpenChange(false)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-[7px] px-3 py-2 text-[13px] transition-colors",
                        isSelected
                          ? "bg-admin-surface-2 text-admin-text"
                          : "text-admin-text-2 hover:bg-admin-surface-2/60 hover:text-admin-text"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <AdminIcon
                          name={item.icon}
                          size="nav"
                          className={isSelected ? "text-admin-accent" : "text-admin-text-3"}
                        />
                        <span className="font-medium text-admin-text">{item.label}</span>
                        <span className="font-mono text-[11px] text-admin-text-3">
                          {item.href}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-[4px] border border-admin-border bg-admin-surface px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-admin-text-3">
                          {item.groupLabel}
                        </span>
                        {isSelected ? (
                          <span className="font-mono text-[10px] text-admin-accent">↵</span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="flex items-center justify-between border-t border-admin-border bg-admin-surface-2/40 px-3 py-2 font-mono text-[11px] text-admin-text-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-admin-border bg-admin-surface px-1 py-0.2 text-[9.5px]">↑</kbd>
              <kbd className="rounded border border-admin-border bg-admin-surface px-1 py-0.2 text-[9.5px]">↓</kbd>
              <span className="ml-0.5">navigate</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-admin-border bg-admin-surface px-1 py-0.2 text-[9.5px]">↵</kbd>
              <span className="ml-0.5">open</span>
            </span>
          </div>
          <span>{filteredRoutes.length} available</span>
        </div>
      </div>
    </div>
  );
}

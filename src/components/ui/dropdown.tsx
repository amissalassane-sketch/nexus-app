"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS V3 — DROPDOWN
// 240px (user menu) / 280px (create menu), radius 16px,
// bg #171717, border 8%, shadow 0 8px 24px rgba(0,0,0,0.48),
// items 36px radius 10px, active item marked by a 2x14px white bar.
// Keyboard: Escape closes, arrows move, Tab leaves, click outside closes.
// No external dependency.
// ============================================================

type DropdownContextValue = {
  close: () => void;
};

const DropdownContext = createContext<DropdownContextValue>({
  close: () => {},
});

export function Dropdown({
  trigger,
  children,
  align = "end",
  width = 240,
  label,
  className,
}: {
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    ref: React.Ref<HTMLButtonElement>;
    ariaProps: Record<string, string | boolean>;
  }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  width?: number;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>(
      "[data-dropdown-item]:not([aria-disabled='true'])"
    );
    first?.focus();
  }, [open]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();

    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        "[data-dropdown-item]:not([aria-disabled='true'])"
      ) ?? []
    );
    if (items.length === 0) return;

    const index = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
      event.key === "ArrowDown"
        ? (index + 1 + items.length) % items.length
        : (index - 1 + items.length) % items.length;

    items[nextIndex]?.focus();
  };

  const contextValue = useMemo(() => ({ close }), [close]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {trigger({
        open,
        toggle,
        ref: triggerRef,
        ariaProps: {
          "aria-haspopup": "menu",
          "aria-expanded": open,
          "aria-controls": menuId,
        },
      })}

      {open && (
        <DropdownContext.Provider value={contextValue}>
          <div
            id={menuId}
            ref={menuRef}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            style={{ width }}
            className={cn(
              "absolute top-[calc(100%+8px)] z-50 rounded-dropdown border border-border-default bg-bg-surface p-1.5 shadow-dropdown animate-scale-in",
              align === "end" ? "right-0" : "left-0"
            )}
          >
            {children}
          </div>
        </DropdownContext.Provider>
      )}
    </div>
  );
}

const itemClasses =
  "relative flex h-9 w-full cursor-pointer select-none items-center gap-2.5 rounded-nav px-2.5 text-left text-body text-text-secondary outline-none transition-colors duration-200 ease-nexus hover:bg-accent-ghost hover:text-text-primary focus-visible:bg-accent-ghost focus-visible:text-text-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-40";

const activeClasses =
  "bg-accent-ghost-hover text-text-primary before:absolute before:left-0.5 before:top-1/2 before:h-3.5 before:w-0.5 before:-translate-y-1/2 before:rounded-pill before:bg-white before:content-['']";

export function DropdownItem({
  children,
  onSelect,
  icon,
  active,
  disabled,
  trailing,
  tone = "default",
}: {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
  tone?: "default" | "danger";
}) {
  const { close } = useContext(DropdownContext);

  return (
    <button
      type="button"
      role="menuitem"
      data-dropdown-item
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onSelect?.();
        close();
      }}
      className={cn(
        itemClasses,
        active && activeClasses,
        tone === "danger" && "text-danger hover:bg-danger-bg hover:text-danger"
      )}
    >
      {icon ? <span className="shrink-0 text-current">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing ? (
        <span className="ml-auto shrink-0 text-text-tertiary">{trailing}</span>
      ) : null}
    </button>
  );
}

export function DropdownLink({
  href,
  children,
  icon,
  active,
  trailing,
}: {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  active?: boolean;
  trailing?: ReactNode;
}) {
  const { close } = useContext(DropdownContext);

  return (
    <Link
      href={href}
      role="menuitem"
      data-dropdown-item
      onClick={close}
      className={cn(itemClasses, active && activeClasses)}
    >
      {icon ? <span className="shrink-0 text-current">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing ? (
        <span className="ml-auto shrink-0 text-text-tertiary">{trailing}</span>
      ) : null}
    </Link>
  );
}

export function DropdownSeparator() {
  return <div className="mx-2 my-1.5 h-px bg-border-subtle" aria-hidden="true" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-1.5 font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary">
      {children}
    </div>
  );
}

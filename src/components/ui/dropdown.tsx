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
// Enhanced with enter/exit motion, staggered items, pressed states.
// GPU-friendly transform + opacity. Respects reduced motion.
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
  open: openProp,
  onOpenChange,
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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const openedAt = useRef(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startClose = useCallback(() => {
    if (!shouldRender || isClosing) return;
    setIsClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setInternalOpen(false);
      setShouldRender(false);
      setIsClosing(false);
    }, 160);
  }, [shouldRender, isClosing]);

  const close = useCallback(() => {
    if (isControlled) {
      // Controlled: notify the parent immediately. The sync effect below
      // plays the exit animation once `open` flips to false.
      if (open) onOpenChange?.(false);
      return;
    }
    startClose();
  }, [isControlled, open, onOpenChange, startClose]);

  const toggle = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(!open);
      return;
    }
    if (isClosing) {
      // Reopen: cancel the pending close instead of getting stuck.
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setIsClosing(false);
      setShouldRender(true);
      setInternalOpen(true);
      return;
    }
    if (internalOpen) {
      // Ignore the accidental second toggle right after opening.
      if (Date.now() - openedAt.current < 140) return;
      startClose();
    } else {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setIsClosing(false);
      setShouldRender(true);
      setInternalOpen(true);
    }
  }, [isControlled, onOpenChange, open, internalOpen, isClosing, startClose]);

  // Sync CONTROLLED open to render state — intentional animation sync.
  // Uncontrolled instances drive shouldRender/isClosing directly through
  // toggle/close above. Running this sync for them would cancel every
  // close: `open` stays true during the exit animation and the `if (open)`
  // branch would clear the close timer and reopen the menu.
  useEffect(() => {
    if (!isControlled) return;
    if (open) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsClosing(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShouldRender(true);
    } else if (shouldRender && !isClosing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsClosing(true);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 160);
    }
  }, [isControlled, open, shouldRender, isClosing]);

  useEffect(() => {
    if (!shouldRender || isClosing) return;
    openedAt.current = Date.now();
  }, [shouldRender, isClosing]);

  useEffect(() => {
    if (!shouldRender || isClosing) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        close();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      // Close when keyboard focus leaves the dropdown (Tab away).
      if (!containerRef.current?.contains(event.target as Node)) {
        close();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [shouldRender, isClosing, close]);

  useEffect(() => {
    if (!shouldRender || isClosing) return;
    const first = menuRef.current?.querySelector<HTMLElement>(
      "[data-dropdown-item]:not([aria-disabled='true'])"
    );
    first?.focus();
  }, [shouldRender, isClosing]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

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
        open: shouldRender && !isClosing,
        toggle,
        ref: triggerRef,
        ariaProps: {
          "aria-haspopup": "menu",
          "aria-expanded": shouldRender && !isClosing,
          "aria-controls": menuId,
        },
      })}

      {shouldRender && (
        <DropdownContext.Provider value={contextValue}>
          <div
            id={menuId}
            ref={menuRef}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            style={{ width }}
            className={cn(
              "absolute top-[calc(100%+6px)] z-[60] max-w-[calc(100vw-24px)] rounded-dropdown border border-border-default bg-bg-surface p-1 shadow-dropdown will-change-transform",
              align === "end"
                ? "right-0 origin-top-right"
                : "left-0 origin-top-left",
              isClosing
                ? "animate-[scale-out_160ms_var(--ease-nexus)_both]"
                : "animate-[scale-in_220ms_var(--ease-nexus)_both]"
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
  "relative flex h-9 w-full cursor-pointer select-none items-center gap-2.5 rounded-nav px-2.5 text-left text-[13px] text-text-secondary outline-none transition-[background-color,color,transform] duration-[160ms] ease-nexus hover:bg-accent-ghost hover:text-text-primary focus-visible:bg-accent-ghost focus-visible:text-text-primary active:bg-accent-ghost active:scale-[0.98] aria-disabled:cursor-not-allowed aria-disabled:opacity-40 sm:h-8 will-change-transform";

const activeClasses = "bg-accent-ghost-hover text-text-primary";

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
        tone === "danger" &&
          "text-danger hover:bg-danger-bg hover:text-danger active:bg-danger-bg"
      )}
    >
      {icon ? (
        <span className="shrink-0 text-current transition-transform duration-150 ease-nexus group-active:scale-90">
          {icon}
        </span>
      ) : null}
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
  onNavigate,
  onClick,
  className,
  ...rest
}: {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  active?: boolean;
  trailing?: ReactNode;
  onNavigate?: () => void;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { close } = useContext(DropdownContext);

  return (
    <Link
      href={href}
      role="menuitem"
      data-dropdown-item
      onClick={(event) => {
        onNavigate?.();
        onClick?.(event);
        close();
      }}
      className={cn(itemClasses, active && activeClasses, className)}
      {...rest}
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
    <div className="eyebrow px-2.5 pb-1 pt-2 text-text-quaternary select-none">
      {children}
    </div>
  );
}

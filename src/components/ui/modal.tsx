"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

// ============================================================
// NEXUS — MODAL
// Enter → settle, close → disappear. Transform + opacity only.
// Mobile sheets slide naturally from bottom. Backdrop blurs.
// Exit animation before unmount. Focus management preserved.
// ============================================================

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(open);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Handle open/close with exit animation — intentional state sync for motion
  useEffect(() => {
    if (open) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsClosing(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShouldRender(true);
      return;
    }

    if (shouldRender && !isClosing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsClosing(true);
      closeTimer.current = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 220);
    }
  }, [open, shouldRender, isClosing]);

  useEffect(() => {
    if (!shouldRender || isClosing) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Tab" && panelRef.current) {
        const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"
        )).filter((node) => node.getClientRects().length > 0 && node.tabIndex >= 0);
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (!first) { event.preventDefault(); panelRef.current.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Focus first interactive element with slight delay for animation
    const timer = setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "input, textarea, select, button, [href], [tabindex]:not([tabindex='-1'])"
      );
      focusable?.focus();
    }, 60);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = overflow;
      if (!isClosing) {
        previouslyFocused.current?.focus?.();
      }
    };
  }, [shouldRender, isClosing]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
        className={cn(
          "fixed inset-0 bg-black/70 backdrop-blur-[3px] will-change-transform",
          isClosing
            ? "animate-[fade-out_180ms_var(--ease-nexus)_both]"
            : "animate-[fade-in_200ms_var(--ease-nexus)_both]"
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-panel border border-border-default bg-bg-surface shadow-overlay will-change-transform",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
          isClosing
            ? "animate-[sheet-out_220ms_var(--ease-nexus)_both] sm:animate-[scale-out_180ms_var(--ease-nexus)_both]"
            : "animate-[sheet-in_320ms_var(--ease-nexus)_both] sm:animate-[scale-in_280ms_var(--ease-nexus)_both]"
        )}
      >
        {/* Sheet grip — phones only */}
        <div
          aria-hidden="true"
          className="flex shrink-0 justify-center pt-2.5 sm:hidden"
        >
          <span className="h-1 w-9 rounded-pill bg-white/15 transition-colors duration-200" />
        </div>

        <div className="mb-4 flex shrink-0 items-start justify-between gap-4 px-5 pt-3 sm:px-6 sm:pt-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-h2 text-text-primary animate-[intelligence-state-in_240ms_var(--ease-nexus)_both]">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-small text-text-secondary animate-[intelligence-state-in_240ms_var(--ease-nexus)_80ms_both]">
                {description}
              </p>
            ) : null}
          </div>
          <Button
            variant="icon"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 transition-transform duration-150 ease-nexus active:scale-90"
          >
            <NexusIcon icon={IconX} />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-1 sm:px-6 sm:pb-0">
          <div
            className={cn(
              "transition-opacity duration-200 ease-nexus",
              isClosing ? "opacity-0" : "opacity-100"
            )}
          >
            {children}
          </div>
        </div>

        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border-subtle px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:border-t-0 sm:px-6 sm:pb-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

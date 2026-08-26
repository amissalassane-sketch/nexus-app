"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

// ============================================================
// NEXUS — MODAL
// Centered dialog on larger screens; a safe-area bottom sheet on
// phones (below `sm`), where a centered box would overflow the
// viewport or float unreachably above the keyboard. Escape closes,
// overlay click closes, focus moves in and returns to the trigger,
// background scroll locked. The sheet never exceeds the viewport:
// the header and footer stay pinned, the body scrolls inside.
// No dependency.
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
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // The modal's lifecycle (focus in, scroll lock, Escape, focus out) runs
  // once per open/close — never per keystroke. `onClose` is usually an
  // inline closure that changes identity on every parent render (e.g. a
  // form field typed into), so it lives in a ref and is NOT a dependency:
  // depending on it stole focus from the field being typed into on every
  // keystroke, making the focus ring jump elsewhere in the dialog.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const focusable = panelRef.current?.querySelector<HTMLElement>(
      "input, textarea, select, button, [href], [tabindex]:not([tabindex='-1'])"
    );
    focusable?.focus();

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-[2px] animate-fade-in"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-panel border border-border-default bg-bg-surface shadow-overlay animate-sheet-in sm:my-8 sm:max-h-none sm:w-auto sm:rounded-card sm:animate-scale-in",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg"
        )}
      >
        {/* Sheet grip — phones only, a visual affordance, not a control */}
        <div aria-hidden="true" className="flex shrink-0 justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-9 rounded-pill bg-white/15" />
        </div>

        <div className="mb-4 flex shrink-0 items-start justify-between gap-4 px-5 pt-3 sm:px-6 sm:pt-6">
          <div>
            <h2 className="text-h2 text-text-primary">{title}</h2>
            {description ? (
              <p className="mt-1 text-small text-text-secondary">{description}</p>
            ) : null}
          </div>
          <Button variant="icon" onClick={onClose} aria-label="Close dialog">
            <X size={16} strokeWidth={1.75} />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-1 sm:px-6 sm:pb-0">
          {children}
        </div>

        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border-subtle px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:border-t-0 sm:px-6 sm:pb-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

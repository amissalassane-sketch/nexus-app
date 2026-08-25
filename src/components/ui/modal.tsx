"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

// ============================================================
// NEXUS — MODAL
// Centered dialog: Escape closes, overlay click closes, focus moves in and
// returns to the trigger, background scroll locked. No dependency.
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
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
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
          "relative my-8 w-full rounded-card border border-border-default bg-bg-surface p-5 shadow-overlay animate-scale-in sm:p-6",
          size === "lg" ? "max-w-2xl" : "max-w-lg"
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
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

        {children}

        {footer ? <div className="mt-6 flex items-center gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { AdminIcon } from "./admin-icons";

// ============================================================
// NEXUS ADMIN — COPY BUTTON (PR 2)
// ============================================================
// The only mutation a directory screen in PR 2 performs is to the
// operator's own clipboard. It exists because support workflows start by
// pasting a user id or email somewhere else, and it is safe precisely
// because it touches nothing on the platform.
//
// Behaviour rules:
//   * Support is probed on click, never rendered from an effect — if the
//     Clipboard API is missing (insecure context), the button says so
//     transiently instead of silently doing nothing.
//   * Success is announced through an aria-live region, so a screen-reader
//     operator hears "Copied to clipboard" as well as seeing the check.
// ============================================================

type CopyState = "idle" | "copied" | "unsupported";

export function AdminCopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function flash(next: CopyState) {
    setState(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState("idle"), 1_800);
  }

  async function copy() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      flash("unsupported");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      flash("copied");
    } catch {
      // The clipboard can reject (permissions). Failing to copy is not a
      // page failure; the label shows why rather than claiming success.
      flash("unsupported");
    }
  }

  return (
    <span className={cn("relative inline-flex items-center", className)}>
      <button
        type="button"
        onClick={copy}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-[7px] border px-2 font-mono text-[10.5px] uppercase leading-none tracking-[0.06em] transition-colors duration-150",
          state === "copied"
            ? "border-admin-accent-border bg-admin-accent-bg text-admin-accent"
            : state === "unsupported"
              ? "border-admin-warning-border bg-admin-warning-bg text-admin-warning"
              : "border-admin-border bg-admin-surface text-admin-text-2 hover:text-admin-text",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
        )}
      >
        <AdminIcon
          name={state === "copied" ? "check" : state === "unsupported" ? "warning" : "copy"}
          size="action"
        />
        {state === "copied" ? "Copied" : state === "unsupported" ? "Clipboard blocked" : label}
      </button>
      {/* Announce separately from the label swap: a label change on a
          focused button is not reliably spoken. */}
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied" ? "Copied to clipboard" : ""}
      </span>
    </span>
  );
}

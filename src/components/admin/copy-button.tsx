"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { AdminIcon } from "./admin-icons";

// ============================================================
// NEXUS ADMIN — COPY BUTTON
// ============================================================
// The only mutation a directory screen performs is to the operator's own
// clipboard. It exists because support workflows start by pasting a user
// id or email somewhere else, and it is safe precisely because it touches
// nothing on the platform.
//
// Behaviour rules:
//   * Support is probed on click, never rendered from an effect — if the
//     Clipboard API is missing (insecure context), the button says so
//     transiently instead of silently doing nothing.
//   * Success is announced through an aria-live region, so a screen-reader
//     operator hears "Copied to clipboard" as well as seeing the check.
//
// It is a machine-token button (id / email in, id / email out), so it wears
// the canonical Tag geometry: 20px tall, radius 4, uppercase mono 10.5.
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
          "inline-flex h-5 items-center gap-1 rounded-xs border px-1.5 mono-token leading-none transition-colors duration-[120ms]",
          state === "copied"
            ? "border-admin-accent-border bg-admin-accent-bg text-admin-accent"
            : state === "unsupported"
              ? "border-admin-warning-border bg-admin-warning-bg text-admin-warning"
              : "border-admin-border bg-admin-surface-2 text-admin-text-2 hover:border-admin-border-strong hover:text-admin-text",
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

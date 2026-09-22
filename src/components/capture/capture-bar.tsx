"use client";

// ============================================================
// NEXUS — CAPTURE BAR
// ============================================================
// The one-input front door: type a sentence, NEXUS understands the
// action, the date and the urgency, and creates the task. The parse
// runs on the server (deterministic, both French and English); this
// component only submits and reports exactly what was understood.

import { useState } from "react";
import { IconBolt, IconCornerDownLeft } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

export function CaptureBar({ compact = false }: { compact?: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [understood, setUnderstood] = useState<string | null>(null);
  const { toast } = useToast();

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setUnderstood(null);
    try {
      const response = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        toast("danger", "Capture failed", payload?.error ? { description: payload.error } : undefined);
        return;
      }
      setUnderstood(payload.understood ?? "Task created");
      setText("");
      toast("success", "Captured", payload.understood ?? "Task created");
    } catch {
      toast("danger", "Capture failed", { description: "The server did not answer. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("w-full", compact ? "" : "max-w-2xl")}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="relative"
      >
        <NexusIcon
          icon={IconBolt}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lavender-text"
        />
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Capture anything — “call the bank tomorrow”, « préparer la réunion vendredi »…"
          aria-label="Capture a task"
          disabled={busy}
          className="h-11 w-full rounded-input border border-border-default bg-bg-surface pl-10 pr-11 text-small text-text-primary outline-none transition-colors placeholder:text-text-quaternary focus:border-border-strong disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label="Capture this as a task"
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-input bg-accent text-accent-fg transition-opacity disabled:opacity-30"
        >
          <NexusIcon icon={IconCornerDownLeft} px={13} />
        </button>
      </form>
      <p className="mt-1.5 text-caption text-text-quaternary">
        {understood
          ? `Created: ${understood}`
          : "Dates and urgency are understood automatically — English and French."}
      </p>
    </div>
  );
}

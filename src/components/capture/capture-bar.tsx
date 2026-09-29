"use client";

// ============================================================
// NEXUS — CAPTURE BAR
// ============================================================
// The one-input front door: type a sentence, NEXUS understands the
// action, the date and the urgency, and creates the task. The parse
// runs on the server (deterministic, both French and English); this
// component submits and reports exactly what was understood.
// Fully resilient: enqueues to the offline queue on network drop.
// ============================================================

import { useEffect, useState } from "react";
import { IconBolt, IconCloudCheck, IconCloudOff, IconCornerDownLeft } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  enqueueOfflineCapture,
  flushOfflineQueue,
  getOfflineQueue,
} from "@/lib/offline-queue";

export function CaptureBar({ compact = false }: { compact?: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [understood, setUnderstood] = useState<string | null>(null);
  const [offlineCount, setOfflineCount] = useState(() =>
    typeof window !== "undefined" ? getOfflineQueue().length : 0
  );
  const { toast } = useToast();

  useEffect(() => {
    const onQueueChange = (event: Event) => {
      const custom = event as CustomEvent<{ count: number }>;
      setOfflineCount(custom.detail?.count ?? getOfflineQueue().length);
    };

    const onSynced = (event: Event) => {
      const custom = event as CustomEvent<{ synced: number; failed: number }>;
      if (custom.detail?.synced > 0) {
        toast("success", "Synced", {
          description: `${custom.detail.synced} task${custom.detail.synced > 1 ? "s" : ""} synced with the server.`,
        });
      }
      setOfflineCount(getOfflineQueue().length);
    };

    window.addEventListener("nexus:offline-queue-changed", onQueueChange);
    window.addEventListener("nexus:offline-synced", onSynced);
    return () => {
      window.removeEventListener("nexus:offline-queue-changed", onQueueChange);
      window.removeEventListener("nexus:offline-synced", onSynced);
    };
  }, [toast]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    // Check if browser is definitely offline
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueOfflineCapture(trimmed);
      setText("");
      toast("info", "Saved offline", {
        description: "Your task will be synced automatically when the network returns.",
      });
      return;
    }

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
        if (response.status >= 500) {
          // Server error or proxy drop: save to queue rather than losing the idea
          enqueueOfflineCapture(trimmed);
          setText("");
          toast("info", "Saved offline", {
            description: "The server is temporarily unreachable. Task queued for syncing.",
          });
          return;
        }
        toast("danger", "Capture failed", payload?.error ? { description: payload.error } : undefined);
        return;
      }
      setUnderstood(payload.understood ?? "Task created");
      setText("");
      toast("success", "Captured", payload.understood ?? "Task created");

      // Check if any backlog can be flushed
      void flushOfflineQueue();
    } catch {
      // Network drop: save locally with 0ms data loss
      enqueueOfflineCapture(trimmed);
      setText("");
      toast("info", "Saved offline", {
        description: "Network unavailable. Your task is saved locally and will sync automatically.",
      });
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
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lavender"
        />
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Capture anything — “call the bank tomorrow”, “prepare Friday's meeting”…"
          aria-label="Capture a task"
          disabled={busy}
          className="h-10 w-full rounded-control border border-border-default bg-bg-surface-2 pr-11 pl-9 text-small text-text-primary outline-none transition-[border-color,box-shadow] duration-[120ms] ease-nexus placeholder:text-text-placeholder hover:border-border-strong focus:border-border-focus focus:shadow-[0_0_0_3px_var(--focus-ring)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label="Capture this as a task"
          className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-control bg-accent text-accent-fg transition-opacity disabled:opacity-30"
        >
          <NexusIcon icon={IconCornerDownLeft} px={13} />
        </button>
      </form>
      <div className="mt-1.5 flex items-center justify-between text-caption text-text-quaternary">
        <p>
          {understood
            ? `Created: ${understood}`
            : "Dates and urgency are understood automatically — English and French."}
        </p>
        {offlineCount > 0 ? (
          <span className="mono-meta flex items-center gap-1 text-warning">
            <NexusIcon icon={IconCloudOff} px={12} />
            <span>{offlineCount} pending</span>
          </span>
        ) : (
          <span className="mono-meta hidden items-center gap-1 text-text-quaternary sm:flex">
            <NexusIcon icon={IconCloudCheck} px={12} />
            <span>Sync ready</span>
          </span>
        )}
      </div>
    </div>
  );
}

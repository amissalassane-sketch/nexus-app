"use client";

// ============================================================
// NEXUS — OFFLINE CAPTURE QUEUE
// ============================================================
// Enables 0-latency task capture even when offline or during transient
// network drops. Captures are enqueued locally in localStorage and
// automatically replayed against /api/capture when connectivity resumes.
// Pure client-side resilience: zero intrusive service worker.
// ============================================================

export type OfflineCaptureItem = {
  id: string;
  text: string;
  createdAt: string;
  retries: number;
};

const OFFLINE_QUEUE_KEY = "nexus_offline_captures";

export function getOfflineQueue(): OfflineCaptureItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineCaptureItem[]) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineCaptureItem[]): void {
  if (typeof window === "undefined") return;
  try {
    if (queue.length === 0) {
      window.localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } else {
      window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
    window.dispatchEvent(
      new CustomEvent("nexus:offline-queue-changed", {
        detail: { count: queue.length },
      })
    );
  } catch {
    // Quota exceeded or private browsing restricted
  }
}

export function enqueueOfflineCapture(text: string): OfflineCaptureItem {
  const trimmed = text.trim();
  const item: OfflineCaptureItem = {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: trimmed,
    createdAt: new Date().toISOString(),
    retries: 0,
  };

  const current = getOfflineQueue();
  saveOfflineQueue([...current, item]);
  return item;
}

export function removeOfflineCapture(id: string): void {
  const current = getOfflineQueue();
  const next = current.filter((item) => item.id !== id);
  saveOfflineQueue(next);
}

let isFlushing = false;

export async function flushOfflineQueue(): Promise<{
  synced: number;
  failed: number;
}> {
  if (typeof window === "undefined") return { synced: 0, failed: 0 };
  if (!navigator.onLine || isFlushing) return { synced: 0, failed: 0 };

  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  isFlushing = true;
  let synced = 0;
  let failed = 0;
  const remaining: OfflineCaptureItem[] = [];

  for (const item of queue) {
    try {
      const response = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: item.text }),
      });

      if (response.ok) {
        synced++;
      } else {
        item.retries += 1;
        // Keep in queue if it was a server error (5xx) or transient issue, drop if 4xx bad request
        if (response.status >= 500 && item.retries < 5) {
          remaining.push(item);
        } else {
          failed++;
        }
      }
    } catch {
      // Still offline or request aborted
      item.retries += 1;
      remaining.push(item);
      break;
    }
  }

  saveOfflineQueue(remaining);
  isFlushing = false;

  if (synced > 0) {
    window.dispatchEvent(
      new CustomEvent("nexus:offline-synced", {
        detail: { synced, failed },
      })
    );
    window.dispatchEvent(
      new CustomEvent("nexus:activation", {
        detail: { type: "task_created" },
      })
    );
  }

  return { synced, failed };
}

// Attach listener once in browser environment
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void flushOfflineQueue();
  });
}

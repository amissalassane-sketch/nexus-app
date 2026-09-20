"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
  IconX,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — TOAST
// Polished feedback: enter, settle, remain readable, exit naturally.
// No bounce. Progress indicator shows remaining time. GPU-friendly.
// ============================================================

export type ToastTone = "success" | "danger" | "info" | "warning";

type Toast = {
  id: number;
  tone: ToastTone;
  message: string;
  description?: string;
  exiting?: boolean;
};

type ToastContextValue = {
  toast: (
    tone: ToastTone,
    message: string,
    options?: { description?: string; duration?: number }
  ) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? { toast: () => {} };
}

const TONE_ICON = {
  success: IconCheck,
  danger: IconAlertTriangle,
  info: IconInfoCircle,
  warning: IconAlertTriangle,
} as const;

const TONE_CLASS: Record<ToastTone, string> = {
  success: "text-success",
  danger: "text-danger",
  info: "text-text-secondary",
  warning: "text-warning",
};

const TONE_BG: Record<ToastTone, string> = {
  success: "border-success-border/40 bg-bg-surface",
  danger: "border-danger-border/40 bg-bg-surface",
  info: "border-border-default bg-bg-surface",
  warning: "border-warning-border/40 bg-bg-surface",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const exitTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number, immediate = false) => {
    if (immediate) {
      setToasts((current) => current.filter((entry) => entry.id !== id));
      const timer = timers.current.get(id);
      if (timer) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
      const exitTimer = exitTimers.current.get(id);
      if (exitTimer) {
        clearTimeout(exitTimer);
        exitTimers.current.delete(id);
      }
      return;
    }

    // Trigger exit animation, then remove
    setToasts((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, exiting: true } : entry
      )
    );
    exitTimers.current.set(
      id,
      setTimeout(() => {
        setToasts((current) => current.filter((entry) => entry.id !== id));
        timers.current.delete(id);
        exitTimers.current.delete(id);
      }, 220)
    );
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    (tone, message, options) => {
      const id = ++idRef.current;
      setToasts((current) => [
        ...current.slice(-2),
        { id, tone, message, description: options?.description, exiting: false },
      ]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), options?.duration ?? 3800)
      );
    },
    [dismiss]
  );

  useEffect(() => {
    const store = timers.current;
    const exitStore = exitTimers.current;
    return () => {
      store.forEach((timer) => clearTimeout(timer));
      store.clear();
      exitStore.forEach((timer) => clearTimeout(timer));
      exitStore.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] right-4 z-[80] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2 lg:bottom-5 lg:right-5"
      >
        {toasts.map((entry) => {
          const Icon = TONE_ICON[entry.tone];
          return (
            <div
              key={entry.id}
              role="status"
              className={cn(
                "pointer-events-auto relative flex items-start gap-2.5 overflow-hidden rounded-card border px-3 py-2.5 shadow-dropdown will-change-transform",
                TONE_BG[entry.tone],
                entry.exiting ? "animate-[toast-out_200ms_var(--ease-nexus)_both]" : "animate-[toast-in_280ms_var(--ease-nexus)_both]"
              )}
            >
              <NexusIcon
                icon={Icon}
                className={cn(
                  "mt-0.5 transition-transform duration-200 ease-nexus",
                  TONE_CLASS[entry.tone],
                  entry.exiting ? "scale-90" : "scale-100"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-[18px] text-text-primary">
                  {entry.message}
                </p>
                {entry.description ? (
                  <p className="mt-0.5 text-caption leading-[15px] text-text-tertiary">
                    {entry.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(entry.id)}
                aria-label="Dismiss notification"
                className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-text-quaternary transition-[background-color,color,transform] duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-secondary active:scale-90"
              >
                <NexusIcon icon={IconX} />
              </button>
              {/* Progress indicator */}
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute bottom-0 left-0 h-[2px] rounded-pill opacity-40",
                  entry.tone === "success"
                    ? "bg-success"
                    : entry.tone === "danger"
                      ? "bg-danger"
                      : entry.tone === "warning"
                        ? "bg-warning"
                        : "bg-text-tertiary",
                  "animate-[toast-progress_3800ms_linear_both]"
                )}
                style={{
                  animationPlayState: entry.exiting ? "paused" : "running",
                }}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

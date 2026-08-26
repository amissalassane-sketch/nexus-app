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
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — TOAST
// A quiet confirmation layer: bottom-right on desktop, above the mobile
// navigation on small screens, never covering primary actions.
// Announced politely to assistive technology, dismissible, auto-expiring.
// ============================================================

export type ToastTone = "success" | "danger" | "info";

type Toast = {
  id: number;
  tone: ToastTone;
  message: string;
  description?: string;
};

type ToastContextValue = {
  toast: (
    tone: ToastTone,
    message: string,
    options?: { description?: string; duration?: number }
  ) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Safe outside a provider: falls back to a no-op so leaf components
 *  can always call it without knowing where they are mounted. */
export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? { toast: () => {} };
}

const TONE_ICON = {
  success: Check,
  danger: AlertTriangle,
  info: Info,
} as const;

const TONE_CLASS: Record<ToastTone, string> = {
  success: "text-success",
  danger: "text-danger",
  info: "text-text-secondary",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    (tone, message, options) => {
      const id = ++idRef.current;
      setToasts((current) => [
        ...current.slice(-2),
        { id, tone, message, description: options?.description },
      ]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), options?.duration ?? 3600)
      );
    },
    [dismiss]
  );

  useEffect(() => {
    const store = timers.current;
    return () => {
      store.forEach((timer) => clearTimeout(timer));
      store.clear();
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
              className="pointer-events-auto flex items-start gap-2.5 rounded-card border border-border-default bg-bg-surface px-3 py-2.5 shadow-dropdown animate-toast-in"
            >
              <Icon
                size={15}
                strokeWidth={1.75}
                aria-hidden="true"
                className={cn("mt-0.5 shrink-0", TONE_CLASS[entry.tone])}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-text-primary">{entry.message}</p>
                {entry.description ? (
                  <p className="mt-0.5 text-caption text-text-tertiary">
                    {entry.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(entry.id)}
                aria-label="Dismiss notification"
                className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-text-quaternary transition-colors duration-150 hover:bg-accent-ghost hover:text-text-secondary"
              >
                <X size={13} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

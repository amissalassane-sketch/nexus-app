"use client";

// ============================================================
// NEXUS — TOASTS (P2)
// Slide + fade from the bottom right. Every action gets visible
// feedback; failures roll back AND explain themselves.
// ============================================================

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const KIND_STYLES: Record<ToastKind, { border: string; text: string; icon: ReactNode }> = {
  success: {
    border: "border-success-border bg-success-bg",
    text: "text-success-fg",
    icon: <CheckCircle2 size={15} strokeWidth={1.75} />,
  },
  error: {
    border: "border-danger-border bg-danger-bg",
    text: "text-danger-fg",
    icon: <AlertTriangle size={15} strokeWidth={1.75} />,
  },
  info: {
    border: "border-info-border bg-info-bg",
    text: "text-info-fg",
    icon: <Info size={15} strokeWidth={1.75} />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-3), { id, kind, message }]);
      // Errors outlive successes — people read them slower.
      window.setTimeout(() => dismiss(id), kind === "error" ? 6000 : 4000);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string) => push("success", message),
      error: (message: string) => push("error", message),
      info: (message: string) => push("info", message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Bottom-right stack */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2"
      >
        {toasts.map((toast) => {
          const style = KIND_STYLES[toast.kind];
          return (
            <div
              key={toast.id}
              role="status"
              className={`animate-toast-in pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md backdrop-blur ${style.border}`}
            >
              <span className={`mt-0.5 shrink-0 ${style.text}`}>{style.icon}</span>
              <p className={`flex-1 text-small leading-5 ${style.text}`}>{toast.message}</p>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded p-0.5 text-text-tertiary transition-colors duration-[120ms] hover:text-text-primary"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

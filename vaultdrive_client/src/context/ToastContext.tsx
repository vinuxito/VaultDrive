import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import type { ToastMessage } from "../components/layout/Toast";

interface ToastContextValue {
  toasts: ToastMessage[];
  addToast: (message: string, type: ToastMessage["type"]) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Auto-dismiss delay in milliseconds (5s for info/success, persistent for errors). */
const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback((message: string, type: ToastMessage["type"]) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss non-error toasts
    if (type !== "error") {
      const timer = setTimeout(() => {
        dismissToast(id);
      }, AUTO_DISMISS_MS);
      timers.current.set(id, timer);
    }
  }, [dismissToast]);

  // Cleanup timers on unmount
  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      currentTimers.forEach((timer) => clearTimeout(timer));
      currentTimers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

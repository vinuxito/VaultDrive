import { createContext, useContext } from "react";
import type { ToastMessage } from "../components/layout/Toast";

interface ToastContextValue {
  toasts: ToastMessage[];
  addToast: (message: string, type: ToastMessage["type"]) => void;
  dismissToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

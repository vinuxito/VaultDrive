import type { ReactElement } from "react";
import { X } from "lucide-react";

export interface ToastMessage {
  id: string;
  message: string;
  type: "info" | "success" | "error";
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const toastStyles: Record<ToastMessage["type"], string> = {
  info: "bg-[#7d4f50] text-white",
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
};

export function Toast({ toasts, onDismiss }: ToastProps): ReactElement {
  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toastStyles[toast.type]}`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 opacity-80 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

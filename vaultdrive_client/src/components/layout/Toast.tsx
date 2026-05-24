import type { ReactElement } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  info: "bg-primary text-primary-foreground",
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
};

const toastIcons: Record<ToastMessage["type"], typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

export function Toast({ toasts, onDismiss }: ToastProps): ReactElement {
  return (
    <div
      className="fixed bottom-6 left-6 z-50 flex flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = toastIcons[toast.type];
          return (
            <motion.div
              key={toast.id}
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -80, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${toastStyles[toast.type]}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => onDismiss(toast.id)}
                className="shrink-0 opacity-80 hover:opacity-100 transition-opacity"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

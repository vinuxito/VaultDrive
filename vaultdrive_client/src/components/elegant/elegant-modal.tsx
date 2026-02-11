import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface ElegantModalProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function ElegantModal({
  children,
  isOpen,
  onClose,
  title,
  className,
  size = "md",
}: ElegantModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "elegant-modal",
          sizeClasses[size],
          "elegant-fade-in",
          "relative p-6",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-accent-secondary/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
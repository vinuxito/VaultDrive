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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          // Theme-aware backgrounds, borders, and texts
          "bg-card border border-border text-foreground shadow-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto",
          "rounded-2xl",
          // Size variants
          sizeClasses[size],
          // Animation
          "elegant-fade-in",
          // Padding
          "relative p-6",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            <button
              onClick={onClose}
              className={cn(
                "p-1 rounded-md transition-colors",
                "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
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

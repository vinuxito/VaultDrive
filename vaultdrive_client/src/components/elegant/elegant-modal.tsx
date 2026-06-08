import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTheme } from "../theme-provider";

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
  const { theme } = useTheme();
  const isDark = theme === "dark";

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
          isDark
            ? "bg-gradient-to-br from-primary to-primary/90 border border-white/10 text-white shadow-2xl"
            : "bg-card border border-border text-foreground shadow-2xl",
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
            <h2 className={cn("text-xl font-semibold", isDark ? "text-white" : "text-foreground")}>{title}</h2>
            <button
              onClick={onClose}
              className={cn(
                "p-1 rounded-md transition-colors",
                isDark
                  ? "hover:bg-white/10 text-white/90 hover:text-white"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
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
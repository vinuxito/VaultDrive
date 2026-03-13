import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface ElegantButtonProps {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "accent" | "success" | "warning" | "danger" | "subtle";
  size?: "sm" | "md" | "lg";
  breathe?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

export function ElegantButton({
  children,
  className,
  variant = "primary",
  size = "md",
  breathe = true,
  disabled = false,
  loading = false,
  onClick,
  type = "button",
}: ElegantButtonProps) {
  const variantClasses = {
    primary: "elegant-button elegant-primary",
    secondary: "elegant-button elegant-secondary",
    accent: "elegant-button elegant-accent",
    success: "elegant-button elegant-success",
    warning: "elegant-button elegant-warning",
    danger: "elegant-button elegant-danger",
    subtle: "elegant-button elegant-subtle",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  const breatheClass = breathe ? "cursor-pointer" : "";
  const disabledClass = disabled ? "elegant-button:disabled" : "";
  const loadingClass = loading ? "elegant-loading" : "";

  return (
    <button
      type={type}
      className={cn(
        variantClasses[variant],
        sizeClasses[size],
        breatheClass,
        disabledClass,
        loadingClass,
        className,
        loading && "flex items-center justify-center gap-2"
      )}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && (
        <span className="elegant-spinner w-4 h-4 border-2 border-current border-t-transparent rounded-full"></span>
      )}
      {children}
    </button>
  );
}
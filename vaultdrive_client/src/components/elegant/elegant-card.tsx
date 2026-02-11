import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface ElegantCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "primary" | "accent" | "success" | "warning" | "danger" | "subtle";
  breathe?: boolean;
  fadeIn?: boolean;
  glow?: boolean;
  stagger?: 1 | 2 | 3 | 4 | 5 | 6;
  onClick?: () => void;
}

export function ElegantCard({
  children,
  className,
  variant = "default",
  breathe = false,
  fadeIn = true,
  glow = false,
  stagger,
  onClick,
}: ElegantCardProps) {
  const variantClasses = {
    default: "elegant-card",
    primary: "elegant-card elegant-primary",
    accent: "elegant-card elegant-accent",
    success: "elegant-card elegant-success",
    warning: "elegant-card elegant-warning",
    danger: "elegant-card elegant-danger",
    subtle: "elegant-card elegant-subtle",
  };

  const breatheClass = breathe ? "elegant-breathe-lift" : "";
  const glowClass = glow ? "elegant-breathe-glow" : "";
  const fadeInClass = fadeIn ? "elegant-fade-in" : "";
  const staggerClass = stagger ? `elegant-stagger-${stagger}` : "";
  const clickableClass = onClick ? "cursor-pointer" : "";

  return (
    <div
      className={cn(
        "rounded-xl p-6",
        variantClasses[variant],
        breatheClass,
        glowClass,
        fadeInClass,
        staggerClass,
        clickableClass,
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
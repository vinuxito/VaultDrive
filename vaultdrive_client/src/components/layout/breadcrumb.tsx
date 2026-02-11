/**
 * Breadcrumb Component
 * VaultDrive v2.0 - Phase 2B: Layout
 */

import { Home, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { useNavigate } from "react-router-dom";

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const navigate = useNavigate();

  return (
    <nav className={cn("flex items-center gap-2 text-sm", className)} aria-label="Breadcrumb">
      {/* Home Link */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 hover:text-primary transition-colors"
        aria-label="Go to home"
      >
        <Home className="w-4 h-4" />
        <span className="hidden sm:inline">Home</span>
      </button>

      {/* Breadcrumb Items */}
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          {item.path ? (
            <button
              onClick={() => {
                if (item.path) {
                  navigate(item.path);
                }
              }}
              className="flex items-center gap-2 hover:text-primary transition-colors"
              aria-label={`Go to ${item.label}`}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span className="truncate max-w-[200px]">{item.label}</span>
            </button>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span className="truncate max-w-[200px]">{item.label}</span>
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}

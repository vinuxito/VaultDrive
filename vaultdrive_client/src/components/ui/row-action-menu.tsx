/**
 * <RowActionMenu> — the canonical row-action component for QuantiX Drive.
 *
 * Every row/card surface in the product (file rows, share-link rows,
 * folder-share rows, drop-link rows, file-request rows, agent-key rows,
 * group-member rows) renders its actions through this component. This is how
 * we keep the row interaction model identical across the whole product.
 *
 * Composes the existing dropdown-menu primitive — does not invent new chrome.
 *
 * See: docs/roadmaps/2026-04-26-ui-ux-coherence-upgrade-roadmap.md (Step 1)
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { cn } from "../../lib/utils";

export interface RowAction {
  /** Stable id used for tests and analytics. */
  id: string;
  label: string;
  icon?: LucideIcon;
  /**
   * `default` is a regular item. `destructive` renders red, sits below a
   * separator, and is always last. `divider` inserts a separator only.
   */
  kind?: "default" | "destructive" | "divider";
  disabled?: boolean;
  /** Optional shortcut hint (e.g. "⌘D") shown right-aligned. */
  shortcut?: string;
  onSelect?: () => void;
}

export interface RowActionMenuProps {
  actions: RowAction[];
  /** Optional menu header label (e.g. "Manage file"). */
  label?: string;
  /** Trigger placement relative to the row. */
  align?: "start" | "end";
  /** Compact density renders a smaller trigger for dense lists / mobile. */
  density?: "comfortable" | "compact";
  /** Accessible label for the trigger button. Defaults to "Row actions". */
  triggerAriaLabel?: string;
  /** Allow callers to wire a stable test id for Playwright. */
  triggerTestId?: string;
  /** Optional override for the trigger button (e.g. inline ghost vs. pill). */
  triggerClassName?: string;
}

/**
 * Sort actions so that destructive items always sit at the bottom under a
 * separator. Mid-list `divider` entries are preserved.
 */
function partitionActions(actions: RowAction[]): {
  primary: RowAction[];
  destructive: RowAction[];
} {
  const primary: RowAction[] = [];
  const destructive: RowAction[] = [];
  for (const action of actions) {
    if (action.kind === "destructive") {
      destructive.push(action);
    } else {
      primary.push(action);
    }
  }
  return { primary, destructive };
}

export function RowActionMenu({
  actions,
  label,
  align = "end",
  density = "comfortable",
  triggerAriaLabel = "Row actions",
  triggerTestId,
  triggerClassName,
}: RowActionMenuProps) {
  if (actions.length === 0) return null;

  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const { primary, destructive } = partitionActions(actions);

  const triggerSize = density === "compact" ? "icon-sm" : "icon-sm";
  const triggerIconClass = density === "compact" ? "h-3.5 w-3.5" : "h-4 w-4";

  if (isMobile) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size={triggerSize}
          aria-label={triggerAriaLabel}
          data-testid={triggerTestId}
          className={cn(
            "text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
            triggerClassName,
          )}
          onClick={(event) => {
            event.stopPropagation();
            setIsOpen(true);
          }}
        >
          <MoreHorizontal className={triggerIconClass} aria-hidden="true" />
        </Button>

        {createPortal(
          <AnimatePresence>
            {isOpen && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 bg-black z-50 cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsOpen(false);
                  }}
                  data-testid={triggerTestId ? `${triggerTestId}-backdrop` : "mobile-drawer-backdrop"}
                />

                {/* Bottom Sheet Drawer */}
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                  drag="y"
                  dragConstraints={{ top: 0 }}
                  dragElastic={0.15}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 100) {
                      setIsOpen(false);
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                  data-testid={triggerTestId ? `${triggerTestId}-content` : "mobile-drawer-content"}
                  className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl shadow-xl flex flex-col max-h-[85vh] safe-area-bottom pb-6 overflow-hidden"
                >
                  {/* Drag Handle Indicator */}
                  <div className="w-12 h-1.5 bg-muted rounded-full mx-auto my-3 shrink-0 cursor-grab active:cursor-grabbing" />

                  {label && (
                    <div className="px-4 pb-2 text-xs font-semibold text-muted-foreground tracking-wider uppercase border-b border-border/40">
                      {label}
                    </div>
                  )}

                  <div className="overflow-y-auto px-2 py-2 space-y-1">
                    {primary.map((action) => {
                      if (action.kind === "divider") {
                        return <div key={action.id} className="h-px bg-border my-1" />;
                      }
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.id}
                          type="button"
                          data-testid={`row-action-${action.id}`}
                          disabled={action.disabled}
                          onClick={(event) => {
                            event.stopPropagation();
                            action.onSelect?.();
                            setIsOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors text-left font-medium min-h-[44px] cursor-pointer",
                            "text-foreground hover:bg-muted active:bg-muted/80",
                            action.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                          )}
                        >
                          {Icon && <Icon className="h-5 w-5 text-muted-foreground shrink-0" />}
                          <span className="flex-1">{action.label}</span>
                          {action.shortcut && (
                            <span className="text-xs text-muted-foreground">{action.shortcut}</span>
                          )}
                        </button>
                      );
                    })}

                    {destructive.length > 0 && primary.length > 0 && (
                      <div className="h-px bg-border my-1" />
                    )}

                    {destructive.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.id}
                          type="button"
                          data-testid={`row-action-${action.id}`}
                          data-variant="destructive"
                          disabled={action.disabled}
                          onClick={(event) => {
                            event.stopPropagation();
                            action.onSelect?.();
                            setIsOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors text-left font-medium min-h-[44px] cursor-pointer",
                            "text-destructive hover:bg-destructive/10 active:bg-destructive/15",
                            action.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                          )}
                        >
                          {Icon && <Icon className="h-5 w-5 text-destructive shrink-0" />}
                          <span className="flex-1">{action.label}</span>
                          {action.shortcut && (
                            <span className="text-xs text-destructive/70">{action.shortcut}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={triggerSize}
          aria-label={triggerAriaLabel}
          data-testid={triggerTestId}
          className={cn(
            "text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
            triggerClassName,
          )}
          onClick={(event) => {
            // Prevent row-level click handlers (e.g. select file) from firing.
            event.stopPropagation();
          }}
        >
          <MoreHorizontal className={triggerIconClass} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={4}
        onClick={(event) => event.stopPropagation()}
        data-testid={triggerTestId ? `${triggerTestId}-content` : undefined}
        className="min-w-[12rem]"
      >
        {label ? (
          <>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {primary.map((action) => {
          if (action.kind === "divider") {
            return <DropdownMenuSeparator key={action.id} />;
          }
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.id}
              data-testid={`row-action-${action.id}`}
              disabled={action.disabled}
              onSelect={(event) => {
                // Radix fires onSelect with a native event; we don't need to
                // close the menu manually — Radix handles it. We just guard
                // against propagation to row-level handlers.
                event.preventDefault?.();
                action.onSelect?.();
              }}
            >
              {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
              <span className="flex-1">{action.label}</span>
              {action.shortcut ? (
                <span className="ml-auto text-xs text-muted-foreground">
                  {action.shortcut}
                </span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
        {destructive.length > 0 && primary.length > 0 ? (
          <DropdownMenuSeparator />
        ) : null}
        {destructive.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.id}
              data-testid={`row-action-${action.id}`}
              variant="destructive"
              disabled={action.disabled}
              onSelect={(event) => {
                event.preventDefault?.();
                action.onSelect?.();
              }}
            >
              {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
              <span className="flex-1">{action.label}</span>
              {action.shortcut ? (
                <span className="ml-auto text-xs text-destructive/70">
                  {action.shortcut}
                </span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default RowActionMenu;

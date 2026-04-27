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

  const { primary, destructive } = partitionActions(actions);

  const triggerSize = density === "compact" ? "icon-sm" : "icon-sm";
  const triggerIconClass = density === "compact" ? "h-3.5 w-3.5" : "h-4 w-4";

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
            "text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
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

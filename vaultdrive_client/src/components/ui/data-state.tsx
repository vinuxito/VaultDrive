/**
 * <DataState> — the canonical loading/empty/error wrapper for list-bearing
 * surfaces in QuantiX Drive.
 *
 * Every list surface (Files, AccessPanel, Groups, Agent Keys, Audit) goes
 * through this component so the user sees the same shimmer/empty/error
 * grammar everywhere. No more "is it broken or just slow?" silent spinners.
 *
 * See: docs/roadmaps/2026-04-26-ui-ux-coherence-upgrade-roadmap.md (Step 3)
 */

import * as React from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "./button";
import { ERROR_COPY, type EmptyStateCopy } from "../../constants/copy";
import { cn } from "../../lib/utils";

export interface DataStateProps {
  loading?: boolean;
  empty?: boolean;
  /** Truthy error renders the error block. Strings are surfaced as the body. */
  error?: unknown;
  /** Short progressive label, e.g. "Decrypting your vault…". */
  loadingLabel?: string;
  /** Empty-state copy from constants/copy.ts. */
  emptyConfig?: EmptyStateCopy;
  /** Render the empty state's primary action. Receives the actionKey/route. */
  onEmptyAction?: (target: { actionKey?: string; route?: string }) => void;
  /** Retry callback for the error state. If absent, no retry button shown. */
  onRetry?: () => void;
  /** How many shimmer rows to render while loading (default 3). */
  skeletonRows?: number;
  /** Custom skeleton render for surfaces that need a non-row skeleton. */
  renderSkeleton?: (rowIndex: number) => React.ReactNode;
  /** Tighter padding for inline lists. */
  density?: "comfortable" | "compact";
  className?: string;
  /** The actual list, rendered when none of the above states match. */
  children: React.ReactNode;
}

function defaultSkeletonRow(index: number, density: "comfortable" | "compact") {
  return (
    <div
      key={`skeleton-${index}`}
      data-testid="data-state-skeleton-row"
      className={cn(
        "animate-pulse rounded-md border border-border/50 bg-muted/30",
        density === "compact" ? "h-10" : "h-14",
      )}
      aria-hidden="true"
    />
  );
}

function errorBody(error: unknown): string {
  if (typeof error === "string" && error.trim().length > 0) return error;
  if (error instanceof Error && error.message) return error.message;
  return ERROR_COPY.generic.body;
}

export function DataState({
  loading = false,
  empty = false,
  error,
  loadingLabel,
  emptyConfig,
  onEmptyAction,
  onRetry,
  skeletonRows = 3,
  renderSkeleton,
  density = "comfortable",
  className,
  children,
}: DataStateProps) {
  if (loading) {
    return (
      <div
        data-testid="data-state-loading"
        className={cn("flex flex-col gap-2", className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {Array.from({ length: skeletonRows }).map((_, index) =>
          renderSkeleton ? renderSkeleton(index) : defaultSkeletonRow(index, density),
        )}
        {loadingLabel ? (
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span>{loadingLabel}</span>
          </div>
        ) : null}
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="data-state-error"
        className={cn(
          "flex flex-col items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center",
          className,
        )}
        role="alert"
      >
        <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{ERROR_COPY.generic.title}</p>
          <p className="text-sm text-muted-foreground">{errorBody(error)}</p>
        </div>
        {onRetry ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRetry}
            data-testid="data-state-retry"
          >
            {ERROR_COPY.generic.retryLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  if (empty && emptyConfig) {
    return (
      <div
        data-testid="data-state-empty"
        className={cn(
          "flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-muted/10 p-6 text-center",
          className,
        )}
      >
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{emptyConfig.title}</p>
          <p className="text-sm text-muted-foreground">{emptyConfig.body}</p>
        </div>
        {emptyConfig.primaryAction && onEmptyAction ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="data-state-empty-action"
            onClick={() =>
              onEmptyAction({
                actionKey: emptyConfig.primaryAction?.actionKey,
                route: emptyConfig.primaryAction?.route,
              })
            }
          >
            {emptyConfig.primaryAction.label}
          </Button>
        ) : null}
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}

export default DataState;

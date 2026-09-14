import { branding } from "../../config/branding";

export function RouteLoading() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
        data-testid="route-loading-spinner"
        aria-hidden="true"
      />
      <span className="text-sm font-medium">Loading {branding.productName}…</span>
    </div>
  );
}

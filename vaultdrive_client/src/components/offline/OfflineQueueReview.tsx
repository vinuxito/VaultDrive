import type { OfflineAction } from "../../utils/offline-db";

interface OfflineQueueReviewProps {
  items: OfflineAction[];
  currentOwnerId: string | null;
  onRetry: (item: OfflineAction) => void;
  onDiscard: (item: OfflineAction) => void;
  onReconcileRename: (item: OfflineAction) => void;
}

export function OfflineQueueReview({
  items,
  currentOwnerId,
  onRetry,
  onDiscard,
  onReconcileRename,
}: OfflineQueueReviewProps) {
  return (
    <section className="border-b border-border bg-card px-4 py-3" aria-label="Offline changes">
      <div className="mx-auto max-w-5xl space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Offline changes</h2>
          <p className="text-xs text-muted-foreground">Pending work stays here until the server confirms it or you resolve it.</p>
        </div>
        <ul className="space-y-2">
          {items.map((item, index) => {
            const key = item.id ?? `${item.file_id}-${index}`;
            const legacy = !item.action_id || !item.owner_id;
            const differentOwner = Boolean(item.owner_id && item.owner_id !== currentOwnerId);
            const needsReview = item.status === "unknown" || item.status === "failed" || item.status === "conflict";
            const label = item.filename || item.file_id;
            return (
              <li key={key} className="rounded-lg border border-border bg-background/60 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{item.type === "delete" ? "Delete" : "Rename"}: {label}</p>
                    {legacy ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Older queued action — it has no owner proof and will not be sent.</p>
                    ) : differentOwner ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Queued for a different account — sign in as that owner to review it.</p>
                    ) : item.status === "unknown" && item.type === "delete" ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">The server did not confirm whether it deleted {label}. Choose Retry only if the file is still present.</p>
                    ) : needsReview ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{item.last_error || "This action needs review before it can be sent again."}</p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">Waiting to sync for this account.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!legacy && !differentOwner && needsReview && (
                      <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => onRetry(item)} aria-label={`Retry ${item.type} for ${label}`}>
                        Retry
                      </button>
                    )}
                    {!legacy && !differentOwner && item.type === "rename" && needsReview && (
                      <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => onReconcileRename(item)}>
                        Check server
                      </button>
                    )}
                    {!differentOwner && (
                      <button type="button" className="text-xs font-semibold text-destructive hover:underline" onClick={() => onDiscard(item)}>
                        {item.type === "delete" && item.status === "unknown" ? "I resolved this" : "Discard"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

import type { OfflineAction } from "../../utils/offline-db";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation(["common"]);
  return (
    <section className="border-b border-border bg-card px-4 py-3" aria-label={t("common:offline.label")}>
      <div className="mx-auto max-w-5xl space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("common:offline.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("common:offline.description")}</p>
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
                    <p className="font-medium text-foreground">{item.type === "delete" ? t("common:offline.delete") : t("common:offline.rename")}: {label}</p>
                    {legacy ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t("common:offline.older")}</p>
                    ) : differentOwner ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t("common:offline.differentOwner")}</p>
                    ) : item.status === "unknown" && item.type === "delete" ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t("common:offline.unknownDeleteBefore")} {label}. {t("common:offline.unknownDeleteAfter")}</p>
                    ) : needsReview ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{item.last_error || t("common:offline.needsReview")}</p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">{t("common:offline.waiting")}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!legacy && !differentOwner && needsReview && (
                      <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => onRetry(item)} aria-label={`${t("common:offline.retry")} ${item.type} ${t("common:offline.for")} ${label}`}>
                        {t("common:offline.retry")}
                      </button>
                    )}
                    {!legacy && !differentOwner && item.type === "rename" && needsReview && (
                      <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => onReconcileRename(item)}>
                        {t("common:offline.checkServer")}
                      </button>
                    )}
                    {!differentOwner && (
                      <button type="button" className="text-xs font-semibold text-destructive hover:underline" onClick={() => onDiscard(item)}>
                        {item.type === "delete" && item.status === "unknown" ? t("common:offline.resolved") : t("common:offline.discard")}
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

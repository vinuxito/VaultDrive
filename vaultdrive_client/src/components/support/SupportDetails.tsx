import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button";
import { sanitizeSupportDetails, serializeSupportDetails, type SanitizedSupportDetails } from "./support-details-data";

export function SupportDetails({ details }: { details: SanitizedSupportDetails }) {
  const { t } = useTranslation("drive");
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const previewRef = useRef<HTMLTextAreaElement>(null);
  const preview = serializeSupportDetails(sanitizeSupportDetails(details));

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(preview);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
      previewRef.current?.focus();
      previewRef.current?.select();
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
      <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(current => !current)}>
        {expanded
          ? t("coherence.support.hide", { defaultValue: "Hide support details" })
          : t("coherence.support.show", { defaultValue: "Show support details" })}
      </Button>
      {expanded && (
        <div className="mt-3 space-y-3">
          <p className="text-muted-foreground">
            {t("coherence.support.previewNote", { defaultValue: "Only the details shown below will be copied. They do not include filenames, account details, credentials, links, or encryption keys." })}
          </p>
          <textarea
            ref={previewRef}
            readOnly
            aria-label={t("coherence.support.previewLabel", { defaultValue: "Support details preview" })}
            value={preview}
            rows={7}
            className="w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground selection:bg-primary/30"
          />
          <Button type="button" size="sm" onClick={() => void copy()}>
            {t("coherence.support.copy", { defaultValue: "Copy support details" })}
          </Button>
          {copyState === "copied" && (
            <p role="status" className="text-emerald-700 dark:text-emerald-300">
              {t("coherence.support.copied", { defaultValue: "Support details copied." })}
            </p>
          )}
          {copyState === "failed" && (
            <p role="alert" className="text-destructive">
              {t("coherence.support.copyFailed", { defaultValue: "Clipboard access was blocked. Select and copy the text manually." })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

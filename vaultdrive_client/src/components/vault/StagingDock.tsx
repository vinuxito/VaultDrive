import React, { useEffect } from "react";
import { Download, Link2, X } from "lucide-react";
import { formatBytes } from "../../utils/format";
import { playTumblerClick } from "../../utils/audioHaptics";
import type { FileData } from "./FileGrid";

interface StagingDockProps {
  dockedFiles: FileData[];
  onClearDock: () => void;
  onBatchDownload: (files: FileData[]) => void;
  onBatchShare?: (files: FileData[]) => void;
}

export const StagingDock: React.FC<StagingDockProps> = ({
  dockedFiles,
  onClearDock,
  onBatchDownload,
  onBatchShare,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dockedFiles.length > 0) {
        onClearDock();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dockedFiles, onClearDock]);

  if (dockedFiles.length === 0) return null;

  const totalBytes = dockedFiles.reduce((acc, f) => acc + (f.file_size || 0), 0);

  return (
    <div
      role="region"
      aria-label="Executive Staging Dock"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3.5 bg-card/95 backdrop-blur-md border border-primary/30 shadow-2xl rounded-2xl px-4 py-2.5 max-w-[90vw] animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
          {dockedFiles.length}
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-foreground">
            Staged for Action
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {formatBytes(totalBytes)}
          </span>
        </div>
      </div>

      <div className="h-6 w-[1px] bg-border mx-1" />

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            playTumblerClick();
            onBatchDownload(dockedFiles);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all active:scale-[0.98] cursor-pointer select-none"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Batch Download</span>
        </button>

        {onBatchShare && (
          <button
            type="button"
            onClick={() => {
              playTumblerClick();
              onBatchShare(dockedFiles);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-medium transition-all active:scale-[0.98] cursor-pointer select-none"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Combined Link</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            playTumblerClick();
            onClearDock();
          }}
          title="Clear Dock (Esc)"
          aria-label="Clear dock"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer select-none"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

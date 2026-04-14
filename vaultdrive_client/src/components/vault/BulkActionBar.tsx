import { Download, Trash2, X } from "lucide-react";
import { Button } from "../ui/button";

interface BulkActionBarProps {
  selectedCount: number;
  deletableCount?: number;
  scopeLabel?: string;
  onDownload: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionBar({
  selectedCount,
  deletableCount = selectedCount,
  scopeLabel = "in this view",
  onDownload,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div
        className="pointer-events-auto flex items-center gap-3 rounded-full px-5 py-3 shadow-2xl border border-white/10 bg-card"
      >
        <span className="text-sm font-semibold text-white">
          {selectedCount} selected {scopeLabel}
        </span>

        <div className="w-px h-5 bg-white/30" />

        <Button
          size="sm"
          onClick={onDownload}
          className="rounded-full bg-primary hover:bg-primary/80 text-white border-0 gap-1.5 px-4 h-8 text-sm font-medium"
        >
          <Download className="w-3.5 h-3.5" />
          Download {selectedCount}
        </Button>

        {deletableCount > 0 && (
          <Button
            size="sm"
            onClick={onDelete}
            className="rounded-full bg-transparent hover:bg-destructive/10 text-destructive hover:text-destructive/90 border border-destructive/50 gap-1.5 px-3 h-8 text-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deletableCount === selectedCount ? "Delete" : `Delete ${deletableCount}`}
          </Button>
        )}

        <button
          type="button"
          onClick={onClear}
          className="ml-1 text-white/80 hover:text-white transition-colors"
          aria-label="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

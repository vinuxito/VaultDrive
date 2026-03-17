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
        className="pointer-events-auto flex items-center gap-3 rounded-full px-5 py-3 shadow-2xl border border-white/10"
        style={{ background: "#3d2526" }}
      >
        <span className="text-sm font-semibold text-white/90">
          {selectedCount} selected {scopeLabel}
        </span>

        <div className="w-px h-5 bg-white/20" />

        <Button
          size="sm"
          onClick={onDownload}
          className="rounded-full bg-[#7d4f50] hover:bg-[#9a6163] text-white border-0 gap-1.5 px-4 h-8 text-sm font-medium"
        >
          <Download className="w-3.5 h-3.5" />
          Download {selectedCount}
        </Button>

        {deletableCount > 0 && (
          <Button
            size="sm"
            onClick={onDelete}
            className="rounded-full bg-transparent hover:bg-red-900/40 text-red-400 hover:text-red-300 border border-red-800/50 gap-1.5 px-3 h-8 text-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deletableCount === selectedCount ? "Delete" : `Delete ${deletableCount}`}
          </Button>
        )}

        <button
          onClick={onClear}
          className="ml-1 text-white/50 hover:text-white/80 transition-colors"
          aria-label="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

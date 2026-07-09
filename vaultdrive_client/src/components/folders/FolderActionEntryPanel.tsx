import { ArrowDownToLine, FolderOpen, Share2 } from "lucide-react";

import { Button } from "../ui/button";

interface FolderActionEntryPanelProps {
  folderName: string;
  canShareFolder?: boolean;
  onGenerateUploadLink: () => void;
  onShareFolder: () => void;
}

export function FolderActionEntryPanel({
  folderName,
  canShareFolder = true,
  onGenerateUploadLink,
  onShareFolder,
}: FolderActionEntryPanelProps) {
  return (
    <div className="rounded-[1.6rem] border border-border bg-card px-5 py-5 shadow-[0_16px_36px_rgba(0,0,0,0.06)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FolderOpen className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Folder actions for {folderName}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Decide whether this folder should collect incoming files or share what is already inside.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          onClick={onGenerateUploadLink}
          className="h-auto w-full items-start justify-start gap-3 rounded-2xl border-sky-200 bg-sky-50/70 px-4 py-4 text-left text-foreground shadow-none hover:bg-sky-100/80 focus-visible:ring-sky-200 dark:border-sky-850/80 dark:bg-sky-950/40 dark:hover:bg-sky-900/50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-900/70 dark:text-sky-200">
            <ArrowDownToLine className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Generate Upload Link</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Collect inbound uploads into this folder without exposing anything else.
            </p>
          </div>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onShareFolder}
          disabled={!canShareFolder}
          className="h-auto w-full items-start justify-start gap-3 rounded-2xl border-emerald-200 bg-emerald-50/70 px-4 py-4 text-left text-foreground shadow-none hover:bg-emerald-100/80 focus-visible:ring-emerald-200 dark:border-emerald-850/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200">
            <Share2 className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Share Folder</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {canShareFolder
                ? "Share this folder outward so people can view what is already here."
                : "Share Folder unlocks after this folder already contains files."}
            </p>
          </div>
        </Button>
      </div>
    </div>
  );
}

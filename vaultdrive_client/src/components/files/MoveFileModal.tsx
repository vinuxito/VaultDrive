import { useMemo, useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import type { Folder } from "./FolderBreadcrumb";
import { buildMoveTargetOptions } from "../../utils/file-move";

interface MoveFileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    id: string;
    filename: string;
    folder_id?: string | null;
  } | null;
  folders: Folder[];
  moving: boolean;
  onMove: (targetFolderId: string) => Promise<void>;
}

export function MoveFileModal({ open, onOpenChange, file, folders, moving, onMove }: MoveFileModalProps) {
  const options = useMemo(
    () => buildMoveTargetOptions(folders, file?.folder_id ?? null),
    [file?.folder_id, folders],
  );
  const [targetFolderId, setTargetFolderId] = useState("");

  const selectedFolderName = useMemo(
    () => options.find((option) => option.id === targetFolderId)?.name ?? "",
    [options, targetFolderId],
  );

  if (!file) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
          <DialogDescription>
            Move <span className="font-medium text-white">{file.filename}</span> into another folder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label htmlFor="move-file-folder" className="text-sm font-medium text-white/85 flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Destination folder
          </label>
          <select
            id="move-file-folder"
            value={targetFolderId}
            onChange={(event) => setTargetFolderId(event.target.value)}
            className="w-full rounded-md border border-white/15 bg-white/15 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
          >
            <option value="" className="text-foreground">Select a folder…</option>
            {options.map((option) => (
              <option key={option.id} value={option.id} className="text-foreground">
                {`${"• ".repeat(option.depth)}${option.name}`}
              </option>
            ))}
          </select>

          {selectedFolderName && (
            <p className="text-xs text-white/75">
              The file will move into <span className="font-medium text-white/85">{selectedFolderName}</span>. If that folder is already shared, active shared links will be updated additively.
            </p>
          )}
        </div>

        <DialogFooter>
          <div className="flex justify-end gap-2 w-full">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={moving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void onMove(targetFolderId)}
              disabled={!targetFolderId || moving}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {moving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Moving…</> : "Move file"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

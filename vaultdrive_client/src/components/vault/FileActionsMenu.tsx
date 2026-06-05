import React from "react";
import { motion } from "framer-motion";
import { FolderOpen } from "lucide-react";
import type { FileData } from "./FileGrid";

interface FileActionsMenuProps {
  x: number;
  y: number;
  file: FileData;
  onMoveClick: (file: FileData) => void;
}

export const FileActionsMenu: React.FC<FileActionsMenuProps> = ({
  x,
  y,
  file,
  onMoveClick,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="fixed z-50 min-w-[180px] rounded-xl border border-border bg-card shadow-xl py-1 backdrop-blur-xl"
      style={{ left: x, top: y }}
    >
      <button
        type="button"
        onClick={() => onMoveClick(file)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left cursor-pointer"
      >
        <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" /> Move to folder
      </button>
    </motion.div>
  );
};

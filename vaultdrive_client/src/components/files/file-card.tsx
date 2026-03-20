import { useState } from 'react';
import { File as FileIcon, Download, Share2, Trash2, MoreVertical, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ElegantCard } from '../elegant';
import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface FileData {
  id: string;
  filename: string;
  file_size: number;
  created_at: string;
  metadata: string;
  starred?: boolean;
}

export interface FileCardProps {
  file: FileData;
  onDownload: (fileId: string, filename: string, metadata: string) => void;
  onShare: (fileId: string, filename: string) => void;
  onDelete: (fileId: string, filename: string) => void;
  onToggleMetadata: (fileId: string) => void;
  onToggleStar?: (fileId: string) => void;
  isExpanded: boolean;
  viewMode: 'grid' | 'list';
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};


function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

const getFileIconColor = (filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return 'bg-pink-500/20 text-pink-500';
    case 'pdf':
      return 'bg-red-500/20 text-red-500';
    case 'doc':
    case 'docx':
      return 'bg-[#7d4f50]/20 text-[#7d4f50]';
    case 'xls':
    case 'xlsx':
      return 'bg-green-500/20 text-green-500';
    case 'zip':
    case 'rar':
      return 'bg-yellow-500/20 text-yellow-500';
    default:
      return 'bg-gray-500/20 text-gray-500';
  }
}

export function FileCard({
  file,
  onDownload,
  onShare,
  onDelete,
  onToggleMetadata,
  onToggleStar,
  viewMode,
}: FileCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const MoreMenu = () => (
    <div className="relative">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            >
              <MoreVertical size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>More actions</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-slate-200 min-w-[152px] py-1">
            <button
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              onClick={() => { onShare(file.id, file.filename); setMenuOpen(false); }}
            >
              <Share2 size={14} /> Share Link
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              onClick={() => { onToggleMetadata(file.id); setMenuOpen(false); }}
            >
              <FileIcon size={14} /> View Details
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
              onClick={() => { onDelete(file.id, file.filename); setMenuOpen(false); }}
            >
              <Trash2 size={14} /> Delete File
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (viewMode === 'list') {
    return (
      <ElegantCard
        className={cn(
          "transition-all duration-300 !p-0",
          "ring-2 ring-primary/50"
        )}
      >
        <div className="flex items-center p-3">
          <div className={cn("file-icon w-10 h-10 rounded-lg flex items-center justify-center mr-4", getFileIconColor(file.filename))}>
            <FileIcon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{file.filename}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.file_size)} · {formatRelativeDate(file.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-1 ml-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => onDownload(file.id, file.filename, file.metadata)}>
                    <Download size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <MoreMenu />
          </div>
        </div>
      </ElegantCard>
    );
  }

  return (
    <ElegantCard
      className={cn(
        "transition-all duration-300 group",
        "ring-2 ring-primary/50"
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className={cn("file-icon w-12 h-12 rounded-lg flex items-center justify-center", getFileIconColor(file.filename))}>
            <FileIcon size={24} />
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onToggleStar && onToggleStar(file.id)}
            className={cn(
              "transition-all rounded-full",
              file.starred
                ? "text-yellow-400"
                : "text-slate-400/70 hover:text-yellow-400"
            )}
          >
            <Star className={cn("w-5 h-5", file.starred && "fill-current")} />
          </Button>
        </div>

        <div className="mt-4 min-w-0">
          <p className="font-semibold truncate text-base">{file.filename}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatFileSize(file.file_size)} · {formatRelativeDate(file.created_at)}
          </p>
        </div>

        <div className="flex items-center justify-end gap-1 mt-4 pt-4 border-t border-[#7d4f50]/15">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDownload(file.id, file.filename, file.metadata)}
                  className="w-8 h-8"
                >
                  <Download size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <MoreMenu />
        </div>
      </div>
    </ElegantCard>
  );
}

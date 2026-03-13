import { File as FileIcon, Download, Share2, Trash2, Lock, ChevronDown, ChevronUp, Star } from 'lucide-react';
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

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString();
};

const maskKey = (key: string): string => {
  if (!key || key.length <= 5) return key;
  return key.substring(0, 5) + "*".repeat(Math.min(key.length - 5, 20));
};

const parseMetadata = (metadataStr: string) => {
  try {
    return JSON.parse(metadataStr);
  } catch {
    return null;
  }
};

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
  isExpanded,
  viewMode,
}: FileCardProps) {
  const metadata = parseMetadata(file.metadata);

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
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{formatFileSize(file.file_size)}</span>
              <span>•</span>
              <span>{formatDate(file.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => onDownload(file.id, file.filename, file.metadata)}><Download size={16} /></Button>
                </TooltipTrigger>
                <TooltipContent>Download</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => onShare(file.id, file.filename)}><Share2 size={16} /></Button>
                </TooltipTrigger>
                <TooltipContent>Share</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => onDelete(file.id, file.filename)} className="text-red-500 hover:text-red-600"><Trash2 size={16} /></Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => onToggleMetadata(file.id)}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Details</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        {isExpanded && metadata && (
          <div className="border-t bg-muted/30 p-3">
            {/* Metadata content here */}
          </div>
        )}
      </ElegantCard>
    )
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
          <p className="text-sm text-muted-foreground">{formatFileSize(file.file_size)}</p>
        </div>
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-muted-foreground">{formatDate(file.created_at)}</p>
          <div className="flex items-center gap-1">
          <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => onDownload(file.id, file.filename, file.metadata)} className="w-8 h-8"><Download size={16} /></Button>
                </TooltipTrigger>
                <TooltipContent>Download</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => onShare(file.id, file.filename)} className="w-8 h-8"><Share2 size={16} /></Button>
                </TooltipTrigger>
                <TooltipContent>Share</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => onDelete(file.id, file.filename)} className="w-8 h-8 text-red-500 hover:text-red-600"><Trash2 size={16} /></Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => onToggleMetadata(file.id)} className="w-8 h-8">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Details</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {isExpanded && metadata && (
        <div className="border-t bg-muted/30 p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
              <Lock className="w-4 h-4" />
              <span>Encryption Details</span>
            </div>

            <div className="grid gap-2 text-xs">
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Algorithm:</span>
                <span className="font-mono font-medium">{metadata.algorithm || "N/A"}</span>
              </div>

              {metadata.salt && (
                <div className="flex justify-between items-start gap-4">
                  <span className="text-muted-foreground">Salt:</span>
                  <span className="font-mono break-all text-right">
                    {maskKey(metadata.salt)}
                  </span>
                </div>
              )}

              {metadata.iv && (
                <div className="flex justify-between items-start gap-4">
                  <span className="text-muted-foreground">IV:</span>
                  <span className="font-mono break-all text-right">
                    {maskKey(metadata.iv)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-start gap-4">
                <span className="text-muted-foreground">File ID:</span>
                <span className="font-mono break-all text-right">
                  {file.id}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </ElegantCard>
  );
}

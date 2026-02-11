import { useState } from "react";
import { Button } from "../ui/button";
import {
  File,
  Shield,
  Lock,
  Download,
  Share2,
  Users,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface FileWidgetProps {
  file: {
    id: string;
    filename: string;
    file_size: number;
    created_at: string;
    metadata?: string;
    is_owner?: boolean;
    group_name?: string;
    group_id?: string;
    shared_by?: string;
    shared_by_email?: string;
    shared_by_name?: string;
    shared_at?: string;
    owner_email?: string;
    owner_name?: string;
    drop_token?: string;
    drop_folder_name?: string;
  };

  // Context-specific configuration
  context: "my-files" | "shared-files" | "group-files";

  // Action handlers (optional based on context)
  onDownload?: (fileId: string, filename: string, metadata: string) => void;
  onShare?: (fileId: string, filename: string) => void;
  onManageShares?: (fileId: string, filename: string) => void;
  onDelete?: (fileId: string, filename: string) => void;

  // UI customization
  showActions?: boolean;
  showDetails?: boolean;
  enableExpand?: boolean;
}

export function FileWidget({
  file,
  context,
  onDownload,
  onShare,
  onManageShares,
  onDelete,
  showActions = true,
  showDetails = true,
  enableExpand = true,
}: FileWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse metadata
  const parseMetadata = (metadataStr?: string): any => {
    if (!metadataStr) return null;
    try {
      return JSON.parse(metadataStr);
    } catch {
      return null;
    }
  };

  const metadata = parseMetadata(file.metadata);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
  };

  // Mask sensitive key data
  const maskKey = (key: string): string => {
    if (!key || key.length < 8) return "****";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  // Determine which actions to show based on context
  // Share: show for my-files (if owner) OR group-files (if owner/admin)
  const shouldShowShare =
    ((context === "my-files" && file.is_owner) ||
      (context === "group-files" && file.is_owner)) &&
    onShare;
  // Manage Group: show for my-files (if owner) OR group-files (if owner/admin)
  const shouldShowManageShares =
    ((context === "my-files" && file.is_owner) ||
      (context === "group-files" && file.is_owner)) &&
    onManageShares;
  const shouldShowDownload = (context === "my-files" || context === "group-files" || context === "shared-files") && onDownload;
  // Delete: show for my-files (if owner) OR group-files (if owner)
  const shouldShowDelete =
    ((context === "my-files" && file.is_owner) ||
      (context === "group-files" && file.is_owner)) &&
    onDelete;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Main File Row */}
      <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <File className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{file.filename}</p>

{/* Group Badge */}
              {file.group_name && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 shrink-0">
                  <Users className="w-3 h-3" />
                  {file.group_name}
                </span>
              )}

              {file.drop_folder_name && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 shrink-0">
                  Via: {file.drop_folder_name}
                </span>
              )}

              {/* Ownership Badge */}
              {file.is_owner && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 shrink-0">
                  Your file
                </span>
              )}
            </div>

            {/* File Metadata Line */}
            <div className="flex gap-3 text-sm text-muted-foreground">
              <span>{formatFileSize(file.file_size)}</span>
              <span>•</span>
              <span>{formatDate(file.created_at)}</span>
              {metadata && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {metadata.algorithm || "Encrypted"}
                  </span>
                </>
              )}
            </div>

            {/* Shared By Info (for group/shared files) */}
            {context !== "my-files" && file.shared_by && (
              <div className="text-xs text-muted-foreground mt-1">
                Shared by {file.shared_by_name || file.shared_by}
                {file.shared_by_email && ` (${file.shared_by_email})`}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-2">
            {/* Show Details Toggle */}
            {enableExpand && showDetails && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsExpanded(!isExpanded)}
                className="gap-1 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Show Details
                  </>
                )}
              </Button>
            )}

            {/* Share Button */}
            {shouldShowShare && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onShare!(file.id, file.filename)}
                className="gap-2 border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950 dark:text-purple-400"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            )}

            {/* Manage Shares Button */}
            {shouldShowManageShares && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onManageShares!(file.id, file.filename)}
                className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950 dark:text-orange-400"
              >
                <Users className="w-4 h-4" />
              </Button>
            )}

            {/* Download Button */}
            {shouldShowDownload && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onDownload!(file.id, file.filename, file.metadata || "")
                }
                className="gap-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 dark:text-blue-400"
              >
                <Download className="w-4 h-4" />
              </Button>
            )}

            {/* Delete Button */}
            {shouldShowDelete && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete!(file.id, file.filename)}
                className="gap-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 dark:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Collapsible Details Section */}
      {isExpanded && showDetails && metadata && (
        <div className="border-t bg-muted/30 p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="w-4 h-4" />
              <span>Encryption Details</span>
            </div>

            <div className="grid gap-3 text-sm">
              {/* Algorithm */}
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Algorithm:</span>
                <span className="font-mono font-medium">
                  {metadata.algorithm || "N/A"}
                </span>
              </div>

              {/* Salt */}
              {metadata.salt && (
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">
                    Salt (Key Derivation):
                  </span>
                  <span className="font-mono text-xs break-all max-w-[200px] text-right">
                    {maskKey(metadata.salt)}
                  </span>
                </div>
              )}

              {/* IV */}
              {metadata.iv && (
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">
                    IV (Initialization Vector):
                  </span>
                  <span className="font-mono text-xs break-all max-w-[200px] text-right">
                    {maskKey(metadata.iv)}
                  </span>
                </div>
              )}

              {/* File ID */}
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">File ID:</span>
                <span className="font-mono text-xs break-all max-w-[200px] text-right">
                  {file.id}
                </span>
              </div>
            </div>

            {/* Group Sharing Info (if applicable) */}
            {file.group_name && file.owner_name && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm font-medium mb-3">
                  <Users className="w-4 h-4" />
                  <span>Sharing Information</span>
                </div>
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-muted-foreground">Shared via:</span>
                    <span className="font-medium text-purple-600 dark:text-purple-400">
                      {file.group_name} (group)
                    </span>
                  </div>
                  {file.owner_name && (
                    <div className="flex justify-between items-start">
                      <span className="text-muted-foreground">File owner:</span>
                      <div className="text-right">
                        <div className="font-medium">{file.owner_name}</div>
                        {file.owner_email && (
                          <div className="text-xs text-muted-foreground">
                            {file.owner_email}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {file.shared_by_name && (
                    <div className="flex justify-between items-start">
                      <span className="text-muted-foreground">Shared by:</span>
                      <div className="text-right">
                        <div className="font-medium">{file.shared_by_name}</div>
                        {file.shared_by_email && (
                          <div className="text-xs text-muted-foreground">
                            {file.shared_by_email}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {file.shared_at && (
                    <div className="flex justify-between items-start">
                      <span className="text-muted-foreground">Shared on:</span>
                      <span className="font-medium">{formatDate(file.shared_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

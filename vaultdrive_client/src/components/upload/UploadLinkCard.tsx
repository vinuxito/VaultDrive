import { Copy, ExternalLink, X, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import type { UploadTokenWithFiles } from "./types";
import { BASE_PATH } from "../../utils/api";

interface UploadLinkCardProps {
  token: UploadTokenWithFiles;
  isExpanded: boolean;
  status: { label: string; variant: "default" | "destructive" | "secondary" };
  onExpand: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}

export function UploadLinkCard({
  token,
  isExpanded,
  status,
  onExpand,
  onDeactivate,
  onDelete,
}: UploadLinkCardProps) {
  const uploadUrl = token.upload_url?.startsWith('http')
    ? token.upload_url
    : `${window.location.origin}${token.upload_url || `${BASE_PATH}/drop/${token.token}`}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(uploadUrl);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getStatusColor = (variant: string) => {
    switch (variant) {
      case "default":
        return "bg-green-500 text-white";
      case "destructive":
        return "bg-red-500 text-white";
      case "secondary":
        return "bg-gray-500 text-white";
      default:
        return "bg-gray-400 text-white";
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                📤
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  {token.folder_name || "Files Upload Link"}
                </h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status.variant)}`}
                  >
                    {status.label}
                  </span>
                  <span>Created: {formatDate(token.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <code className="bg-muted px-2 py-0.5 rounded text-xs flex-1 min-w-0 overflow-hidden">
                  {token.token}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyUrl}
                  className="h-7 px-2 shrink-0"
                  title="Copy URL"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <a
                href={uploadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700"
              >
                <ExternalLink className="w-3 h-3" />
                {uploadUrl}
              </a>
            </div>

            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              {token.max_files && (
<span className="flex items-center gap-1">
                Files Uploaded: <strong>{token.files_uploaded || 0}</strong> / {token.max_files}
              </span>
              )}
              {token.expires_at && (
                <span>Expires: {formatDate(token.expires_at)}</span>
              )}
              {!token.max_files && !token.expires_at && (
                <span>No expiration or file limits</span>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onExpand}
            className="ml-2 shrink-0"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t bg-muted/30">
          <div className="p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              📄 Files Uploaded via this Link ({token.files?.length || 0})
            </h4>

            {token.files && token.files.length > 0 ? (
              <div className="space-y-2">
                {token.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-background border"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded bg-[#7d4f50]/10 flex items-center justify-center text-[#7d4f50]">
                        📄
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.filename}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatFileSize(file.file_size)}</span>
                          <span>•</span>
                          <span>{formatDate(file.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="text-xs text-muted-foreground mt-2">
                  {token.files.length} file{token.files.length !== 1 ? "s" : ""} total
                  {token.files.length > 0 && (
                    <>
                      {" "}
                      • Last upload:{" "}
                      {formatDate(
                        token.files[token.files.length - 1].created_at
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No files uploaded yet</p>
                <p className="text-xs mt-1">
                  Share this link to let external users upload files
                </p>
              </div>
            )}

            <div className="flex gap-2 mt-4 pt-4 border-t">
              {!token.used && status.variant !== "destructive" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDeactivate}
                  className="flex-1 gap-1"
                >
                  <X className="w-4 h-4" />
                  Deactivate Link
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                className="flex-1 gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Delete Link
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
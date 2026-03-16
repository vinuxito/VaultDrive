import { Copy, X, ChevronDown, ChevronUp, Trash2, UploadCloud, FileIcon, ShieldCheck } from "lucide-react";
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
        return "bg-emerald-100 text-emerald-700 border border-emerald-200";
      case "destructive":
        return "bg-rose-100 text-rose-700 border border-rose-200";
      case "secondary":
        return "bg-slate-100 text-slate-700 border border-slate-200";
      default:
        return "bg-slate-100 text-slate-700 border border-slate-200";
    }
  };

  return (
    <div className="rounded-[1.4rem] border border-slate-200 overflow-hidden bg-white shadow-[0_16px_36px_rgba(125,79,80,0.06)] dark:border-slate-700 dark:bg-slate-900/70">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#7d4f50] via-[#9f7475] to-[#d7bbbc] flex items-center justify-center text-white shadow-[0_12px_24px_rgba(125,79,80,0.22)]">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                    {token.folder_name || "Files Upload Link"}
                  </h3>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${getStatusColor(status.variant)}`}
                  >
                    {status.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Client delivery route into the selected folder, with status and uploaded files visible here.
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Created: {formatDate(token.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  <span>Sender route</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                    <ShieldCheck className="w-3 h-3" />
                    Reviewable
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <code className="bg-white dark:bg-slate-900 px-2 py-1 rounded text-xs flex-1 min-w-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                    {uploadUrl}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyUrl}
                    className="h-8 px-2 shrink-0"
                    title="Copy URL"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Share this route with a client when you want them to deliver files into the folder you selected.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <code className="bg-muted px-2 py-0.5 rounded text-xs flex-1 min-w-0 overflow-hidden">
                  {token.token}
                </code>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
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
        <div className="border-t bg-muted/20 dark:bg-slate-950/20">
          <div className="p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <FileIcon className="w-4 h-4 text-[#7d4f50]" />
              Files uploaded through this route ({token.files?.length || 0})
            </h4>

            {token.files && token.files.length > 0 ? (
              <div className="space-y-2">
                {token.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-background border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-[#7d4f50]/10 flex items-center justify-center text-[#7d4f50]">
                        <FileIcon className="w-4 h-4" />
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
                  Seal route
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                className="flex-1 gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Remove route
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

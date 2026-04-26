import { useMemo, useState } from "react";
import { X, ChevronDown, ChevronUp, Trash2, UploadCloud, FileIcon, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { ProtectedLinkCopyField } from "../links/ProtectedLinkCopyField";
import type { UploadTokenWithFiles } from "./types";
import { API_URL, BASE_PATH } from "../../utils/api";

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
  const [revealedKey, setRevealedKey] = useState("");

  const baseUrl = token.upload_url?.startsWith('http')
    ? token.upload_url
    : `${window.location.origin}${token.upload_url || `${BASE_PATH}/drop/${token.token}`}`;
  const baseWithoutFragment = baseUrl.split("#")[0];

  const copyUnavailableReason = useMemo(() => {
    if (status.label === "Expired") {
      return "This upload link has expired, so there is no full URL to copy.";
    }
    if (status.label === "Inactive") {
      return "This upload link is sealed and can no longer accept files.";
    }
    if (status.label === "Full") {
      return "This upload link already reached its file limit and should not be shared again.";
    }
    return undefined;
  }, [status.label]);

  const handleResolveCopyUrl = async (pin: string) => {
    if (revealedKey) {
      return `${baseWithoutFragment}#key=${revealedKey}`;
    }

    const authToken = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/drop/${token.token}/recover-key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ pin }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error || "Wrong PIN. Try again.");
    }

    const data = await response.json() as { encryption_key: string };
    setRevealedKey(data.encryption_key);
    return `${baseWithoutFragment}#key=${data.encryption_key}`;
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
        return "bg-destructive/10 text-destructive border border-destructive/20";
      case "secondary":
        return "bg-muted text-foreground border border-border";
      default:
        return "bg-muted text-foreground border border-border";
    }
  };

  return (
    <div className="rounded-[1.4rem] border border-border overflow-hidden bg-white shadow-[0_16px_36px_rgba(0,0,0,0.06)] dark:bg-muted/60">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary via-primary/60 to-primary/20 flex items-center justify-center text-white shadow-[0_12px_24px_rgba(0,0,0,0.22)]">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-lg text-foreground">
                    {token.folder_name || "Files Upload Link"}
                  </h3>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${getStatusColor(status.variant)}`}
                  >
                    {status.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Client delivery route into the selected folder, with status and uploaded files visible here.
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Created: {formatDate(token.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="rounded-2xl border border-border bg-muted px-3 py-3 dark:bg-muted/40">
                <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <span>Sender route</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                    <ShieldCheck className="w-3 h-3" />
                    Reviewable
                  </span>
                </div>
                <div className="mt-2">
                  <ProtectedLinkCopyField
                    label="Sender route"
                    rawUrl={revealedKey ? `${baseWithoutFragment}#key=${revealedKey}` : `${baseWithoutFragment}#key=missing`}
                    expectedPath={new URL(baseWithoutFragment).pathname}
                    kind="upload-link"
                    variant="light"
                    copyButtonLabel="Copy full upload link"
                    guidanceText="Enter your 4-digit PIN to copy the full URL."
                    onResolveUrl={handleResolveCopyUrl}
                    unavailableReason={copyUnavailableReason}
                  />
                </div>
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
        <div className="border-t bg-muted/20 dark:bg-muted/20">
          <div className="p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
              <FileIcon className="w-4 h-4 text-primary" />
              Files uploaded through this route ({token.files?.length || 0})
            </h4>

            {token.files && token.files.length > 0 ? (
              <div className="space-y-2">
                {token.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-background border border-border"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
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

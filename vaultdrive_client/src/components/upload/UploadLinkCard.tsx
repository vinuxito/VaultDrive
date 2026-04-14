import { useState } from "react";
import { Copy, X, ChevronDown, ChevronUp, Trash2, UploadCloud, FileIcon, ShieldCheck, KeyRound, Check, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
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
  const [pinInput, setPinInput] = useState("");
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoverError, setRecoverError] = useState("");
  const [copied, setCopied] = useState(false);

  const baseUrl = token.upload_url?.startsWith('http')
    ? token.upload_url
    : `${window.location.origin}${token.upload_url || `${BASE_PATH}/drop/${token.token}`}`;

  // Strip any existing fragment from the base URL before appending recovered key
  const baseWithoutFragment = baseUrl.split("#")[0];
  const displayUrl = revealedKey
    ? `${baseWithoutFragment}#key=${revealedKey}`
    : baseUrl;

  const copyUrl = async () => {
    await navigator.clipboard.writeText(displayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRecoverKey = async () => {
    if (!pinInput || pinInput.length < 4) {
      setRecoverError("Enter your 4-digit PIN");
      return;
    }

    setRecovering(true);
    setRecoverError("");

    try {
      const authToken = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/drop/${token.token}/recover-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ pin: pinInput }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Failed to recover key");
      }

      const data = await response.json() as { encryption_key: string };
      setRevealedKey(data.encryption_key);
      setShowPinPrompt(false);
      setPinInput("");

      // Auto-copy the full URL
      const fullUrl = `${baseWithoutFragment}#key=${data.encryption_key}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setRecoverError(err instanceof Error ? err.message : "Failed to recover key");
    } finally {
      setRecovering(false);
    }
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
        return "bg-slate-100 text-foreground border border-border";
      default:
        return "bg-slate-100 text-foreground border border-border";
    }
  };

  const hasKey = revealedKey || baseUrl.includes("#key=");

  return (
    <div className="rounded-[1.4rem] border border-border overflow-hidden bg-white shadow-[0_16px_36px_rgba(0,0,0,0.06)] dark:border-slate-700 dark:bg-slate-900/70">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary via-primary/60 to-primary/20 flex items-center justify-center text-white shadow-[0_12px_24px_rgba(0,0,0,0.22)]">
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
                <p className="mt-1 text-sm text-muted-foreground dark:text-slate-400">
                  Client delivery route into the selected folder, with status and uploaded files visible here.
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Created: {formatDate(token.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="rounded-2xl border border-border bg-muted px-3 py-3 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground dark:text-slate-400">
                  <span>Sender route</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                    <ShieldCheck className="w-3 h-3" />
                    Reviewable
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <code className="bg-white dark:bg-slate-900 px-2 py-1 rounded text-xs flex-1 min-w-0 overflow-hidden border border-border">
                    {displayUrl}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyUrl}
                    className="h-8 px-2 shrink-0"
                    title={hasKey ? "Copy full link" : "Copy link (missing key)"}
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>

                {!hasKey && !showPinPrompt && (
                  <button
                    type="button"
                    onClick={() => { setShowPinPrompt(true); setRecoverError(""); }}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Reveal full link with PIN
                  </button>
                )}

                {showPinPrompt && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={8}
                        value={pinInput}
                        onChange={(e) => { setPinInput(e.target.value); setRecoverError(""); }}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRecoverKey(); }}
                        placeholder="Enter PIN"
                        className="w-28 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground placeholder-slate-400 focus:border-primary/40 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={handleRecoverKey}
                        disabled={recovering}
                        className="h-8 bg-primary hover:bg-primary/80 text-white"
                      >
                        {recovering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Reveal"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowPinPrompt(false); setPinInput(""); setRecoverError(""); }}
                        className="h-8 px-2"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {recoverError && (
                      <p className="text-xs text-destructive">{recoverError}</p>
                    )}
                  </div>
                )}

                {revealedKey && (
                  <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                    Full link recovered and copied to clipboard. Share this URL with your client.
                  </p>
                )}

                {!hasKey && !showPinPrompt && !revealedKey && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    The encryption key is not in this URL. Use "Reveal full link with PIN" to recover it.
                  </p>
                )}

                {hasKey && !revealedKey && (
                  <p className="mt-2 text-xs text-muted-foreground dark:text-slate-400">
                    Share this route with a client when you want them to deliver files into the folder you selected.
                  </p>
                )}
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

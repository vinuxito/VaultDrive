import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Upload,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  FileIcon,
  FolderOpen,
  Lock,
  ShieldCheck,
  Building2,
  Copy,
  Eye,
  EyeOff,
  Key,
} from "lucide-react";
import { collectFilesFromDataTransferItems } from "../utils/drop-drag";
import type { DragDataTransferItem } from "../utils/drop-drag";

import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  deriveKeyFromPassword,
  generateSalt,
  arrayBufferToBase64,
} from "../utils/crypto";
import BrandLogo from "../components/branding/brand-logo";
import { API_URL } from "../utils/api";
import { buildFileRequestUploadFormData } from "../utils/file-request-upload";
import { branding } from "../config/branding";

interface RequestInfo {
  description: string;
  expires_at: string | null;
  is_expired: boolean;
  owner_display_name: string;
  owner_organization: string;
  uploaded_count: number;
  max_file_size: number;
}

interface UploadProgress {
  id: string;
  fileName: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  bytesUploaded: number;
  bytesTotal: number;
  error?: string;
}

export default function FileRequestPage() {
  const { token } = useParams<{ token: string }>();

  const [info, setInfo] = useState<RequestInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [delivered, setDelivered] = useState(false);
  const [deliveryRef, setDeliveryRef] = useState("");
  const [receiptCopied, setReceiptCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fetchInfo = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/file-requests/${token}/info`);

      if (
        response.status === 404 ||
        response.status === 403 ||
        response.status === 410
      ) {
        const data = (await response.json()) as { error?: string };
        setError(
          data.error || "This file request link is invalid or has expired."
        );
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load request info");
      }

      const data = (await response.json()) as RequestInfo;

      if (data.is_expired) {
        setError("This file request link has expired.");
        setLoading(false);
        return;
      }

      setInfo(data);
    } catch {
      setError(
        "Unable to load file request. Please check the link and try again."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchInfo();
  }, [fetchInfo]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const items = Array.from(e.dataTransfer?.items ?? []) as unknown as DragDataTransferItem[];
    if (items.length > 0 && items.some((i) => (i as unknown as DataTransferItem).webkitGetAsEntry?.()?.isDirectory)) {
      void collectFilesFromDataTransferItems(items).then((collected) => {
        if (collected.length > 0) {
          setSelectedFiles((prev) => [...prev, ...collected]);
        }
      });
    } else {
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) {
        setSelectedFiles((prev) => [...prev, ...files]);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (!passphrase.trim()) {
      setError("Please set a download password before uploading.");
      return;
    }
    if (selectedFiles.length === 0) {
      setError("Please select at least one file.");
      return;
    }

    setUploading(true);
    setError("");
    const uploadQueue = selectedFiles.map((file) => ({
      id: Math.random().toString(36).slice(2),
      file,
      fileName: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }));
    setUploadProgress(
      uploadQueue.map(({ id, file, fileName }) => ({
        id,
        fileName,
        status: "pending",
        progress: 0,
        bytesUploaded: 0,
        bytesTotal: file.size,
      }))
    );

    for (const { id, file } of uploadQueue) {
      await uploadFile(id, file);
    }

    setUploading(false);
    setDelivered(true);
    setDeliveryRef(token?.slice(0, 8) ?? "");
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
    e.target.value = "";
  };

  const uploadFile = (progressId: string, file: File): Promise<void> => {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || "";

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.id === progressId
                ? {
                    ...p,
                    progress: percent,
                    status: "uploading",
                    bytesUploaded: event.loaded,
                    bytesTotal: event.total,
                  }
                : p
            )
          );
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.id === progressId
                ? { ...p, status: "success", progress: 100, bytesUploaded: file.size }
                : p
            )
          );
          resolve();
        } else {
          let errMsg = `Upload failed (${xhr.status})`;
          try {
            const body = JSON.parse(xhr.responseText) as { error?: string };
            if (body.error) errMsg = body.error;
          } catch {
            // ignore json parse error
          }
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.id === progressId ? { ...p, status: "error", error: errMsg } : p
            )
          );
          reject(new Error(errMsg));
        }
      };

      xhr.onerror = () => {
        setUploadProgress((prev) =>
          prev.map((p) =>
            p.id === progressId
              ? { ...p, status: "error", error: "Network error" }
              : p
          )
        );
        reject(new Error("Network error"));
      };

      xhr.ontimeout = () => {
        setUploadProgress((prev) =>
          prev.map((p) =>
            p.id === progressId
              ? { ...p, status: "error", error: "Upload timed out" }
              : p
          )
        );
        reject(new Error("Upload timeout"));
      };

      xhr.timeout = 30 * 60 * 1000;

      // Defer async encryption to next tick (matches drop-upload pattern)
      setTimeout(() => {
        void (async () => {
          try {
            // 1. Generate random salt for PBKDF2 key derivation
            const salt = generateSalt(); // 16 random bytes

            // 2. Generate random IV for AES-GCM
            const iv = crypto.getRandomValues(new Uint8Array(12));

            // 3. Derive AES-256 key from passphrase + salt (100k iterations)
            const aesKey = await deriveKeyFromPassword(passphrase, salt, 100000);

            // 4. Encrypt the file buffer
            const fileBuffer = await file.arrayBuffer();
            const encryptedData = await crypto.subtle.encrypt(
              { name: "AES-GCM", iv },
              aesKey,
              fileBuffer
            );

            // 5. Build multipart form
            // pin_wrapped_key stores the salt (base64) so the owner can
            // re-derive the key once they know the passphrase (shared out-of-band)
            const formData = buildFileRequestUploadFormData({
              encryptedData,
              ivBase64: arrayBufferToBase64(iv),
              saltBase64: arrayBufferToBase64(salt),
              relativePath,
              fallbackName: file.name,
            });

            xhr.open("POST", `${API_URL}/file-requests/${token}/upload`);
            xhr.send(formData);
          } catch (err) {
            setUploadProgress((prev) =>
              prev.map((p) =>
                p.id === progressId
                  ? {
                      ...p,
                      status: "error",
                      error:
                        err instanceof Error ? err.message : "Encryption failed",
                    }
                  : p
              )
            );
            reject(err);
          }
        })();
      }, 0);
    });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="brand-page-bg flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  // ── Error (no info loaded) ───────────────────────────────────────────────
  if (error && !info) {
    return (
      <div className="brand-page-bg flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <CardTitle>Link Unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              onClick={() => {
                window.location.href = branding.marketingURL;
              }}
              variant="outline"
              className="w-full"
            >
              {`Back to ${branding.companyName}`}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!info) return null;

  const completedCount = uploadProgress.filter((p) => p.status === "success").length;
  const totalCount = uploadProgress.length;

  // ── Success / receipt ────────────────────────────────────────────────────
  if (delivered && completedCount > 0) {
    const receiptLines = [
      `✓ Files sent securely`,
      `To: ${info.owner_display_name}${info.owner_organization ? ` · ${info.owner_organization}` : ""}`,
      `Files: ${completedCount} file${completedCount > 1 ? "s" : ""}`,
      `Time: ${new Date().toLocaleString()}`,
      deliveryRef ? `Reference: ${deliveryRef}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-background/90 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <BrandLogo className="h-14 mx-auto" />

          <div className="w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border-4 border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-12 h-12 text-emerald-500" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Files sent securely
            </h1>
            <p className="text-muted-foreground">
              {completedCount} file{completedCount > 1 ? "s" : ""} encrypted
              and delivered to{" "}
              {info.owner_display_name || "the recipient"}.
            </p>
          </div>

          <div className="brand-receipt-surface rounded-[1.6rem] px-4 py-4 text-left">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">Delivery receipt</p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-800 dark:text-emerald-400">
              Your encrypted files are now in the request route. The recipient can review the delivery, but they still need the separate password you chose to open the files.
            </p>
          </div>

          <div className="text-left bg-card/80 rounded-2xl border border-border p-4 space-y-2 text-sm">
            {info.owner_display_name && (
              <p className="font-medium text-foreground">
                {info.owner_display_name}
                {info.owner_organization && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · {info.owner_organization}
                  </span>
                )}
              </p>
            )}
            <p className="text-muted-foreground">
              {completedCount} file{completedCount > 1 ? "s" : ""} received
            </p>
            <p className="text-muted-foreground text-xs">{new Date().toLocaleString()}</p>
            {deliveryRef && (
              <p className="text-muted-foreground text-xs">Ref: {deliveryRef}</p>
            )}
          </div>

          <div className="text-left bg-card/70 rounded-2xl border border-border p-4 space-y-2 text-sm">
            <p className="font-medium text-foreground">What happened</p>
            <p className="text-muted-foreground leading-relaxed">
              {`Your files were encrypted in this browser using the password you chose. ${branding.productName} stored only the protected files and request metadata.`}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The recipient can review the delivery now, but they will still need the separate download password to open the files.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
            <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">
              Remember your download password
            </p>
            <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
              Share your download password with{" "}
              {info.owner_display_name || "the recipient"} — they will need it
              to open your files.
            </p>
          </div>

          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(receiptLines);
              setReceiptCopied(true);
              setTimeout(() => setReceiptCopied(false), 2000);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-muted-foreground text-sm hover:bg-muted transition-colors cursor-pointer"
          >
            {receiptCopied ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {receiptCopied ? "Copied!" : "Copy receipt"}
          </button>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Lock className="w-3.5 h-3.5" />
            AES-256-GCM encrypted · Zero-knowledge storage
          </div>
        </div>
      </div>
    );
  }

  // ── Main upload UI ───────────────────────────────────────────────────────
  return (
    <div className="brand-page-bg p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-start mb-4">
          <BrandLogo className="h-12" />
        </div>

        {/* Owner identity banner */}
        {(info.owner_display_name || info.owner_organization) && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card/70 border border-border/60">
            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-foreground">
                {info.owner_display_name
                  ? `Sending files to ${info.owner_display_name}`
                  : "File Request"}
              </span>
              {info.owner_organization && (
                <span className="text-muted-foreground">
                  {" "}
                  · {info.owner_organization}
                </span>
              )}
            </div>
            <Lock className="w-3.5 h-3.5 text-emerald-500 ml-auto shrink-0" />
          </div>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary">
            Secure File Request
          </h1>
          <p className="text-muted-foreground">
            Your files will be encrypted in your browser before upload
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-4 text-sm text-emerald-800 dark:text-emerald-300">
            <p className="font-medium text-emerald-900 dark:text-emerald-200">What stays private</p>
            <p className="mt-1.5 leading-relaxed">
              {`Your files are encrypted in this browser with the password you choose. ${branding.productName} stores only the protected upload and request metadata.`}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/75 px-4 py-4 text-sm text-muted-foreground shadow-[0_12px_28px_rgba(0,0,0,0.06)]">
            <p className="font-medium text-foreground">What the recipient needs</p>
            <p className="mt-1.5 leading-relaxed">
              They can see the upload arrived, but they still need the separate password you share with them to decrypt and open the files.
            </p>
          </div>
        </div>

        {/* Description / instructions */}
        {info.description && (
          <div className="flex gap-3 px-4 py-3 rounded-xl bg-primary-foreground/60 border border-primary/30">
            <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-primary/90">{info.description}</p>
          </div>
        )}

        {info.expires_at && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
            <Clock className="w-4 h-4" />
            <span>Expires: {new Date(info.expires_at).toLocaleString()}</span>
          </div>
        )}

        {/* Passphrase card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Set a Download Password
            </CardTitle>
            <CardDescription>
              The recipient will need this password to open your files. Share it
              separately — not via this link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <input
                type={showPassphrase ? "text" : "password"}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter a secure password…"
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:bg-card focus:outline-none transition-all"
                disabled={uploading}
              />
              <button
                type="button"
                onClick={() => setShowPassphrase((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showPassphrase ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Files are encrypted with this password. Only someone who knows it
              can decrypt them.
            </p>
          </CardContent>
        </Card>

        {/* File selector card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Select Files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!uploading && (
              <>
                <input
                  id="file-input-req"
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <input
                  id="folder-input-req"
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={handleFolderChange}
                  disabled={uploading}
                  {...{ webkitdirectory: "", directory: "" } as Record<string, string>}
                />

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label htmlFor="file-input-req" className="group relative cursor-pointer">
                    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/75 backdrop-blur-sm p-5 transition-all duration-300 group-hover:border-primary group-hover:shadow-lg group-hover:bg-gradient-to-br group-hover:from-primary/10 group-hover:to-primary/10 text-center">
                      <FileIcon className="w-7 h-7 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                      <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors duration-300">
                        Select Files
                      </span>
                    </div>
                  </label>
                  <label htmlFor="folder-input-req" className="group relative cursor-pointer">
                    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/75 backdrop-blur-sm p-5 transition-all duration-300 group-hover:border-primary group-hover:shadow-lg group-hover:bg-gradient-to-br group-hover:from-primary/10 group-hover:to-primary/10 text-center">
                      <FolderOpen className="w-7 h-7 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                      <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors duration-300">
                        Select Folder
                      </span>
                    </div>
                  </label>
                </div>

                <button
                  type="button"
                  className={`w-full border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 cursor-pointer ${
                    dragOver
                      ? "border-primary bg-gradient-to-br from-primary/5 to-primary/5"
                      : "border-primary/30 hover:border-primary hover:bg-gradient-to-br hover:from-primary/5 hover:to-primary/5"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() =>
                    document.getElementById("file-input-req")?.click()
                  }
                >
                  <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-base font-medium text-foreground">
                    Drag &amp; drop files or folders here
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    or use the buttons above
                  </p>
                </button>

                {/* Selected file list */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {selectedFiles.length} file
                      {selectedFiles.length > 1 ? "s" : ""} selected
                    </p>
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted border border-border text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="truncate text-foreground">
                            {(file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name}
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {formatBytes(file.size)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="ml-2 text-muted-foreground hover:text-red-500 cursor-pointer shrink-0"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Uploading indicator */}
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Encrypting and uploading…
              </div>
            )}

            {/* Progress list */}
            {uploadProgress.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Upload Progress</h3>
                  <span className="text-xs text-muted-foreground">
                    {completedCount}/{totalCount} completed
                  </span>
                </div>
                {uploadProgress.map((progress) => (
                  <div
                    key={progress.fileName}
                    className="space-y-1.5 p-3 bg-muted rounded-lg"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1 mr-2">
                        {progress.fileName}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {progress.bytesUploaded > 0 && progress.bytesTotal > 0
                          ? `${formatBytes(progress.bytesUploaded)} / ${formatBytes(progress.bytesTotal)}`
                          : `${progress.progress}%`}
                      </span>
                      {progress.status === "success" && (
                        <CheckCircle className="w-4 h-4 text-green-500 ml-2 shrink-0" />
                      )}
                      {progress.status === "error" && (
                        <XCircle className="w-4 h-4 text-red-500 ml-2 shrink-0" />
                      )}
                      {progress.status === "uploading" && (
                        <Loader2 className="w-4 h-4 text-primary animate-spin ml-2 shrink-0" />
                      )}
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-primary transition-all duration-300 h-full"
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>
                    {progress.status === "error" && (
                      <p className="text-xs text-red-600">{progress.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Inline error */}
            {error && !uploading && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => {
                void handleUpload();
              }}
              disabled={
                uploading || selectedFiles.length === 0 || !passphrase.trim()
              }
              className="w-full bg-primary hover:bg-primary/90 text-white border-0"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Send Securely
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Trust indicator */}
        <Card className="bg-primary/10 dark:bg-primary/10 border-primary/40 dark:border-primary">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Lock className="w-5 h-5 text-primary dark:text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">End-to-end encrypted</p>
                <p className="text-muted-foreground">
                  Your files are encrypted in your browser before being sent.
                  The server never sees your files or your password.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

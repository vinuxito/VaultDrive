import { useState, useEffect } from "react";
import { useSessionVault } from "../../context/SessionVaultContext";
import { CheckCircle2, AlertCircle, Loader2, X, Key, Download } from "lucide-react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { useTheme } from "../theme-provider";
import { cn } from "../../lib/utils";

export interface BulkDownloadFile {
  id: string;
  filename: string;
  metadata: string;
  pin_wrapped_key?: string | null;
  is_owner?: boolean;
}

type FileStatus = "pending" | "downloading" | "done" | "error";

interface BulkDownloadModalProps {
  files: BulkDownloadFile[];
  onDownloadFile: (
    file: BulkDownloadFile,
    credential: string
  ) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

export function BulkDownloadModal({
  files,
  onDownloadFile,
  onClose,
}: BulkDownloadModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const needsPin = files.some((f) => f.pin_wrapped_key);
  const needsPassword = files.some((f) => !f.pin_wrapped_key);

  const { getCredential } = useSessionVault();

  const [pinCredential, setPinCredential] = useState("");
  const [passwordCredential, setPasswordCredential] = useState("");

  useEffect(() => {
    const cached = getCredential();
    if (!cached) return;
    if (cached.type === "pin" && needsPin) setPinCredential(cached.value);
    if (cached.type === "password" && needsPassword) setPasswordCredential(cached.value);
  }, [getCredential, needsPin, needsPassword]);

  const [fileStatuses, setFileStatuses] = useState<Record<string, FileStatus>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const setStatus = (id: string, status: FileStatus) =>
    setFileStatuses((prev) => ({ ...prev, [id]: status }));

  const setError = (id: string, msg: string) =>
    setFileErrors((prev) => ({ ...prev, [id]: msg }));

  const handleStart = async () => {
    setRunning(true);

    for (const file of files) {
      setStatus(file.id, "downloading");

      const credential = file.pin_wrapped_key ? pinCredential : passwordCredential;

      const result = await onDownloadFile(file, credential);

      if (result.success) {
        setStatus(file.id, "done");
      } else {
        setStatus(file.id, "error");
        setError(file.id, result.error ?? "Unknown error");
      }

      await new Promise((r) => setTimeout(r, 800));
    }

    setRunning(false);
    setDone(true);
  };

  const credentialsReady =
    (!needsPin || pinCredential.length === 4) &&
    (!needsPassword || passwordCredential.length > 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <Card
        className={cn(
          "w-full max-w-lg mx-4 max-h-[85vh] flex flex-col border",
          isDark
            ? "bg-gradient-to-br from-primary to-primary/90 border-white/10 text-white"
            : "bg-card border-border text-foreground"
        )}
      >
        <CardHeader className={cn("border-b shrink-0", isDark ? "border-white/10" : "border-border")}>
          <div className="flex items-center justify-between">
            <CardTitle className={cn("flex items-center gap-2", isDark ? "text-white" : "text-foreground")}>
              <Download className={cn("w-5 h-5", isDark ? "text-primary-foreground" : "text-primary")} />
              Download {files.length} file{files.length !== 1 ? "s" : ""}
            </CardTitle>
            {!running && (
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "transition-colors",
                  isDark ? "text-white/75 hover:text-white" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <CardDescription className={isDark ? "text-white/80" : "text-muted-foreground"}>
            {done
              ? "All downloads processed."
              : credentialsReady
              ? "Credentials ready — click Start to decrypt and download."
              : "Enter credentials, then click Start to decrypt and download."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-4 py-4">
          {!done && !running && (
            <div className="space-y-3">
              {needsPin && pinCredential.length < 4 && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="bulk-download-pin"
                    className={cn("text-sm font-medium flex items-center gap-1.5", isDark ? "text-white" : "text-foreground")}
                  >
                    <Key className="w-3.5 h-3.5" />
                    4-digit PIN
                    <span className={cn("text-xs", isDark ? "text-white/75" : "text-muted-foreground")}>
                      (used across your vault)
                    </span>
                  </label>
                  <input
                    id="bulk-download-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinCredential}
                    onChange={(e) => setPinCredential(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    className={cn(
                      "w-full px-3 py-2 border rounded-md text-center tracking-widest text-xl focus:outline-none",
                      isDark
                        ? "bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/20"
                        : "bg-muted border-border text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background"
                    )}
                  />
                </div>
              )}

              {needsPassword && passwordCredential.length === 0 && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="bulk-download-password"
                    className={cn("text-sm font-medium flex items-center gap-1.5", isDark ? "text-white" : "text-foreground")}
                  >
                    <Key className="w-3.5 h-3.5" />
                    File credential
                    <span className={cn("text-xs", isDark ? "text-white/75" : "text-muted-foreground")}>
                      (only for older non-PIN files)
                    </span>
                  </label>
                  <input
                    id="bulk-download-password"
                    type="password"
                    value={passwordCredential}
                    onChange={(e) => setPasswordCredential(e.target.value)}
                    placeholder="Enter password"
                    className={cn(
                      "w-full px-3 py-2 border rounded-md focus:outline-none",
                      isDark
                        ? "bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/20"
                        : "bg-muted border-border text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background"
                    )}
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            {files.map((file) => {
              const status = fileStatuses[file.id] ?? "pending";
              return (
                <div
                  key={file.id}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-lg border",
                    isDark ? "bg-white/12 border-white/10" : "bg-muted border-border"
                  )}
                >
                  <div className="shrink-0">
                    {status === "pending" && (
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border-2",
                          isDark ? "border-white/30" : "border-muted-foreground/35"
                        )}
                      />
                    )}
                    {status === "downloading" && (
                      <Loader2 className={cn("w-4 h-4 animate-spin", isDark ? "text-primary-foreground" : "text-primary")} />
                    )}
                    {status === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {status === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", isDark ? "text-white" : "text-foreground")}>
                      {file.filename}
                    </p>
                    {status === "error" && fileErrors[file.id] && (
                      <p className={cn("text-xs truncate mt-0.5", isDark ? "text-red-300" : "text-destructive")}>
                        {fileErrors[file.id]}
                      </p>
                    )}
                  </div>
                  {file.pin_wrapped_key && (
                    <span className={cn("text-xs shrink-0", isDark ? "text-violet-300" : "text-primary")}>PIN</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>

        <div className={cn("border-t p-4 shrink-0 flex gap-2", isDark ? "border-white/10" : "border-border")}>
          {done ? (
            <Button
              onClick={onClose}
              className={cn(
                "w-full font-semibold",
                isDark
                  ? "bg-white text-primary hover:bg-primary/10"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              Done
            </Button>
          ) : (
            <>
              <Button
                variant="modal-cancel"
                onClick={onClose}
                disabled={running}
                className={cn(isDark ? "bg-white/15 border-white/20 text-white hover:bg-white/25 border" : "")}
              >
                Cancel
              </Button>
              <Button
                onClick={handleStart}
                disabled={!credentialsReady || running}
                className={cn(
                  "flex-1 font-semibold gap-1.5",
                  isDark
                    ? "bg-white text-primary hover:bg-primary/10"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {running ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Start Download
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

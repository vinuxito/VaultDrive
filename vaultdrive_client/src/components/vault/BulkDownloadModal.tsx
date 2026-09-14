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
import { getFileCredentialScheme } from "../../utils/file-credential";

export interface BulkDownloadFile {
  id: string;
  filename: string;
  metadata: string;
  pin_wrapped_key?: string | null;
  is_owner?: boolean;
  folder_id?: string | null;
}

export type DownloadFailureKind =
  | "credential"
  | "auth"
  | "storage"
  | "metadata"
  | "unknown";

export interface DownloadAttemptResult {
  success: boolean;
  error?: string;
  failureKind?: DownloadFailureKind;
}

type FileStatus = "pending" | "downloading" | "done" | "error";

interface BulkDownloadModalProps {
  files: BulkDownloadFile[];
  onDownloadFile: (
    file: BulkDownloadFile,
    credential: string
  ) => Promise<DownloadAttemptResult>;
  onClose: () => void;
}

export function BulkDownloadModal({
  files,
  onDownloadFile,
  onClose,
}: BulkDownloadModalProps) {
  const needsPin = files.some((file) => {
    const scheme = getFileCredentialScheme(file);
    return scheme === "drop-pin" || scheme === "pin";
  });
  const needsPassword = files.some(
    (file) => getFileCredentialScheme(file) === "password",
  );

  const { getCredential, clearCredential } = useSessionVault();

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
  const [stopped, setStopped] = useState(false);

  const setStatus = (id: string, status: FileStatus) =>
    setFileStatuses((prev) => ({ ...prev, [id]: status }));

  const setError = (id: string, msg: string) =>
    setFileErrors((prev) => ({ ...prev, [id]: msg }));

  const handleStart = async () => {
    if (files.length === 0) return;

    setRunning(true);
    setDone(false);
    setStopped(false);
    setFileStatuses({});
    setFileErrors({});

    try {
      for (const file of files) {
        setStatus(file.id, "downloading");

        const scheme = getFileCredentialScheme(file);
        const credential =
          scheme === "drop-pin" || scheme === "pin"
            ? pinCredential
            : scheme === "password"
              ? passwordCredential
              : "";

        let result: DownloadAttemptResult;
        try {
          result = await onDownloadFile(file, credential);
        } catch (error) {
          result = {
            success: false,
            error: error instanceof Error ? error.message : "Download failed.",
            failureKind: "unknown",
          };
        }

        if (result.success) {
          setStatus(file.id, "done");
          continue;
        }

        setStatus(file.id, "error");
        setError(file.id, result.error ?? "Unknown error");
        setStopped(true);
        if (result.failureKind === "credential") {
          clearCredential();
          if (scheme === "drop-pin" || scheme === "pin") setPinCredential("");
          if (scheme === "password") setPasswordCredential("");
        }
        return;
      }
      setDone(true);
    } finally {
      setRunning(false);
    }
  };

  const credentialsReady =
    files.length > 0 &&
    (!needsPin || pinCredential.length === 4) &&
    (!needsPassword || passwordCredential.length > 0);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-download-title"
      aria-describedby="bulk-download-description"
    >
      <Card className="w-full max-w-lg mx-4 max-h-[85vh] flex flex-col border bg-card border-border text-foreground">
        <CardHeader className="border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle
              id="bulk-download-title"
              className="flex items-center gap-2 text-foreground"
            >
              <Download className="w-5 h-5 text-primary" />
              Download {files.length} file{files.length !== 1 ? "s" : ""}
            </CardTitle>
            {!running && (
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <CardDescription id="bulk-download-description" className="text-muted-foreground">
            {files.length === 0
              ? "No files selected."
              : done
              ? "All downloads processed."
              : stopped
              ? "Download stopped at the first failure. Correct the issue, then retry."
              : credentialsReady && !needsPin && !needsPassword
              ? "Ready to download — click Start to decrypt and download."
              : credentialsReady
              ? "Credentials ready — click Start to decrypt and download."
              : "Enter credentials, then click Start to decrypt and download."}
          </CardDescription>
        </CardHeader>

        <form
          className="contents"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            void handleStart();
          }}
        >
          <CardContent className="flex-1 overflow-y-auto space-y-4 py-4">
            {!done && !running && (
              <div className="space-y-3">
              {needsPin && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="bulk-download-pin"
                    className="text-sm font-medium flex items-center gap-1.5 text-foreground"
                  >
                    <Key className="w-3.5 h-3.5" />
                    4-digit PIN
                    <span className="text-xs text-muted-foreground">
                      (used across your vault)
                    </span>
                  </label>
                  <input
                    id="bulk-download-pin"
                    name="bulk-file-pin"
                    type="password"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={4}
                    autoFocus={needsPin}
                    value={pinCredential}
                    onChange={(e) => setPinCredential(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    className="w-full px-3 py-2 border rounded-md text-center tracking-widest text-xl focus:outline-none bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>
              )}

              {needsPassword && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="bulk-download-password"
                    className="text-sm font-medium flex items-center gap-1.5 text-foreground"
                  >
                    <Key className="w-3.5 h-3.5" />
                    File credential
                    <span className="text-xs text-muted-foreground">
                      (only for older non-PIN files)
                    </span>
                  </label>
                  <input
                    id="bulk-download-password"
                    name="bulk-file-credential"
                    type="password"
                    autoComplete="new-password"
                    autoFocus={!needsPin && needsPassword}
                    value={passwordCredential}
                    onChange={(e) => setPasswordCredential(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>
              )}
              </div>
            )}

            <div className="space-y-1.5">
              {files.map((file) => {
                const status = fileStatuses[file.id] ?? "pending";
                const scheme = getFileCredentialScheme(file);
                return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted border-border"
                >
                  <div className="shrink-0">
                    {status === "pending" && (
                      <div
                        className="w-4 h-4 rounded-full border-2 border-muted-foreground/50"
                      />
                    )}
                    {status === "downloading" && (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    )}
                    {status === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {status === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">
                      {file.filename}
                    </p>
                    {status === "error" && fileErrors[file.id] && (
                      <p className="text-xs truncate mt-0.5 text-destructive">
                        {fileErrors[file.id]}
                      </p>
                    )}
                  </div>
                  {(scheme === "drop-pin" || scheme === "pin") && (
                    <span className="text-xs shrink-0 text-foreground">PIN</span>
                  )}
                </div>
                );
              })}
            </div>
          </CardContent>

          <div className="border-t border-border p-4 shrink-0 flex gap-2">
            {done ? (
              <Button
                type="button"
                onClick={onClose}
                className="w-full font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Done
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="modal-cancel"
                  onClick={onClose}
                  disabled={running}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!credentialsReady || running}
                  className="flex-1 font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {running ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      {stopped ? "Retry Downloads" : "Start Download"}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

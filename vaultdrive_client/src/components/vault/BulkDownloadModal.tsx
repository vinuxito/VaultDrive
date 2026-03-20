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
      <Card className="w-full max-w-lg mx-4 max-h-[85vh] flex flex-col bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border-white/10 text-white">
        <CardHeader className="border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Download className="w-5 h-5 text-[#f2d7d8]" />
              Download {files.length} file{files.length !== 1 ? "s" : ""}
            </CardTitle>
            {!running && (
              <button
                type="button"
                onClick={onClose}
                className="text-white/50 hover:text-white/80 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <CardDescription className="text-white/70">
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
                  <label htmlFor="bulk-download-pin" className="text-sm font-medium flex items-center gap-1.5 text-white/90">
                    <Key className="w-3.5 h-3.5" />
                    4-digit PIN
                    <span className="text-xs text-white/68">(used across your vault)</span>
                  </label>
                  <input
                    id="bulk-download-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinCredential}
                    onChange={(e) =>
                      setPinCredential(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="••••"
                    className="w-full px-3 py-2 border rounded-md bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/40 text-center tracking-widest text-xl"
                  />
                </div>
              )}

              {needsPassword && passwordCredential.length === 0 && (
                <div className="space-y-1.5">
                  <label htmlFor="bulk-download-password" className="text-sm font-medium flex items-center gap-1.5 text-white/90">
                    <Key className="w-3.5 h-3.5" />
                    File credential
                    <span className="text-xs text-white/68">(only for older non-PIN files)</span>
                  </label>
                  <input
                    id="bulk-download-password"
                    type="password"
                    value={passwordCredential}
                    onChange={(e) => setPasswordCredential(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 border rounded-md bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/40"
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
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/10"
                >
                  <div className="shrink-0">
                    {status === "pending" && (
                      <div className="w-4 h-4 rounded-full border-2 border-white/20" />
                    )}
                    {status === "downloading" && (
                      <Loader2 className="w-4 h-4 animate-spin text-[#f2d7d8]" />
                    )}
                    {status === "done" && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    {status === "error" && (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-white/90">
                      {file.filename}
                    </p>
                    {status === "error" && fileErrors[file.id] && (
                      <p className="text-xs text-red-300 truncate mt-0.5">
                        {fileErrors[file.id]}
                      </p>
                    )}
                  </div>
                  {file.pin_wrapped_key && (
                    <span className="text-xs text-violet-300 shrink-0">PIN</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>

        <div className="border-t border-white/10 p-4 shrink-0 flex gap-2">
          {done ? (
            <Button
              onClick={onClose}
              className="w-full bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
            >
              Done
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={onClose}
                disabled={running}
                className="flex-1 border-2 border-white/40 text-white hover:bg-white/10 bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleStart}
                disabled={!credentialsReady || running}
                className="flex-1 bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold gap-1.5"
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

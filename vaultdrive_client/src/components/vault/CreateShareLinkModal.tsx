import { useState } from "react";
import { X, Link2, Loader2, CheckCircle2, AlertCircle, Copy, Key, Calendar, Shield, Lock } from "lucide-react";
import { Button } from "../ui/button";
import { useTheme } from "../theme-provider";
import { cn } from "../../lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { API_URL, BASE_PATH } from "../../utils/api";
import {
  deriveKeyFromPassword,
  unwrapKey,
  hexToBytes,
  base64ToArrayBuffer,
  arrayBufferToBase64,
} from "../../utils/crypto";
import { useSessionVault } from "../../context/SessionVaultContext";
import { ApiCallTrace } from "../control-plane/ApiCallTrace";
import { branding } from "../../config/branding";

export interface CreateShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    id: string;
    filename: string;
    metadata: string;
    pin_wrapped_key?: string | null;
    is_owner?: boolean;
  };
}

type Step = "credential" | "generating" | "done" | "error";

const EXPIRY_PRESETS = [
  { label: "1 day", value: 1 },
  { label: "3 days", value: 3 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
] as const;

type ExpiryPreset = (typeof EXPIRY_PRESETS)[number]["value"];
type ExpiryOption = ExpiryPreset | "custom";

function computeExpiresAt(option: ExpiryOption, customDate: string): string {
  if (option === "custom") {
    if (customDate) {
      return new Date(customDate + "T12:00:00").toISOString();
    }
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  }
  const d = new Date();
  d.setDate(d.getDate() + option);
  return d.toISOString();
}

function formatExpiryDisplay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function CreateShareLinkModal({
  isOpen,
  onClose,
  file,
}: CreateShareLinkModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isDropFile = !!file.pin_wrapped_key;
  const { getCredential } = useSessionVault();
  const cached = getCredential();
  const fileCredentialMode = (() => {
    if (isDropFile) return "pin";
    try {
      const meta = JSON.parse(file.metadata) as { credential_scheme?: string };
      if (meta.credential_scheme === "pin") return "pin";
    } catch { /* ignore */ }
    return "password";
  })();
  const hasCachedCred = cached && cached.type === fileCredentialMode;
  const [credential, setCredential] = useState("");
  const [step, setStep] = useState<Step>("credential");
  const [shareUrl, setShareUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [expiryDays, setExpiryDays] = useState<ExpiryOption>(7);
  const [customDate, setCustomDate] = useState<string>("");
  const [expiryDisplay, setExpiryDisplay] = useState<string>("");
  const [autoShred, setAutoShred] = useState(false);
  const [enableTimeLock, setEnableTimeLock] = useState(false);
  const [unlockAtDate, setUnlockAtDate] = useState("");

  const todayISO = new Date().toISOString().split("T")[0] ?? "";

  async function handleGenerate() {
    const cred = hasCachedCred ? cached!.value : credential;
    if (!cred) return;
    setStep("generating");
    setErrorMsg("");

    try {
      let aesKey: CryptoKey;

      if (isDropFile && file.pin_wrapped_key) {
        const rawHex = await unwrapKey(cred, file.pin_wrapped_key);
        const keyBytes = hexToBytes(rawHex);
        aesKey = await crypto.subtle.importKey(
          "raw",
          new Uint8Array(keyBytes),
          { name: "AES-GCM", length: 256 },
          true,
          ["decrypt"]
        );
      } else {
        const meta = JSON.parse(file.metadata) as { iv: string; salt?: string };
        if (!meta.salt) {
          throw new Error("File has no salt — cannot derive key. This may be a drop file.");
        }
        const salt = new Uint8Array(base64ToArrayBuffer(meta.salt));
        aesKey = await deriveKeyFromPassword(cred, salt, 100000);
      }

      const rawKey = await crypto.subtle.exportKey("raw", aesKey);
      const b64Key = arrayBufferToBase64(rawKey);

      const expiresAtISO = computeExpiresAt(expiryDays, customDate);
      const displayDate = formatExpiryDisplay(expiresAtISO);

      const authToken = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/${file.id}/share-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ 
          expires_at: expiresAtISO,
          unlock_at: enableTimeLock && unlockAtDate ? new Date(unlockAtDate).toISOString() : undefined,
          max_downloads: autoShred ? 1 : 0
        }),
      });

      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errData.error ?? "Failed to create share link");
      }

      const data = (await response.json()) as { token: string };
      const url = `${window.location.origin}${BASE_PATH}/share/${data.token}#${b64Key}`;
      setShareUrl(url);
      setExpiryDisplay(displayDate);
      setStep("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to generate share link");
      setStep("error");
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => undefined);
  }

  function handleClose() {
    setCredential("");
    setStep("credential");
    setShareUrl("");
    setErrorMsg("");
    setCopied(false);
    setExpiryDays(7);
    setCustomDate("");
    setExpiryDisplay("");
    setAutoShred(false);
    setEnableTimeLock(false);
    setUnlockAtDate("");
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className={cn(
        "w-full max-w-md mx-4 border shadow-2xl",
        isDark
          ? "bg-gradient-to-br from-primary to-primary/90 border-white/10 text-white"
          : "bg-card border-border text-foreground"
      )}>
        <CardHeader className={cn("border-b", isDark ? "border-white/10" : "border-border")}>
          <div className="flex items-center justify-between">
            <CardTitle className={cn("flex items-center gap-2", isDark ? "text-white" : "text-foreground")}>
              <Link2 className={cn("w-5 h-5", isDark ? "text-primary-foreground" : "text-primary")} />
              Create Share Link
            </CardTitle>
            <button
              type="button"
              onClick={handleClose}
              className={cn("transition-colors", isDark ? "text-white/50 hover:text-white/80" : "text-muted-foreground hover:text-foreground")}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <CardDescription className={isDark ? "text-white/80 truncate" : "text-muted-foreground truncate"}>
            {file.filename}
          </CardDescription>
          <div className={cn(
            "mt-3 rounded-2xl border px-3 py-3 text-xs leading-relaxed",
            isDark ? "border-white/10 bg-white/12 text-white/85" : "border-border bg-muted text-muted-foreground"
          )}>
            This creates a reviewable route you can revoke later. The share record is visible to you; the decryption fragment stays with the recipient link, not the server.
          </div>
        </CardHeader>

        <CardContent className="space-y-4 py-4">
          {step === "credential" && (
            <>
              <div className="space-y-2">
                <p className={cn("text-sm font-medium flex items-center gap-1.5", isDark ? "text-white" : "text-foreground")}>
                  <Calendar className="w-3.5 h-3.5" />
                  Link Expiry
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {EXPIRY_PRESETS.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setExpiryDays(value)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer",
                        expiryDays === value
                          ? (isDark ? "bg-white text-primary/90" : "bg-primary text-primary-foreground")
                          : (isDark ? "bg-white/15 text-white/85 hover:bg-white/25" : "bg-muted text-muted-foreground hover:bg-muted/80")
                      )}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExpiryDays("custom")}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer",
                      expiryDays === "custom"
                        ? (isDark ? "bg-white text-primary/90" : "bg-primary text-primary-foreground")
                        : (isDark ? "bg-white/15 text-white/85 hover:bg-white/25" : "bg-muted text-muted-foreground hover:bg-muted/80")
                    )}
                  >
                    Custom
                  </button>
                </div>
                {expiryDays === "custom" && (
                  <input
                    type="date"
                    value={customDate}
                    min={todayISO}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className={cn(
                      "w-full px-3 py-2 border rounded-md text-sm focus:outline-none",
                      isDark
                        ? "bg-white/15 border-white/20 text-white focus:border-white/40"
                        : "bg-muted border-border text-foreground focus:border-primary focus:bg-background"
                    )}
                  />
                )}
              </div>

              {/* Auto-shred and Time-lock Options */}
              <div className={cn("space-y-3 pt-2 border-t", isDark ? "border-white/10" : "border-border")}>
                <div className="flex items-center gap-2">
                  <input
                    id="auto-shred-checkbox"
                    type="checkbox"
                    checked={autoShred}
                    onChange={(e) => setAutoShred(e.target.checked)}
                    className={cn(
                      "rounded w-4 h-4 cursor-pointer focus:ring-0 focus:ring-offset-0",
                      isDark ? "border-white/20 bg-white/15 text-primary" : "border-border bg-muted text-primary"
                    )}
                  />
                  <label htmlFor="auto-shred-checkbox" className={cn("text-sm font-medium flex items-center gap-1.5 cursor-pointer select-none", isDark ? "text-white" : "text-foreground")}>
                    <Shield className={cn("w-3.5 h-3.5", isDark ? "text-primary-foreground" : "text-primary")} />
                    Single-Use Auto-Shredding
                  </label>
                </div>
                <p className={cn("text-xs pl-6", isDark ? "text-white/75" : "text-muted-foreground")}>
                  Destroy the key immediately after the first successful download.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="time-lock-checkbox"
                    type="checkbox"
                    checked={enableTimeLock}
                    onChange={(e) => setEnableTimeLock(e.target.checked)}
                    className={cn(
                      "rounded w-4 h-4 cursor-pointer focus:ring-0 focus:ring-offset-0",
                      isDark ? "border-white/20 bg-white/15 text-primary" : "border-border bg-muted text-primary"
                    )}
                  />
                  <label htmlFor="time-lock-checkbox" className={cn("text-sm font-medium flex items-center gap-1.5 cursor-pointer select-none", isDark ? "text-white" : "text-foreground")}>
                    <Lock className={cn("w-3.5 h-3.5", isDark ? "text-primary-foreground" : "text-primary")} />
                    Time-Locked Release
                  </label>
                </div>
                {enableTimeLock && (
                  <div className="pl-6 space-y-1.5">
                    <input
                      type="datetime-local"
                      value={unlockAtDate}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(e) => setUnlockAtDate(e.target.value)}
                      className={cn(
                        "w-full px-3 py-2 border rounded-md text-sm focus:outline-none",
                        isDark
                          ? "bg-white/15 border-white/20 text-white focus:border-white/40"
                          : "bg-muted border-border text-foreground focus:border-primary focus:bg-background"
                      )}
                    />
                    <p className={cn("text-xs", isDark ? "text-white/75" : "text-muted-foreground")}>
                      The file cannot be accessed or downloaded before this date.
                    </p>
                  </div>
                )}
              </div>

              {!hasCachedCred && (
              <div className="space-y-1.5">
                <label htmlFor="csl-credential" className={cn("text-sm font-medium flex items-center gap-1.5", isDark ? "text-white" : "text-foreground")}>
                  <Key className="w-3.5 h-3.5" />
                  {fileCredentialMode === "pin" ? "4-digit PIN" : "Upload password"}
                </label>
                <p className={cn("text-xs", isDark ? "text-white/75" : "text-muted-foreground")}>
                  {fileCredentialMode === "pin"
                    ? "Enter your PIN to prepare this file for secure sharing"
                    : "Enter the password used when this file was encrypted so the key can be embedded in the share link"}
                </p>
                <input
                  id="csl-credential"
                  type="password"
                  inputMode={fileCredentialMode === "pin" ? "numeric" : undefined}
                  maxLength={fileCredentialMode === "pin" ? 4 : undefined}
                  value={credential}
                  onChange={(e) =>
                    setCredential(
                      fileCredentialMode === "pin"
                        ? e.target.value.replace(/\D/g, "").slice(0, 4)
                        : e.target.value
                    )
                  }
                  placeholder={fileCredentialMode === "pin" ? "••••" : "Enter credential"}
                  className={cn(
                    "w-full px-3 py-2 border rounded-md focus:outline-none",
                    isDark
                      ? "bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40"
                      : "bg-muted border-border text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background",
                    fileCredentialMode === "pin" ? " text-center tracking-widest text-xl" : ""
                  )}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && credential) void handleGenerate();
                  }}
                />
              </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="modal-cancel"
                  onClick={handleClose}
                  className={cn("flex-1", isDark ? "bg-white/15 border-white/20 text-white hover:bg-white/25 border" : "")}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={
                    (!hasCachedCred && (fileCredentialMode === "pin" ? credential.length !== 4 : credential.length === 0)) ||
                    (expiryDays === "custom" && customDate === "") ||
                    (enableTimeLock && unlockAtDate === "")
                  }
                  className={cn(
                    "flex-1 font-semibold",
                    isDark
                      ? "bg-white text-primary hover:bg-primary/10"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  Generate Link
                </Button>
              </div>
            </>
          )}

          {step === "generating" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className={cn("w-8 h-8 animate-spin", isDark ? "text-primary-foreground" : "text-primary")} />
              <p className={cn("text-sm", isDark ? "text-white/85" : "text-foreground")}>Generating share link…</p>
            </div>
          )}

          {step === "done" && (
            <>
              <div className="brand-receipt-surface rounded-2xl px-4 py-4">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Share link created</p>
                    <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-300">The route is live, visible to you, and revocable at any time.</p>
                  </div>
                </div>
              </div>
              <div className={cn("p-4 border rounded-xl", isDark ? "bg-white/12 border-emerald-400/20" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-800")}>
                <CheckCircle2 className={cn("w-5 h-5 shrink-0", isDark ? "text-emerald-400" : "text-emerald-600")} />
                <div className="mt-3 space-y-1.5">
                  <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-foreground")}>Trust receipt</p>
                  <p className={cn("text-xs leading-relaxed", isDark ? "text-white/80" : "text-muted-foreground")}>
                    The decryption key is carried in the URL fragment after <strong>#</strong>. {branding.productName} stores the share record, but the server never sees that fragment key.
                  </p>
                  <p className={cn("text-xs leading-relaxed", isDark ? "text-white/80" : "text-muted-foreground")}>
                    You can review or revoke this share at any time from the file's access controls.
                  </p>
                </div>
              </div>
              <div className={cn("p-3 rounded-xl border space-y-1.5", isDark ? "bg-white/12 border-white/15" : "bg-muted border-border")}>
                <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-foreground")}>Owner control</p>
                <p className={cn("text-xs leading-relaxed", isDark ? "text-white/80" : "text-muted-foreground")}>
                  The recipient gets a complete link. You keep the ability to inspect when it was created, when it expires, and whether it should remain active.
                </p>
              </div>
              <ApiCallTrace
                method="POST"
                path={`/api/v1/files/${file.id}/share-link`}
                scope="shares:create"
                note={`${branding.productName} created a revocable share record while the decryption fragment stayed in the URL after #.`}
              />
              {expiryDisplay && (
                <div className={cn("flex items-center gap-2 px-3 py-2 border rounded-md", isDark ? "bg-white/12 border-white/10" : "bg-muted border-border")}>
                  <Calendar className={cn("w-3.5 h-3.5 shrink-0", isDark ? "text-primary-foreground" : "text-primary")} />
                  <p className={cn("text-xs", isDark ? "text-white/85" : "text-muted-foreground")}>
                    Link expires:{" "}
                    <span className={cn("font-medium", isDark ? "text-white" : "text-foreground")}>{expiryDisplay}</span>
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="csl-share-url" className={cn("text-xs", isDark ? "text-white/75" : "text-muted-foreground")}>
                  Share URL (decryption key embedded after #)
                </label>
                <textarea
                  id="csl-share-url"
                  readOnly
                  value={shareUrl}
                  rows={4}
                  className={cn(
                    "w-full px-3 py-2 border rounded-md text-xs resize-none focus:outline-none cursor-text",
                    isDark
                      ? "bg-white/15 border-white/20 text-white/90"
                      : "bg-muted border-border text-foreground"
                  )}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </div>
              <div className={cn("p-2.5 border rounded-md", isDark ? "bg-white/12 border-white/10" : "bg-muted border-border")}>
                <p className={cn("text-xs", isDark ? "text-white/75" : "text-muted-foreground")}>
                  Share this link with the recipient. The decryption key travels in the link fragment, never through the server. Revoke anytime from the file's access panel.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="modal-cancel"
                  onClick={handleClose}
                  className={cn("flex-1", isDark ? "bg-white/15 border-white/20 text-white hover:bg-white/25 border" : "")}
                >
                  Close
                </Button>
                <Button
                  onClick={handleCopy}
                  className={cn(
                    "flex-1 font-semibold gap-1.5",
                    isDark
                      ? "bg-white text-primary hover:bg-primary/10"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === "error" && (
            <>
              <div className="flex items-start gap-2 p-3 bg-red-500/20 border border-red-400/30 rounded-md text-red-200">
                <AlertCircle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
                <p className="text-sm">{errorMsg}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="modal-cancel"
                  onClick={handleClose}
                  className={cn("flex-1", isDark ? "bg-white/15 border-white/20 text-white hover:bg-white/25 border" : "")}
                >
                  Close
                </Button>
                <Button
                  onClick={() => setStep("credential")}
                  className={cn(
                    "flex-1 font-semibold",
                    isDark
                      ? "bg-white text-primary hover:bg-primary/10"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  Try Again
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

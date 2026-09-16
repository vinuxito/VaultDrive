import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { X, Download, Loader2, AlertCircle, Lock, Key, ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { useSessionVault } from "../../context/SessionVaultContext";
import { API_URL } from "../../utils/api";
import { TrustRail } from "./TrustRail";
import { FileSecurityTimeline } from "./FileSecurityTimeline";
import {
  decryptPrivateKeyWithPIN,
  importRSAPSSPrivateKey,
  importRSAPSSPublicKey,
  signWithRSAPSS,
  verifyWithRSAPSS,
} from "../../utils/crypto";
import { getStoredUserFromLocalStorage } from "../../utils/browser-storage";
import { getFileCredentialScheme } from "../../utils/file-credential";

export interface FileEntry {
  id: string;
  filename: string;
  metadata: string;
  is_owner?: boolean;
  folder_id?: string | null;
  pin_wrapped_key?: string | null;
}

interface FilePreviewModalProps {
  file: FileEntry | null;
  onClose: () => void;
  onDownload: () => void;
}

interface ActivePreview {
  id: number;
  worker: Worker;
  cancel: () => void;
}

interface SigningUnlockDialogProps {
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (credential: string) => void;
}

function SigningUnlockDialog({ busy, error, onCancel, onSubmit }: SigningUnlockDialogProps) {
  const { t } = useTranslation("drive");
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [credential, setCredential] = useState("");
  useDialogFocus({ open: true, onClose: onCancel, containerRef: dialogRef, initialFocusRef: inputRef });

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="signing-unlock-title" tabIndex={-1} className="w-full min-w-0 max-w-sm space-y-4 rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-2xl sm:p-5">
      <div className="space-y-1">
        <h3 id="signing-unlock-title" className="font-semibold text-foreground">{t("coherence.preview.signUnlockTitle", { defaultValue: "Unlock local signing" })}</h3>
        <p className="text-sm text-muted-foreground">{t("coherence.preview.signUnlockBody", { defaultValue: "Enter your account PIN. It is used only in this browser to unlock your signing key." })}</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="preview-signing-credential" className="text-sm text-foreground">{t("coherence.preview.accountPin", { defaultValue: "Account PIN" })}</label>
        <input
          ref={inputRef}
          id="preview-signing-credential"
          name="preview-signing-credential"
          type="password"
          autoComplete="current-password"
          inputMode="numeric"
          maxLength={4}
          data-lpignore="true"
          value={credential}
          onChange={(event) => setCredential(event.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={(event) => { if (event.key === "Enter" && credential && !busy) onSubmit(credential); }}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none"
        />
      </div>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{t("coherence.preview.cancelSigning", { defaultValue: "Cancel signing" })}</Button>
        <Button type="button" disabled={busy || !credential} onClick={() => onSubmit(credential)}>{busy ? t("coherence.preview.signing", { defaultValue: "Signing..." }) : t("coherence.preview.unlockAndSign", { defaultValue: "Unlock and sign" })}</Button>
      </div>
    </div>
  </div>;
}



function getCredentialType(file: FileEntry): "password" | "pin" | "drop-pin" {
  const scheme = getFileCredentialScheme(file);
  return scheme === "folder" ? "pin" : scheme;
}

export function FilePreviewModal({ file, onClose, onDownload }: FilePreviewModalProps) {
  const { t } = useTranslation("drive");
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ open: !!file, onClose, containerRef: panelRef });
  const {
    getFileKey,
    getFolderKey,
    getPrivateKey,
    getPrivateKeyPem,
    getCredential,
    setCredential: cacheCredential,
    clearCredential,
  } = useSessionVault();

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadFailureKind, setLoadFailureKind] = useState("unknown");
  const [trustExpanded, setTrustExpanded] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [decryptedBlob, setDecryptedBlob] = useState<Blob | null>(null);
  const [credential, setCredential] = useState("");
  const [showCredentialPrompt, setShowCredentialPrompt] = useState(false);

  const [signatureB64, setSignatureB64] = useState<string | null>(null);
  const [isSignatureVerified, setIsSignatureVerified] = useState<boolean | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [showSigningUnlock, setShowSigningUnlock] = useState(false);
  const [signingUnlockError, setSigningUnlockError] = useState("");
  const previewGeneration = useRef(0);
  const activePreview = useRef<ActivePreview | null>(null);

  const cancelActivePreview = useCallback(() => {
    previewGeneration.current += 1;
    const active = activePreview.current;
    activePreview.current = null;
    if (active) {
      active.worker.terminate();
      active.cancel();
    }
  }, []);

  const checkSignature = useCallback(async (dataBuffer: ArrayBuffer, requestId: number) => {
    if (!file) return;
    const storedSig = localStorage.getItem(`signature_${file.id}`);
    if (!storedSig) {
      if (requestId !== previewGeneration.current) return;
      setSignatureB64(null);
      setIsSignatureVerified(null);
      return;
    }
    if (requestId !== previewGeneration.current) return;
    setSignatureB64(storedSig);
    try {
      const userObj = getStoredUserFromLocalStorage();
      if (!userObj?.public_key) {
        setIsSignatureVerified(false);
        return;
      }
      const pubKey = await importRSAPSSPublicKey(userObj.public_key);
      const verified = await verifyWithRSAPSS(pubKey, storedSig, dataBuffer);
      if (requestId !== previewGeneration.current) return;
      setIsSignatureVerified(verified);
    } catch {
      if (requestId !== previewGeneration.current) return;
      setIsSignatureVerified(false);
    }
  }, [file]);

  const signWithPrivateKey = async (pem: string) => {
    if (!file || !decryptedBlob) return;
    const pssPrivKey = await importRSAPSSPrivateKey(pem);
    const buffer = await decryptedBlob.arrayBuffer();
    const sig = await signWithRSAPSS(pssPrivKey, buffer);
    localStorage.setItem(`signature_${file.id}`, sig);
    setSignatureB64(sig);
    setIsSignatureVerified(true);
  };

  const handleSignFile = async () => {
    if (!file || !decryptedBlob) return;
    setIsSigning(true);
    try {
      const pem = await getPrivateKeyPem();
      if (!pem) {
        const userObj = getStoredUserFromLocalStorage();
        const pinEncrypted = userObj?.private_key_pin_encrypted ?? null;
        if (pinEncrypted) {
          setSigningUnlockError("");
          setShowSigningUnlock(true);
          return;
        }
      }
      if (!pem) throw new Error(t("coherence.preview.signUnlockError", { defaultValue: "Signing is locked. Unlock your account PIN in Settings and try again." }));
      await signWithPrivateKey(pem);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("coherence.preview.signError", { defaultValue: "Local signing failed. Try again after unlocking your account." }));
    } finally {
      setIsSigning(false);
    }
  };

  const handleSigningUnlock = async (signingCredential: string) => {
    const userObj = getStoredUserFromLocalStorage();
    const pinEncrypted = userObj?.private_key_pin_encrypted ?? null;
    if (!pinEncrypted) {
      setSigningUnlockError(t("coherence.preview.signUnlockMissing", { defaultValue: "No PIN-protected signing key is available. Unlock signing in Settings and try again." }));
      return;
    }
    setIsSigning(true);
    setSigningUnlockError("");
    try {
      const pem = await decryptPrivateKeyWithPIN(signingCredential, pinEncrypted, userObj?.kek_envelope_version);
      await signWithPrivateKey(pem);
      setShowSigningUnlock(false);
    } catch {
      setSigningUnlockError(t("coherence.preview.signUnlockRejected", { defaultValue: "Could not unlock signing. Check your account PIN and try again." }));
    } finally {
      setIsSigning(false);
    }
  };

  const loadPreview = useCallback(async (
    cred: string,
  ): Promise<{ success: boolean; failureKind?: string }> => {
    if (!file) return { success: false, failureKind: "unknown" };
    cancelActivePreview();
    const requestId = ++previewGeneration.current;
    let localFailureKind = "unknown";
    setIsLoading(true);
    setLoadError("");
    setLoadFailureKind("unknown");
    try {
      const cachedFileKey = getFileKey(file.id);
      const cachedFolderKey = file.folder_id ? getFolderKey(file.folder_id) : null;
      let rawPrivateKeyPem: string | null = null;
      if (file.is_owner === false && !file.pin_wrapped_key && !cachedFileKey && !cachedFolderKey) {
        rawPrivateKeyPem = await getPrivateKeyPem();
        if (requestId !== previewGeneration.current) return { success: false, failureKind: "cancelled" };
        if (!rawPrivateKeyPem) {
          const userObj = getStoredUserFromLocalStorage();
          const pinEncrypted = userObj?.private_key_pin_encrypted ?? null;
          if (pinEncrypted && cred) {
            localFailureKind = "credential";
            rawPrivateKeyPem = await decryptPrivateKeyWithPIN(cred, pinEncrypted, userObj?.kek_envelope_version);
            if (requestId !== previewGeneration.current) return { success: false, failureKind: "cancelled" };
          }
        }
      }

      if (requestId !== previewGeneration.current) return { success: false, failureKind: "cancelled" };
      const authToken = localStorage.getItem("token") ?? "";
      const decryptedBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const worker = new Worker(
          new URL("../../workers/preview.worker.ts", import.meta.url),
          { type: "module" }
        );
        const finish = () => {
          if (activePreview.current?.id === requestId) activePreview.current = null;
          worker.terminate();
        };
        worker.onmessage = (e) => {
          if (e.data.success) {
            resolve(e.data.decryptedBuffer);
          } else {
            const failure = new Error(e.data.error || "Decryption failed") as Error & {
              failureKind?: string;
            };
            failure.failureKind = e.data.failureKind;
            reject(failure);
          }
          finish();
        };
        worker.onerror = (err) => {
          reject(err);
          finish();
        };
        activePreview.current = {
          id: requestId,
          worker,
          cancel: () => reject(Object.assign(new Error("Preview cancelled"), { name: "AbortError" })),
        };
        worker.postMessage({
          file,
          credential: cred,
          fileKey: cachedFileKey ?? undefined,
          folderKey: cachedFolderKey ?? undefined,
          rawPrivateKeyPem,
          authToken,
          API_URL,
        });
      });

      if (requestId !== previewGeneration.current) return { success: false, failureKind: "cancelled" };

      const blob = new Blob([decryptedBuffer]);
      setDecryptedBlob(blob);
      await checkSignature(decryptedBuffer, requestId);
      if (requestId !== previewGeneration.current) return { success: false, failureKind: "cancelled" };

      const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
      const textTypes = ["txt", "md", "json", "csv", "xml", "html", "js", "ts", "py", "go", "sh"];

      if (textTypes.includes(ext)) {
        const text = await blob.text();
        if (requestId !== previewGeneration.current) return { success: false, failureKind: "cancelled" };
        setTextContent(text);
      } else {
        const url = URL.createObjectURL(blob);
        if (requestId !== previewGeneration.current) URL.revokeObjectURL(url);
        else setBlobUrl(url);
      }
      return { success: true };
    } catch (err) {
      if ((err instanceof Error && err.name === "AbortError") || requestId !== previewGeneration.current) {
        return { success: false, failureKind: "cancelled" };
      }
      const failureKind = err instanceof Error && "failureKind" in err
        ? String((err as Error & { failureKind?: string }).failureKind)
        : localFailureKind;
      setLoadError(failureKind === "credential"
        ? t("coherence.preview.credentialError", { defaultValue: "Decryption failed. Check the original PIN or file password and try again." })
        : failureKind === "auth"
          ? t("coherence.preview.authError", { defaultValue: "Your session expired. Sign in again to open this file." })
          : failureKind === "storage"
            ? t("coherence.preview.storageError", { defaultValue: "The service is temporarily unavailable. Check your connection and retry." })
            : t("coherence.preview.openError", { defaultValue: "This preview could not be opened. Retry, or ask the owner to check the file and access." }));
      setLoadFailureKind(failureKind);
      return {
        success: false,
        failureKind,
      };
    } finally {
      if (requestId === previewGeneration.current) setIsLoading(false);
    }
  }, [file, getPrivateKeyPem, getFileKey, getFolderKey, checkSignature, t, cancelActivePreview]);

  useEffect(() => cancelActivePreview, [file?.id, cancelActivePreview]);

  useEffect(() => {
    if (!file) return;
    setBlobUrl(null);
    setTextContent(null);
    setLoadError("");
    setDecryptedBlob(null);
    setCredential("");
    setTrustExpanded(false);
    setSignatureB64(null);
    setIsSignatureVerified(null);
    setShowSigningUnlock(false);
    setSigningUnlockError("");
    const folderRoute = getFileCredentialScheme(file) === "folder"
      && (file.is_owner !== false || Boolean(file.folder_id));
    if (folderRoute) {
      setShowCredentialPrompt(false);
      if (getFileKey(file.id) || (file.folder_id && getFolderKey(file.folder_id))) {
        void loadPreview("");
      } else {
        setLoadFailureKind("folder");
        setLoadError(t("coherence.preview.folderError", { defaultValue: "Close this preview and reopen the containing folder to unlock it, then try again." }));
      }
      return;
    }

    const vaultKey = getPrivateKey();
    if (vaultKey && file.is_owner === false && !file.pin_wrapped_key) {
      setShowCredentialPrompt(false);
      loadPreview("");
    } else {
      const cached = getCredential();
      const credType = getCredentialType(file);
      if (cached && ((credType !== "password" && cached.type === "pin") || (credType === "password" && cached.type === "password"))) {
        setCredential(cached.value);
        setShowCredentialPrompt(false);
        void loadPreview(cached.value).then((result) => {
          if (!result.success && result.failureKind === "credential") {
            clearCredential();
            setCredential("");
            setShowCredentialPrompt(true);
          }
        });
      } else {
        setShowCredentialPrompt(true);
      }
    }
  }, [file, getPrivateKey, getCredential, getFileKey, getFolderKey, loadPreview, clearCredential, t]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const handleCredentialSubmit = async () => {
    if (!credential) return;
    setShowCredentialPrompt(false);
    const ct = getCredentialType(file!);
    const result = await loadPreview(credential);
    if (result.success) {
      cacheCredential(credential, ct === "password" ? "password" : "pin");
    } else if (result.failureKind === "credential") {
      clearCredential();
      setShowCredentialPrompt(true);
    }
  };

  const handleDownloadDecrypted = () => {
    if (!decryptedBlob || !file) { onDownload(); return; }
    const url = URL.createObjectURL(decryptedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const renderPreview = () => {
    if (!file) return null;
    const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";

    if (textContent !== null) {
      return (
        <pre className="text-sm text-foreground overflow-auto max-h-[70vh] p-4 bg-muted rounded whitespace-pre-wrap break-words">
          {textContent}
        </pre>
      );
    }

    if (blobUrl) {
      if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
        return (
          <div className="flex justify-center bg-black/20 rounded-xl overflow-hidden border border-white/10">
            <img src={blobUrl} alt={file.filename} className="max-w-full max-h-[70vh] object-contain" />
          </div>
        );
      }
      if (["mp4", "webm", "ogg"].includes(ext)) {
        return (
          <div className="flex justify-center bg-black/20 rounded-xl overflow-hidden border border-white/10">
            <video src={blobUrl} controls className="max-w-full max-h-[70vh]" />
          </div>
        );
      }
      if (ext === "pdf") {
        return (
          <iframe src={blobUrl} className="w-full h-[70vh] rounded-xl border border-white/10 bg-white/12" title={t("coherence.preview.pdf", { defaultValue: "PDF preview" })} />
        );
      }
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4">
        <p className="text-lg">{t("coherence.preview.unsupported", { defaultValue: "Preview not available for this file type" })}</p>
        <Button
          onClick={handleDownloadDecrypted}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
        >
          <Download className="w-4 h-4 mr-2" />
          {t("coherence.preview.download", { defaultValue: "Download" })}
        </Button>
      </div>
    );
  };

  if (!file) return null;

  const credType = getCredentialType(file);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="preview-title" tabIndex={-1} className="bg-card text-card-foreground border border-border rounded-2xl w-full min-w-0 max-w-5xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 border-b border-border shrink-0 sm:flex-nowrap sm:gap-3 sm:px-5 sm:py-4">
          <h2 id="preview-title" className="min-w-0 flex-1 text-foreground font-semibold truncate text-sm">{file.filename}</h2>
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1.5 shrink-0 sm:gap-2">
            <Button
              size="sm"
              onClick={handleDownloadDecrypted}
              disabled={!decryptedBlob}
              className="bg-primary text-primary-foreground hover:bg-primary/90 border border-primary h-8 px-3 text-xs gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {t("coherence.preview.download", { defaultValue: "Download" })}
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("coherence.preview.close", { defaultValue: "Close preview" })}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto p-3 pr-2 min-h-0 scrollable-panel sm:p-5 sm:pr-2">
          {file.is_owner !== false && (
            <div className="mb-5">
              <button
                type="button"
                aria-expanded={trustExpanded}
                onClick={() => setTrustExpanded((prev) => !prev)}
                className="w-full text-left mb-2 group rounded-2xl border border-border bg-muted/60 px-3.5 py-3 hover:bg-muted transition-colors"
              >
                <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start gap-1.5 text-muted-foreground">
                        {trustExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform" />
                          : <ChevronRight className="w-3.5 h-3.5 shrink-0 transition-transform" />
                        }
                        <span className="min-w-0 break-words text-[11px] font-medium uppercase tracking-[0.08em] sm:tracking-[0.18em]">{t("coherence.preview.protection", { defaultValue: "Protection & History" })}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground">{t("coherence.preview.protectionHint", { defaultValue: "See how this file is protected, shared, and controlled." })}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t("coherence.preview.protectionSub", { defaultValue: "This keeps the trust story visible while you preview the file itself." })}</p>
                    </div>
                  </div>
                  <span className="inline-flex max-w-full self-start items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground sm:self-center">
                    {trustExpanded ? t("coherence.preview.hideDetails", { defaultValue: "Hide details" }) : t("coherence.preview.showDetails", { defaultValue: "Show details" })}
                  </span>
                </div>
              </button>
              {trustExpanded && (
                <div className="space-y-4">
                  <TrustRail key={`trust-${file.id}`} fileId={file.id} />
                  <FileSecurityTimeline key={`timeline-${file.id}`} fileId={file.id} />
                </div>
              )}
            </div>
          )}

          {file.is_owner === false && (
            <div className="mb-5 rounded-2xl border border-border bg-muted/60 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t("coherence.preview.shared", { defaultValue: "This file was shared with you." })}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t("coherence.preview.sharedLimits", { defaultValue: "The owner controls future downloads. Copies already downloaded cannot be recalled." })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {showCredentialPrompt && (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="bg-muted/60 border border-border rounded-2xl p-3 w-full min-w-0 max-w-sm space-y-4 sm:p-6">
                <div className="flex items-center gap-2 text-foreground">
                  <Lock className="w-5 h-5 text-primary" />
                  <span className="font-medium">
                    {credType === "password" ? t("coherence.preview.filePassword", { defaultValue: "Enter the original file password" }) : t("coherence.preview.enterPin", { defaultValue: "Enter your 4-digit PIN" })}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="preview-credential" className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    {credType === "password" ? t("coherence.preview.passwordLabel", { defaultValue: "File password" }) : "PIN"}
                  </label>
                  <input
                    id="preview-credential"
                    type="password"
                    autoComplete="new-password"
                    name="preview-file-credential"
                    data-lpignore="true"
                    inputMode={credType !== "password" ? "numeric" : undefined}
                    maxLength={credType !== "password" ? 4 : undefined}
                    value={credential}
                    onChange={(e) => setCredential(
                      credType !== "password"
                        ? e.target.value.replace(/\D/g, "").slice(0, 4)
                        : e.target.value
                    )}
                    placeholder={credType !== "password" ? "••••" : t("coherence.preview.passwordLabel", { defaultValue: "File password" })}
                    className={`w-full px-3 py-2 border rounded-lg bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none${credType !== "password" ? " text-center tracking-widest text-xl" : ""}`}
                    onKeyDown={(e) => { if (e.key === "Enter" && credential) handleCredentialSubmit(); }}
                  />
                </div>
                <Button
                  onClick={handleCredentialSubmit}
                  disabled={!credential || (credType !== "password" && credential.length !== 4)}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {t("coherence.preview.decrypt", { defaultValue: "Decrypt & Preview" })}
                </Button>
              </div>
            </div>
          )}

          {isLoading && (
            <div role="status" className="flex items-center justify-center min-h-[200px] text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mr-3" />
              {t("coherence.preview.decrypting", { defaultValue: "Decrypting…" })}
            </div>
          )}

          {loadError && !isLoading && (
            <div className="flex items-center justify-center mt-3" role="alert">
              <div className="flex flex-col items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm max-w-md text-center">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {loadError}
                </div>
                {loadFailureKind === "folder" && <Button onClick={onClose}>{t("coherence.preview.close", { defaultValue: "Close preview" })}</Button>}
                {loadFailureKind !== "credential" && loadFailureKind !== "folder" && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void loadPreview(credential)}
                    >
                      {t("coherence.preview.retry", { defaultValue: "Retry preview" })}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setLoadError("");
                        setShowCredentialPrompt(true);
                      }}
                    >
                      {t("coherence.preview.edit", { defaultValue: "Edit credential" })}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {!showCredentialPrompt && !isLoading && !loadError && (
            <>
              {decryptedBlob && (
                <details className="mb-5 rounded-2xl border border-border bg-muted/60 px-4 py-4 space-y-3"><summary className="cursor-pointer text-sm">{t("coherence.preview.localSignature", { defaultValue: "Local file signature" })}</summary>
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-foreground">{t("coherence.preview.localSignature", { defaultValue: "Local file signature" })}</span>
                    </div>
                    {isSignatureVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {t("coherence.preview.verified", { defaultValue: "VERIFIED" })}
                      </span>
                    ) : signatureB64 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                        {t("coherence.preview.invalid", { defaultValue: "INVALID / ALTERED" })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {t("coherence.preview.unsigned", { defaultValue: "UNSIGNED" })}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground space-y-2">
                    {isSignatureVerified ? (
                      <p>
                        {t("coherence.preview.signatureMatch", { defaultValue: "These bytes match the signature stored in this browser for your account key. This does not verify the sender’s identity or establish legal non-repudiation." })}
                      </p>
                    ) : signatureB64 ? (
                      <p className="text-destructive">
                        {t("coherence.preview.signatureMismatch", { defaultValue: "These bytes could not be verified against the locally stored signature. Check the original file before relying on it." })}
                      </p>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background p-3 rounded-xl border border-border">
                        <p className="max-w-md">
                          {t("coherence.preview.signatureAbsent", { defaultValue: "No signature is stored in this browser. A local signature lets this account check whether these bytes changed." })}
                        </p>
                        <Button
                          size="sm"
                          onClick={handleSignFile}
                          disabled={isSigning}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 self-start sm:self-center font-semibold"
                        >
                          {isSigning ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              {t("coherence.preview.signing", { defaultValue: "Signing..." })}
                            </>
                          ) : (
                            t("coherence.preview.sign", { defaultValue: "Sign locally" })
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  {signatureB64 && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        {t("coherence.preview.signature", { defaultValue: "Signature" })}: {signatureB64}
                      </p>
                    </div>
                  )}
                </details>
              )}
              {renderPreview()}
            </>
          )}
        </div>
      </div>
      {showSigningUnlock && <SigningUnlockDialog
        busy={isSigning}
        error={signingUnlockError}
        onCancel={() => { setShowSigningUnlock(false); setSigningUnlockError(""); }}
        onSubmit={(value) => { void handleSigningUnlock(value); }}
      />}
    </div>
  );
}

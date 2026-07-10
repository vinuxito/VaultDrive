import { useState, useEffect, useCallback } from "react";
import { X, Download, Loader2, AlertCircle, Lock, Key, ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { useSessionVault } from "../../context/SessionVaultContext";
import { API_URL } from "../../utils/api";
import { TrustRail } from "./TrustRail";
import { FileSecurityTimeline } from "./FileSecurityTimeline";
import { branding } from "../../config/branding";
import {
  decryptPrivateKeyWithPIN,
  importRSAPSSPrivateKey,
  importRSAPSSPublicKey,
  signWithRSAPSS,
  verifyWithRSAPSS,
} from "../../utils/crypto";
import { getStoredUserFromLocalStorage } from "../../utils/browser-storage";

export interface FileEntry {
  id: string;
  filename: string;
  metadata: string;
  is_owner?: boolean;
  pin_wrapped_key?: string | null;
}

interface FilePreviewModalProps {
  file: FileEntry | null;
  onClose: () => void;
  onDownload: () => void;
}



function getCredentialType(file: FileEntry): "password" | "pin" | "drop-pin" {
  const currentUser = getStoredUserFromLocalStorage() ?? {};
  if (file.pin_wrapped_key) return "drop-pin";
  if (file.is_owner === false) return "pin";
  if (currentUser.pin_set) return "pin";
  return "password";
}

export function FilePreviewModal({ file, onClose, onDownload }: FilePreviewModalProps) {
  const { getPrivateKey, getPrivateKeyPem, getCredential, setCredential: cacheCredential } = useSessionVault();

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [trustExpanded, setTrustExpanded] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [decryptedBlob, setDecryptedBlob] = useState<Blob | null>(null);
  const [credential, setCredential] = useState("");
  const [showCredentialPrompt, setShowCredentialPrompt] = useState(false);

  const [signatureB64, setSignatureB64] = useState<string | null>(null);
  const [isSignatureVerified, setIsSignatureVerified] = useState<boolean | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  const checkSignature = useCallback(async (dataBuffer: ArrayBuffer) => {
    if (!file) return;
    const storedSig = localStorage.getItem(`signature_${file.id}`);
    if (!storedSig) {
      setSignatureB64(null);
      setIsSignatureVerified(null);
      return;
    }
    setSignatureB64(storedSig);
    try {
      const userObj = getStoredUserFromLocalStorage();
      if (!userObj?.public_key) {
        setIsSignatureVerified(false);
        return;
      }
      const pubKey = await importRSAPSSPublicKey(userObj.public_key);
      const verified = await verifyWithRSAPSS(pubKey, storedSig, dataBuffer);
      setIsSignatureVerified(verified);
    } catch {
      setIsSignatureVerified(false);
    }
  }, [file]);

  const handleSignFile = async () => {
    if (!file || !decryptedBlob) return;
    setIsSigning(true);
    try {
      let pem = await getPrivateKeyPem();
      if (!pem) {
        const userObj = getStoredUserFromLocalStorage();
        const pinEncrypted = userObj?.private_key_pin_encrypted ?? null;
        if (pinEncrypted) {
          const cred = prompt("Please enter your PIN/Password to authorize digital signing:");
          if (cred) {
            pem = await decryptPrivateKeyWithPIN(cred, pinEncrypted);
          }
        }
      }
      if (!pem) throw new Error("Could not unlock private key for signing");
      const pssPrivKey = await importRSAPSSPrivateKey(pem);
      const buffer = await decryptedBlob.arrayBuffer();
      const sig = await signWithRSAPSS(pssPrivKey, buffer);
      localStorage.setItem(`signature_${file.id}`, sig);
      setSignatureB64(sig);
      setIsSignatureVerified(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Signing failed");
    } finally {
      setIsSigning(false);
    }
  };

  const loadPreview = useCallback(async (cred: string): Promise<boolean> => {
    if (!file) return false;
    setIsLoading(true);
    setLoadError("");
    try {
      let rawPrivateKeyPem: string | null = null;
      if (file.is_owner === false && !file.pin_wrapped_key) {
        rawPrivateKeyPem = await getPrivateKeyPem();
        if (!rawPrivateKeyPem) {
          const userObj = getStoredUserFromLocalStorage();
          const pinEncrypted = userObj?.private_key_pin_encrypted ?? null;
          if (pinEncrypted && cred) {
            rawPrivateKeyPem = await decryptPrivateKeyWithPIN(cred, pinEncrypted);
          }
        }
      }

      const authToken = localStorage.getItem("token") ?? "";
      const decryptedBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const worker = new Worker(
          new URL("../../workers/preview.worker.ts", import.meta.url),
          { type: "module" }
        );
        worker.onmessage = (e) => {
          if (e.data.success) {
            resolve(e.data.decryptedBuffer);
          } else {
            reject(new Error(e.data.error || "Decryption failed"));
          }
          worker.terminate();
        };
        worker.onerror = (err) => {
          reject(err);
          worker.terminate();
        };
        worker.postMessage({
          file,
          credential: cred,
          rawPrivateKeyPem,
          authToken,
          API_URL,
        });
      });

      const blob = new Blob([decryptedBuffer]);
      setDecryptedBlob(blob);
      await checkSignature(decryptedBuffer);

      const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
      const textTypes = ["txt", "md", "json", "csv", "xml", "html", "js", "ts", "py", "go", "sh"];

      if (textTypes.includes(ext)) {
        const text = await blob.text();
        setTextContent(text);
      } else {
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      }
      return true;
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to decrypt file");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [file, getPrivateKeyPem, checkSignature]);

  useEffect(() => {
    if (!file) return;
    setBlobUrl(null);
    setTextContent(null);
    setLoadError("");
    setDecryptedBlob(null);
    setCredential("");
    setTrustExpanded(file.is_owner !== false);

    const vaultKey = getPrivateKey();
    if (vaultKey && file.is_owner === false && !file.pin_wrapped_key) {
      setShowCredentialPrompt(false);
      loadPreview("");
    } else {
      const cached = getCredential();
      const credType = getCredentialType(file);
      if (cached && ((credType !== "password" && cached.type === "pin") || (credType === "password" && cached.type === "password"))) {
        setShowCredentialPrompt(false);
        loadPreview(cached.value);
      } else {
        setShowCredentialPrompt(true);
      }
    }
  }, [file, getPrivateKey, getCredential, loadPreview]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const handleCredentialSubmit = async () => {
    if (!credential) return;
    setShowCredentialPrompt(false);
    const ct = getCredentialType(file!);
    const success = await loadPreview(credential);
    if (success) {
      cacheCredential(credential, ct === "password" ? "password" : "pin");
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
        <pre className="text-sm text-white overflow-auto max-h-[70vh] p-4 bg-black/40 rounded whitespace-pre-wrap break-words">
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
          <iframe src={blobUrl} className="w-full h-[70vh] rounded-xl border border-white/10 bg-white/12" title="PDF Preview" />
        );
      }
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/75 gap-4">
        <p className="text-lg">Preview not available for this file type</p>
        <Button
          onClick={handleDownloadDecrypted}
          className="bg-white text-primary hover:bg-primary/10 font-semibold"
        >
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
      </div>
    );
  };

  if (!file) return null;

  const credType = getCredentialType(file);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <h2 className="text-white font-semibold truncate max-w-lg text-sm">{file.filename}</h2>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handleDownloadDecrypted}
              disabled={!decryptedBlob}
              className="bg-white/15 hover:bg-white/25 text-white border border-white/20 h-8 px-3 text-xs gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/15 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pr-2 min-h-0 scrollable-panel">
          {file.is_owner !== false && (
            <div className="mb-5">
              <button
                type="button"
                onClick={() => setTrustExpanded((prev) => !prev)}
                className="w-full text-left mb-2 group rounded-2xl border border-white/10 bg-white/12 px-3.5 py-3 hover:bg-white/18 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-300 shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-white/75">
                        {trustExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform" />
                          : <ChevronRight className="w-3.5 h-3.5 shrink-0 transition-transform" />
                        }
                        <span className="text-[11px] font-medium uppercase tracking-[0.18em]">Protection & History</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-white/90">See how this file is protected, shared, and controlled.</p>
                      <p className="mt-1 text-xs text-white/75">This keeps the trust story visible while you preview the file itself.</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/12 px-2.5 py-1 text-[11px] font-medium text-white/85 whitespace-nowrap">
                    {trustExpanded ? "Open" : "Show details"}
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
            <div className="mb-5 rounded-2xl border border-white/10 bg-white/12 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-300 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/90">This file was shared with you.</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/75">
                    {`The owner controls access, can revoke the share at any time, and ${branding.productName} still keeps the protected content unreadable outside the trusted decrypt flow.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {showCredentialPrompt && (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="bg-white/12 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
                <div className="flex items-center gap-2 text-white">
                  <Lock className="w-5 h-5 text-primary-foreground" />
                  <span className="font-medium">
                    {credType === "password" ? "Enter your file credential" : "Enter your 4-digit PIN"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="preview-credential" className="text-xs text-white/75 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    {credType === "password" ? "Credential" : "PIN"}
                  </label>
                  <input
                    id="preview-credential"
                    type="password"
                    inputMode={credType !== "password" ? "numeric" : undefined}
                    maxLength={credType !== "password" ? 4 : undefined}
                    value={credential}
                    onChange={(e) => setCredential(
                      credType !== "password"
                        ? e.target.value.replace(/\D/g, "").slice(0, 4)
                        : e.target.value
                    )}
                    placeholder={credType !== "password" ? "••••" : "Enter credential"}
                    className={`w-full px-3 py-2 border rounded-lg bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:outline-none${credType !== "password" ? " text-center tracking-widest text-xl" : ""}`}
                    onKeyDown={(e) => { if (e.key === "Enter" && credential) handleCredentialSubmit(); }}
                  />
                </div>
                <Button
                  onClick={handleCredentialSubmit}
                  disabled={!credential || (credType !== "password" && credential.length !== 4)}
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                >
                  Decrypt & Preview
                </Button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center min-h-[200px] text-white/75">
              <Loader2 className="w-8 h-8 animate-spin mr-3" />
              Decrypting…
            </div>
          )}

          {loadError && !isLoading && (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm max-w-md">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {loadError}
              </div>
            </div>
          )}

          {!showCredentialPrompt && !isLoading && !loadError && (
            <>
              {decryptedBlob && (
                <div className="mb-5 rounded-2xl border border-white/10 bg-white/12 px-4 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-white">Zero-Knowledge RSA-PSS Signature</span>
                    </div>
                    {isSignatureVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                        VERIFIED
                      </span>
                    ) : signatureB64 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                        INVALID / ALTERED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/60">
                        UNSIGNED
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-white/75 space-y-2">
                    {isSignatureVerified ? (
                      <p>
                        This decrypted content has been cryptographically signed locally using your RSA private key. The signature verification matches your public key 100% client-side, guaranteeing absolute document integrity and non-repudiation.
                      </p>
                    ) : signatureB64 ? (
                      <p className="text-red-400">
                        Warning: A digital signature was found but verification failed! The decrypted file data does not match the signature hash.
                      </p>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                        <p className="max-w-md">
                          This file does not have a local digital signature. You can sign this file locally with your ZK private key to establish a mathematical proof of authenticity.
                        </p>
                        <Button
                          size="sm"
                          onClick={handleSignFile}
                          disabled={isSigning}
                          className="bg-white hover:bg-white/90 text-slate-900 shrink-0 self-start sm:self-center font-semibold"
                        >
                          {isSigning ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              Signing...
                            </>
                          ) : (
                            "Sign File"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  {signatureB64 && (
                    <div className="pt-2 border-t border-white/5">
                      <p className="text-[10px] text-white/55 font-mono truncate">
                        Signature: {signatureB64}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {renderPreview()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

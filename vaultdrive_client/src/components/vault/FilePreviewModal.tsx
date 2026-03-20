import { useState, useEffect, useCallback } from "react";
import { X, Download, Loader2, AlertCircle, Lock, Key, ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { useSessionVault } from "../../context/SessionVaultContext";
import { API_URL } from "../../utils/api";
import { TrustRail } from "./TrustRail";
import { FileSecurityTimeline } from "./FileSecurityTimeline";
import {
  unwrapKey,
  hexToBytes,
  decryptPrivateKeyWithPIN,
  importRSAPrivateKey,
  unwrapKeyWithRSA,
  decryptFile,
  base64ToArrayBuffer,
  deriveKeyFromPassword,
} from "../../utils/crypto";

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

async function fetchAndDecryptBlob(
  file: FileEntry,
  credential: string,
  vaultKey: CryptoKey | null
): Promise<Blob> {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/files/${file.id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Failed to download file");

  const metaStr = response.headers.get("X-File-Metadata") ?? file.metadata;
  const metaObj: { iv?: string; salt?: string } = JSON.parse(metaStr);
  if (!metaObj.iv) throw new Error("Missing encryption IV");

  const iv = new Uint8Array(base64ToArrayBuffer(metaObj.iv));
  const isDropUpload = !metaObj.salt || metaObj.salt === "";
  const wrappedKeyB64 = response.headers.get("X-Wrapped-Key");
  let encryptionKey: CryptoKey;

  if (isDropUpload && file.pin_wrapped_key) {
    const rawKey = await unwrapKey(credential, file.pin_wrapped_key);
    const keyBytes = hexToBytes(rawKey);
    encryptionKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(keyBytes),
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  } else if (wrappedKeyB64 && file.is_owner === false) {
    let rsaKey: CryptoKey;
    if (vaultKey) {
      rsaKey = vaultKey;
    } else {
      const stored = localStorage.getItem("user");
      const userObj: { private_key_pin_encrypted?: string } | null = stored ? JSON.parse(stored) : null;
      const pinEncrypted = userObj?.private_key_pin_encrypted ?? null;
      if (!pinEncrypted) throw new Error("PIN-encrypted private key not found. Please re-set your PIN in Settings.");
      const pem = await decryptPrivateKeyWithPIN(credential, pinEncrypted);
      rsaKey = await importRSAPrivateKey(pem);
    }
    encryptionKey = await unwrapKeyWithRSA(rsaKey, wrappedKeyB64);
  } else {
    if (!metaObj.salt) throw new Error("Missing encryption salt");
    const salt = new Uint8Array(base64ToArrayBuffer(metaObj.salt));
    encryptionKey = await deriveKeyFromPassword(credential, salt, 100000);
  }

  const encryptedBlob = await response.blob();
  const encryptedData = await encryptedBlob.arrayBuffer();
  const decryptedData = await decryptFile(encryptedData, encryptionKey, iv);
  return new Blob([decryptedData]);
}

function getCredentialType(file: FileEntry): "password" | "pin" | "drop-pin" {
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  if (file.pin_wrapped_key) return "drop-pin";
  if (file.is_owner === false) return "pin";
  if (currentUser.pin_set) return "pin";
  return "password";
}

export function FilePreviewModal({ file, onClose, onDownload }: FilePreviewModalProps) {
  const { getPrivateKey, getCredential } = useSessionVault();

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [trustExpanded, setTrustExpanded] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [decryptedBlob, setDecryptedBlob] = useState<Blob | null>(null);
  const [credential, setCredential] = useState("");
  const [showCredentialPrompt, setShowCredentialPrompt] = useState(false);

  const loadPreview = useCallback(async (cred: string) => {
    if (!file) return;
    setIsLoading(true);
    setLoadError("");
    try {
      const blob = await fetchAndDecryptBlob(file, cred, getPrivateKey());
      setDecryptedBlob(blob);

      const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
      const textTypes = ["txt", "md", "json", "csv", "xml", "html", "js", "ts", "py", "go", "sh"];

      if (textTypes.includes(ext)) {
        const text = await blob.text();
        setTextContent(text);
      } else {
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to decrypt file");
    } finally {
      setIsLoading(false);
    }
  }, [file, getPrivateKey]);

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
    await loadPreview(credential);
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
        <pre className="text-sm text-white/90 overflow-auto max-h-[70vh] p-4 bg-black/40 rounded whitespace-pre-wrap break-words">
          {textContent}
        </pre>
      );
    }

    if (blobUrl) {
      if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
        return (
          <img
            src={blobUrl}
            alt={file.filename}
            className="max-h-[80vh] max-w-full object-contain mx-auto rounded"
          />
        );
      }
      if (ext === "pdf") {
        return <iframe src={blobUrl} className="w-full h-[75vh] rounded" title={file.filename} />;
      }
      if (["mp3", "m4a", "wav", "ogg", "flac"].includes(ext)) {
        return <audio controls src={blobUrl} className="w-full mt-4"><track kind="captions" /></audio>;
      }
      if (["mp4", "webm", "mov"].includes(ext)) {
        return (
          <video controls src={blobUrl} className="w-full max-h-[70vh] rounded"><track kind="captions" /></video>
        );
      }
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/60 gap-4">
        <p className="text-lg">Preview not available for this file type</p>
        <Button
          onClick={handleDownloadDecrypted}
          className="bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
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
      <div className="bg-[#1a0f0f] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <h2 className="text-white font-semibold truncate max-w-lg text-sm">{file.filename}</h2>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handleDownloadDecrypted}
              disabled={!decryptedBlob}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 h-8 px-3 text-xs gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5 min-h-0">
          {file.is_owner !== false && (
            <div className="mb-5">
              <button
                type="button"
                onClick={() => setTrustExpanded((prev) => !prev)}
                className="w-full text-left mb-2 group rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 hover:bg-white/[0.06] transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-300 shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-white/50">
                        {trustExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform" />
                          : <ChevronRight className="w-3.5 h-3.5 shrink-0 transition-transform" />
                        }
                        <span className="text-[11px] font-medium uppercase tracking-[0.18em]">Protection & History</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-white/88">See how this file is protected, shared, and controlled.</p>
                      <p className="mt-1 text-xs text-white/65">This keeps the trust story visible while you preview the file itself.</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/72 whitespace-nowrap">
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
            <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-300 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/88">This file was shared with you.</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/58">
                    The owner controls access, can revoke the share at any time, and ABRN Drive still keeps the protected content unreadable outside the trusted decrypt flow.
                  </p>
                </div>
              </div>
            </div>
          )}

          {showCredentialPrompt && (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
                <div className="flex items-center gap-2 text-white">
                  <Lock className="w-5 h-5 text-[#f2d7d8]" />
                  <span className="font-medium">
                    {credType === "password" ? "Enter your file credential" : "Enter your 4-digit PIN"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="preview-credential" className="text-xs text-white/60 flex items-center gap-1.5">
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
                    className={`w-full px-3 py-2 border rounded-lg bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/40 focus:outline-none${credType !== "password" ? " text-center tracking-widest text-xl" : ""}`}
                    onKeyDown={(e) => { if (e.key === "Enter" && credential) handleCredentialSubmit(); }}
                  />
                </div>
                <Button
                  onClick={handleCredentialSubmit}
                  disabled={!credential || (credType !== "password" && credential.length !== 4)}
                  className="w-full bg-[#7d4f50] hover:bg-[#6b4345] text-white"
                >
                  Decrypt & Preview
                </Button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center min-h-[200px] text-white/60">
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

          {!showCredentialPrompt && !isLoading && !loadError && renderPreview()}
        </div>
      </div>
    </div>
  );
}

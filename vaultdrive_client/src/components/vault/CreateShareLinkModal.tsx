import { useState } from "react";
import { X, Link2, Loader2, CheckCircle2, AlertCircle, Copy, Key } from "lucide-react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { API_URL } from "../../utils/api";
import {
  deriveKeyFromPassword,
  unwrapKey,
  hexToBytes,
  base64ToArrayBuffer,
  arrayBufferToBase64,
} from "../../utils/crypto";

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

export function CreateShareLinkModal({
  isOpen,
  onClose,
  file,
}: CreateShareLinkModalProps) {
  const isDropFile = !!file.pin_wrapped_key;
  const [credential, setCredential] = useState("");
  const [step, setStep] = useState<Step>("credential");
  const [shareUrl, setShareUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!credential) return;
    setStep("generating");
    setErrorMsg("");

    try {
      let aesKey: CryptoKey;

      if (isDropFile && file.pin_wrapped_key) {
        const rawHex = await unwrapKey(credential, file.pin_wrapped_key);
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
        aesKey = await deriveKeyFromPassword(credential, salt, 100000);
      }

      const rawKey = await crypto.subtle.exportKey("raw", aesKey);
      const b64Key = arrayBufferToBase64(rawKey);

      const authToken = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/${file.id}/share-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errData.error ?? "Failed to create share link");
      }

      const data = (await response.json()) as { token: string };
      const url = `https://abrndrive.filemonprime.net/share/${data.token}#${b64Key}`;
      setShareUrl(url);
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
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4 bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border-white/10 text-white">
        <CardHeader className="border-b border-white/10">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Link2 className="w-5 h-5 text-[#f2d7d8]" />
              Create Share Link
            </CardTitle>
            <button
              onClick={handleClose}
              className="text-white/50 hover:text-white/80 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <CardDescription className="text-white/70 truncate">
            {file.filename}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 py-4">
          {step === "credential" && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5 text-white/90">
                  <Key className="w-3.5 h-3.5" />
                  {isDropFile ? "4-digit PIN" : "Encryption Password"}
                </label>
                <p className="text-xs text-white/50">
                  {isDropFile
                    ? "Enter your PIN to decrypt the file key for embedding in the share link"
                    : "Enter your password to derive the file key for embedding in the share link"}
                </p>
                <input
                  type="password"
                  inputMode={isDropFile ? "numeric" : undefined}
                  maxLength={isDropFile ? 4 : undefined}
                  value={credential}
                  onChange={(e) =>
                    setCredential(
                      isDropFile
                        ? e.target.value.replace(/\D/g, "").slice(0, 4)
                        : e.target.value
                    )
                  }
                  placeholder={isDropFile ? "••••" : "Enter password"}
                  className={`w-full px-3 py-2 border rounded-md bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/40 focus:outline-none${
                    isDropFile ? " text-center tracking-widest text-xl" : ""
                  }`}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && credential) void handleGenerate();
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 border-2 border-white/40 text-white hover:bg-white/10 bg-transparent"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={isDropFile ? credential.length !== 4 : credential.length === 0}
                  className="flex-1 bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
                >
                  Generate Link
                </Button>
              </div>
            </>
          )}

          {step === "generating" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-8 h-8 animate-spin text-[#f2d7d8]" />
              <p className="text-sm text-white/80">Generating share link…</p>
            </div>
          )}

          {step === "done" && (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <p className="text-sm font-medium text-white">Share link created!</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/60">
                  Share URL (decryption key embedded after #)
                </label>
                <textarea
                  readOnly
                  value={shareUrl}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-md bg-white/10 border-white/20 text-white/90 text-xs resize-none focus:outline-none cursor-text"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </div>
              <div className="p-2.5 bg-amber-500/10 border border-amber-400/20 rounded-md">
                <p className="text-xs text-amber-200">
                  ⚠️ Anyone with this link can decrypt and download the file. The key after # is never sent to the server.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 border-2 border-white/40 text-white hover:bg-white/10 bg-transparent"
                >
                  Close
                </Button>
                <Button
                  onClick={handleCopy}
                  className="flex-1 bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold gap-1.5"
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
              <div className="flex items-start gap-2 p-3 bg-red-500/20 border border-red-400/30 rounded-md">
                <AlertCircle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{errorMsg}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 border-2 border-white/40 text-white hover:bg-white/10 bg-transparent"
                >
                  Close
                </Button>
                <Button
                  onClick={() => setStep("credential")}
                  className="flex-1 bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
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

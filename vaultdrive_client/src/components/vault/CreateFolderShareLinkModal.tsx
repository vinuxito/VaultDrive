import { useState } from "react";
import {
  X,
  FolderOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Key,
  Calendar,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { API_URL, BASE_PATH } from "../../utils/api";
import {
  generateFileKey,
  exportKey,
  importRSAPublicKey,
  importRSAPrivateKey,
  wrapKeyWithAES,
  wrapKeyWithRSA,
  decryptPrivateKeyWithPIN,
} from "../../utils/crypto";
import { useSessionVault } from "../../context/SessionVaultContext";
import { resolveFolderShareFileKey } from "../../utils/folder-share";

export interface CreateFolderShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: {
    id: string;
    name: string;
  };
  onCreated?: () => void;
  onUseUploadLink?: () => void;
}

type Step = "credential" | "generating" | "done" | "error" | "empty-folder";

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

export function CreateFolderShareLinkModal({
  isOpen,
  onClose,
  folder,
  onCreated,
  onUseUploadLink,
}: CreateFolderShareLinkModalProps) {
  const { getCredential } = useSessionVault();
  const cached = getCredential();
  const hasCachedPin = cached && cached.type === "pin";

  const [pin, setPin] = useState("");
  const [step, setStep] = useState<Step>("credential");
  const [shareUrl, setShareUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [expiryDays, setExpiryDays] = useState<ExpiryOption>(7);
  const [customDate, setCustomDate] = useState("");
  const [expiryDisplay, setExpiryDisplay] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [useCachedPin, setUseCachedPin] = useState(Boolean(hasCachedPin));

  const todayISO = new Date().toISOString().split("T")[0] ?? "";

  async function handleGenerate() {
    const usingCachedPin = Boolean(useCachedPin && cached?.type === "pin");
    const userPin = usingCachedPin ? cached!.value : pin;
    if (!userPin) return;
    setStep("generating");
    setErrorMsg("");

    try {
      const authToken = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      // 1. Decrypt owner's RSA private key with PIN
      if (!user.private_key_pin_encrypted) {
        throw new Error("PIN-encrypted private key not found. Set your PIN in Settings first.");
      }
      let privateKeyPem: string;
      try {
        privateKeyPem = await decryptPrivateKeyWithPIN(
          userPin,
          user.private_key_pin_encrypted
        );
      } catch (err) {
        if (usingCachedPin) {
          setUseCachedPin(false);
          setPin("");
          setErrorMsg("Your cached PIN could not unlock this folder share. Enter your current PIN and try again.");
          setStep("credential");
          return;
        }
        throw err;
      }
      const rsaPrivateKey = await importRSAPrivateKey(privateKeyPem);

      // 2. Get all files in the folder subtree
      const filesRes = await fetch(
        `${API_URL}/folders/${folder.id}/files-recursive`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (!filesRes.ok) {
        throw new Error("Failed to fetch folder files");
      }
      const filesData = (await filesRes.json()) as {
        files: Array<{ id: string; filename: string; encrypted_metadata: string }>;
        total_count: number;
      };

      if (filesData.total_count === 0) {
        setErrorMsg(
          `Folder Share only works after the folder already contains files. Use an upload link when you want someone else to send files into ${folder.name}.`,
        );
        setStep("empty-folder");
        return;
      }

      setProgress({ current: 0, total: filesData.total_count });

      // 3. Get wrapped keys for all files (batch)
      const fileIds = filesData.files.map((f) => f.id);
      const keysRes = await fetch(`${API_URL}/files/access-keys-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ file_ids: fileIds }),
      });
      if (!keysRes.ok) {
        throw new Error("Failed to fetch file access keys");
      }
      const wrappedKeysMap = (await keysRes.json()) as Record<string, string>;

      // 4. Generate folder share key
      const folderShareKey = await generateFileKey();
      if (!user.public_key) {
        throw new Error("Owner public key not found. Refresh and try again.");
      }
      const ownerPublicKey = await importRSAPublicKey(user.public_key);
      const ownerWrappedFolderKey = await wrapKeyWithRSA(ownerPublicKey, folderShareKey);

      // 5. For each file, unwrap RSA key then wrap with folder share key
      const folderWrappedKeys: Record<string, string> = {};
      let processed = 0;
      const fileMap = new Map(filesData.files.map((file) => [file.id, file]));

      for (const fileId of fileIds) {
        const wrappedKey = wrappedKeysMap[fileId];
        const fileEntry = fileMap.get(fileId);
        if (!wrappedKey || !fileEntry) continue;

        const fileAesKey = await resolveFolderShareFileKey({
          wrappedKey,
          encryptedMetadata: fileEntry.encrypted_metadata,
          credential: userPin,
          credentialType: "pin",
          rsaPrivateKey,
        });
        const wrappedWithFolderKey = await wrapKeyWithAES(
          folderShareKey,
          fileAesKey
        );
        folderWrappedKeys[fileId] = wrappedWithFolderKey;

        processed++;
        setProgress({ current: processed, total: filesData.total_count });
      }

      if (Object.keys(folderWrappedKeys).length === 0) {
        throw new Error("Could not wrap any file keys");
      }

      // 6. Create folder share link on server
      const expiresAtISO = computeExpiresAt(expiryDays, customDate);
      const displayDate = formatExpiryDisplay(expiresAtISO);

      const createRes = await fetch(
        `${API_URL}/folders/${folder.id}/share-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            expires_at: expiresAtISO,
            wrapped_keys: folderWrappedKeys,
            owner_wrapped_folder_key: ownerWrappedFolderKey,
          }),
        }
      );

      if (!createRes.ok) {
        const errData = (await createRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errData.error ?? "Failed to create folder share link");
      }

      const data = (await createRes.json()) as { token: string };

      // 7. Build share URL with folder share key in fragment
      const b64Key = await exportKey(folderShareKey);
      const url = `${window.location.origin}${BASE_PATH}/folder-share/${data.token}#${b64Key}`;
      setShareUrl(url);
      setExpiryDisplay(displayDate);
      setStep("done");
      onCreated?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to generate folder share link"
      );
      setStep("error");
    }
  }

  function handleCopy() {
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  }

  function handleClose() {
    setPin("");
    setStep("credential");
    setShareUrl("");
    setErrorMsg("");
    setCopied(false);
    setExpiryDays(7);
    setCustomDate("");
    setExpiryDisplay("");
    setProgress({ current: 0, total: 0 });
    setUseCachedPin(Boolean(hasCachedPin));
    onClose();
  }

  function resetStateForHandoff() {
    setPin("");
    setUseCachedPin(Boolean(hasCachedPin));
    setStep("credential");
    setShareUrl("");
    setErrorMsg("");
    setCopied(false);
    setExpiryDays(7);
    setCustomDate("");
    setExpiryDisplay("");
    setProgress({ current: 0, total: 0 });
  }

  function handleUseUploadLink() {
    resetStateForHandoff();
    onUseUploadLink?.();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4 bg-gradient-to-br from-primary to-primary/90 border-white/10 text-white">
        <CardHeader className="border-b border-white/10">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <FolderOpen className="w-5 h-5 text-primary-foreground" />
              Share Folder
            </CardTitle>
            <button
              type="button"
              onClick={handleClose}
              className="text-white/75 hover:text-white/85 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <CardDescription className="text-white/80 truncate">
            {folder.name}
          </CardDescription>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/12 px-3 py-3 text-xs leading-relaxed text-white/85">
            Share this folder and all its contents via a single link. Each
            file&apos;s key is wrapped with a folder key that travels in the URL
            fragment — the server never sees it.
          </div>
        </CardHeader>

        <CardContent className="space-y-4 py-4">
          {step === "credential" && (
            <>
              {errorMsg && (
                <div className="flex items-start gap-2 p-3 bg-red-500/20 border border-red-400/30 rounded-md">
                  <AlertCircle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{errorMsg}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5 text-white">
                  <Calendar className="w-3.5 h-3.5" />
                  Link Expiry
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {EXPIRY_PRESETS.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setExpiryDays(value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        expiryDays === value
                          ? "bg-white text-primary/90"
                          : "bg-white/15 text-white/85 hover:bg-white/25"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExpiryDays("custom")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      expiryDays === "custom"
                        ? "bg-white text-primary/90"
                        : "bg-white/15 text-white/85 hover:bg-white/25"
                    }`}
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
                    className="w-full px-3 py-2 border rounded-md bg-white/15 border-white/20 text-white text-sm focus:border-white/40 focus:outline-none"
                  />
                )}
              </div>

              {!useCachedPin && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="fsl-pin"
                    className="text-sm font-medium flex items-center gap-1.5 text-white"
                  >
                    <Key className="w-3.5 h-3.5" />
                    4-digit PIN
                  </label>
                  <p className="text-xs text-white/75">
                    Enter your PIN to unlock file keys for sharing
                  </p>
                  <input
                    id="fsl-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={(e) =>
                      setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="••••"
                    className="w-full px-3 py-2 border rounded-md bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:outline-none text-center tracking-widest text-xl"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && pin.length === 4)
                        void handleGenerate();
                    }}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="modal-cancel"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={
                    (!useCachedPin && pin.length !== 4) ||
                    (expiryDays === "custom" && customDate === "")
                  }
                  className="flex-1 bg-white text-primary hover:bg-primary/10 font-semibold"
                >
                  Generate Link
                </Button>
              </div>
            </>
          )}

          {step === "generating" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary-foreground" />
              <p className="text-sm text-white/85">
                {progress.total > 0
                  ? `Wrapping keys… ${progress.current}/${progress.total} files`
                  : "Preparing folder share…"}
              </p>
              {progress.total > 0 && (
                <div className="w-full bg-white/15 rounded-full h-1.5">
                  <div
                    className="bg-primary/10 h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.round(
                        (progress.current / progress.total) * 100
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {step === "empty-folder" && (
            <>
              <div className="rounded-2xl border border-amber-200/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-50">
                <p className="font-semibold text-white">This folder is empty right now</p>
                <p className="mt-2 leading-relaxed text-white/80">
                  Folder Share is for files that already exist in this folder. If your goal is to let someone upload into <strong>{folder.name}</strong>, create an upload link instead.
                </p>
              </div>

              <div className="rounded-xl bg-white/8 border border-white/15 p-3 text-sm text-white/85 space-y-1">
                <p className="font-medium">Use the upload flow instead</p>
                <p className="text-xs text-white/70 leading-relaxed">
                  Upload Links create a bounded sender route into this folder. The sender can deliver files without getting access to anything else in your vault.
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
                  onClick={handleUseUploadLink}
                  className="flex-1 bg-white text-primary hover:bg-primary/10 font-semibold"
                >
                  Create Upload Link Instead
                </Button>
              </div>
            </>
          )}

          {step === "done" && (
            <>
              <div className="brand-receipt-surface rounded-2xl px-4 py-4">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      Folder share link created
                    </p>
                    <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-300">
                      {progress.total} files included. Revocable at any time.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/12 border border-emerald-400/20 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="mt-3 space-y-1.5">
                  <p className="text-sm font-medium text-white">
                    Trust receipt
                  </p>
                  <p className="text-xs text-white/80 leading-relaxed">
                    Each file&apos;s key is individually wrapped with a folder
                    share key carried in the URL fragment after{" "}
                    <strong>#</strong>. The server stores wrapped keys but
                    cannot decrypt them.
                  </p>
                </div>
              </div>

              {expiryDisplay && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/12 border border-white/10 rounded-md">
                  <Calendar className="w-3.5 h-3.5 text-primary-foreground shrink-0" />
                  <p className="text-xs text-white/85">
                    Link expires:{" "}
                    <span className="font-medium text-white">
                      {expiryDisplay}
                    </span>
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="fsl-share-url"
                  className="text-xs text-white/75"
                >
                  Share URL (folder key embedded after #)
                </label>
                <textarea
                  id="fsl-share-url"
                  readOnly
                  value={shareUrl}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-md bg-white/15 border-white/20 text-white/90 text-xs resize-none focus:outline-none cursor-text"
                  onClick={(e) =>
                    (e.target as HTMLTextAreaElement).select()
                  }
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="modal-cancel"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={handleCopy}
                  className="flex-1 bg-white text-primary hover:bg-primary/10 font-semibold gap-1.5"
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
                  variant="modal-cancel"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setStep("credential");
                    if (cached?.type === "pin") {
                      setUseCachedPin(false);
                    }
                  }}
                  className="flex-1 bg-white text-primary hover:bg-primary/10 font-semibold"
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

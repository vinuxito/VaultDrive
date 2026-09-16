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
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation(["drive"]);
  const copy = (key: string, fallback: string) => {
    const value = t(key, { defaultValue: fallback });
    return value === key ? fallback : value;
  };
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
        throw new Error(
          "PIN-encrypted private key not found. Set your PIN in Settings first.",
        );
      }
      let privateKeyPem: string;
      try {
        privateKeyPem = await decryptPrivateKeyWithPIN(
          userPin,
          user.private_key_pin_encrypted,
          user.kek_envelope_version,
        );
      } catch (err) {
        if (usingCachedPin) {
          setUseCachedPin(false);
          setPin("");
          setErrorMsg(
            "Your cached PIN could not unlock this folder share. Enter your current PIN and try again.",
          );
          setStep("credential");
          return;
        }
        throw err;
      }
      const rsaPrivateKey = await importRSAPrivateKey(privateKeyPem);

      // 2. Get all files in the folder subtree
      const filesRes = await fetch(
        `${API_URL}/folders/${folder.id}/files-recursive`,
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
      if (!filesRes.ok) {
        throw new Error("Failed to fetch folder files");
      }
      const filesData = (await filesRes.json()) as {
        files: Array<{
          id: string;
          filename: string;
          encrypted_metadata: string;
        }>;
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
      const ownerWrappedFolderKey = await wrapKeyWithRSA(
        ownerPublicKey,
        folderShareKey,
      );

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
          fileAesKey,
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
        },
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
        err instanceof Error && err.message.trim()
          ? err.message
          : "Could not unlock this folder for sharing. Check your PIN and try again.",
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card
        className={cn(
          "w-full max-w-md border max-h-[calc(100dvh-2rem)] overflow-y-auto",
          "bg-card border-border text-foreground",
        )}
      >
        <CardHeader className={cn("border-b", "border-border")}>
          <div className="flex items-center justify-between">
            <CardTitle
              className={cn("flex items-center gap-2", "text-foreground")}
            >
              <FolderOpen className={cn("w-5 h-5", "text-primary")} />
              {copy("drive:transfers.folderShare.title", "Share Folder")}
            </CardTitle>
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                "transition-colors",
                "text-muted-foreground hover:text-foreground",
              )}
              aria-label={copy("drive:transfers.common.close", "Close")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <CardDescription className={"text-muted-foreground truncate"}>
            {folder.name}
          </CardDescription>
          <div
            className={cn(
              "mt-3 rounded-2xl border px-3 py-3 text-xs leading-relaxed",
              "bg-muted border-border text-muted-foreground",
            )}
          >
            {copy("drive:transfers.folderShare.description", "Share this folder and all its contents through one link. Each file key is wrapped with a folder key carried in the URL fragment; the server does not receive that key.")}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 py-4">
          {step === "credential" && (
            <>
              {errorMsg && (
                <div
                  className={cn(
                    "flex items-start gap-2 p-3 border rounded-md",
                    "bg-destructive/10 border-destructive/20 text-destructive",
                  )}
                >
                  <AlertCircle
                    className={cn(
                      "w-4 h-4 shrink-0 mt-0.5",
                      "text-destructive",
                    )}
                  />
                  <p className="text-sm">{errorMsg}</p>
                </div>
              )}

              <div className="space-y-2">
                <p
                  className={cn(
                    "text-sm font-medium flex items-center gap-1.5",
                    "text-foreground",
                  )}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {copy("drive:transfers.share.expiry", "Link Expiry")}
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
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/85",
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
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/85",
                    )}
                  >
                    {copy("drive:transfers.share.custom", "Custom")}
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
                      "bg-muted border-border text-foreground focus:border-primary",
                    )}
                  />
                )}
              </div>

              {!useCachedPin && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="fsl-pin"
                    className={cn(
                      "text-sm font-medium flex items-center gap-1.5",
                      "text-foreground",
                    )}
                  >
                    <Key className="w-3.5 h-3.5" />
                    {copy("drive:transfers.bulk.pinLabel", "4-digit PIN")}
                  </label>
                  <p className={cn("text-xs", "text-muted-foreground")}>
                    {copy("drive:transfers.folderShare.pinDescription", "Enter your PIN to unlock file keys for sharing")}
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
                    className={cn(
                      "w-full px-3 py-2 border rounded-md text-center tracking-widest text-xl focus:outline-none",
                      "bg-muted border-border text-foreground placeholder-muted-foreground focus:border-primary",
                    )}
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
                  className={cn("flex-1", "")}
                >
                  {copy("drive:transfers.common.cancel", "Cancel")}
                </Button>
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={
                    (!useCachedPin && pin.length !== 4) ||
                    (expiryDays === "custom" && customDate === "")
                  }
                  className={cn(
                    "flex-1 font-semibold",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {copy("drive:transfers.folderShare.generate", "Generate Link")}
                </Button>
              </div>
            </>
          )}

          {step === "generating" && (
            <div className="flex flex-col items-center gap-3 py-4" role="status" aria-live="polite" aria-busy="true">
              <Loader2 className={cn("w-8 h-8 animate-spin", "text-primary")} />
              <p className={cn("text-sm", "text-muted-foreground")}>
                {progress.total > 0
                  ? `${copy("drive:transfers.folderShare.wrapping", "Wrapping keys…")} ${progress.current}/${progress.total}`
                  : copy("drive:transfers.folderShare.preparing", "Preparing folder share…")}
              </p>
              {progress.total > 0 && (
                <div className={cn("w-full rounded-full h-1.5", "bg-muted")}>
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.round((progress.current / progress.total) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {step === "empty-folder" && (
            <>
              <div
                className={cn(
                  "rounded-2xl border px-4 py-4 text-sm",
                  "border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-100",
                )}
              >
                <p className="font-semibold text-amber-950 dark:text-amber-100">
                  {copy("drive:transfers.folderShare.emptyTitle", "This folder is empty right now")}
                </p>
                <p
                  className={cn(
                    "mt-2 leading-relaxed",
                    "text-amber-800 dark:text-amber-200",
                  )}
                >
                  {copy("drive:transfers.folderShare.emptyDescription", "Folder Share is for files that already exist here. To let someone upload into this folder, create an upload link instead.")}
                </p>
              </div>

              <div
                className={cn(
                  "rounded-xl border p-3 text-sm space-y-1",
                  "bg-muted border-border text-muted-foreground",
                )}
              >
                <p className={cn("font-medium", "text-foreground")}>
                  Use the upload flow instead
                </p>
                <p
                  className={cn(
                    "text-xs leading-relaxed",
                    "text-muted-foreground",
                  )}
                >
                  Upload Links create a bounded sender route into this folder.
                  The sender can deliver files without getting access to
                  anything else in your vault.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className={cn(
                    "flex-1 border-2 bg-transparent",
                    "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {copy("drive:transfers.common.close", "Close")}
                </Button>
                <Button
                  onClick={handleUseUploadLink}
                  className={cn(
                    "flex-1 font-semibold",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {copy("drive:transfers.folderShare.createUploadInstead", "Create Upload Link Instead")}
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
                      {copy("drive:transfers.folderShare.created", "Folder share link created")}
                    </p>
                    <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-300">
                      {progress.total} files included. Revocable at any time.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "p-4 border rounded-xl",
                  "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-100",
                )}
              >
                <CheckCircle2
                  className={cn("w-5 h-5 shrink-0", "text-emerald-600")}
                />
                <div className="mt-3 space-y-1.5">
                  <p className={cn("text-sm font-medium", "text-foreground")}>
                    {copy("drive:transfers.common.trustReceipt", "Trust receipt")}
                  </p>
                  <p
                    className={cn(
                      "text-xs leading-relaxed",
                      "text-muted-foreground",
                    )}
                  >
                    Each file&apos;s key is individually wrapped with a folder
                    share key carried in the URL fragment after{" "}
                    <strong>#</strong>. The server stores wrapped keys but
                    cannot decrypt them.
                  </p>
                </div>
              </div>

              {expiryDisplay && (
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 border rounded-md",
                    "bg-muted border-border",
                  )}
                >
                  <Calendar
                    className={cn("w-3.5 h-3.5 shrink-0", "text-primary")}
                  />
                  <p className={cn("text-xs", "text-muted-foreground")}>
                    Link expires:{" "}
                    <span className={cn("font-medium", "text-foreground")}>
                      {expiryDisplay}
                    </span>
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="fsl-share-url"
                  className={cn("text-xs", "text-muted-foreground")}
                >
                  {copy("drive:transfers.folderShare.urlLabel", "Share URL (folder key embedded after #)")}
                </label>
                <textarea
                  id="fsl-share-url"
                  readOnly
                  value={shareUrl}
                  rows={4}
                  className={cn(
                    "w-full px-3 py-2 border rounded-md text-xs resize-none focus:outline-none cursor-text",
                    "bg-muted border-border text-foreground",
                  )}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="modal-cancel"
                  onClick={handleClose}
                  className={cn("flex-1", "")}
                >
                  {copy("drive:transfers.common.close", "Close")}
                </Button>
                <Button
                  onClick={handleCopy}
                  className={cn(
                    "flex-1 font-semibold gap-1.5",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {copy("drive:transfers.common.copied", "Copied!")}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      {copy("drive:transfers.folderShare.copyLink", "Copy Link")}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === "error" && (
            <>
              <div
                className={cn(
                  "flex items-start gap-2 p-3 border rounded-md",
                  "bg-destructive/10 border-destructive/20 text-destructive",
                )}
              >
                <AlertCircle
                  className={cn("w-4 h-4 shrink-0 mt-0.5", "text-destructive")}
                />
                <p className="text-sm">{errorMsg}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="modal-cancel"
                  onClick={handleClose}
                  className={cn("flex-1", "")}
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
                  className={cn(
                    "flex-1 font-semibold",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
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

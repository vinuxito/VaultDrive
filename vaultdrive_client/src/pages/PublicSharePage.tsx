import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { API_URL } from "../utils/api";
import { decryptFile, base64ToArrayBuffer } from "../utils/crypto";
import BrandLogo from "../components/branding/brand-logo";
import { branding } from "../config/branding";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Download,
  Image as ImageIcon,
  FileText,
  File,
  Music,
  Video,
  Archive,
  Shield,
  Lock,
} from "lucide-react";

type PageState = "loading" | "ready" | "downloading" | "done" | "expired" | "error" | "locked" | "shredded";

interface ShareInfo {
  filename: string;
  file_size: number;
  expires_at: string | null;
  is_expired: boolean;
  owner_display_name: string | null;
  owner_organization: string | null;
  access_count: number;
  is_locked?: boolean;
  unlock_at?: string | null;
  max_downloads?: number;
  is_shredded?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatExpiry(expiresAt: string | null, t: any): string {
  if (!expiresAt) return t("drive:publicShare.noExpiry", "No expiry");
  const date = new Date(expiresAt);
  // Optional: We can keep the basic date string for now or pass format params
  return t("drive:publicShare.expiresOn", "Expires {{date}}", { 
    date: date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  });
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext))
    return ImageIcon;
  if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext)) return Music;
  if (["mp4", "mkv", "avi", "mov", "wmv", "webm"].includes(ext)) return Video;
  if (["zip", "tar", "gz", "rar", "7z", "bz2"].includes(ext)) return Archive;
  if (["pdf", "doc", "docx", "txt", "md", "rtf", "odt"].includes(ext)) return FileText;
  return File;
}

export default function PublicSharePage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation(["drive"]);
  const [state, setState] = useState<PageState>("loading");
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [savedFilename, setSavedFilename] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [decryptDuration, setDecryptDuration] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  const fetchInfo = async () => {
    try {
      if (!token) {
        setErrorMsg("Invalid share link — missing token");
        setState("error");
        return;
      }

      const hashRaw = window.location.hash;
      const hashKey = hashRaw.startsWith("#") ? hashRaw.slice(1) : hashRaw;

      if (!hashKey) {
        setErrorMsg("This share link is incomplete. Ask the sender to re-send the full link.");
        setState("error");
        return;
      }

      const response = await fetch(`${API_URL}/share/${token}/info`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Share link not found or has been revoked");
        }
        throw new Error(`Failed to fetch file info (${response.status})`);
      }

      const info = (await response.json()) as ShareInfo;

      if (info.is_shredded) {
        setState("shredded");
        return;
      }

      if (info.is_expired) {
        setState("expired");
        return;
      }

      if (info.is_locked) {
        setShareInfo(info);
        setState("locked");
        return;
      }

      setShareInfo(info);
      setState("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load file info");
      setState("error");
    }
  };

  useEffect(() => {
    void fetchInfo();
  }, [token]);

  useEffect(() => {
    if (state !== "locked" || !shareInfo?.unlock_at) return;

    const calculateTime = () => {
      const difference = new Date(shareInfo.unlock_at!).getTime() - Date.now();
      if (difference <= 0) {
        setTimeLeft(null);
        setState("loading");
        void fetchInfo();
        return false;
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds });
        return true;
      }
    };

    const hasTimeLeft = calculateTime();
    if (!hasTimeLeft) return;

    const interval = setInterval(() => {
      calculateTime();
    }, 1000);

    return () => clearInterval(interval);
  }, [state, shareInfo?.unlock_at]);

  async function handleDownload() {
    if (!token || !shareInfo) return;
    setState("downloading");

    try {
      const hashRaw = window.location.hash;
      const hashKey = hashRaw.startsWith("#") ? hashRaw.slice(1) : hashRaw;

      const response = await fetch(`${API_URL}/share/${token}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Share link not found or has been revoked");
        }
        throw new Error(`Failed to fetch file (${response.status})`);
      }

      const fileNameHeader = response.headers.get("X-File-Name") ?? shareInfo.filename;
      const metadataHeader = response.headers.get("X-File-Metadata");

      if (!metadataHeader) {
        throw new Error("This file is unavailable");
      }

      const metadata = JSON.parse(metadataHeader) as { iv: string; salt?: string };

      if (!metadata.iv) {
        throw new Error("Missing encryption IV in file metadata");
      }

      const iv = new Uint8Array(base64ToArrayBuffer(metadata.iv));

      const rawKeyBuf = base64ToArrayBuffer(hashKey);
      const aesKey = await crypto.subtle.importKey(
        "raw",
        rawKeyBuf,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );

      const encryptedBlob = await response.blob();
      const encryptedData = await encryptedBlob.arrayBuffer();

      const start = performance.now();
      const decryptedData = await decryptFile(encryptedData, aesKey, iv);
      const duration = performance.now() - start;
      setDecryptDuration(duration);

      const decryptedBlob = new Blob([decryptedData]);
      const blobUrl = window.URL.createObjectURL(decryptedBlob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileNameHeader;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);

      setSavedFilename(fileNameHeader);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to decrypt file");
      setState("error");
    }
  }

  const FileIconComponent = shareInfo ? getFileIcon(shareInfo.filename) : File;

  return (
    <div className="min-h-screen bg-card flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-2">
          <div className="flex justify-center mb-3">
            <BrandLogo className="h-12 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-white">{branding.productName}</h1>
          <p className="text-white/80 text-sm">{t("drive:publicShare.secureShare", "Secure File Share")}</p>
        </div>

        <div className="bg-gradient-to-br from-primary to-primary/90 rounded-2xl shadow-2xl border border-white/10 p-8 text-white">
          {state === "loading" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary-foreground" />
              <p className="text-white/90">{t("drive:publicShare.verifying", "Verifying share link…")}</p>
            </div>
          )}

          {state === "ready" && shareInfo && (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-14 h-14 rounded-xl bg-white/15 flex items-center justify-center border border-white/15">
                  <FileIconComponent className="w-7 h-7 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="font-semibold text-white leading-snug truncate"
                    title={shareInfo.filename}
                  >
                    {shareInfo.filename}
                  </p>
                  <p className="text-sm text-white/80 mt-0.5">
                    {formatFileSize(shareInfo.file_size)}
                  </p>
                  <p className="text-xs text-white/80 mt-1">
                    {formatExpiry(shareInfo.expires_at, t)}
                  </p>
                </div>
              </div>

              {shareInfo.owner_display_name && (
                <div className="flex items-center gap-2.5 text-sm text-white/80">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold text-white/85 shrink-0">
                    {shareInfo.owner_display_name.charAt(0).toUpperCase()}
                  </div>
                  <span>
                    {t("drive:publicShare.sharedBy", "Shared by")}{" "}
                    <span className="text-white/90 font-medium">
                      {shareInfo.owner_display_name}
                    </span>
                    {shareInfo.owner_organization && (
                      <span className="text-white/80">
                        {" "}
                        · {shareInfo.owner_organization}
                      </span>
                    )}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-2.5 bg-white/15 rounded-lg border border-white/10">
                <Shield className="w-4 h-4 text-primary-foreground shrink-0" />
                <p className="text-xs text-white/85">
                  {t("drive:publicShare.e2eInfo", "End-to-end encrypted · Key never leaves your browser")}
                </p>
              </div>

              {shareInfo.max_downloads === 1 && (
                branding.productSlug.includes("quantix") ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-orange-950/40 border border-orange-500/30 rounded-lg text-orange-400 animate-pulse font-mono text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 text-orange-400" />
                    <span>{t("drive:publicShare.autoShredWarning", "Caution: This file will auto-shred after your download completes.")}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-950/20 border border-rose-800/30 rounded-lg text-rose-300 text-xs">
                    <Shield className="w-4 h-4 shrink-0 text-rose-450 animate-pulse text-rose-400" />
                    <span>{t("drive:publicShare.autoShredWarning", "Caution: This file will auto-shred after your download completes.")}</span>
                  </div>
                )
              )}

              <button
                type="button"
                onClick={() => void handleDownload()}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-white text-primary/90 font-semibold rounded-xl hover:bg-primary/10 transition-colors cursor-pointer"
              >
                <Download className="w-5 h-5" />
                {t("drive:publicShare.download", "Download File")}
              </button>
            </div>
          )}

          {state === "locked" && shareInfo && (
            branding.productSlug.includes("quantix") ? (
              <div className="flex flex-col items-center gap-6 py-4 text-center">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-16 h-16 bg-orange-500/20 rounded-full animate-ping" />
                  <Lock className="w-12 h-12 text-orange-500 relative z-10 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-lg font-bold text-white tracking-wide font-mono uppercase">
                    {t("drive:publicShare.lockedTitle", "LINK TIME-LOCKED")}
                  </h2>
                  
                  {timeLeft && (
                    <div className="text-2xl font-mono tracking-widest text-orange-400 bg-black/40 px-4 py-2 rounded-lg border border-orange-500/30 drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]">
                      {String(timeLeft.days).padStart(2, '0')}D : {String(timeLeft.hours).padStart(2, '0')}H : {String(timeLeft.minutes).padStart(2, '0')}M : {String(timeLeft.seconds).padStart(2, '0')}S
                    </div>
                  )}

                  <p className="text-xs text-white/70 max-w-xs mx-auto leading-relaxed">
                    {t("drive:publicShare.lockedDesc", "This file is secure and will be available to download once the lock duration expires.")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 py-4 text-center">
                <div className="relative w-24 h-24 flex items-center justify-center bg-white/5 rounded-full border border-white/10 shadow-inner">
                  <svg className="w-20 h-20 text-zinc-300" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-40" />
                    {[...Array(12)].map((_, i) => {
                      const angle = (i * 30 * Math.PI) / 180;
                      const x1 = 50 + 38 * Math.sin(angle);
                      const y1 = 50 - 38 * Math.cos(angle);
                      const x2 = 50 + 42 * Math.sin(angle);
                      const y2 = 50 - 42 * Math.cos(angle);
                      return (
                        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="2" className="opacity-50" />
                      );
                    })}
                    <line
                      x1="50"
                      y1="50"
                      x2="50"
                      y2="28"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      transform={`rotate(${timeLeft ? ((timeLeft.hours % 12) * 30 + timeLeft.minutes * 0.5) : 0} 50 50)`}
                      className="transition-transform duration-500 ease-out"
                    />
                    <line
                      x1="50"
                      y1="50"
                      x2="50"
                      y2="18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      transform={`rotate(${timeLeft ? (timeLeft.minutes * 6) : 0} 50 50)`}
                      className="transition-transform duration-500 ease-out"
                    />
                    <line
                      x1="50"
                      y1="50"
                      x2="50"
                      y2="15"
                      stroke="#f43f5e"
                      strokeWidth="1"
                      strokeLinecap="round"
                      transform={`rotate(${timeLeft ? (timeLeft.seconds * 6) : 0} 50 50)`}
                    />
                    <circle cx="50" cy="50" r="3" fill="currentColor" />
                  </svg>
                </div>
                
                <div className="space-y-3">
                  <h2 className="text-lg font-medium text-zinc-100 tracking-normal">
                    {t("drive:publicShare.lockedTitle", "Time-Locked Release")}
                  </h2>

                  {timeLeft && (
                    <div className="text-xl font-light text-zinc-300 tracking-wide font-sans bg-zinc-900/40 px-5 py-2.5 rounded-full border border-white/5 shadow-lg inline-block">
                      {timeLeft.days > 0 && <span>{timeLeft.days}d </span>}
                      <span>{String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}</span>
                    </div>
                  )}

                  <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                    {t("drive:publicShare.lockedDesc", "This file is secure and will be available to download once the lock duration expires.")}
                  </p>
                </div>
              </div>
            )
          )}

          {state === "shredded" && (
            branding.productSlug.includes("quantix") ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center animate-pulse">
                <div className="relative">
                  <Shield className="w-16 h-16 text-red-500 opacity-80" />
                  <span className="absolute inset-0 flex items-center justify-center text-red-500 font-bold text-lg select-none">
                    [X]
                  </span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-extrabold text-red-400 tracking-wider font-mono uppercase">
                    ⚠ KEY_SHREDDED ⚠
                  </h2>
                  <p className="text-sm text-red-300 font-mono">
                    {t("drive:publicShare.shreddedDesc", "As a single-use secure link, the decryption key for this file has been permanently deleted from the server after its first download.")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <Shield className="w-12 h-12 text-zinc-400" />
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-zinc-200">
                    {t("drive:publicShare.shreddedTitle", "This link has been shredded")}
                  </h2>
                  <p className="text-sm max-w-sm leading-relaxed text-zinc-400">
                    {t("drive:publicShare.shreddedDesc", "As a single-use secure link, the decryption key for this file has been permanently deleted from the server after its first download.")}
                  </p>
                </div>
              </div>
            )
          )}

          {state === "downloading" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary-foreground" />
              <div>
                <p className="text-white/85 font-medium">{t("drive:publicShare.decrypting", "Decrypting…")}</p>
                <p className="text-xs text-white/80 mt-1">
                  {t("drive:publicShare.decryptingDesc", "Decryption happens entirely in your browser")}
                </p>
              </div>
            </div>
          )}

          {state === "done" && (
            <div className="flex flex-col items-center gap-4 py-2 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              <div>
                <p className="text-lg font-semibold text-white">{t("drive:publicShare.doneTitle", "File Decrypted & Saved!")}</p>
                {savedFilename && (
                  <p className="text-sm text-white/80 mt-1 break-all">{savedFilename}</p>
                )}
              </div>
              
              <div className="w-full text-left bg-black/30 backdrop-blur-md border border-white/10 rounded-lg p-4 font-mono text-xs space-y-2 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold uppercase tracking-wider">{t("drive:publicShare.zkp", "Zero-Knowledge Proof")}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-zinc-500">{t("drive:publicShare.algo", "Algorithm:")}</span>
                    <span>AES-256-GCM</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-zinc-500">{t("drive:publicShare.keySource", "Key Source:")}</span>
                    <span>URL fragment (Local)</span>
                  </div>
                  {decryptDuration !== null && (
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-zinc-500">{t("drive:publicShare.performance", "Performance:")}</span>
                      <span className="text-emerald-400">⚡ {decryptDuration.toFixed(0)}ms</span>
                    </div>
                  )}
                  <div className="text-xs text-zinc-500 mt-2 italic border-l-2 border-emerald-500/30 pl-2">
                    {t("drive:publicShare.zkpDesc", "Server never saw the encryption key. Decryption happened entirely on this device.")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {state === "expired" && (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <Clock className="w-12 h-12 text-amber-400" />
              <div>
                <p className="text-lg font-semibold text-white">{t("drive:publicShare.expiredTitle", "This link has expired")}</p>
                <p className="text-sm text-white/80 mt-2">
                  {t("drive:publicShare.expiredDesc", "This share link is no longer valid.")}
                </p>
                <p className="text-sm text-white/80 mt-1">
                  {t("drive:publicShare.expiredContact", "Contact the file owner to request a new link.")}
                </p>
              </div>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <div>
                <p className="text-lg font-semibold text-white">{t("drive:publicShare.errorTitle", "Something went wrong")}</p>
                <p className="text-sm text-red-300 mt-2 break-words">{errorMsg}</p>
              </div>
              <p className="text-xs text-white/80">
                {t("drive:publicShare.errorDesc", "Make sure you have the complete share link, including the key after #.")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

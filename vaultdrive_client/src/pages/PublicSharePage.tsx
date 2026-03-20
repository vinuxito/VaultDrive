import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_URL } from "../utils/api";
import { decryptFile, base64ToArrayBuffer } from "../utils/crypto";
import ABRNLogo from "../components/branding/abrn-logo";
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
} from "lucide-react";

type PageState = "loading" | "ready" | "downloading" | "done" | "expired" | "error";

interface ShareInfo {
  filename: string;
  file_size: number;
  expires_at: string | null;
  is_expired: boolean;
  owner_display_name: string | null;
  owner_organization: string | null;
  access_count: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "No expiry";
  const date = new Date(expiresAt);
  return `Expires ${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
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
  const [state, setState] = useState<PageState>("loading");
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [savedFilename, setSavedFilename] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    async function fetchInfo() {
      try {
        if (!token) {
          setErrorMsg("Invalid share link — missing token");
          setState("error");
          return;
        }

        const hashRaw = window.location.hash;
        const hashKey = hashRaw.startsWith("#") ? hashRaw.slice(1) : hashRaw;

        if (!hashKey) {
          setErrorMsg("Invalid share link — missing decryption key");
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

        if (info.is_expired) {
          setState("expired");
          return;
        }

        setShareInfo(info);
        setState("ready");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load file info");
        setState("error");
      }
    }

    void fetchInfo();
  }, [token]);

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
        throw new Error("Missing file metadata in server response");
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

      const decryptedData = await decryptFile(encryptedData, aesKey, iv);

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
    <div className="min-h-screen bg-[#2a1f1f] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-2">
          <div className="flex justify-center mb-3">
            <ABRNLogo className="h-12 object-contain" alt="ABRN Drive" />
          </div>
          <h1 className="text-xl font-bold text-white">ABRN Drive</h1>
          <p className="text-white/70 text-sm">Secure File Share</p>
        </div>

        <div className="bg-gradient-to-br from-[#7d4f50] to-[#6b4345] rounded-2xl shadow-2xl border border-white/10 p-8 text-white">
          {state === "loading" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 className="w-10 h-10 animate-spin text-[#f2d7d8]" />
              <p className="text-white/85">Loading file info…</p>
            </div>
          )}

          {state === "ready" && shareInfo && (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center border border-white/15">
                  <FileIconComponent className="w-7 h-7 text-[#f2d7d8]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="font-semibold text-white leading-snug truncate"
                    title={shareInfo.filename}
                  >
                    {shareInfo.filename}
                  </p>
                  <p className="text-sm text-white/75 mt-0.5">
                    {formatFileSize(shareInfo.file_size)}
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    {formatExpiry(shareInfo.expires_at)}
                  </p>
                </div>
              </div>

              {shareInfo.owner_display_name && (
                <div className="flex items-center gap-2.5 text-sm text-white/70">
                  <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-[11px] font-bold text-white/80 shrink-0">
                    {shareInfo.owner_display_name.charAt(0).toUpperCase()}
                  </div>
                  <span>
                    Shared by{" "}
                    <span className="text-white/90 font-medium">
                      {shareInfo.owner_display_name}
                    </span>
                    {shareInfo.owner_organization && (
                      <span className="text-white/65">
                        {" "}
                        · {shareInfo.owner_organization}
                      </span>
                    )}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 rounded-lg border border-white/10">
                <Shield className="w-4 h-4 text-[#f2d7d8] shrink-0" />
                <p className="text-xs text-white/80">
                  End-to-end encrypted · Key never leaves your browser
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleDownload()}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-white text-[#6b4345] font-semibold rounded-xl hover:bg-[#f2d7d8] transition-colors cursor-pointer"
              >
                <Download className="w-5 h-5" />
                Download File
              </button>
            </div>
          )}

          {state === "downloading" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-[#f2d7d8]" />
              <div>
                <p className="text-white/80 font-medium">Decrypting…</p>
                <p className="text-xs text-white/65 mt-1">
                  Decryption happens entirely in your browser
                </p>
              </div>
            </div>
          )}

          {state === "done" && (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              <div>
                <p className="text-lg font-semibold text-white">File saved!</p>
                {savedFilename && (
                  <p className="text-sm text-white/70 mt-1 break-all">{savedFilename}</p>
                )}
              </div>
              <p className="text-xs text-white/65">
                The file was saved to your device.
              </p>
            </div>
          )}

          {state === "expired" && (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <Clock className="w-12 h-12 text-amber-400" />
              <div>
                <p className="text-lg font-semibold text-white">This link has expired</p>
                <p className="text-sm text-white/75 mt-2">
                  The share link is no longer valid. Ask the sender for a new link.
                </p>
              </div>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <div>
                <p className="text-lg font-semibold text-white">Something went wrong</p>
                <p className="text-sm text-red-300 mt-2 break-words">{errorMsg}</p>
              </div>
              <p className="text-xs text-white/65">
                Make sure you have the complete share link, including the key after #.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

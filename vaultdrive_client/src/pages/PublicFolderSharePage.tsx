import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { API_URL } from "../utils/api";
import { useSessionVault } from "../context/SessionVaultContext";
import {
  decryptFile,
  base64ToArrayBuffer,
  importKey,
  unwrapKeyWithAES,
} from "../utils/crypto";
import BrandLogo from "../components/branding/brand-logo";
import JSZip from "jszip";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Download,
  FolderOpen,
  File,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  Archive,
  Shield,
  ChevronRight,
  ChevronDown,
  Package,
  RefreshCw,
} from "lucide-react";
import { syncFolderShareLinkById, type SyncableFolderShareLink } from "../utils/folder-share-sync";
import { branding } from "../config/branding";
import {
  canRepairFolderShareLink,
  findOwnedFolderShareLink,
  getFolderShareRepairLabel,
} from "../utils/folder-share-repair";

type PageState = "loading" | "ready" | "downloading" | "done" | "expired" | "error";

interface SharedFileEntry {
  id: string;
  filename: string;
  file_size: number;
  encrypted_metadata: string;
  folder_id: string;
}

interface SharedFolderNode {
  id: string;
  name: string;
  files: SharedFileEntry[];
  subfolders: SharedFolderNode[];
}

interface FolderShareInfo {
  folder_name: string;
  owner_display_name: string;
  owner_organization: string;
  expires_at: string | null;
  is_expired: boolean;
  access_count: number;
  tree: SharedFolderNode;
  total_files: number;
  total_size: number;
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
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) return ImageIcon;
  if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext)) return Music;
  if (["mp4", "mkv", "avi", "mov", "wmv", "webm"].includes(ext)) return Video;
  if (["zip", "tar", "gz", "rar", "7z", "bz2"].includes(ext)) return Archive;
  if (["pdf", "doc", "docx", "txt", "md", "rtf", "odt"].includes(ext)) return FileText;
  return File;
}

function FolderTreeNode({
  node,
  path,
  onDownloadFile,
  downloadingFileId,
}: {
  node: SharedFolderNode;
  path: string;
  onDownloadFile: (fileId: string, filename: string) => void;
  downloadingFileId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasContent = node.files.length > 0 || node.subfolders.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
      >
        {hasContent ? (
          expanded ? (
            <ChevronDown className="w-4 h-4 text-white/50 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/50 shrink-0" />
          )
        ) : (
          <div className="w-4 h-4" />
        )}
        <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-sm font-medium text-white truncate">{node.name}</span>
        {node.files.length > 0 && (
          <span className="text-xs text-white/50 shrink-0">
            {node.files.length} file{node.files.length !== 1 ? "s" : ""}
          </span>
        )}
      </button>

      {expanded && (
        <div className="ml-6 border-l border-white/10 pl-2">
          {node.files.map((file) => {
            const FileIcon = getFileIcon(file.filename);
            const isDownloading = downloadingFileId === file.id;
            return (
              <div
                key={file.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
              >
                <FileIcon className="w-4 h-4 text-primary-foreground shrink-0" />
                <span className="flex-1 text-sm text-white/80 truncate" title={file.filename}>
                  {file.filename}
                </span>
                <span className="text-xs text-white/40 shrink-0">
                  {formatFileSize(file.file_size)}
                </span>
                <button
                  type="button"
                  onClick={() => onDownloadFile(file.id, file.filename)}
                  disabled={isDownloading}
                  className="shrink-0 p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                  title="Download"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })}

          {node.subfolders.map((subfolder) => (
            <FolderTreeNode
              key={subfolder.id}
              node={subfolder}
              path={`${path}/${subfolder.name}`}
              onDownloadFile={onDownloadFile}
              downloadingFileId={downloadingFileId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PublicFolderSharePage() {
  const { token } = useParams<{ token: string }>();
  const sessionVault = useSessionVault();
  const [state, setState] = useState<PageState>("loading");
  const [shareInfo, setShareInfo] = useState<FolderShareInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [wrappedKeys, setWrappedKeys] = useState<Record<string, string>>({});
  const [folderShareKey, setFolderShareKey] = useState<CryptoKey | null>(null);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0 });
  const [ownedLink, setOwnedLink] = useState<SyncableFolderShareLink | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairMessage, setRepairMessage] = useState("");
  const [ownerCredentialInput, setOwnerCredentialInput] = useState("");

  const currentUser = useMemo(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) as {
      pin_set?: boolean;
      private_key_encrypted?: string | null;
      private_key_pin_encrypted?: string | null;
      public_key?: string | null;
    } : null;
  }, []);

  const refreshShareData = useCallback(async () => {
    if (!token) {
      return;
    }

    const response = await fetch(`${API_URL}/folder-share/${token}/info`);
    if (!response.ok) {
      throw new Error(`Failed to fetch folder info (${response.status})`);
    }

    const info = (await response.json()) as FolderShareInfo;
    if (info.is_expired) {
      setState("expired");
      return;
    }

    setShareInfo(info);
    const keysRes = await fetch(`${API_URL}/folder-share/${token}/keys`);
    if (keysRes.ok) {
      const keys = (await keysRes.json()) as Record<string, string>;
      setWrappedKeys(keys);
    }
  }, [token]);

  useEffect(() => {
    async function fetchInfo() {
      try {
        if (!token) {
          setErrorMsg("Invalid folder share link — missing token");
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

        // Import the folder share key from URL fragment
        const key = await importKey(hashKey);
        setFolderShareKey(key);

        await refreshShareData();

        setState("ready");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load folder info");
        setState("error");
      }
    }

    void fetchInfo();
  }, [refreshShareData, token]);

  useEffect(() => {
    async function detectOwnedLink() {
      const authToken = localStorage.getItem("token");
      if (!authToken || !token) {
        setOwnedLink(null);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/folder-share-links`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!response.ok) {
          setOwnedLink(null);
          return;
        }

        const links = (await response.json()) as SyncableFolderShareLink[];
        setOwnedLink(findOwnedFolderShareLink(links, token));
      } catch {
        setOwnedLink(null);
      }
    }

    void detectOwnedLink();
  }, [token]);

  async function handleRepairLink() {
    const authToken = localStorage.getItem("token");
    const credential = sessionVault.getCredential() ?? (
      ownerCredentialInput.trim()
        ? {
            value: ownerCredentialInput.trim(),
            type: currentUser?.pin_set ? "pin" : "password",
          }
        : null
    );

    if (!ownedLink || !authToken || !credential) {
      setRepairMessage(currentUser?.pin_set
        ? "Enter your current PIN to repair this link."
        : "Enter your current password to repair this link.");
      return;
    }

    setRepairing(true);
    setRepairMessage("");
    try {
      const result = await syncFolderShareLinkById({
        link: ownedLink,
        authToken,
        credential,
        cachedPrivateKey: sessionVault.getPrivateKey(),
        currentUser,
        providedShareUrl: window.location.href,
      });

      const message = result.syncedFiles > 0
        ? `${result.upgraded ? "Upgraded and updated" : "Updated"} this shared link with ${result.syncedFiles} new file${result.syncedFiles === 1 ? "" : "s"}.`
        : result.upgraded
          ? "Upgraded this shared link for future automatic updates."
          : "This shared link is already up to date.";

      if (result.upgraded && !ownedLink.owner_wrapped_folder_key) {
        setOwnedLink({ ...ownedLink, owner_wrapped_folder_key: "stored" });
      }

      sessionVault.setCredential(credential.value, credential.type);
      await refreshShareData();
      setRepairMessage(message);
    } catch (err) {
      setRepairMessage(err instanceof Error ? err.message : "Failed to repair this shared link.");
    } finally {
      setRepairing(false);
    }
  }

  const handleDownloadFile = useCallback(
    async (fileId: string, filename: string) => {
      if (!token || !folderShareKey) return;
      setDownloadingFileId(fileId);

      try {
        const wrappedKey = wrappedKeys[fileId];
        if (!wrappedKey) {
          throw new Error("File key not found");
        }

        // Unwrap the file's AES key using the folder share key
        const fileKey = await unwrapKeyWithAES(folderShareKey, wrappedKey);

        // Fetch encrypted file
        const response = await fetch(`${API_URL}/folder-share/${token}/file/${fileId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch file (${response.status})`);
        }

        const metadataHeader = response.headers.get("X-File-Metadata");
        if (!metadataHeader) {
          throw new Error("Missing file metadata");
        }

        const metadata = JSON.parse(metadataHeader) as { iv: string };
        const iv = new Uint8Array(base64ToArrayBuffer(metadata.iv));

        const encryptedBlob = await response.blob();
        const encryptedData = await encryptedBlob.arrayBuffer();

        const decryptedData = await decryptFile(encryptedData, fileKey, iv);

        // Trigger download
        const blob = new Blob([decryptedData]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (err) {
        // Show error inline without breaking ready state for single-file failures
        alert(err instanceof Error ? err.message : "Failed to download file");
      } finally {
        setDownloadingFileId(null);
      }
    },
    [token, folderShareKey, wrappedKeys]
  );

  async function handleDownloadAll() {
    if (!token || !folderShareKey || !shareInfo) return;
    setState("downloading");

    try {
      const zip = new JSZip();
      const allFiles: Array<{ file: SharedFileEntry; path: string }> = [];

      // Collect all files with their folder paths
      function collectFiles(node: SharedFolderNode, parentPath: string) {
        const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
        for (const file of node.files) {
          allFiles.push({ file, path: `${currentPath}/${file.filename}` });
        }
        for (const subfolder of node.subfolders) {
          collectFiles(subfolder, currentPath);
        }
      }
      collectFiles(shareInfo.tree, "");

      setZipProgress({ current: 0, total: allFiles.length });

      for (let i = 0; i < allFiles.length; i++) {
        const { file, path } = allFiles[i];
        const wrappedKey = wrappedKeys[file.id];
        if (!wrappedKey) continue;

        const fileKey = await unwrapKeyWithAES(folderShareKey, wrappedKey);

        const response = await fetch(`${API_URL}/folder-share/${token}/file/${file.id}`);
        if (!response.ok) continue;

        const metadataHeader = response.headers.get("X-File-Metadata");
        if (!metadataHeader) continue;

        const metadata = JSON.parse(metadataHeader) as { iv: string };
        const iv = new Uint8Array(base64ToArrayBuffer(metadata.iv));

        const encryptedData = await (await response.blob()).arrayBuffer();
        const decryptedData = await decryptFile(encryptedData, fileKey, iv);

        zip.file(path, decryptedData);
        setZipProgress({ current: i + 1, total: allFiles.length });
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${shareInfo.folder_name}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create ZIP");
      setState("error");
    }
  }

  return (
    <div className="min-h-screen bg-card flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center mb-2">
          <div className="flex justify-center mb-3">
            <BrandLogo className="h-12 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-white">{branding.productName}</h1>
          <p className="text-white/70 text-sm">Secure Folder Share</p>
        </div>

        <div className="bg-gradient-to-br from-primary to-primary/90 rounded-2xl shadow-2xl border border-white/10 p-6 text-white">
          {state === "loading" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary-foreground" />
              <p className="text-white/85">Verifying folder share link…</p>
            </div>
          )}

          {state === "ready" && shareInfo && (
            <div className="space-y-4">
              {/* Folder info */}
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center border border-white/15">
                  <FolderOpen className="w-7 h-7 text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white leading-snug truncate" title={shareInfo.folder_name}>
                    {shareInfo.folder_name}
                  </p>
                  <p className="text-sm text-white/75 mt-0.5">
                    {shareInfo.total_files} file{shareInfo.total_files !== 1 ? "s" : ""} · {formatFileSize(shareInfo.total_size)}
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
                    <span className="text-white/90 font-medium">{shareInfo.owner_display_name}</span>
                    {shareInfo.owner_organization && (
                      <span className="text-white/65"> · {shareInfo.owner_organization}</span>
                    )}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 rounded-lg border border-white/10">
                <Shield className="w-4 h-4 text-primary-foreground shrink-0" />
                <p className="text-xs text-white/80">
                  End-to-end encrypted · Keys never leave your browser
                </p>
              </div>

              {ownedLink && (
                <div className="rounded-xl border border-white/10 bg-white/6 px-4 py-3 space-y-3">
                  <div className="flex items-start gap-3">
                    <RefreshCw className="w-4 h-4 mt-0.5 text-primary-foreground shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white">Owner tools</p>
                      <p className="text-xs text-white/70">
                        You own this link. If new files were added after sharing, you can repair and update this same link here.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {!canRepairFolderShareLink(ownedLink, sessionVault.getCredential()) && (
                      <div className="space-y-2">
                        <label htmlFor="owner-repair-credential" className="text-xs font-medium text-white/75">
                          {currentUser?.pin_set ? "Enter your current PIN" : "Enter your current password"}
                        </label>
                        <input
                          id="owner-repair-credential"
                          type={currentUser?.pin_set ? "password" : "password"}
                          inputMode={currentUser?.pin_set ? "numeric" : undefined}
                          maxLength={currentUser?.pin_set ? 4 : undefined}
                          value={ownerCredentialInput}
                          onChange={(event) => setOwnerCredentialInput(event.target.value)}
                          placeholder={currentUser?.pin_set ? "••••" : "Current password"}
                          className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none"
                        />
                        <p className="text-xs text-white/60">
                          This stays in your browser and is only used to repair this link.
                        </p>
                      </div>
                    )}

                      <button
                        type="button"
                        onClick={() => void handleRepairLink()}
                        disabled={repairing || (!sessionVault.getCredential() && !ownerCredentialInput.trim())}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-primary/90 font-semibold px-4 py-2 hover:bg-primary/10 transition-colors disabled:opacity-60"
                      >
                        {repairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {repairing ? "Repairing…" : getFolderShareRepairLabel(ownedLink)}
                      </button>
                      {repairMessage && (
                        <p className="text-xs text-white/80">{repairMessage}</p>
                      )}
                    </div>
                </div>
              )}

              {/* File tree */}
              <div className="bg-white/5 rounded-xl border border-white/10 max-h-80 overflow-y-auto">
                <FolderTreeNode
                  node={shareInfo.tree}
                  path=""
                  onDownloadFile={handleDownloadFile}
                  downloadingFileId={downloadingFileId}
                />
              </div>

              {/* Download All */}
              <button
                type="button"
                onClick={() => void handleDownloadAll()}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-white text-primary/90 font-semibold rounded-xl hover:bg-primary/10 transition-colors cursor-pointer"
              >
                <Package className="w-5 h-5" />
                Download All as ZIP
              </button>
            </div>
          )}

          {state === "downloading" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary-foreground" />
              <div>
                <p className="text-white/80 font-medium">
                  {zipProgress.total > 0
                    ? `Decrypting files… ${zipProgress.current}/${zipProgress.total}`
                    : "Preparing download…"}
                </p>
                <p className="text-xs text-white/65 mt-1">
                  Each file is decrypted in your browser before packaging
                </p>
              </div>
              {zipProgress.total > 0 && (
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div
                    className="bg-primary/10 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.round((zipProgress.current / zipProgress.total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {state === "done" && (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              <div>
                <p className="text-lg font-semibold text-white">ZIP saved!</p>
                {shareInfo && (
                  <p className="text-sm text-white/70 mt-1 break-all">{shareInfo.folder_name}.zip</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setState("ready")}
                className="text-sm text-white/60 hover:text-white/80 underline underline-offset-2"
              >
                Back to folder
              </button>
            </div>
          )}

          {state === "expired" && (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <Clock className="w-12 h-12 text-amber-400" />
              <div>
                <p className="text-lg font-semibold text-white">This link has expired</p>
                <p className="text-sm text-white/75 mt-2">
                  This folder share link is no longer valid.
                </p>
                <p className="text-sm text-white/60 mt-1">
                  Contact the folder owner to request a new link.
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
              {shareInfo && (
                <button
                  type="button"
                  onClick={() => { setErrorMsg(""); setState("ready"); }}
                  className="text-sm text-white/60 hover:text-white/80 underline underline-offset-2"
                >
                  Back to folder
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

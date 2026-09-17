import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import useSWR from "swr";
import { legacyFileRequestSalt } from "../utils/file-request-credential";
import { AnimatePresence } from "framer-motion";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  File,
  Trash2,
  AlertCircle,
  Lock,
  Key,
  X,
  Loader2,
  Users,
  Upload,
  ChevronRight,
  Menu,
  CheckCircle2,
  FolderOpen,
  Folder as FolderIcon,
} from "lucide-react";
import { FirstTaskGuide, type FirstTask } from "../components/onboarding/FirstTaskGuide";
import { useNavigate, useLocation } from "react-router-dom";
import { API_URL } from "../utils/api";
import {
  generateSalt,
  deriveKeyFromPassword,
  encryptFile,
  decryptFile,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  unwrapKey,
  hexToBytes,
  decryptPrivateKeyWithPIN,
  importRSAPrivateKey,
  unwrapKeyWithRSA,
  wrapKeyWithAES,
  unwrapKeyWithAES,
  generateFileKey,
  type CryptoEvent,
} from "../utils/crypto";
import ShareModal from "../components/share-modal";
import { CreateShareLinkModal } from "../components/vault/CreateShareLinkModal";
import { CreateFolderShareLinkModal } from "../components/vault/CreateFolderShareLinkModal";
import { AccessPanel } from "../components/vault/AccessPanel";
import FolderModal from "../components/folders/FolderModal";
import { FolderCollaboratorsModal } from "../components/folders/FolderCollaboratorsModal";
import DeleteFolderModal from "../components/folders/DeleteFolderModal";
import { MoveFileModal } from "../components/files/MoveFileModal";
import {
  VaultTree,
  BulkActionBar,
  BulkDownloadModal,
  FileGrid,
  FileActionsMenu,
  UploadZone,
  FileSearch,
  type FileTypeFilter,
  ActivityReceiptDrawer,
} from "../components/vault";
import { CryptoPassportDrawer } from "../components/vault/CryptoPassportDrawer";
import { StagingDock } from "../components/vault/StagingDock";
import { VaultPrivacyShutter } from "../components/vault/VaultPrivacyShutter";
import { downloadTransferSlip, downloadBatchTransferSlip } from "../utils/transferSlip";
import { playTumblerClick, playDeadboltThud } from "../utils/audioHaptics";
import { useToast } from "../context/ToastContext";
import type {
  TreeNode,
  DropTokenInfo,
  BulkDownloadFile,
  DownloadAttemptResult,
  DownloadFailureKind,
} from "../components/vault";
import type { Folder } from "../components/files/FolderBreadcrumb";
import { useSessionVault } from "../context/SessionVaultContext";
import {
  syncAllFolderShareLinks,
  syncFolderShareLinksForFolder,
  type SyncableFolderShareLink,
} from "../utils/folder-share-sync";
import { FilePreviewModal } from "../components/vault/FilePreviewModal";
import { CreateUploadLinkModal, UploadLinksSection, EncryptionProof } from "../components/upload";
import { FileRequestsSection } from "../components/vault/FileRequestsSection";
import { FolderSharedLinksSection } from "../components/vault/FolderSharedLinksSection";
import { buildMoveTargetOptions } from "../utils/file-move";
import { collectFilesFromDataTransferItems } from "../utils/drop-drag";
import type { DragDataTransferItem } from "../utils/drop-drag";
import { mapDownloadHttpError } from "../utils/download-error";
import { getFileCredentialScheme } from "../utils/file-credential";
import { ensureFolderStructure, getFolderIdForFile } from "../utils/folder-upload";
import { getStoredUserFromLocalStorage } from "../utils/browser-storage";
import { useTranslation } from "react-i18next";
import { queueOfflineAction } from "../utils/offline-db";
import { DataState } from "../components/ui/data-state";
import { readOwnerUploadOutcome } from "../utils/owner-upload-outcome";


interface FileData {

  id: string;
  filename: string;
  file_size: number;
  created_at: string;
  metadata: string;
  is_owner?: boolean;
  starred?: boolean;
  owner_email?: string | null;
  owner_name?: string | null;
  group_name?: string | null;
  group_id?: string | null;
  shared_by?: string | null;
  shared_by_email?: string | null;
  shared_by_name?: string | null;
  shared_at?: string | null;
  drop_token?: string | null;
  drop_folder_id?: string | null;
  drop_folder_name?: string | null;
  pin_wrapped_key?: string | null;
  folder_id?: string | null;
  parent_hash?: string | null;
}

interface SharedFile {
  id: string;
  filename: string;
  file_size: number;
  owner_username: string;
  shared_at: string;
  encrypted_metadata: string;
}

interface UploadTrayItem {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error" | "unknown";
  message?: string;
}

const FILE_TYPE_EXTENSIONS: Record<string, string[]> = {
  images: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"],
  documents: ["pdf", "doc", "docx", "txt", "md", "csv", "xls", "xlsx", "ppt", "pptx", "json", "xml", "html"],
  audio: ["mp3", "m4a", "wav", "ogg", "flac", "aac"],
  video: ["mp4", "webm", "mov", "avi", "mkv"],
  archives: ["zip", "rar", "tar", "gz", "7z", "bz2"],
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function collectFolderDescendantIds(folders: Folder[], folderId: string): Set<string> {
  const descendants = new Set<string>([folderId]);
  const childrenByParent = new Map<string, string[]>();

  folders.forEach((folder) => {
    if (!folder.parentId) return;
    const siblings = childrenByParent.get(folder.parentId) ?? [];
    siblings.push(folder.id);
    childrenByParent.set(folder.parentId, siblings);
  });

  const queue = [folderId];
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;

    const childIds = childrenByParent.get(currentId) ?? [];
    childIds.forEach((childId) => {
      if (descendants.has(childId)) return;
      descendants.add(childId);
      queue.push(childId);
    });
  }

  return descendants;
}

function getFolderFileCounts(files: FileData[]): Record<string, number> {
  return files.reduce<Record<string, number>>((counts, file) => {
    const fid = file.folder_id ?? file.drop_folder_id;
    if (!fid) return counts;
    counts[fid] = (counts[fid] ?? 0) + 1;
    return counts;
  }, {});
}

function getSelectableFileIds(files: FileData[]): Set<string> {
  return new Set(files.map((file) => file.id));
}

function areAllFilesSelected(files: FileData[], selectedIds: Set<string>): boolean {
  return files.length > 0 && files.every((file) => selectedIds.has(file.id));
}

function hasSomeFilesSelected(files: FileData[], selectedIds: Set<string>): boolean {
  return files.some((file) => selectedIds.has(file.id));
}

export default function Files() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionVault = useSessionVault();
  const { addToast } = useToast();
  const { t } = useTranslation(["drive"]);

  const routeState = location.state as { highlightFileId?: string; onboardingTask?: FirstTask; manageDropToken?: string } | null;
  const onboardingTask = routeState?.onboardingTask;
  const firstTask = onboardingTask && ["upload", "share", "receive"].includes(onboardingTask) ? onboardingTask : null;

  const highlightFileId = (location.state as { highlightFileId?: string } | null)?.highlightFileId;
  const manageDropToken = typeof routeState?.manageDropToken === "string" ? routeState.manageDropToken : null;

  const { data: myFiles = [], mutate: mutateMyFiles, isLoading, error: myFilesError } = useSWR<FileData[]>(`${API_URL}/files`, {
    onError: (err) => {
      if (err.message?.includes("401") || err.status === 401) {
        navigate("/login");
      }
    }
  });

  useEffect(() => {
    if (!highlightFileId || isLoading || myFiles.length === 0) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`file-row-${highlightFileId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-pulse");
        setTimeout(() => el.classList.remove("highlight-pulse"), 2000);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [highlightFileId, isLoading, myFiles]);

  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [sharedFilesLoading, setSharedFilesLoading] = useState(true);
  const [sharedFilesError, setSharedFilesError] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersError, setFoldersError] = useState("");
  const [dropTokens, setDropTokens] = useState<DropTokenInfo[]>([]);
  const [dropTokensError, setDropTokensError] = useState("");
  const [dropLinkFiles, setDropLinkFiles] = useState<Record<string, FileData[]>>({});
  const [dropLinkLoading, setDropLinkLoading] = useState<Record<string, boolean>>({});
  const [dropLinkErrors, setDropLinkErrors] = useState<Record<string, string>>({});

  // loading state removed
  const [uploading, setUploading] = useState(false);
  const [cryptoEvent, setCryptoEvent] = useState<CryptoEvent | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedNode, setSelectedNode] = useState<TreeNode>({ type: "all" });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);

  const [encryptionPassword, setEncryptionPassword] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordAction, setPasswordAction] = useState<"upload" | "download" | "drop-upload" | "decrypt-folder" | null>(null);
  const [pendingDownload, setPendingDownload] = useState<{
    fileId: string;
    filename: string;
    metadata: string;
    pin_wrapped_key?: string;
    is_owner?: boolean;
    folder_id?: string | null;
  } | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: string; filename: string; parent_hash?: string | null } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingFileIds, setDownloadingFileIds] = useState<Set<string>>(new Set());
  const [deletingFileIds, setDeletingFileIds] = useState<Set<string>>(new Set());
  const [showMoveFileModal, setShowMoveFileModal] = useState(false);
  const [fileToMove, setFileToMove] = useState<FileData | null>(null);
  const [movingFile, setMovingFile] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [fileToShare, setFileToShare] = useState<{ id: string; filename: string; metadata?: string; pin_wrapped_key?: string; folder_id?: string | null } | null>(null);

  const [accessPanelFile, setAccessPanelFile] = useState<{ id: string; filename: string } | null>(null);
  const [receiptFile, setReceiptFile] = useState<FileData | null>(null);

  const [showManageSharesModal, setShowManageSharesModal] = useState(false);
  const [fileToManage, setFileToManage] = useState<{ id: string; filename: string } | null>(null);
  const [sharedUsers, setSharedUsers] = useState<
    Array<{ user_id: string; username: string; email: string; shared_at: string }>
  >([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderModalMode, setFolderModalMode] = useState<"create" | "rename">("create");
  const [folderModalParentId, setFolderModalParentId] = useState<string | null>(null);
  const [folderToEdit, setFolderToEdit] = useState<{ id: string; name: string } | null>(null);
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{
    id: string;
    name: string;
    hasSubfolders: boolean;
  } | null>(null);

  const [bulkDownloadFiles, setBulkDownloadFiles] = useState<BulkDownloadFile[] | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadTray, setUploadTray] = useState<UploadTrayItem[]>([]);
  const dragCounter = useRef(0);
  const droppedFilesRef = useRef<globalThis.File[] | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);

  const [previewFile, setPreviewFile] = useState<FileData | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [sortBy, setSortBy] = useState<"name" | "date" | "size">("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>("all");

  // Step 1: Scroll ref & return-scroll anchoring
  const fileContainerRef = useRef<HTMLDivElement | null>(null);
  const [lastInteractedFileId, setLastInteractedFileId] = useState<string | null>(null);
  const [focusedRowFileId, setFocusedRowFileId] = useState<string | null>(null);

  // Step 2: Keyboard traversal & Quick Look
  const [focusedFileIndex, setFocusedFileIndex] = useState<number>(-1);

  // Step 4: Cryptographic Passport Drawer
  const [passportFile, setPassportFile] = useState<FileData | null>(null);

  // Step 5: Executive Staging Dock & Transactional Undo
  const [stagedFiles, setStagedFiles] = useState<FileData[]>([]);
  const [undoAction, setUndoAction] = useState<{ message: string; undo: () => Promise<void> } | null>(null);

  // Step 6: Ephemeral Vault Privacy Shutter
  const [isVaultLocked, setIsVaultLocked] = useState(false);

  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [fileContextMenu, setFileContextMenu] = useState<{ file: FileData; x: number; y: number } | null>(null);

  const [showShareLinkModal, setShowShareLinkModal] = useState(false);
  const [fileForShareLink, setFileForShareLink] = useState<{
    id: string;
    filename: string;
    metadata: string;
    pin_wrapped_key?: string | null;
    folder_id?: string | null;
  } | null>(null);

  const [showFolderShareModal, setShowFolderShareModal] = useState(false);
  const [folderForShare, setFolderForShare] = useState<{ id: string; name: string } | null>(null);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
  const [folderForCollaborators, setFolderForCollaborators] = useState<{ id: string; name: string } | null>(null);
  const [showCreateUploadLinkModal, setShowCreateUploadLinkModal] = useState(false);
  const [uploadLinkTargetFolder, setUploadLinkTargetFolder] = useState<{ id: string; name: string } | null>(null);
  const [folderSharePanelVersion, setFolderSharePanelVersion] = useState(0);
  const initialFolderShareSyncAttemptedRef = useRef(false);
  const [moveFolders, setMoveFolders] = useState<Folder[]>([]);

  // Shared folders & key exchange state
  interface SharedFolder {
    id: string;
    owner_id: string;
    name: string;
    parentId?: string;
    wrapped_key: string;
    shared_by: string;
    shared_at: string;
  }
  const [sharedFolders, setSharedFolders] = useState<SharedFolder[]>([]);
  const [sharedFolderFiles, setSharedFolderFiles] = useState<FileData[]>([]);
  const [sharedFolderFilesLoading, setSharedFolderFilesLoading] = useState(false);
  const [sharedFolderFilesError, setSharedFolderFilesError] = useState("");
  const [sharedFolderReload, setSharedFolderReload] = useState(0);
  const [pendingSharedFolder, setPendingSharedFolder] = useState<SharedFolder | null>(null);

  const fetchFiles = useCallback(async () => {
    // SWR handles fetching automatically, but this function is kept for backward compatibility
    // in places that explicitly expect to trigger a refresh.
    await mutateMyFiles();
  }, [mutateMyFiles]);

  const fetchSharedFiles = useCallback(async () => {
    setSharedFilesLoading(true);
    setSharedFilesError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/shared`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(response.status === 403 ? "You do not have access to shared files." : "Shared files are unavailable.");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Shared files returned an unexpected response.");
      setSharedFiles(data);
    } catch (sourceError) {
      setSharedFilesError(sourceError instanceof Error ? sourceError.message : "Shared files are unavailable.");
    } finally {
      setSharedFilesLoading(false);
    }
  }, []);

  const fetchSharedFolders = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/folders/shared`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSharedFolders(data || []);
      }
    } catch {
      return;
    }
  }, []);

  const fetchFolders = useCallback(async () => {
    setFoldersError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/folders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(response.status === 403 ? "You do not have access to folders." : "Folders are unavailable.");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Folders returned an unexpected response.");
      setFolders(data);
      return data;
    } catch (sourceError) {
      setFoldersError(sourceError instanceof Error ? sourceError.message : "Folders are unavailable.");
      return [];
    }
    return [];
  }, []);

  const fetchDropTokens = useCallback(async () => {
    setDropTokensError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/drop/tokens`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(response.status === 403 ? "You do not have access to upload links." : "Upload links are unavailable.");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Upload links returned an unexpected response.");
      setDropTokens(data);
    } catch (sourceError) {
      setDropTokensError(sourceError instanceof Error ? sourceError.message : "Upload links are unavailable.");
    }
  }, []);

  const fetchDropLinkFiles = useCallback(async (dropToken: string, force = false) => {
    if (dropLinkFiles[dropToken] && !force) return;
    setDropLinkLoading((current) => ({ ...current, [dropToken]: true }));
    setDropLinkErrors((current) => ({ ...current, [dropToken]: "" }));
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/drop/${dropToken}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(response.status === 403 ? "You do not have access to this upload link." : "Uploaded files are unavailable.");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Uploaded files returned an unexpected response.");
      setDropLinkFiles((prev) => ({ ...prev, [dropToken]: data }));
    } catch (sourceError) {
      setDropLinkErrors((current) => ({ ...current, [dropToken]: sourceError instanceof Error ? sourceError.message : "Uploaded files are unavailable." }));
    } finally {
      setDropLinkLoading((current) => ({ ...current, [dropToken]: false }));
    }
  }, [dropLinkFiles]);

  const syncExistingFolderShares = useCallback(async (folderId?: string) => {
    const token = localStorage.getItem("token");
    const credential = sessionVault.getCredential();
    const storedUser = localStorage.getItem("user");
    const currentUser = storedUser ? JSON.parse(storedUser) as {
      private_key_encrypted?: string | null;
      private_key_pin_encrypted?: string | null;
    } : null;

    if (!token || !credential) {
      return;
    }

    const linksResponse = await fetch(`${API_URL}/folder-share-links`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!linksResponse.ok) {
      return;
    }

    const links = (await linksResponse.json()) as SyncableFolderShareLink[];
    const syncResult = folderId
      ? await syncFolderShareLinksForFolder({
          folderId,
          folders,
          links,
          authToken: token,
          credential,
          cachedPrivateKey: sessionVault.getPrivateKey(),
          currentUser,
        })
      : await syncAllFolderShareLinks({
          links,
          authToken: token,
          credential,
          cachedPrivateKey: sessionVault.getPrivateKey(),
          currentUser,
        });

    if (syncResult.syncedFiles > 0) {
      await fetchFiles();
      setSuccessMessage(`Updated ${syncResult.syncedFiles} file${syncResult.syncedFiles === 1 ? "" : "s"} across active folder shares.`);
      setTimeout(() => setSuccessMessage(""), 5000);
    }
  }, [fetchFiles, folders, sessionVault]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    fetchFiles();
    fetchSharedFiles();
    fetchSharedFolders();
    fetchFolders();
    fetchDropTokens();
  }, [navigate, fetchFiles, fetchSharedFiles, fetchSharedFolders, fetchFolders, fetchDropTokens]);

  useEffect(() => {
    if (manageDropToken) setSelectedNode({ type: "manage-drops" });
  }, [manageDropToken]);

  useEffect(() => {
    if (initialFolderShareSyncAttemptedRef.current) {
      return;
    }
    if (folders.length === 0) {
      return;
    }
    if (!sessionVault.getCredential()) {
      return;
    }

    initialFolderShareSyncAttemptedRef.current = true;
    void syncExistingFolderShares();
  }, [folders, sessionVault, syncExistingFolderShares]);

  useEffect(() => {
    if (selectedNode.type === "drop-link") {
      fetchDropLinkFiles(selectedNode.token);
    }
  }, [selectedNode, fetchDropLinkFiles]);

  useEffect(() => {
    if (selectedNode.type !== "folder") return;
    const sharedFolder = sharedFolders.find(f => f.id === selectedNode.folderId);
    if (!sharedFolder) return;

    let active = true;

    const initFolder = async () => {
      setSharedFolderFilesLoading(true);
      setSharedFolderFilesError("");
      const cachedKey = sessionVault.getFolderKey(sharedFolder.id);
      if (!cachedKey) {
        const privateKey = sessionVault.getPrivateKey();
        if (privateKey) {
          try {
            const folderKey = await unwrapKeyWithRSA(privateKey, sharedFolder.wrapped_key);
            sessionVault.setFolderKey(sharedFolder.id, folderKey);
          } catch (err) {
            console.error("Failed to decrypt folder key with private key:", err);
          }
        } else {
          setPendingSharedFolder(sharedFolder);
          setPasswordAction("decrypt-folder");
          setShowPasswordModal(true);
        }
      }

      // Fetch files
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/folders/${selectedNode.folderId}/files`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(res.status === 403 ? "You do not have access to this shared folder." : "Shared-folder files are unavailable.");
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Shared-folder files returned an unexpected response.");
        if (active) setSharedFolderFiles(data);
      } catch (err) {
        console.error("Failed to load shared folder files:", err);
        if (active) setSharedFolderFilesError(err instanceof Error ? err.message : "Shared-folder files are unavailable.");
      } finally {
        if (active) setSharedFolderFilesLoading(false);
      }
    };

    void initFolder();

    return () => { active = false; };
  }, [selectedNode, sharedFolders, sessionVault, sharedFolderReload]);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer?.types.includes("Files")) setIsDragging(true);
    };
    const onDragLeave = () => {
      dragCounter.current--;
      if (dragCounter.current === 0) setIsDragging(false);
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      const items = Array.from(e.dataTransfer?.items ?? []) as unknown as DragDataTransferItem[];
      if (items.length > 0 && items.some((i) => (i as unknown as DataTransferItem).webkitGetAsEntry?.()?.isDirectory)) {
        // Folder drop — collect files with relative paths preserved
        void collectFilesFromDataTransferItems(items).then((collected) => {
          if (collected.length > 0) {
            droppedFilesRef.current = collected;
            setPasswordAction("drop-upload");
            setShowPasswordModal(true);
          }
        });
      } else {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          droppedFilesRef.current = Array.from(files);
          setPasswordAction("drop-upload");
          setShowPasswordModal(true);
        }
      }
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  useEffect(() => {
    if (!openActionMenu && !fileContextMenu) return;
    const handler = () => {
      setOpenActionMenu(null);
      setFileContextMenu(null);
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [fileContextMenu, openActionMenu]);

  const applyTypeFilter = useCallback((list: FileData[]): FileData[] => {
    if (typeFilter === "all") return list;
    const exts = FILE_TYPE_EXTENSIONS[typeFilter] ?? [];
    return list.filter((f) => exts.includes(getFileExtension(f.filename)));
  }, [typeFilter]);

  const applySort = useCallback((list: FileData[]): FileData[] => {
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.filename.localeCompare(b.filename);
      else if (sortBy === "date") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortBy === "size") cmp = a.file_size - b.file_size;
      return sortAsc ? cmp : -cmp;
    });
  }, [sortBy, sortAsc]);

  const sharedAsFiles = useMemo<FileData[]>(() => {
    return sharedFiles.map((sf) => ({
      id: sf.id,
      filename: sf.filename,
      file_size: sf.file_size,
      created_at: sf.shared_at,
      metadata: sf.encrypted_metadata,
      is_owner: false,
      shared_by: sf.owner_username,
    }));
  }, [sharedFiles]);

  const visibleFiles = useMemo<FileData[]>(() => {
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      const allFiles = [...myFiles, ...sharedAsFiles];
      const filtered = allFiles.filter((file) => file.filename.toLowerCase().includes(q));
      return applySort(applyTypeFilter(filtered));
    }

    let list: FileData[] = [];

    switch (selectedNode.type) {
      case "all":
        list = myFiles;
        break;
      case "starred":
        list = myFiles.filter((file) => file.starred);
        break;
      case "folder": {
        const isShared = sharedFolders.some((f) => f.id === selectedNode.folderId);
        if (isShared) {
          list = sharedFolderFiles;
        } else {
          const descendantIds = collectFolderDescendantIds(folders, selectedNode.folderId);
          list = myFiles.filter((file) =>
            (file.drop_folder_id && descendantIds.has(file.drop_folder_id)) ||
            (file.folder_id && descendantIds.has(file.folder_id))
          );
        }
        break;
      }
      case "shared":
        list = sharedAsFiles;
        break;
      case "drop-link":
        list = dropLinkFiles[selectedNode.token] || [];
        break;
    }

    return applySort(applyTypeFilter(list));
  }, [applySort, applyTypeFilter, dropLinkFiles, folders, myFiles, searchQuery, selectedNode, sharedAsFiles, sharedFolders, sharedFolderFiles]);

  const selectedSharedFolder = selectedNode.type === "folder"
    && sharedFolders.some((folder) => folder.id === selectedNode.folderId);
  const activeViewLoading = searchQuery
    ? isLoading || sharedFilesLoading
    : selectedNode.type === "shared"
      ? sharedFilesLoading
      : selectedNode.type === "drop-link"
        ? Boolean(dropLinkLoading[selectedNode.token])
        : selectedSharedFolder
          ? sharedFolderFilesLoading
          : isLoading;
  const ownedFilesError = myFilesError instanceof Error ? myFilesError.message : myFilesError ? "Your files are unavailable." : "";
  const activeViewError = searchQuery
    ? [ownedFilesError, sharedFilesError].filter(Boolean).join(" ")
    : selectedNode.type === "shared"
      ? sharedFilesError
      : selectedNode.type === "drop-link"
        ? dropLinkErrors[selectedNode.token] || ""
        : selectedSharedFolder
          ? sharedFolderFilesError
          : ownedFilesError;
  const retryActiveView = () => {
    if (searchQuery) {
      void fetchFiles();
      void fetchSharedFiles();
    } else if (selectedNode.type === "shared") {
      void fetchSharedFiles();
    } else if (selectedNode.type === "drop-link") {
      void fetchDropLinkFiles(selectedNode.token, true);
    } else if (selectedSharedFolder) {
      setSharedFolderReload((value) => value + 1);
    } else {
      void fetchFiles();
    }
  };

  const folderFileCounts = useMemo(() => getFolderFileCounts(myFiles), [myFiles]);
  const visibleFileIds = useMemo(() => getSelectableFileIds(visibleFiles), [visibleFiles]);
  const selectedVisibleFiles = useMemo(
    () => visibleFiles.filter((file) => selectedFileIds.has(file.id)),
    [selectedFileIds, visibleFiles]
  );
  const allVisibleSelected = useMemo(
    () => areAllFilesSelected(visibleFiles, selectedFileIds),
    [selectedFileIds, visibleFiles]
  );
  const someVisibleSelected = useMemo(
    () => hasSomeFilesSelected(visibleFiles, selectedFileIds),
    [selectedFileIds, visibleFiles]
  );
  const selectedBulkFiles = useMemo<BulkDownloadFile[]>(() => {
    return selectedVisibleFiles.map((file) => ({
      id: file.id,
      filename: file.filename,
      metadata: file.metadata,
      pin_wrapped_key: file.pin_wrapped_key,
      is_owner: file.is_owner,
      folder_id: file.folder_id || (selectedNode.type === "folder" ? selectedNode.folderId : null),
    }));
  }, [selectedVisibleFiles, selectedNode]);
  const deletableSelectedCount = useMemo(
    () => selectedVisibleFiles.filter((file) => file.is_owner !== false).length,
    [selectedVisibleFiles]
  );
  const bulkDeleteCandidates = useMemo(
    () => selectedVisibleFiles.filter((file) => file.is_owner !== false),
    [selectedVisibleFiles]
  );

  const starredCount = myFiles.filter((file) => file.starred).length;

  useEffect(() => {
    setSelectedFileIds((prev) => {
      const next = new Set<string>();
      prev.forEach((fileId) => {
        if (visibleFileIds.has(fileId)) {
          next.add(fileId);
        }
      });

      if (next.size === prev.size) {
        let identical = true;
        prev.forEach((fileId) => {
          if (!next.has(fileId)) {
            identical = false;
          }
        });
        if (identical) {
          return prev;
        }
      }

      return next;
    });
  }, [visibleFileIds]);

  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  // Step 1: Viewport Scroll Intelligence
  useEffect(() => {
    if (fileContainerRef.current) {
      fileContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    setFocusedFileIndex(-1);
  }, [selectedNode]);

  // Guard: keep focusedFileIndex strictly within bounds when visible files change
  useEffect(() => {
    if (focusedFileIndex >= visibleFiles.length) {
      setFocusedFileIndex(visibleFiles.length > 0 ? 0 : -1);
    }
  }, [visibleFiles.length, focusedFileIndex]);

  // Step 1: Return-Scroll Anchoring & Subtle Focus Ring
  useEffect(() => {
    if (!previewFile && !accessPanelFile && !showShareModal && !receiptFile && !passportFile && lastInteractedFileId) {
      const el = document.getElementById(`file-row-${lastInteractedFileId}`);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        setFocusedRowFileId(lastInteractedFileId);
        const timer = setTimeout(() => setFocusedRowFileId(null), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [previewFile, accessPanelFile, showShareModal, receiptFile, passportFile, lastInteractedFileId]);

  // Step 3: Speculative Hover-to-Decrypt Priming
  const hoverPrimingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRowHover = useCallback((_file: FileData) => {
    if (hoverPrimingTimer.current) clearTimeout(hoverPrimingTimer.current);
    hoverPrimingTimer.current = setTimeout(() => {
      const cred = sessionVault.getCredential();
      if (cred?.value) {
        // Session credentials warm for instantaneous decryption
      }
    }, 70);
  }, [sessionVault]);

  // Step 2 & 5 & 6: Keyboard Traversal, Space Quick Look, Staging Dock & Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable) {
        return;
      }

      // Hotkey: ⌘L / Ctrl+L -> Lock Privacy Shutter
      if ((e.metaKey || e.ctrlKey) && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        setIsVaultLocked((prev) => !prev);
        return;
      }

      // Hotkey: ⌘Z / Ctrl+Z -> Transactional Undo
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        if (undoAction) {
          e.preventDefault();
          void undoAction.undo();
          setUndoAction(null);
          return;
        }
      }

      if (isVaultLocked || bulkDownloadFiles !== null || showPasswordModal) return;

      // If Cryptographic Passport drawer is open, only allow dismissal keys
      if (passportFile !== null) {
        if (
          e.key === "Escape" ||
          ((e.metaKey || e.ctrlKey) && (e.key === "i" || e.key === "I")) ||
          e.key === "p" ||
          e.key === "P"
        ) {
          e.preventDefault();
          playTumblerClick();
          setPassportFile(null);
        }
        return;
      }

      // If File Preview modal is open, Space or Escape dismisses it; block background traversal
      if (previewFile !== null) {
        if (e.key === " " || e.code === "Space" || e.key === "Escape") {
          e.preventDefault();
          setPreviewFile(null);
        }
        return;
      }

      // Hotkey: ⌘I or P -> Open Cryptographic Passport
      if (((e.metaKey || e.ctrlKey) && (e.key === "i" || e.key === "I")) || e.key === "p" || e.key === "P") {
        const targetFile = focusedFileIndex >= 0 && visibleFiles[focusedFileIndex] ? visibleFiles[focusedFileIndex] : visibleFiles[0];
        if (targetFile) {
          e.preventDefault();
          playTumblerClick();
          setPassportFile(targetFile);
        }
        return;
      }

      // Spacebar: Open Quick Look preview for focused file
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (focusedFileIndex >= 0 && visibleFiles[focusedFileIndex]) {
          const file = visibleFiles[focusedFileIndex];
          setLastInteractedFileId(file.id);
          setPreviewFile({
            ...file,
            folder_id: file.folder_id || (selectedNode.type === "folder" ? selectedNode.folderId : null),
          });
        }
        return;
      }

      // J or Down Arrow: Next file
      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        playTumblerClick();
        setFocusedFileIndex((prev) => {
          const next = Math.min(prev + 1, visibleFiles.length - 1);
          const file = visibleFiles[next];
          if (file) {
            const el = document.getElementById(`file-row-${file.id}`);
            el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
          return next;
        });
        return;
      }

      // K or Up Arrow: Previous file
      if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        playTumblerClick();
        setFocusedFileIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          const file = visibleFiles[next];
          if (file) {
            const el = document.getElementById(`file-row-${file.id}`);
            el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
          return next;
        });
        return;
      }

      // Enter: Drill in or Preview focused file
      if (e.key === "Enter") {
        if (focusedFileIndex >= 0 && visibleFiles[focusedFileIndex]) {
          e.preventDefault();
          const file = visibleFiles[focusedFileIndex];
          setLastInteractedFileId(file.id);
          setPreviewFile({
            ...file,
            folder_id: file.folder_id || (selectedNode.type === "folder" ? selectedNode.folderId : null),
          });
        }
        return;
      }

      // Backspace or ArrowLeft: Navigate back to parent folder
      if (e.key === "Backspace" || e.key === "ArrowLeft") {
        if (selectedNode.type === "folder") {
          e.preventDefault();
          const currentFolder = folders.find((f) => f.id === selectedNode.folderId);
          if (currentFolder?.parentId) {
            const parent = folders.find((f) => f.id === currentFolder.parentId);
            if (parent) {
              setSelectedNode({ type: "folder", folderId: parent.id, folderName: parent.name });
            } else {
              setSelectedNode({ type: "all" });
            }
          } else {
            setSelectedNode({ type: "all" });
          }
        }
        return;
      }

      // X: Toggle Staging Dock for focused file
      if (e.key === "x" || e.key === "X") {
        if (focusedFileIndex >= 0 && visibleFiles[focusedFileIndex]) {
          e.preventDefault();
          playTumblerClick();
          const file = visibleFiles[focusedFileIndex];
          setStagedFiles((prev) => {
            const exists = prev.some((f) => f.id === file.id);
            if (exists) {
              return prev.filter((f) => f.id !== file.id);
            }
            return [...prev, file];
          });
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    visibleFiles,
    focusedFileIndex,
    previewFile,
    isVaultLocked,
    selectedNode,
    folders,
    undoAction,
    bulkDownloadFiles,
    showPasswordModal,
  ]);

  // Step 6: 3-Minute Inactivity Auto-Lock
  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout>;

    const resetInactivity = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        setIsVaultLocked(true);
      }, 180_000);
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, resetInactivity, { passive: true }));
    resetInactivity();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach((ev) => window.removeEventListener(ev, resetInactivity));
    };
  }, []);

  // Step 2: Command Palette custom action listener
  useEffect(() => {
    const handleVaultAction = (e: Event) => {
      const detail = (e as CustomEvent<{ action: string }>).detail;
      if (detail?.action === "lock") {
        setIsVaultLocked(true);
      } else if (detail?.action === "passport") {
        const file = focusedFileIndex >= 0 && visibleFiles[focusedFileIndex] ? visibleFiles[focusedFileIndex] : visibleFiles[0];
        if (file) setPassportFile(file);
      }
    };
    window.addEventListener("vault-action", handleVaultAction);
    return () => window.removeEventListener("vault-action", handleVaultAction);
  }, [focusedFileIndex, visibleFiles]);

  const toggleStar = async (fileId: string) => {
    const token = localStorage.getItem("token");
    const file = myFiles.find((candidate) => candidate.id === fileId);
    if (!file) return;
    const nextStarred = !file.starred;
    
    // Optimistic UI update
    mutateMyFiles(
      (prev = []) => prev.map((f) => (f.id === fileId ? { ...f, starred: nextStarred } : f)),
      { revalidate: false }
    );

    try {
      const response = await fetch(`${API_URL}/files/${fileId}/star`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Could not ${nextStarred ? "star" : "unstar"} ${file.filename}. Try again.`);
      // Revalidate to ensure server state matches
      await mutateMyFiles();
    } catch (starError) {
      mutateMyFiles(
        (prev = []) => prev.map((candidate) => candidate.id === fileId ? { ...candidate, starred: file.starred } : candidate),
        { revalidate: false },
      );
      setError(starError instanceof Error ? starError.message : "Could not update the starred state. Try again.");
    }
  };

  const handleQuickShare = (fileId: string) => {
    const file = visibleFiles.find((candidate) => candidate.id === fileId);
    if (file) handleCreateShareLink(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError("");
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      droppedFilesRef.current = files;
      setPasswordAction("drop-upload");
      setShowPasswordModal(true);
    }
    e.target.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile) { setError("Please select a file to upload"); return; }
    const cached = sessionVault.getCredential();
    if (cached && ((ownerUsesPin && cached.type === "pin") || (!ownerUsesPin && cached.type === "password"))) {
      await performUpload(cached.value);
      return;
    }
    setPasswordAction("upload");
    setShowPasswordModal(true);
  };

  const performUpload = async (password: string): Promise<boolean> => {
    if (!selectedFile) return false;
    const uploadFile = selectedFile;
    let requestStarted = false;
    let responseReceived = false;
    setUploading(true);
    setError("");
    try {
      const isSharedFolder = selectedNode.type === "folder" && sharedFolders.some((f) => f.id === selectedNode.folderId);
      let encryptedBlob: Blob;
      let encryptionKey: CryptoKey;
      let wrappedKeyStr = "";
      let saltStr = "";
      let ivStr = "";
      let credentialSchemeStr = "";

      if (isSharedFolder) {
        const folderKey = sessionVault.getFolderKey(selectedNode.folderId);
        if (!folderKey) {
          throw new Error("Folder key not found. Please re-open the folder to unlock it.");
        }
        encryptionKey = await generateFileKey();
        setCryptoEvent(null);
        const { encryptedData, iv } = await encryptFile(selectedFile, encryptionKey, setCryptoEvent);
        encryptedBlob = new Blob([encryptedData], { type: "application/octet-stream" });
        wrappedKeyStr = await wrapKeyWithAES(folderKey, encryptionKey);
        ivStr = arrayBufferToBase64(iv);
        const salt = generateSalt();
        saltStr = arrayBufferToBase64(salt);
        credentialSchemeStr = "folder";
      } else {
        const salt = generateSalt();
        encryptionKey = await deriveKeyFromPassword(password, salt, 100000);
        setCryptoEvent(null);
        const { encryptedData, iv } = await encryptFile(selectedFile, encryptionKey, setCryptoEvent);
        encryptedBlob = new Blob([encryptedData], { type: "application/octet-stream" });
        wrappedKeyStr = arrayBufferToBase64(salt) + ":" + arrayBufferToBase64(iv);
        ivStr = arrayBufferToBase64(iv);
        saltStr = arrayBufferToBase64(salt);
        credentialSchemeStr = ownerUsesPin ? "pin" : "password";
      }

      const formData = new FormData();
      formData.append("file", encryptedBlob, selectedFile.name);
      formData.append("iv", ivStr);
      formData.append("salt", saltStr);
      formData.append("algorithm", "AES-256-GCM");
      formData.append("wrapped_key", wrappedKeyStr);
      formData.append("credential_scheme", credentialSchemeStr);
      if (selectedNode.type === "folder") {
        formData.append("folder_id", selectedNode.folderId);
      }
      const token = localStorage.getItem("token");
      requestStarted = true;
      const response = await fetch(`${API_URL}/files/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      responseReceived = true;
      const outcome = await readOwnerUploadOutcome(response);
      if (outcome.kind === "failed") {
        if (response.status === 401) navigate("/login");
        setError(outcome.message);
        return false;
      }
      if (outcome.kind === "unknown") {
        setUploadTray((current) => [...current, {
          id: crypto.randomUUID(),
          name: uploadFile.name,
          progress: 100,
          status: "unknown",
          message: outcome.message,
        }]);
        setSelectedFile(null);
        const fileInput = document.getElementById("file-input") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        await fetchFiles();
        setError(outcome.message);
        return true;
      }
      setSelectedFile(null);
      const fileInput = document.getElementById("file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      await fetchFiles();
      if (selectedNode.type === "folder") {
        await syncExistingFolderShares(selectedNode.folderId);
      }
      return true;
    } catch (err) {
      if (requestStarted && !responseReceived) {
        const message = "The connection ended after the upload started. The server may have stored it; do not resend it yet.";
        setUploadTray((current) => [...current, { id: crypto.randomUUID(), name: uploadFile.name, progress: 100, status: "unknown", message }]);
        setSelectedFile(null);
        await fetchFiles();
        setError(message);
        return true;
      }
      setError(err instanceof Error ? err.message : "Failed to prepare the upload");
      return false;
    } finally {
      setUploading(false);
    }
  };

  const performUploadFileToFolder = async (
    file: globalThis.File,
    password: string,
    trayId: string,
    folderId: string | null
  ): Promise<boolean> => {
    let requestStarted = false;
    let responseReceived = false;
    const updateTray = (progress: number, status: UploadTrayItem["status"], message?: string) => {
      setUploadTray((prev) =>
        prev.map((item) => item.id === trayId ? { ...item, progress, status, message } : item)
      );
    };
    try {
      updateTray(10, "uploading");
      const targetFolderId = folderId || (selectedNode.type === "folder" ? selectedNode.folderId : null);
      const isSharedFolder = targetFolderId ? sharedFolders.some((f) => f.id === targetFolderId) : false;

      let encryptedBlob: Blob;
      let encryptionKey: CryptoKey;
      let wrappedKeyStr = "";
      let saltStr = "";
      let ivStr = "";
      let credentialSchemeStr = "";

      if (isSharedFolder && targetFolderId) {
        const folderKey = sessionVault.getFolderKey(targetFolderId);
        if (!folderKey) {
          throw new Error("Folder key not found. Please re-open the folder to unlock it.");
        }
        encryptionKey = await generateFileKey();
        updateTray(30, "uploading");
        setCryptoEvent(null);
        const { encryptedData, iv } = await encryptFile(file, encryptionKey, setCryptoEvent);
        encryptedBlob = new Blob([encryptedData], { type: "application/octet-stream" });
        wrappedKeyStr = await wrapKeyWithAES(folderKey, encryptionKey);
        ivStr = arrayBufferToBase64(iv);
        const salt = generateSalt();
        saltStr = arrayBufferToBase64(salt);
        credentialSchemeStr = "folder";
      } else {
        const salt = generateSalt();
        encryptionKey = await deriveKeyFromPassword(password, salt, 100000);
        updateTray(30, "uploading");
        setCryptoEvent(null);
        const { encryptedData, iv } = await encryptFile(file, encryptionKey, setCryptoEvent);
        encryptedBlob = new Blob([encryptedData], { type: "application/octet-stream" });
        wrappedKeyStr = arrayBufferToBase64(salt) + ":" + arrayBufferToBase64(iv);
        ivStr = arrayBufferToBase64(iv);
        saltStr = arrayBufferToBase64(salt);
        credentialSchemeStr = ownerUsesPin ? "pin" : "password";
      }

      updateTray(60, "uploading");
      const formData = new FormData();
      formData.append("file", encryptedBlob, file.name);
      formData.append("iv", ivStr);
      formData.append("salt", saltStr);
      formData.append("algorithm", "AES-256-GCM");
      formData.append("wrapped_key", wrappedKeyStr);
      formData.append("credential_scheme", credentialSchemeStr);
      if (targetFolderId) {
        formData.append("folder_id", targetFolderId);
      }
      const token = localStorage.getItem("token");
      requestStarted = true;
      const response = await fetch(`${API_URL}/files/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      responseReceived = true;
      updateTray(90, "uploading");
      const outcome = await readOwnerUploadOutcome(response);
      if (outcome.kind === "failed") {
        updateTray(0, "error", outcome.message);
        return false;
      }
      if (outcome.kind === "unknown") {
        updateTray(100, "unknown", outcome.message);
        return false;
      }
      updateTray(100, "done");
      return true;
    } catch (err) {
      console.error(err);
      if (requestStarted && !responseReceived) {
        updateTray(100, "unknown", "The connection ended after upload started. Do not resend this file until its server outcome is confirmed.");
      } else {
        updateTray(0, "error", err instanceof Error ? err.message : "Failed to prepare upload");
      }
      return false;
    }
  };

  const performDropUploads = async (password: string) => {
    const files = droppedFilesRef.current;
    droppedFilesRef.current = null;
    if (!files || files.length === 0) return;

    // Check if any file has a relative path (folder upload)
    const hasFolderStructure = files.some(
      (f) => ((f as File & { webkitRelativePath?: string }).webkitRelativePath || "").includes("/")
    );

    let pathToId = new Map<string, string>();
    if (hasFolderStructure) {
      try {
        const rootId = selectedNode.type === "folder" ? selectedNode.folderId : null;
        const folderInfos = folders.map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId,
        }));
        pathToId = await ensureFolderStructure(files, rootId, folderInfos);
        // Refresh folders after creating new ones
        await fetchFolders();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create folder structure");
        return;
      }
    }

    const newItems: UploadTrayItem[] = files.map((f) => ({
      id: Math.random().toString(36).slice(2),
      name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
      progress: 0,
      status: "uploading",
    }));
    setUploadTray((prev) => [...prev, ...newItems]);

    const fallbackFolderId = selectedNode.type === "folder" ? selectedNode.folderId : null;
    for (let i = 0; i < files.length; i++) {
      const folderId = hasFolderStructure
        ? getFolderIdForFile(files[i], pathToId, fallbackFolderId)
        : fallbackFolderId;
      await performUploadFileToFolder(files[i], password, newItems[i].id, folderId);
    }
    await fetchFiles();
    if (selectedNode.type === "folder") {
      await syncExistingFolderShares(selectedNode.folderId);
    }
  };

  const downloadFileWithCredential = async (
    file: BulkDownloadFile,
    credential: string
  ): Promise<DownloadAttemptResult> => {
    let failureKind: DownloadFailureKind = "storage";
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/${file.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401) {
          navigate("/login");
          return {
            success: false,
            error: mapDownloadHttpError(response.status),
            failureKind: "auth",
          };
        }
        return {
          success: false,
          error: mapDownloadHttpError(response.status),
          failureKind: response.status >= 500 ? "storage" : "unknown",
        };
      }

      failureKind = "metadata";
      const metadataStr = response.headers.get("X-File-Metadata") ?? file.metadata;
      let metadataObj: { iv?: string; salt?: string; credential_scheme?: string };
      try {
        metadataObj = JSON.parse(metadataStr);
      } catch {
        throw new Error("Invalid file metadata format");
      }

      if (!metadataObj.iv) throw new Error("Missing encryption IV");

      const iv = new Uint8Array(base64ToArrayBuffer(metadataObj.iv));
      const wrappedKeyB64 = response.headers.get("X-Wrapped-Key");
      metadataObj.salt ||= legacyFileRequestSalt(metadataObj, wrappedKeyB64);
      const isDropUpload = !metadataObj.salt;
      let encryptionKey: CryptoKey;
      let finalDecryptVerifiesCredential = false;

      failureKind = "unknown";
      const credentialScheme = metadataObj.credential_scheme;
      const cachedFileKey = sessionVault.getFileKey(file.id);
      if (cachedFileKey) {
        encryptionKey = cachedFileKey;
      } else if (credentialScheme === "folder" && wrappedKeyB64) {
        const folderId = file.folder_id || (selectedNode.type === "folder" ? selectedNode.folderId : null);
        if (!folderId) {
          throw new Error("Folder ID not specified for folder-wrapped file.");
        }
        const folderKey = sessionVault.getFolderKey(folderId);
        if (!folderKey) {
          throw new Error("Folder key not found. Please re-open the folder to unlock it.");
        }
        encryptionKey = await unwrapKeyWithAES(folderKey, wrappedKeyB64);
      } else if (isDropUpload && file.is_owner !== false && (file.pin_wrapped_key || wrappedKeyB64)) {
        failureKind = "credential";
        const pinWrapped = file.pin_wrapped_key || wrappedKeyB64 || "";
        const rawKey = await unwrapKey(credential, pinWrapped);
        const keyBytes = hexToBytes(rawKey);
        encryptionKey = await crypto.subtle.importKey(
          "raw",
          new Uint8Array(keyBytes),
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"]
        );
        failureKind = "unknown";
      } else if (wrappedKeyB64 && file.is_owner === false) {
        const sessionKey = sessionVault.getPrivateKey();
        let rsaPrivateKey: CryptoKey;
        if (sessionKey) {
          rsaPrivateKey = sessionKey;
        } else {
          const userObj = getStoredUserFromLocalStorage();
          const privateKeyPinEncrypted = userObj?.private_key_pin_encrypted ?? null;
          if (!privateKeyPinEncrypted) {
            throw new Error("PIN-encrypted private key not found. Please re-set your PIN in Settings.");
          }
          failureKind = "credential";
          const privateKeyPem = await decryptPrivateKeyWithPIN(credential, privateKeyPinEncrypted, userObj?.kek_envelope_version);
          rsaPrivateKey = await importRSAPrivateKey(privateKeyPem);
          sessionVault.setPrivateKey(rsaPrivateKey);
        }
        failureKind = "unknown";
        encryptionKey = await unwrapKeyWithRSA(rsaPrivateKey, wrappedKeyB64);
      } else {
        finalDecryptVerifiesCredential = true;
        failureKind = "credential";
        const salt = new Uint8Array(base64ToArrayBuffer(metadataObj.salt!));
        encryptionKey = await deriveKeyFromPassword(credential, salt, 100000);
      }

      failureKind = finalDecryptVerifiesCredential ? "credential" : "unknown";
      const encryptedBlob = await response.blob();
      const encryptedData = await encryptedBlob.arrayBuffer();
      const decryptedData = await decryptFile(encryptedData, encryptionKey, iv);
      // A derived key is only trustworthy after authenticated decryption succeeds.
      // Otherwise a wrong PIN would poison the cache and defeat later retries.
      sessionVault.setFileKey(file.id, encryptionKey);

      const decryptedBlob = new Blob([decryptedData]);
      const url = window.URL.createObjectURL(decryptedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: failureKind === "credential"
          ? "Incorrect PIN or file credential. Please try again."
          : err instanceof Error ? err.message : "Decryption failed",
        failureKind,
      };
    }
  };

  const handleDownload = async (
    fileId: string,
    filename: string,
    metadata: string,
    pin_wrapped_key?: string,
    is_owner?: boolean,
    folder_id?: string | null
  ) => {
    const cachedFileKey = sessionVault.getFileKey(fileId);
    const scheme = getFileCredentialScheme({ pin_wrapped_key, metadata, is_owner });
    const targetFolderId = folder_id || (selectedNode.type === "folder" ? selectedNode.folderId : null);

    if (cachedFileKey) {
      setDownloadingFileIds((prev) => { const n = new Set(prev); n.add(fileId); return n; });
      setDownloading(true);
      setError("");
      try {
        const result = await downloadFileWithCredential(
          { id: fileId, filename, metadata, pin_wrapped_key, is_owner, folder_id: targetFolderId },
          ""
        );
        if (!result.success) setError(result.error ?? "Download failed");
      } finally {
        setDownloading(false);
        setDownloadingFileIds((prev) => { const n = new Set(prev); n.delete(fileId); return n; });
      }
      return;
    }

    if (scheme === "folder" && targetFolderId) {
      const folderKey = sessionVault.getFolderKey(targetFolderId);
      if (folderKey) {
        setDownloadingFileIds((prev) => { const n = new Set(prev); n.add(fileId); return n; });
        setDownloading(true);
        setError("");
        try {
          const result = await downloadFileWithCredential(
            { id: fileId, filename, metadata, pin_wrapped_key, is_owner, folder_id: targetFolderId },
            ""
          );
          if (!result.success) setError(result.error ?? "Download failed");
        } finally {
          setDownloading(false);
          setDownloadingFileIds((prev) => { const n = new Set(prev); n.delete(fileId); return n; });
        }
        return;
      }
    }

    if (is_owner === false && !pin_wrapped_key && scheme !== "folder") {
      const sessionKey = sessionVault.getPrivateKey();
      if (sessionKey) {
        setDownloadingFileIds((prev) => { const n = new Set(prev); n.add(fileId); return n; });
        setDownloading(true);
        setError("");
        try {
          const result = await downloadFileWithCredential(
            { id: fileId, filename, metadata, pin_wrapped_key, is_owner, folder_id: targetFolderId },
            ""
          );
          if (!result.success) setError(result.error ?? "Download failed");
        } finally {
          setDownloading(false);
          setDownloadingFileIds((prev) => { const n = new Set(prev); n.delete(fileId); return n; });
        }
        return;
      }
    }

    const cached = sessionVault.getCredential();
    if (cached && ((scheme !== "password" && cached.type === "pin") || (scheme === "password" && cached.type === "password"))) {
      setDownloadingFileIds((prev) => { const n = new Set(prev); n.add(fileId); return n; });
      setDownloading(true);
      setError("");
      try {
        const result = await downloadFileWithCredential(
          { id: fileId, filename, metadata, pin_wrapped_key, is_owner, folder_id: targetFolderId },
          cached.value,
        );
        if (!result.success) {
          if (result.failureKind === "credential") {
            sessionVault.clearCredential();
            setPendingDownload({
              fileId,
              filename,
              metadata,
              pin_wrapped_key,
              is_owner,
              folder_id: targetFolderId,
            });
            setPasswordAction("download");
            setShowPasswordModal(true);
          } else {
            setError(result.error ?? "Download failed");
          }
        }
      } finally {
        setDownloading(false);
        setDownloadingFileIds((prev) => { const n = new Set(prev); n.delete(fileId); return n; });
      }
      return;
    }

    // If folder key needs decryption, we will prompt using standard password modal
    if (scheme === "folder" && targetFolderId) {
      const sharedFolder = sharedFolders.find((f) => f.id === targetFolderId);
      if (sharedFolder) {
        setPendingSharedFolder(sharedFolder);
        setPasswordAction("decrypt-folder");
        setShowPasswordModal(true);
        return;
      }
    }

    setPendingDownload({ fileId, filename, metadata, pin_wrapped_key, is_owner, folder_id: targetFolderId });
    setPasswordAction("download");
    setShowPasswordModal(true);
  };

  const performDownload = async (password: string): Promise<boolean> => {
    if (!pendingDownload) return false;
    const fileId = pendingDownload.fileId;
    setDownloadingFileIds((prev) => { const n = new Set(prev); n.add(fileId); return n; });
    setDownloading(true);
    setError("");
    try {
      const result = await downloadFileWithCredential(
        {
          id: pendingDownload.fileId,
          filename: pendingDownload.filename,
          metadata: pendingDownload.metadata,
          pin_wrapped_key: pendingDownload.pin_wrapped_key,
          is_owner: pendingDownload.is_owner,
          folder_id: pendingDownload.folder_id,
        },
        password
      );
      if (!result.success) {
        if (result.failureKind === "credential") {
          sessionVault.clearCredential();
          setEncryptionPassword("");
        }
        throw new Error(result.error);
      }
      setPendingDownload(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download or decrypt file");
      return false;
    } finally {
      setDownloading(false);
      setDownloadingFileIds((prev) => { const n = new Set(prev); n.delete(fileId); return n; });
    }
  };

  const handleDeleteClick = (fileId: string, filename: string) => {
    const file = myFiles.find((f) => f.id === fileId);
    setFileToDelete({ id: fileId, filename, parent_hash: file?.parent_hash ?? null });
    setShowDeleteModal(true);
  };

  const handleMoveClick = async (file: FileData) => {
    const latestFolders = await fetchFolders();
    setMoveFolders(latestFolders);
    setFileToMove(file);
    setShowMoveFileModal(true);
    setOpenActionMenu(null);
    setFileContextMenu(null);
  };

  const handleMoveFileSubmit = async (targetFolderId: string) => {
    if (!fileToMove) return;

    setMovingFile(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/${fileToMove.id}/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ folder_id: targetFolderId }),
      });

      if (!response.ok) {
        if (response.status === 401) { navigate("/login"); return; }
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to move file");
      }

      await fetchFiles();
      await fetchFolders();
      await syncExistingFolderShares(targetFolderId);
      const destinationName = buildMoveTargetOptions(folders, fileToMove.folder_id ?? null)
        .find((folder) => folder.id === targetFolderId)?.name ?? "the selected folder";
      setSuccessMessage(`Moved ${fileToMove.filename} to ${destinationName}.`);
      setTimeout(() => setSuccessMessage(""), 5000);
      setShowMoveFileModal(false);
      setFileToMove(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move file");
    } finally {
      setMovingFile(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    const target = fileToDelete;
    setShowDeleteModal(false);
    setFileToDelete(null);
    setDeletingFileIds((prev) => { const n = new Set(prev); n.add(target.id); return n; });
    setDeleting(true);
    setError("");
    try {
      if (!navigator.onLine) {
        const ownerId = getStoredUserFromLocalStorage()?.id;
        if (!ownerId) throw new Error("Cannot queue this delete because the signed-in owner could not be verified.");
        await queueOfflineAction({
          type: "delete",
          owner_id: ownerId,
          file_id: target.id,
          filename: target.filename,
          parent_hash: target.parent_hash || "",
          updated_at: new Date().toISOString(),
        });
        window.dispatchEvent(new Event("offline-action-queued"));

        setSuccessMessage(`Queued delete for ${target.filename}. The file stays visible until the server confirms it.`);
        setTimeout(() => setSuccessMessage(""), 5000);
        return;
      }

      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/${target.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401) { navigate("/login"); return; }
        throw new Error("Failed to delete file");
      }
      mutateMyFiles((prev = []) => prev.filter((f) => f.id !== target.id), { revalidate: false });
      mutateMyFiles();
      setSelectedFileIds((prev) => { const n = new Set(prev); n.delete(target.id); return n; });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete file");
    } finally {
      setDeleting(false);
      setDeletingFileIds((prev) => { const n = new Set(prev); n.delete(target.id); return n; });
    }
  };

  const handleBulkDeleteClick = () => {
    if (bulkDeleteCandidates.length === 0) return;
    setShowBulkDeleteModal(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (bulkDeleteCandidates.length === 0) return;

    setBulkDeleting(true);
    setError("");

    if (!navigator.onLine) {
      try {
        const ownerId = getStoredUserFromLocalStorage()?.id;
        if (!ownerId) throw new Error("Cannot queue deletes because the signed-in owner could not be verified.");
        for (const file of bulkDeleteCandidates) {
          await queueOfflineAction({
            type: "delete",
            owner_id: ownerId,
            file_id: file.id,
            filename: file.filename,
            parent_hash: file.parent_hash || "",
            updated_at: new Date().toISOString(),
          });
        }
        window.dispatchEvent(new Event("offline-action-queued"));

        setSuccessMessage(`Queued ${bulkDeleteCandidates.length} deletes. Files stay visible until the server confirms them.`);
        setTimeout(() => setSuccessMessage(""), 5000);
        setShowBulkDeleteModal(false);
      } catch {
        setError("Failed to queue offline bulk delete");
      } finally {
        setBulkDeleting(false);
      }
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const succeededIds: string[] = [];
    const failedFiles: string[] = [];

    try {
      for (const file of bulkDeleteCandidates) {
        try {
          const response = await fetch(`${API_URL}/files/${file.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!response.ok) {
            if (response.status === 401) {
              navigate("/login");
              return;
            }
            failedFiles.push(file.filename);
            continue;
          }

          succeededIds.push(file.id);
        } catch {
          failedFiles.push(file.filename);
        }
      }

      if (succeededIds.length > 0) {
        const deletedIds = new Set(succeededIds);
        mutateMyFiles((prev = []) => prev.filter((file) => !deletedIds.has(file.id)), { revalidate: false });
        mutateMyFiles();
        setSelectedFileIds((prev) => {
          const next = new Set(prev);
          succeededIds.forEach((id) => {
            next.delete(id);
          });
          return next;
        });
      }

      if (failedFiles.length > 0) {
        const failedList = failedFiles.slice(0, 3).join(", ");
        const remainingCount = failedFiles.length - Math.min(failedFiles.length, 3);
        setError(
          succeededIds.length > 0
            ? `Deleted ${succeededIds.length} of ${bulkDeleteCandidates.length} files. Failed: ${failedList}${remainingCount > 0 ? ` and ${remainingCount} more` : ""}.`
            : `Failed to delete the selected files: ${failedList}${remainingCount > 0 ? ` and ${remainingCount} more` : ""}.`
        );
      }

    } finally {
      setShowBulkDeleteModal(false);
      setBulkDeleting(false);
    }
  };

  const handleShareClick = (fileId: string, filename: string, metadata?: string, pin_wrapped_key?: string) => {
    setFileToShare({ id: fileId, filename, metadata, pin_wrapped_key, folder_id: myFiles.find((file) => file.id === fileId)?.folder_id });
    setShowShareModal(true);
  };

  const handleCreateShareLink = (file: FileData) => {
    setFileForShareLink({
      id: file.id,
      filename: file.filename,
      metadata: file.metadata,
      pin_wrapped_key: file.pin_wrapped_key,
      folder_id: file.folder_id,
    });
    setShowShareLinkModal(true);
  };

  const handleManageSharesClick = async (fileId: string, filename: string) => {
    setFileToManage({ id: fileId, filename });
    setShowManageSharesModal(true);
    setLoadingShares(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/${fileId}/shares`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401) { navigate("/login"); return; }
        throw new Error("Failed to fetch shared users");
      }
      const data = await response.json();
      setSharedUsers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shared users");
    } finally {
      setLoadingShares(false);
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    if (!fileToManage) return;
    setRevoking(userId);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/files/${fileToManage.id}/revoke/${userId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        if (response.status === 401) { navigate("/login"); return; }
        throw new Error("Failed to revoke access");
      }
      setSharedUsers((prev) => prev.filter((u) => u.user_id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke access");
    } finally {
      setRevoking(null);
    }
  };

  const handleShareFolder = (folderId: string, folderName: string) => {
    setFolderForShare({ id: folderId, name: folderName });
    setShowFolderShareModal(true);
  };

  const handleManageCollaborators = (folderId: string, folderName: string) => {
    setFolderForCollaborators({ id: folderId, name: folderName });
    setShowCollaboratorsModal(true);
  };

  const handleCreateUploadLinkForFolder = (folderId: string, folderName: string) => {
    setUploadLinkTargetFolder({ id: folderId, name: folderName });
    setShowCreateUploadLinkModal(true);
    setShowFolderShareModal(false);
    setFolderForShare(null);
  };

  const handleManageFolderShares = (folderId: string, folderName: string) => {
    setSelectedNode({ type: "manage-folder-shares", folderId, folderName });
    setSidebarOpen(false);
  };

  const openCreateFolderModal = (parentId: string | null = null) => {
    setFolderModalMode("create");
    setFolderModalParentId(parentId);
    setFolderToEdit(null);
    setShowFolderModal(true);
  };

  const openRenameFolderModal = (folderId: string, name: string) => {
    setFolderModalMode("rename");
    setFolderToEdit({ id: folderId, name });
    setFolderModalParentId(null);
    setShowFolderModal(true);
  };

  const openDeleteFolderModal = (folderId: string, name: string) => {
    setFolderToDelete({
      id: folderId,
      name,
      hasSubfolders: folders.some((folder) => folder.parentId === folderId),
    });
    setShowDeleteFolderModal(true);
  };

  const handleFolderModalSubmit = async (name: string) => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    if (folderModalMode === "create") {
      const response = await fetch(`${API_URL}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, parentId: folderModalParentId || undefined }),
      });
      if (!response.ok) { const e = await response.json(); throw new Error(e.error || "Failed to create folder"); }
      const createdFolder = await response.json();
      if (createdFolder?.id && createdFolder?.name) {
        setSelectedNode({ type: "folder", folderId: createdFolder.id, folderName: createdFolder.name });
      }
    } else {
      if (!folderToEdit) return;
      const response = await fetch(`${API_URL}/folders/${folderToEdit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) { const e = await response.json(); throw new Error(e.error || "Failed to rename folder"); }
      const updatedFolder = await response.json();
      if (
        updatedFolder?.id &&
        updatedFolder?.name &&
        selectedNode.type === "folder" &&
        selectedNode.folderId === updatedFolder.id
      ) {
        setSelectedNode({ type: "folder", folderId: updatedFolder.id, folderName: updatedFolder.name });
      }
    }
    await fetchFolders();
    setShowFolderModal(false);
    setFolderToEdit(null);
    setFolderModalParentId(null);
  };

  const handleDeleteFolderConfirm = async () => {
    if (!folderToDelete) return;
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    const deletedFolderSubtree = collectFolderDescendantIds(folders, folderToDelete.id);
    const response = await fetch(`${API_URL}/folders/${folderToDelete.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) { const e = await response.json(); throw new Error(e.error || "Failed to delete folder"); }
    await fetchFolders();
    if (selectedNode.type === "folder" && deletedFolderSubtree.has(selectedNode.folderId)) {
      setSelectedNode({ type: "all" });
    }
    setShowDeleteFolderModal(false);
    setFolderToDelete(null);
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedFileIds(new Set());
      return;
    }

    setSelectedFileIds(new Set(visibleFiles.map((file) => file.id)));
  };

  const handleSort = (field: "name" | "date" | "size") => {
    if (sortBy === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  const isSharedView = selectedNode.type === "shared";
  const currentUser = getStoredUserFromLocalStorage();
  const ownerUsesPin = Boolean(currentUser?.pin_set);

  async function handlePasswordSubmit() {
    if (!encryptionPassword) return;
    const password = encryptionPassword;
    let success = false;
    if (passwordAction === "upload") {
      success = await performUpload(password);
    } else if (passwordAction === "download") {
      success = await performDownload(password);
    } else if (passwordAction === "drop-upload") {
      setShowPasswordModal(false);
      setEncryptionPassword("");
      setPasswordAction(null);
      await performDropUploads(password);
      return;
    } else if (passwordAction === "decrypt-folder") {
      if (currentUser?.private_key_pin_encrypted && pendingSharedFolder) {
        try {
          const privateKeyPem = await decryptPrivateKeyWithPIN(
            password,
            currentUser.private_key_pin_encrypted,
            currentUser.kek_envelope_version,
          );
          const privateKey = await importRSAPrivateKey(privateKeyPem);
          sessionVault.setPrivateKey(privateKey);
          sessionVault.setCredential(password, ownerUsesPin ? "pin" : "password");

          const folderKey = await unwrapKeyWithRSA(privateKey, pendingSharedFolder.wrapped_key);
          sessionVault.setFolderKey(pendingSharedFolder.id, folderKey);

          setShowPasswordModal(false);
          setEncryptionPassword("");
          setPasswordAction(null);
          setPendingSharedFolder(null);
          return;
        } catch {
          setError("Failed to decrypt your private key. Please check your PIN/password.");
          return;
        }
      }
    }
    if (success) {
      if (passwordAction === "upload") {
        sessionVault.setCredential(password, ownerUsesPin ? "pin" : "password");
      } else if (passwordAction === "download" && pendingDownload) {
        const scheme = getFileCredentialScheme(pendingDownload);
        sessionVault.setCredential(password, scheme === "password" ? "password" : "pin");
      }
      setShowPasswordModal(false);
      setEncryptionPassword("");
      setPasswordAction(null);
    }
  }

  const panelTitle = (() => {
    switch (selectedNode.type) {
      case "all": return "All Files";
      case "starred": return "Starred";
      case "shared": return "Shared with Me";
      case "folder": return selectedNode.folderName;
      case "manage-folder-shares": return `${selectedNode.folderName} · Shared Links`;
      case "drop-link": return selectedNode.linkName;
      case "manage-drops": return "Client Upload Links";
      case "manage-requests": return "File Requests";
    }
  })();

  return (
    <>
      <div className="h-full flex flex-col" inert={bulkDownloadFiles !== null || showPasswordModal}>
        <div className="px-6 pt-6 pb-4 border-b border-border/60">
          <h1 className="text-2xl font-bold text-foreground">{t("drive:vault.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("drive:vault.subtitle")}
          </p>
        </div>


        {firstTask && <FirstTaskGuide
          task={firstTask}
          fileCount={isLoading || myFilesError ? null : myFiles.length}
          onUpload={() => document.getElementById("file-input")?.click()}
          onReceive={() => setShowCreateUploadLinkModal(true)}
          onShare={() => {
            setSelectedNode({ type: "all" });
            requestAnimationFrame(() => document.querySelector<HTMLElement>('[id^="file-row-"] button')?.focus());
          }}
          onDismiss={() => navigate(location.pathname, { replace: true, state: { ...routeState, onboardingTask: undefined } })}
        />}

        <FileSearch
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          disabled={bulkDownloadFiles !== null || showPasswordModal}
        />

        <div className="flex flex-1 overflow-hidden">
          {sidebarOpen && (
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/30 md:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close vault sidebar"
            />
          )}

          <aside
            className={`
              w-60 shrink-0 border-r border-border/60 bg-card overflow-y-auto
              md:relative md:translate-x-0
              fixed inset-y-0 left-0 z-50 transition-transform duration-300
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            `}
          >
            <VaultTree
              selected={selectedNode}
              onSelect={(node) => {
                setSelectedNode(node);
                setSelectedFileIds(new Set());
                setSidebarOpen(false);
              }}
              folders={folders}
              dropTokens={dropTokens}
              allFilesCount={myFiles.length}
              starredCount={starredCount}
              sharedCount={sharedFiles.length}
              fileCountsByFolderId={folderFileCounts}
              onCreateFolder={() => openCreateFolderModal()}
              onCreateSubfolder={(parentId) => openCreateFolderModal(parentId)}
              onRenameFolder={openRenameFolderModal}
              onDeleteFolder={openDeleteFolderModal}
              onShareFolder={handleShareFolder}
              onCollectUploadsForFolder={handleCreateUploadLinkForFolder}
              onManageShareFolder={handleManageFolderShares}
              onCollaborateFolder={handleManageCollaborators}
            />
          </aside>

          <main className="flex-1 flex flex-col overflow-hidden bg-muted">
            {selectedNode.type === "manage-drops" ? (
              <div className="flex-1 overflow-auto p-6">
                <UploadLinksSection initialToken={manageDropToken} />
              </div>
            ) : selectedNode.type === "manage-requests" ? (
              <div className="flex-1 overflow-auto p-6">
                <FileRequestsSection />
              </div>
            ) : selectedNode.type === "manage-folder-shares" ? (
              <FolderSharedLinksSection
                folder={{ id: selectedNode.folderId, name: selectedNode.folderName }}
                onCreateLink={() => handleShareFolder(selectedNode.folderId, selectedNode.folderName)}
                onStatusMessage={(message) => {
                  setSuccessMessage(message);
                  setTimeout(() => setSuccessMessage(""), 5000);
                }}
                refreshKey={folderSharePanelVersion}
              />
            ) : (
            <>
            <div className="flex flex-col items-stretch gap-3 px-3 py-4 border-b border-border/60 bg-background shrink-0 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-start gap-1.5 sm:items-center sm:gap-2">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors mr-1"
                >
                  <Menu className="w-4 h-4" />
                </button>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-muted-foreground sm:gap-2">
                  <span className="break-words text-muted-foreground">{t("drive:vault.title")}</span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  <span className="min-w-0 break-words font-medium text-foreground">{panelTitle}</span>

                  <span className="ml-1 text-xs text-muted-foreground">
                    ({visibleFiles.length})
                  </span>
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  {(["name", "date", "size"] as const).map((field) => (
                    <button
                      type="button"
                      key={field}
                      onClick={() => handleSort(field)}
                      className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                        sortBy === field
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "border-border text-muted-foreground hover:border-border"
                      }`}
                    >
                      {field.charAt(0).toUpperCase() + field.slice(1)}{" "}
                      {sortBy === field ? (sortAsc ? "↑" : "↓") : ""}
                    </button>
                  ))}
                </div>

                {!isSharedView && (
                  <>
                    <label
                      htmlFor="file-input"
                      className="cursor-pointer inline-flex min-w-0 items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {t("drive:vault.upload")}
                    </label>

                    <input
                      id="file-input"
                      type="file"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <label
                      htmlFor="folder-input"
                      className="cursor-pointer inline-flex min-w-0 items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      {t("drive:vault.folder")}
                    </label>

                    <input
                      id="folder-input"
                      type="file"
                      className="hidden"
                      onChange={handleFolderSelect}
                      {...{ webkitdirectory: "", directory: "" } as Record<string, string>}
                    />
                  </>
                )}
              </div>
            </div>

            {selectedFile && !isSharedView && (
              <div className="mx-6 mt-4 flex items-center gap-3 p-3 bg-primary/10 border border-primary/40 rounded-xl shrink-0">
                <File className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-foreground font-medium flex-1 truncate">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-foreground">
                  {formatBytes(selectedFile.size)}
                </span>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 px-3 text-xs"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t("drive:vault.encryptAndUpload")}
                </Button>

                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-primary/60 hover:text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {error && (
              <div className="mx-6 mt-4 flex items-center gap-3 p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-sm shrink-0">
                <div className="w-7 h-7 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                </div>
                <span className="text-destructive font-medium">{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="mx-6 mt-4 flex items-center gap-3 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm shrink-0">
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-emerald-800 dark:text-emerald-200 font-medium">{successMessage}</span>
              </div>
            )}

            {(foldersError || dropTokensError) && (
              <div className="mx-6 mt-4 space-y-2" role="status">
                {foldersError && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                    <span>{t("drive:vault.source.foldersStale", { defaultValue: "Folder navigation may be out of date." })} {foldersError}</span>
                    <button type="button" className="font-semibold text-primary hover:underline" onClick={() => void fetchFolders()}>{t("drive:vault.source.retryFolders", { defaultValue: "Retry folders" })}</button>
                  </div>
                )}
                {dropTokensError && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                    <span>{t("drive:vault.source.uploadLinksStale", { defaultValue: "Upload-link navigation may be out of date." })} {dropTokensError}</span>
                    <button type="button" className="font-semibold text-primary hover:underline" onClick={() => void fetchDropTokens()}>{t("drive:vault.source.retryUploadLinks", { defaultValue: "Retry upload links" })}</button>
                  </div>
                )}
              </div>
            )}

            <div ref={fileContainerRef} className="flex-1 overflow-y-auto px-6 py-4">
              {activeViewError && visibleFiles.length > 0 && (
                <p role="status" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                  Showing the last loaded files. {activeViewError}
                </p>
              )}

              {activeViewError && visibleFiles.length === 0 && (
                <DataState error={activeViewError} onRetry={retryActiveView}>{null}</DataState>
              )}

              {!activeViewError && activeViewLoading && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mb-3" />
                  <p className="text-sm">{t("drive:vault.loading")}</p>
                </div>
              )}


              {!activeViewLoading && selectedNode.type === "shared" && sharedFolders.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                    Shared Folders
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {sharedFolders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => setSelectedNode({ type: "folder", folderId: folder.id, folderName: folder.name })}
                        className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left group cursor-pointer select-none"
                      >
                        <FolderIcon className="w-8 h-8 text-primary group-hover:scale-105 transition-transform shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground text-sm truncate">{folder.name}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">Shared by {folder.shared_by || "Unknown"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!activeViewLoading && visibleFiles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <FolderOpen className="w-12 h-12 mb-3 stroke-[1.5]" />
                  <p className="text-base font-medium text-foreground">
                    {searchQuery
                      ? t("drive:vault.noSearchResults")
                      : selectedNode.type === "starred"
                        ? t("drive:vault.noStarredFiles")
                        : selectedNode.type === "shared"
                          ? t("drive:vault.noSharedFiles")
                          : t("drive:vault.noFilesInFolder")}
                  </p>

                  {selectedNode.type === "all" && !isSharedView && (
                    <p className="text-xs mt-1.5 text-muted-foreground max-w-xs text-center">
                      {t("drive:vault.uploadPrompt")}
                    </p>
                  )}

                </div>
              )}

              {!activeViewLoading && visibleFiles.length > 0 && (
                <FileGrid
                  files={visibleFiles}
                  selectedFileIds={selectedFileIds}
                  toggleFileSelection={toggleFileSelection}
                  toggleSelectAllVisible={toggleSelectAllVisible}
                  allVisibleSelected={allVisibleSelected}
                  headerCheckboxRef={headerCheckboxRef}
                  onDownload={(file) => handleDownload(file.id, file.filename, file.metadata, file.pin_wrapped_key || undefined, file.is_owner, file.folder_id)}
                  onCreateShareLink={handleCreateShareLink}
                  onToggleStar={toggleStar}
                  onAccessPanel={(file) => {
                    setLastInteractedFileId(file.id);
                    setAccessPanelFile(file);
                  }}
                  onShareClick={(fileId, filename, metadata, pinWrappedKey) => {
                    setLastInteractedFileId(fileId);
                    handleShareClick(fileId, filename, metadata, pinWrappedKey);
                  }}
                  onQuickShare={handleQuickShare}
                  onManageSharesClick={(file) => handleManageSharesClick(file.id, file.filename)}
                  onMoveClick={(file) => { void handleMoveClick(file); }}
                  onDeleteClick={(file) => handleDeleteClick(file.id, file.filename)}
                  onPreviewClick={(file) => {
                    setLastInteractedFileId(file.id);
                    setPreviewFile({
                      ...file,
                      folder_id: file.folder_id || (selectedNode.type === "folder" ? selectedNode.folderId : null),
                    });
                  }}
                  onContextMenu={(event, file) => {
                    if (file.is_owner === false) return;
                    event.preventDefault();
                    setOpenActionMenu(null);
                    setFileContextMenu({
                      file,
                      x: Math.min(event.clientX, window.innerWidth - 220),
                      y: Math.min(event.clientY, window.innerHeight - 120),
                    });
                  }}
                  setOpenActionMenu={setOpenActionMenu}
                  openActionMenu={openActionMenu}
                  onOpenReceipt={(file) => {
                    setLastInteractedFileId(file.id);
                    setReceiptFile(file);
                  }}
                  downloadingFileIds={downloadingFileIds}
                  deletingFileIds={deletingFileIds}
                  focusedFileId={
                    focusedRowFileId || (focusedFileIndex >= 0 && visibleFiles[focusedFileIndex]?.id ? visibleFiles[focusedFileIndex].id : null)
                  }
                  sortBy={sortBy}
                  sortAsc={sortAsc}
                  onSort={handleSort}
                  onRowHover={handleRowHover}
                  onPassportClick={(file) => setPassportFile(file)}
                />
              )}
            </div>
            </>
            )}
          </main>
        </div>
      </div>

      <UploadZone isDragging={isDragging} />

      <AnimatePresence>
        {fileContextMenu && (
          <FileActionsMenu
            x={fileContextMenu.x}
            y={fileContextMenu.y}
            file={fileContextMenu.file}
            onMoveClick={(file) => {
              void handleMoveClick(file);
              setFileContextMenu(null);
            }}
          />
        )}
      </AnimatePresence>

      {cryptoEvent && (
        <details className="mx-4 my-3 max-w-xl rounded-xl border border-border bg-card p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">{t("drive:vault.encryptionDetails", { defaultValue: "Encryption details" })}</summary>
          <EncryptionProof event={cryptoEvent} />
        </details>
      )}

      {uploadTray.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 w-72 bg-card border border-border rounded-xl shadow-2xl p-3 space-y-2">
          <div className="flex justify-between items-center text-muted-foreground text-xs font-medium px-1">
            <span>{t("drive:vault.uploads")}</span>
            <button type="button" onClick={() => setUploadTray([])} className="hover:text-foreground">✕</button>

          </div>
          {uploadTray.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-foreground text-xs truncate">{item.name}</p>
                {item.message && <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{item.message}</p>}
                <div className="h-1 bg-muted rounded mt-1">
                  <div
                    className="h-1 bg-emerald-500 rounded transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
              <span className="text-xs shrink-0">
                {item.status === "done" ? "✓" : item.status === "error" ? "✗" : item.status === "unknown" ? "?" : "…"}
              </span>
            </div>
          ))}
        </div>
      )}

      {bulkDownloadFiles === null && <BulkActionBar
        selectedCount={selectedVisibleFiles.length}
        deletableCount={deletableSelectedCount}
        scopeLabel={t("drive:vault.bulk.inView", { defaultValue: "in this view" })}
        onDownload={() => {
          if (selectedBulkFiles.length > 0) setBulkDownloadFiles(selectedBulkFiles);
        }}
        onDelete={handleBulkDeleteClick}
        onClear={() => setSelectedFileIds(new Set())}
      />}

      {bulkDownloadFiles !== null && (
        <BulkDownloadModal
          files={bulkDownloadFiles}
          onDownloadFile={downloadFileWithCredential}
          onClose={() => { setBulkDownloadFiles(null); setSelectedFileIds(new Set()); }}
        />
      )}

      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={() => {
            handleDownload(previewFile.id, previewFile.filename, previewFile.metadata, previewFile.pin_wrapped_key || undefined, previewFile.is_owner, previewFile.folder_id);
            setPreviewFile(null);
          }}
        />
      )}

      {showPasswordModal && (() => {
        const credScheme = pendingDownload ? getFileCredentialScheme(pendingDownload) : "password";
        const isUpload = passwordAction === "upload" || passwordAction === "drop-upload";
        const usePin = isUpload ? ownerUsesPin : credScheme !== "password";
        return (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vault-credential-title"
        >
          <Card className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-gradient-to-br from-primary to-primary/90 border-primary-foreground/20 text-primary-foreground">
            <CardHeader className="border-b border-primary-foreground/20">
              <CardTitle id="vault-credential-title" className="flex items-center gap-2 text-primary-foreground">
                <Lock className="w-5 h-5 text-primary-foreground" />
                {isUpload
                  ? (ownerUsesPin ? t("drive:vault.passwordModal.usePin") : t("drive:vault.passwordModal.encryptFile"))
                  : usePin ? t("drive:vault.passwordModal.enterPin") : t("drive:vault.passwordModal.decryptFile")}
              </CardTitle>

              <CardDescription className="text-primary-foreground/80">
                {isUpload
                  ? ownerUsesPin
                    ? t("drive:vault.passwordModal.pinUploadDesc")
                    : t("drive:vault.passwordModal.passwordUploadDesc")
                  : usePin
                  ? t("drive:vault.passwordModal.pinDownloadDesc")
                  : t("drive:vault.passwordModal.passwordDownloadDesc")}
              </CardDescription>
              {!isUpload && pendingDownload?.is_owner !== false && (credScheme === "pin" || credScheme === "password" || credScheme === "drop-pin") && (
                <p className="text-sm text-primary-foreground" id="original-file-credential-help">
                  {t("drive:vault.passwordModal.originalCredential", { defaultValue: "Use the PIN or file password that encrypted this file. If you reset your account or changed your PIN, an older file may still need its original credential. If it is lost, ask the sender for another copy or use your backup." })}
                </p>
              )}

            </CardHeader>
            <form autoComplete="off" onSubmit={(event) => {
              event.preventDefault();
              if (encryptionPassword && (!usePin || /^\d{4}$/.test(encryptionPassword)) && !uploading && !downloading) {
                void handlePasswordSubmit();
              }
            }}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-primary/60" />
                  <span>{error}</span>
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="vault-credential" className="text-sm font-medium flex items-center gap-2 text-primary-foreground">
                  <Key className="w-4 h-4" />
                  {usePin ? t("drive:vault.passwordModal.pinLabel") : t("drive:vault.passwordModal.credentialLabel")}
                </label>

                <input
                  id="vault-credential"
                  aria-describedby={!isUpload && pendingDownload?.is_owner !== false && (credScheme === "pin" || credScheme === "password" || credScheme === "drop-pin") ? "original-file-credential-help" : undefined}
                  name="vault-decryption-credential"
                  type="password"
                  disabled={uploading || downloading}
                  autoComplete={usePin ? "one-time-code" : "new-password"}
                  data-lpignore="true"
                  data-1p-ignore
                  autoFocus
                  inputMode={usePin ? "numeric" : undefined}
                  maxLength={usePin ? 4 : undefined}
                  value={encryptionPassword}
                  onChange={(e) => setEncryptionPassword(
                    usePin
                      ? e.target.value.replace(/\D/g, "").slice(0, 4)
                      : e.target.value
                  )}
                  placeholder={usePin ? t("drive:vault.passwordModal.placeholderPin") : t("drive:vault.passwordModal.placeholderCredential")}
                  className={`w-full px-3 py-2 border rounded-md bg-primary-foreground/15 border-primary-foreground/25 text-primary-foreground placeholder:text-primary-foreground/60 focus:border-primary-foreground/50 focus:bg-primary-foreground/20${usePin ? " text-center tracking-widest text-xl" : ""}`}

                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="modal-cancel"
                  disabled={uploading || downloading}
                  onClick={() => {
                    setShowPasswordModal(false);
                    setEncryptionPassword("");
                    setPasswordAction(null);
                    setPendingDownload(null);
                  }}
                  className="flex-1"
                >
                  {t("drive:vault.passwordModal.cancel", { defaultValue: "Cancel" })}
                </Button>
                <Button
                  type="submit"
                  disabled={!encryptionPassword || (usePin && !/^\d{4}$/.test(encryptionPassword)) || uploading || downloading}
                  className="flex-1 bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-semibold"
                >
                  {uploading || downloading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isUpload ? t("drive:vault.encrypting") : t("drive:vault.decrypting")}
                    </>
                  ) : isUpload ? (
                    t("drive:vault.encryptAndUpload")
                  ) : (
                    t("drive:vault.decryptAndDownload")
                  )}

                </Button>
              </div>
            </CardContent>
            </form>
          </Card>
        </div>
        );
      })()}

      <ShareModal
        isOpen={showShareModal}
        onClose={() => { setShowShareModal(false); setFileToShare(null); }}
        fileId={fileToShare?.id || ""}
        fileName={fileToShare?.filename || ""}
        fileMetadata={fileToShare?.metadata}
        pinWrappedKey={fileToShare?.pin_wrapped_key}
        folderId={fileToShare?.folder_id}
        onShareComplete={fetchFiles}
      />

      <FolderModal
        isOpen={showFolderModal}
        onClose={() => { setShowFolderModal(false); setFolderToEdit(null); setFolderModalParentId(null); }}
        onSubmit={handleFolderModalSubmit}
        mode={folderModalMode}
        initialName={folderToEdit?.name || ""}
        parentFolderName={folderModalParentId ? folders.find((f) => f.id === folderModalParentId)?.name : undefined}
      />

      <DeleteFolderModal
        isOpen={showDeleteFolderModal}
        onClose={() => { setShowDeleteFolderModal(false); setFolderToDelete(null); }}
        onConfirm={handleDeleteFolderConfirm}
        folderName={folderToDelete?.name || ""}
        hasSubfolders={folderToDelete?.hasSubfolders || false}
      />

      {showManageSharesModal && fileToManage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col bg-gradient-to-br from-primary to-primary/90 border-primary-foreground/20 text-primary-foreground">
            <CardHeader className="border-b border-primary-foreground/20">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-primary-foreground">
                  <Users className="w-5 h-5 text-primary-foreground" />
                  Manage File Shares
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowManageSharesModal(false); setFileToManage(null); setSharedUsers([]); }}
                  className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/15"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription className="text-primary-foreground/80">
                View and manage who has access to this file
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1">
              <div className="space-y-4">
                <div className="p-3 bg-primary-foreground/15 border border-primary-foreground/25 rounded-md">
                  <p className="text-sm font-medium truncate flex items-center gap-2 text-primary-foreground">
                    <File className="w-4 h-4" />
                    {fileToManage.filename}
                  </p>
                </div>
                {loadingShares ? (
                  <div className="text-center py-8 text-muted-foreground">Loading shared users…</div>
                ) : sharedUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-foreground">This file hasn't been shared yet</p>
                    <p className="text-sm text-muted-foreground mt-2">Use the Share button to give others access to this file</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Shared with {sharedUsers.length} user{sharedUsers.length !== 1 ? "s" : ""}
                    </p>
                    {sharedUsers.map((user) => (
                      <div key={user.user_id} className="flex items-center justify-between p-3 rounded-lg border border-border/20 bg-muted/5">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-foreground">{user.username}</p>
                          <div className="flex gap-3 text-sm text-muted-foreground">
                            <span>{user.email}</span>
                            <span>•</span>
                            <span>Shared {new Date(user.shared_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRevokeAccess(user.user_id)}
                          disabled={revoking === user.user_id}
                          className="gap-2 border-2 border-destructive/60 text-foreground hover:bg-destructive/20 bg-transparent"
                        >
                          <X className="w-4 h-4" />
                          {revoking === user.user_id ? "Revoking…" : "Revoke"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-3 bg-muted/5 border border-border/20 rounded-md">
                  <p className="text-xs text-foreground flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Revoking access will immediately prevent the user from downloading this file.</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showDeleteModal && fileToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-card border-border text-card-foreground">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Trash2 className="w-5 h-5 text-destructive" />
                {t("drive:vault.delete.title", { defaultValue: "Delete file" })}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {t("drive:vault.delete.description", { defaultValue: "Delete this file permanently? This action cannot be undone." })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted border border-border rounded-md">
                <p className="text-sm font-medium truncate text-foreground">{fileToDelete.filename}</p>
              </div>
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                <p className="text-xs text-foreground flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
                  <span>{t("drive:vault.delete.warning", { defaultValue: "The encrypted file will be permanently deleted from the server and cannot be recovered." })}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="modal-cancel"
                  onClick={() => { setShowDeleteModal(false); setFileToDelete(null); }}
                  disabled={deleting}
                  className="flex-1"
                >
                  {t("drive:vault.delete.cancel", { defaultValue: "Keep file" })}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))/0.9] text-destructive-foreground border-0"
                >
                  {deleting ? t("drive:vault.delete.deleting", { defaultValue: "Deleting…" }) : t("drive:vault.delete.confirm", { defaultValue: "Delete file" })}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showBulkDeleteModal && bulkDeleteCandidates.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto bg-card border-border text-card-foreground">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Trash2 className="w-5 h-5 text-destructive" />
                {t("drive:vault.bulkDelete.title", { defaultValue: "Delete {{count}} file", count: bulkDeleteCandidates.length })}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {t("drive:vault.bulkDelete.description", { defaultValue: "This permanently deletes the owned files in your selection. Shared files stay untouched." })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {bulkDeleteCandidates.slice(0, 6).map((file) => (
                  <div key={file.id} className="p-3 bg-muted border border-border rounded-md">
                    <p className="text-sm font-medium truncate text-foreground">{file.filename}</p>
                  </div>
                ))}
                {bulkDeleteCandidates.length > 6 && (
                  <p className="text-xs text-muted-foreground px-1">
                    {t("drive:vault.bulkDelete.more", { defaultValue: "…and {{count}} more", count: bulkDeleteCandidates.length - 6 })}
                  </p>
                )}
              </div>
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                <p className="text-xs text-foreground flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
                  <span>{t("drive:vault.bulkDelete.warning", { defaultValue: "This action cannot be undone. Files that fail to delete remain selected so you can retry." })}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="modal-cancel"
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={bulkDeleting}
                  className="flex-1"
                >
                  {t("drive:vault.bulkDelete.cancel", { defaultValue: "Keep files" })}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDeleteConfirm}
                  disabled={bulkDeleting}
                  className="flex-1 bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))/0.9] text-destructive-foreground border-0"
                >
                  {bulkDeleting
                    ? t("drive:vault.bulkDelete.deleting", { defaultValue: "Deleting…" })
                    : t("drive:vault.bulkDelete.confirm", { defaultValue: "Delete {{count}}", count: bulkDeleteCandidates.length })}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showShareLinkModal && fileForShareLink && (
        <CreateShareLinkModal
          isOpen={showShareLinkModal}
          onClose={() => { setShowShareLinkModal(false); setFileForShareLink(null); }}
          file={fileForShareLink}
        />
      )}

      <MoveFileModal
        open={showMoveFileModal}
        onOpenChange={(open) => {
          setShowMoveFileModal(open);
          if (!open) {
            setFileToMove(null);
            setMoveFolders([]);
          }
        }}
        file={fileToMove ? { id: fileToMove.id, filename: fileToMove.filename, folder_id: fileToMove.folder_id } : null}
        folders={moveFolders.length > 0 ? moveFolders : folders}
        moving={movingFile}
        onMove={handleMoveFileSubmit}
      />

      {showFolderShareModal && folderForShare && (
        <CreateFolderShareLinkModal
          isOpen={showFolderShareModal}
          onClose={() => { setShowFolderShareModal(false); setFolderForShare(null); }}
          onCreated={() => setFolderSharePanelVersion((value) => value + 1)}
          onUseUploadLink={() => handleCreateUploadLinkForFolder(folderForShare.id, folderForShare.name)}
          folder={folderForShare}
        />
      )}
      {showCollaboratorsModal && folderForCollaborators && (
        <FolderCollaboratorsModal
          isOpen={showCollaboratorsModal}
          onClose={() => { setShowCollaboratorsModal(false); setFolderForCollaborators(null); }}
          folderId={folderForCollaborators.id}
          folderName={folderForCollaborators.name}
        />
      )}
      <CreateUploadLinkModal
        open={showCreateUploadLinkModal}
        onClose={() => {
          setShowCreateUploadLinkModal(false);
          setUploadLinkTargetFolder(null);
        }}
        onSuccess={() => {
          setSelectedNode({ type: "manage-drops" });
          setSidebarOpen(false);
        }}
        initialFolderId={uploadLinkTargetFolder?.id}
        initialFolderName={uploadLinkTargetFolder?.name}
        introMessage={uploadLinkTargetFolder
          ? `Use this link when you want someone else to upload files into ${uploadLinkTargetFolder.name}.`
          : undefined}
      />
      {accessPanelFile && (
        <AccessPanel
          fileId={accessPanelFile.id}
          filename={accessPanelFile.filename}
          onClose={() => setAccessPanelFile(null)}
        />
      )}
      {receiptFile && (
        <ActivityReceiptDrawer
          isOpen={!!receiptFile}
          onClose={() => setReceiptFile(null)}
          fileId={receiptFile.id}
          filename={receiptFile.filename}
        />
      )}

      {passportFile && (
        <CryptoPassportDrawer
          file={passportFile}
          onClose={() => setPassportFile(null)}
          onDownloadSlip={(file) => downloadTransferSlip(file, currentUser?.email)}
        />
      )}

      <StagingDock
        dockedFiles={stagedFiles}
        onClearDock={() => setStagedFiles([])}
        onDownloadBatchSlip={(files) => downloadBatchTransferSlip(files, currentUser?.email)}
        onBatchSever={async (files) => {
          const token = localStorage.getItem("token");
          if (!token) return;
          playDeadboltThud();
          let severedCount = 0;
          for (const f of files) {
            try {
              const res = await fetch(`${API_URL}/v1/files/${f.id}/revoke-external`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) severedCount++;
            } catch {
              // Ignore individual network failures
            }
          }
          if (severedCount === files.length) {
            addToast(`Severed all external access for ${severedCount} file(s).`, "success");
          } else if (severedCount > 0) {
            addToast(`Severed external access for ${severedCount} of ${files.length} file(s).`, "info");
          } else {
            addToast("Could not sever external access. Please retry.", "error");
          }
          mutateMyFiles();
        }}
        onBatchDownload={(files) => {
          const bulkFiles: BulkDownloadFile[] = files.map((f) => ({
            id: f.id,
            filename: f.filename,
            metadata: f.metadata,
            pin_wrapped_key: f.pin_wrapped_key,
            is_owner: f.is_owner,
            folder_id: f.folder_id || null,
          }));
          setBulkDownloadFiles(bulkFiles);
        }}
      />

      <VaultPrivacyShutter
        isLocked={isVaultLocked}
        onUnlock={() => setIsVaultLocked(false)}
        onScrubMemory={() => {
          setPreviewFile(null);
          setPassportFile(null);
          if (typeof document !== "undefined") {
            const mediaElements = document.querySelectorAll("audio, video");
            mediaElements.forEach((el) => {
              try {
                (el as HTMLMediaElement).pause();
                (el as HTMLMediaElement).src = "";
                (el as HTMLMediaElement).load();
              } catch {
                // Safe ignore
              }
            });
          }
        }}
      />

      {undoAction && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card border border-primary/40 shadow-2xl text-xs text-foreground animate-in slide-in-from-bottom duration-200">
          <span>{undoAction.message}</span>
          <button
            type="button"
            onClick={() => {
              void undoAction.undo();
              setUndoAction(null);
            }}
            className="font-bold text-primary hover:underline cursor-pointer select-none"
          >
            Undo (⌘Z)
          </button>
        </div>
      )}
    </>
  );
}

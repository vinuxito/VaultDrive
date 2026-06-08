import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import useSWR from "swr";
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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_URL, BASE_PATH } from "../utils/api";
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
  type CryptoEvent,
} from "../utils/crypto";
import ShareModal from "../components/share-modal";
import { CreateShareLinkModal } from "../components/vault/CreateShareLinkModal";
import { CreateFolderShareLinkModal } from "../components/vault/CreateFolderShareLinkModal";
import { AccessPanel } from "../components/vault/AccessPanel";
import FolderModal from "../components/folders/FolderModal";
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
import type { TreeNode, DropTokenInfo, BulkDownloadFile } from "../components/vault";
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
import { ensureFolderStructure, getFolderIdForFile } from "../utils/folder-upload";
import { getStoredUserFromLocalStorage } from "../utils/browser-storage";
import { useTranslation } from "react-i18next";
import { queueOfflineAction } from "../utils/offline-db";


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
  status: "uploading" | "done" | "error";
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

function getFileCredentialScheme(file: { pin_wrapped_key?: string | null; metadata?: string; is_owner?: boolean }): "drop-pin" | "pin" | "password" {
  if (file.pin_wrapped_key) return "drop-pin";
  if (!file.is_owner) return "pin";
  if (!file.metadata) return "password";
  try {
    const meta = JSON.parse(file.metadata) as { credential_scheme?: string };
    return meta.credential_scheme === "pin" ? "pin" : "password";
  } catch {
    return "password";
  }
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
  const sessionVault = useSessionVault();
  const { t } = useTranslation(["drive"]);

  const { data: myFiles = [], mutate: mutateMyFiles, isLoading } = useSWR<FileData[]>(`${API_URL}/files`, {
    onError: (err) => {
      if (err.message?.includes("401") || err.status === 401) {
        navigate("/login");
      }
    }
  });

  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [dropTokens, setDropTokens] = useState<DropTokenInfo[]>([]);
  const [dropLinkFiles, setDropLinkFiles] = useState<Record<string, FileData[]>>({});

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
  const [passwordAction, setPasswordAction] = useState<"upload" | "download" | "drop-upload" | null>(null);
  const [pendingDownload, setPendingDownload] = useState<{
    fileId: string;
    filename: string;
    metadata: string;
    pin_wrapped_key?: string;
    is_owner?: boolean;
  } | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: string; filename: string; parent_hash?: string | null } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showMoveFileModal, setShowMoveFileModal] = useState(false);
  const [fileToMove, setFileToMove] = useState<FileData | null>(null);
  const [movingFile, setMovingFile] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [fileToShare, setFileToShare] = useState<{ id: string; filename: string; metadata?: string; pin_wrapped_key?: string } | null>(null);

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

  const [showBulkDownload, setShowBulkDownload] = useState(false);

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

  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [fileContextMenu, setFileContextMenu] = useState<{ file: FileData; x: number; y: number } | null>(null);

  const [showShareLinkModal, setShowShareLinkModal] = useState(false);
  const [fileForShareLink, setFileForShareLink] = useState<{
    id: string;
    filename: string;
    metadata: string;
    pin_wrapped_key?: string | null;
  } | null>(null);

  const [showFolderShareModal, setShowFolderShareModal] = useState(false);
  const [folderForShare, setFolderForShare] = useState<{ id: string; name: string } | null>(null);
  const [showCreateUploadLinkModal, setShowCreateUploadLinkModal] = useState(false);
  const [uploadLinkTargetFolder, setUploadLinkTargetFolder] = useState<{ id: string; name: string } | null>(null);
  const [folderSharePanelVersion, setFolderSharePanelVersion] = useState(0);
  const initialFolderShareSyncAttemptedRef = useRef(false);
  const [moveFolders, setMoveFolders] = useState<Folder[]>([]);

  const fetchFiles = useCallback(async () => {
    // SWR handles fetching automatically, but this function is kept for backward compatibility
    // in places that explicitly expect to trigger a refresh.
    await mutateMyFiles();
  }, [mutateMyFiles]);

  const fetchSharedFiles = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/shared`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSharedFiles(data || []);
      }
    } catch {
      return;
    }
  }, []);

  const fetchFolders = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/folders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFolders(data || []);
        return data || [];
      }
    } catch {
      return [];
    }
    return [];
  }, []);

  const fetchDropTokens = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/drop/tokens`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDropTokens(data || []);
      }
    } catch {
      return;
    }
  }, []);

  const fetchDropLinkFiles = useCallback(async (dropToken: string) => {
    if (dropLinkFiles[dropToken]) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/drop/${dropToken}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDropLinkFiles((prev) => ({ ...prev, [dropToken]: data || [] }));
      }
    } catch {
      return;
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
    fetchFolders();
    fetchDropTokens();
  }, [navigate, fetchFiles, fetchSharedFiles, fetchFolders, fetchDropTokens]);

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
        const descendantIds = collectFolderDescendantIds(folders, selectedNode.folderId);
        list = myFiles.filter((file) =>
          (file.drop_folder_id && descendantIds.has(file.drop_folder_id)) ||
          (file.folder_id && descendantIds.has(file.folder_id))
        );
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
  }, [applySort, applyTypeFilter, dropLinkFiles, folders, myFiles, searchQuery, selectedNode, sharedAsFiles]);

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
    }));
  }, [selectedVisibleFiles]);
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

  const toggleStar = async (fileId: string) => {
    const token = localStorage.getItem("token");
    
    // Optimistic UI update
    mutateMyFiles(
      (prev = []) => prev.map((f) => (f.id === fileId ? { ...f, starred: !f.starred } : f)),
      { revalidate: false }
    );

    try {
      await fetch(`${API_URL}/files/${fileId}/star`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      // Revalidate to ensure server state matches
      mutateMyFiles();
    } catch {
      // Revert on failure
      mutateMyFiles();
    }
  };

  const handleQuickShare = async (fileId: string) => {
    const authToken = localStorage.getItem("token");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const res = await fetch(`${API_URL}/files/${fileId}/share-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ expires_at: expiresAt }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create share link");
      }
      const data = await res.json();
      const shareUrl = `${window.location.origin}${BASE_PATH}/share/${data.token}`;
      await navigator.clipboard.writeText(shareUrl);
      setSuccessMessage("Share link copied to clipboard! (expires in 7 days)");
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create share link");
    }
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
    setUploading(true);
    setError("");
    try {
      const salt = generateSalt();
      const encryptionKey = await deriveKeyFromPassword(password, salt, 100000);
      setCryptoEvent(null);
      const { encryptedData, iv } = await encryptFile(selectedFile, encryptionKey, setCryptoEvent);
      const formData = new FormData();
      formData.append("file", new Blob([encryptedData], { type: "application/octet-stream" }), selectedFile.name);
      formData.append("iv", arrayBufferToBase64(iv));
      formData.append("salt", arrayBufferToBase64(salt));
      formData.append("algorithm", "AES-256-GCM");
      formData.append("wrapped_key", arrayBufferToBase64(salt) + ":" + arrayBufferToBase64(iv));
      formData.append("credential_scheme", ownerUsesPin ? "pin" : "password");
      if (selectedNode.type === "folder") {
        formData.append("folder_id", selectedNode.folderId);
      }
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        if (response.status === 401) { navigate("/login"); return false; }
        throw new Error("Failed to upload file");
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
      setError(err instanceof Error ? err.message : "Failed to upload file");
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
    const updateTray = (progress: number, status: UploadTrayItem["status"]) => {
      setUploadTray((prev) =>
        prev.map((item) => item.id === trayId ? { ...item, progress, status } : item)
      );
    };
    try {
      updateTray(10, "uploading");
      const salt = generateSalt();
      const encryptionKey = await deriveKeyFromPassword(password, salt, 100000);
      updateTray(30, "uploading");
      setCryptoEvent(null);
      const { encryptedData, iv } = await encryptFile(file, encryptionKey, setCryptoEvent);
      updateTray(60, "uploading");
      const formData = new FormData();
      formData.append("file", new Blob([encryptedData], { type: "application/octet-stream" }), file.name);
      formData.append("iv", arrayBufferToBase64(iv));
      formData.append("salt", arrayBufferToBase64(salt));
      formData.append("algorithm", "AES-256-GCM");
      formData.append("wrapped_key", arrayBufferToBase64(salt) + ":" + arrayBufferToBase64(iv));
      formData.append("credential_scheme", ownerUsesPin ? "pin" : "password");
      if (folderId) {
        formData.append("folder_id", folderId);
      } else if (selectedNode.type === "folder") {
        formData.append("folder_id", selectedNode.folderId);
      }
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      updateTray(90, "uploading");
      if (!response.ok) {
        updateTray(0, "error");
        return false;
      }
      updateTray(100, "done");
      return true;
    } catch {
      updateTray(0, "error");
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
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/${file.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401) { navigate("/login"); return { success: false, error: "Unauthorized" }; }
        throw new Error("Failed to download file");
      }

      const metadataStr = response.headers.get("X-File-Metadata") ?? file.metadata;
      let metadataObj: { iv?: string; salt?: string };
      try {
        metadataObj = JSON.parse(metadataStr);
      } catch {
        throw new Error("Invalid file metadata format");
      }

      if (!metadataObj.iv) throw new Error("Missing encryption IV");

      const iv = new Uint8Array(base64ToArrayBuffer(metadataObj.iv));
      const isDropUpload = !metadataObj.salt || metadataObj.salt === "";
      const wrappedKeyB64 = response.headers.get("X-Wrapped-Key");
      let encryptionKey: CryptoKey;

      const cachedFileKey = sessionVault.getFileKey(file.id);
      if (cachedFileKey) {
        encryptionKey = cachedFileKey;
      } else if (isDropUpload && (file.pin_wrapped_key || wrappedKeyB64)) {
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
        sessionVault.setFileKey(file.id, encryptionKey);
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
          const privateKeyPem = await decryptPrivateKeyWithPIN(credential, privateKeyPinEncrypted);
          rsaPrivateKey = await importRSAPrivateKey(privateKeyPem);
          sessionVault.setPrivateKey(rsaPrivateKey);
        }
        encryptionKey = await unwrapKeyWithRSA(rsaPrivateKey, wrappedKeyB64);
        sessionVault.setFileKey(file.id, encryptionKey);
      } else {
        const salt = new Uint8Array(base64ToArrayBuffer(metadataObj.salt!));
        encryptionKey = await deriveKeyFromPassword(credential, salt, 100000);
        sessionVault.setFileKey(file.id, encryptionKey);
      }

      const encryptedBlob = await response.blob();
      const encryptedData = await encryptedBlob.arrayBuffer();
      const decryptedData = await decryptFile(encryptedData, encryptionKey, iv);

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
        error: err instanceof Error ? err.message : "Decryption failed",
      };
    }
  };

  const handleDownload = async (
    fileId: string,
    filename: string,
    metadata: string,
    pin_wrapped_key?: string,
    is_owner?: boolean
  ) => {
    const cachedFileKey = sessionVault.getFileKey(fileId);
    if (cachedFileKey) {
      setDownloading(true);
      setError("");
      try {
        const result = await downloadFileWithCredential(
          { id: fileId, filename, metadata, pin_wrapped_key, is_owner },
          ""
        );
        if (!result.success) setError(result.error ?? "Download failed");
      } finally {
        setDownloading(false);
      }
      return;
    }
    if (is_owner === false && !pin_wrapped_key) {
      const sessionKey = sessionVault.getPrivateKey();
      if (sessionKey) {
        setDownloading(true);
        setError("");
        try {
          const result = await downloadFileWithCredential(
            { id: fileId, filename, metadata, pin_wrapped_key, is_owner },
            ""
          );
          if (!result.success) setError(result.error ?? "Download failed");
        } finally {
          setDownloading(false);
        }
        return;
      }
    }
    const cached = sessionVault.getCredential();
    const scheme = getFileCredentialScheme({ pin_wrapped_key, metadata, is_owner });
    if (cached && ((scheme !== "password" && cached.type === "pin") || (scheme === "password" && cached.type === "password"))) {
      setDownloading(true);
      setError("");
      try {
        const result = await downloadFileWithCredential(
          { id: fileId, filename, metadata, pin_wrapped_key, is_owner },
          cached.value,
        );
        if (!result.success) setError(result.error ?? "Download failed");
      } finally {
        setDownloading(false);
      }
      return;
    }
    setPendingDownload({ fileId, filename, metadata, pin_wrapped_key, is_owner });
    setPasswordAction("download");
    setShowPasswordModal(true);
  };

  const performDownload = async (password: string): Promise<boolean> => {
    if (!pendingDownload) return false;
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
        },
        password
      );
      if (!result.success) throw new Error(result.error);
      setPendingDownload(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download or decrypt file");
      return false;
    } finally {
      setDownloading(false);
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
    setDeleting(true);
    setError("");
    try {
      if (!navigator.onLine) {
        await queueOfflineAction({
          type: "delete",
          file_id: fileToDelete.id,
          filename: fileToDelete.filename,
          parent_hash: fileToDelete.parent_hash || "",
          updated_at: new Date().toISOString(),
        });
        window.dispatchEvent(new Event("offline-action-queued"));

        mutateMyFiles((prev = []) => prev.filter((f) => f.id !== fileToDelete.id), { revalidate: false });
        setSelectedFileIds((prev) => {
          const n = new Set(prev);
          n.delete(fileToDelete.id);
          return n;
        });
        setSuccessMessage(t("drive:vault.sync.queued"));
        setTimeout(() => setSuccessMessage(""), 5000);
        setShowDeleteModal(false);
        setFileToDelete(null);
        return;
      }

      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/${fileToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401) { navigate("/login"); return; }
        throw new Error("Failed to delete file");
      }
      mutateMyFiles((prev = []) => prev.filter((f) => f.id !== fileToDelete.id), { revalidate: false });
      mutateMyFiles();
      setSelectedFileIds((prev) => { const n = new Set(prev); n.delete(fileToDelete.id); return n; });
      setShowDeleteModal(false);
      setFileToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete file");
    } finally {
      setDeleting(false);
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
        for (const file of bulkDeleteCandidates) {
          await queueOfflineAction({
            type: "delete",
            file_id: file.id,
            filename: file.filename,
            parent_hash: file.parent_hash || "",
            updated_at: new Date().toISOString(),
          });
        }
        window.dispatchEvent(new Event("offline-action-queued"));

        const deleteIds = new Set(bulkDeleteCandidates.map((c) => c.id));
        mutateMyFiles((prev = []) => prev.filter((file) => !deleteIds.has(file.id)), { revalidate: false });
        setSelectedFileIds((prev) => {
          const next = new Set(prev);
          deleteIds.forEach((id) => next.delete(id));
          return next;
        });

        setSuccessMessage(t("drive:vault.sync.queued"));
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
    setFileToShare({ id: fileId, filename, metadata, pin_wrapped_key });
    setShowShareModal(true);
  };

  const handleCreateShareLink = (file: FileData) => {
    setFileForShareLink({
      id: file.id,
      filename: file.filename,
      metadata: file.metadata,
      pin_wrapped_key: file.pin_wrapped_key,
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
      sessionVault.setCredential(password, ownerUsesPin ? "pin" : "password");
      setShowPasswordModal(false);
      setEncryptionPassword("");
      setPasswordAction(null);
      await performDropUploads(password);
      return;
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
      <div className="h-full flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-border/60">
          <h1 className="text-2xl font-bold text-foreground">{t("drive:vault.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("drive:vault.subtitle")}
          </p>
        </div>


        <FileSearch
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
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
            />
          </aside>

          <main className="flex-1 flex flex-col overflow-hidden bg-muted">
            {selectedNode.type === "manage-drops" ? (
              <div className="flex-1 overflow-auto p-6">
                <UploadLinksSection />
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-background shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors mr-1"
                >
                  <Menu className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-muted-foreground">{t("drive:vault.title")}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="font-medium text-foreground">{panelTitle}</span>

                  <span className="ml-1 text-xs text-muted-foreground">
                    ({visibleFiles.length})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
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
                      className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
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
                      className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
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
                <span className="text-sm text-primary/90 font-medium flex-1 truncate">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-primary/70">
                  {formatBytes(selectedFile.size)}
                </span>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="bg-primary hover:bg-primary/90 text-white h-7 px-3 text-xs"
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

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mb-3" />
                  <p className="text-sm">{t("drive:vault.loading")}</p>
                </div>
              )}


              {!isLoading && visibleFiles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                    <Lock className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {selectedNode.type === "starred" ? t("drive:vault.noStarred") :
                     selectedNode.type === "shared" ? t("drive:vault.noShared") :
                     t("drive:vault.noFiles")}
                  </p>

                  {selectedNode.type === "all" && !isSharedView && (
                    <p className="text-xs mt-1.5 text-muted-foreground max-w-xs text-center">
                      {t("drive:vault.uploadPrompt")}
                    </p>
                  )}

                </div>
              )}

              {!isLoading && visibleFiles.length > 0 && (
                <FileGrid
                  files={visibleFiles}
                  selectedFileIds={selectedFileIds}
                  toggleFileSelection={toggleFileSelection}
                  toggleSelectAllVisible={toggleSelectAllVisible}
                  allVisibleSelected={allVisibleSelected}
                  headerCheckboxRef={headerCheckboxRef}
                  onDownload={(file) => handleDownload(file.id, file.filename, file.metadata, file.pin_wrapped_key || undefined, file.is_owner)}
                  onCreateShareLink={handleCreateShareLink}
                  onToggleStar={toggleStar}
                  onAccessPanel={setAccessPanelFile}
                  onShareClick={handleShareClick}
                  onQuickShare={handleQuickShare}
                  onManageSharesClick={(file) => handleManageSharesClick(file.id, file.filename)}
                  onMoveClick={(file) => { void handleMoveClick(file); }}
                  onDeleteClick={(file) => handleDeleteClick(file.id, file.filename)}
                  onPreviewClick={setPreviewFile}
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
                  onOpenReceipt={setReceiptFile}
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
        <div className="fixed bottom-6 left-6 z-50 w-80">
          <EncryptionProof event={cryptoEvent} />
        </div>
      )}

      {uploadTray.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 w-72 bg-card border border-white/10 rounded-xl shadow-2xl p-3 space-y-2">
          <div className="flex justify-between items-center text-white/70 text-xs font-medium px-1">
            <span>{t("drive:vault.uploads")}</span>
            <button type="button" onClick={() => setUploadTray([])} className="hover:text-white">✕</button>

          </div>
          {uploadTray.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs truncate">{item.name}</p>
                <div className="h-1 bg-white/10 rounded mt-1">
                  <div
                    className="h-1 bg-emerald-500 rounded transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
              <span className="text-xs shrink-0">
                {item.status === "done" ? "✓" : item.status === "error" ? "✗" : "…"}
              </span>
            </div>
          ))}
        </div>
      )}

      <BulkActionBar
        selectedCount={selectedVisibleFiles.length}
        deletableCount={deletableSelectedCount}
        scopeLabel="in this view"
        onDownload={() => setShowBulkDownload(true)}
        onDelete={handleBulkDeleteClick}
        onClear={() => setSelectedFileIds(new Set())}
      />

      {showBulkDownload && (
        <BulkDownloadModal
          files={selectedBulkFiles}
          onDownloadFile={downloadFileWithCredential}
          onClose={() => { setShowBulkDownload(false); setSelectedFileIds(new Set()); }}
        />
      )}

      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={() => {
            handleDownload(previewFile.id, previewFile.filename, previewFile.metadata, previewFile.pin_wrapped_key || undefined, previewFile.is_owner);
            setPreviewFile(null);
          }}
        />
      )}

      {showPasswordModal && (() => {
        const credScheme = pendingDownload ? getFileCredentialScheme(pendingDownload) : "password";
        const isUpload = passwordAction === "upload" || passwordAction === "drop-upload";
        const usePin = isUpload ? ownerUsesPin : credScheme !== "password";
        return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 bg-gradient-to-br from-primary to-primary/90 border-white/10 text-white">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-white">
                <Lock className="w-5 h-5 text-primary-foreground" />
                {isUpload
                  ? (ownerUsesPin ? t("drive:vault.passwordModal.usePin") : t("drive:vault.passwordModal.encryptFile"))
                  : usePin ? t("drive:vault.passwordModal.enterPin") : t("drive:vault.passwordModal.decryptFile")}
              </CardTitle>

              <CardDescription className="text-white/70">
                {isUpload
                  ? ownerUsesPin
                    ? t("drive:vault.passwordModal.pinUploadDesc")
                    : t("drive:vault.passwordModal.passwordUploadDesc")
                  : usePin
                  ? t("drive:vault.passwordModal.pinDownloadDesc")
                  : t("drive:vault.passwordModal.passwordDownloadDesc")}
              </CardDescription>

            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-primary/20 border border-primary/30 text-primary-foreground text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-primary/60" />
                  <span>{error}</span>
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="vault-credential" className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Key className="w-4 h-4" />
                  {usePin ? t("drive:vault.passwordModal.pinLabel") : t("drive:vault.passwordModal.credentialLabel")}
                </label>

                <input
                  id="vault-credential"
                  type="password"
                  inputMode={usePin ? "numeric" : undefined}
                  maxLength={usePin ? 4 : undefined}
                  value={encryptionPassword}
                  onChange={(e) => setEncryptionPassword(
                    usePin
                      ? e.target.value.replace(/\D/g, "").slice(0, 4)
                      : e.target.value
                  )}
                  placeholder={usePin ? t("drive:vault.passwordModal.placeholderPin") : t("drive:vault.passwordModal.placeholderCredential")}
                  className={`w-full px-3 py-2 border rounded-md bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-white/40 focus:bg-white/15${usePin ? " text-center tracking-widest text-xl" : ""}`}

                  onKeyDown={(e) => { if (e.key === "Enter" && encryptionPassword) handlePasswordSubmit(); }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="modal-cancel"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setEncryptionPassword("");
                    setPasswordAction(null);
                    setPendingDownload(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePasswordSubmit}
                  disabled={!encryptionPassword || uploading || downloading}
                  className="flex-1 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))/0.9] font-semibold"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col bg-gradient-to-br from-primary to-primary/90 border-white/10 text-white">
            <CardHeader className="border-b border-white/10">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Users className="w-5 h-5 text-primary-foreground" />
                  Manage File Shares
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowManageSharesModal(false); setFileToManage(null); setSharedUsers([]); }}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription className="text-white/70">
                View and manage who has access to this file
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1">
              <div className="space-y-4">
                <div className="p-3 bg-white/10 border border-white/20 rounded-md">
                  <p className="text-sm font-medium truncate flex items-center gap-2 text-white">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 bg-gradient-to-br from-primary to-primary/90 border-white/10 text-white">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-white">
                <Trash2 className="w-5 h-5 text-destructive" />
                Delete File
              </CardTitle>
              <CardDescription className="text-white/70">
                Are you sure you want to delete this file? This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-white/10 border border-white/20 rounded-md">
                <p className="text-sm font-medium truncate text-white">{fileToDelete.filename}</p>
              </div>
              <div className="p-3 bg-primary/20 border border-primary/30 rounded-md">
                <p className="text-xs text-primary-foreground flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-primary/60" />
                  <span>The encrypted file will be permanently deleted from the server. You will not be able to recover it.</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="modal-cancel"
                  onClick={() => { setShowDeleteModal(false); setFileToDelete(null); }}
                  disabled={deleting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))/0.9] text-white border-0"
                >
                  {deleting ? "Deleting…" : "Delete File"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showBulkDeleteModal && bulkDeleteCandidates.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4 bg-gradient-to-br from-primary to-primary/90 border-white/10 text-white">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-white">
                <Trash2 className="w-5 h-5 text-destructive" />
                Delete {bulkDeleteCandidates.length} File{bulkDeleteCandidates.length !== 1 ? "s" : ""}
              </CardTitle>
              <CardDescription className="text-white/70">
                This deletes the owned files in your current selection. Shared files stay untouched.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {bulkDeleteCandidates.slice(0, 6).map((file) => (
                  <div key={file.id} className="p-3 bg-white/10 border border-white/20 rounded-md">
                    <p className="text-sm font-medium truncate text-white">{file.filename}</p>
                  </div>
                ))}
                {bulkDeleteCandidates.length > 6 && (
                  <p className="text-xs text-white/70 px-1">
                    ...and {bulkDeleteCandidates.length - 6} more file{bulkDeleteCandidates.length - 6 !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <div className="p-3 bg-primary/20 border border-primary/30 rounded-md">
                <p className="text-xs text-primary-foreground flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-primary/60" />
                  <span>This action cannot be undone. Files that fail to delete will remain selected so you can retry.</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="modal-cancel"
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={bulkDeleting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDeleteConfirm}
                  disabled={bulkDeleting}
                  className="flex-1 bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))/0.9] text-white border-0"
                >
                  {bulkDeleting ? "Deleting..." : `Delete ${bulkDeleteCandidates.length}`}
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
    </>
  );
}

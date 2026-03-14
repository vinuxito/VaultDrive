import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Download,
  Share2,
  Star,
  StarOff,
  Search,
  Upload,
  MoreHorizontal,
  ChevronRight,
  Menu,
  Link2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
} from "../utils/crypto";
import ShareModal from "../components/share-modal";
import { CreateShareLinkModal } from "../components/vault/CreateShareLinkModal";
import FolderModal from "../components/folders/FolderModal";
import DeleteFolderModal from "../components/folders/DeleteFolderModal";
import {
  VaultTree,
  BulkActionBar,
  BulkDownloadModal,
  OriginBadge,
} from "../components/vault";
import type { TreeNode, DropTokenInfo, BulkDownloadFile, FileOrigin } from "../components/vault";
import type { Folder } from "../components/files/FolderBreadcrumb";
import { useSessionVault } from "../context/SessionVaultContext";
import { FilePreviewModal } from "../components/vault/FilePreviewModal";

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

type FileTypeFilter = "all" | "images" | "documents" | "audio" | "video" | "archives";

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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fileOriginFromData(file: FileData): FileOrigin {
  if (file.drop_token && file.drop_folder_name) {
    return { type: "drop", linkName: file.drop_folder_name };
  }
  if (file.group_name) {
    return { type: "group", groupName: file.group_name };
  }
  if (file.shared_by) {
    return { type: "shared", sharedBy: file.shared_by };
  }
  return { type: "my-upload" };
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
    if (!file.drop_folder_id) return counts;
    counts[file.drop_folder_id] = (counts[file.drop_folder_id] ?? 0) + 1;
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

  const [myFiles, setMyFiles] = useState<FileData[]>([]);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [dropTokens, setDropTokens] = useState<DropTokenInfo[]>([]);
  const [dropLinkFiles, setDropLinkFiles] = useState<Record<string, FileData[]>>({});

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

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
  const [fileToDelete, setFileToDelete] = useState<{ id: string; filename: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [fileToShare, setFileToShare] = useState<{ id: string; filename: string; metadata?: string; pin_wrapped_key?: string } | null>(null);

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

  const [showShareLinkModal, setShowShareLinkModal] = useState(false);
  const [fileForShareLink, setFileForShareLink] = useState<{
    id: string;
    filename: string;
    metadata: string;
    pin_wrapped_key?: string | null;
  } | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401) { navigate("/login"); return; }
        throw new Error("Failed to fetch files");
      }
      const data = await response.json();
      setMyFiles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

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
      }
    } catch {
      return;
    }
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

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    fetchFiles();
    fetchSharedFiles();
    fetchFolders();
    fetchDropTokens();
  }, [navigate, fetchFiles, fetchSharedFiles, fetchFolders, fetchDropTokens]);

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
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        droppedFilesRef.current = Array.from(files);
        setPasswordAction("drop-upload");
        setShowPasswordModal(true);
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
    if (!openActionMenu) return;
    const handler = () => setOpenActionMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [openActionMenu]);

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
        list = myFiles.filter((file) => file.drop_folder_id && descendantIds.has(file.drop_folder_id));
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
    try {
      await fetch(`${API_URL}/files/${fileId}/star`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, starred: !f.starred } : f))
      );
    } catch {
      return;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError("");
    }
  };

  const handleUpload = () => {
    if (!selectedFile) { setError("Please select a file to upload"); return; }
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
      const { encryptedData, iv } = await encryptFile(selectedFile, encryptionKey);
      const formData = new FormData();
      formData.append("file", new Blob([encryptedData], { type: "application/octet-stream" }), selectedFile.name);
      formData.append("iv", arrayBufferToBase64(iv));
      formData.append("salt", arrayBufferToBase64(salt));
      formData.append("algorithm", "AES-256-GCM");
      formData.append("wrapped_key", arrayBufferToBase64(salt) + ":" + arrayBufferToBase64(iv));
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
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
      return false;
    } finally {
      setUploading(false);
    }
  };

  const performUploadFile = async (
    file: globalThis.File,
    password: string,
    trayId: string
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
      const { encryptedData, iv } = await encryptFile(file, encryptionKey);
      updateTray(60, "uploading");
      const formData = new FormData();
      formData.append("file", new Blob([encryptedData], { type: "application/octet-stream" }), file.name);
      formData.append("iv", arrayBufferToBase64(iv));
      formData.append("salt", arrayBufferToBase64(salt));
      formData.append("algorithm", "AES-256-GCM");
      formData.append("wrapped_key", arrayBufferToBase64(salt) + ":" + arrayBufferToBase64(iv));
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

    const newItems: UploadTrayItem[] = files.map((f) => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      progress: 0,
      status: "uploading",
    }));
    setUploadTray((prev) => [...prev, ...newItems]);

    for (let i = 0; i < files.length; i++) {
      await performUploadFile(files[i], password, newItems[i].id);
    }
    await fetchFiles();
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
        const sessionKey = sessionVault.getPrivateKey();
        let rsaPrivateKey: CryptoKey;
        if (sessionKey) {
          rsaPrivateKey = sessionKey;
        } else {
          const stored = localStorage.getItem("user");
          const userObj: { private_key_pin_encrypted?: string } | null = stored ? JSON.parse(stored) : null;
          const privateKeyPinEncrypted = userObj?.private_key_pin_encrypted ?? null;
          if (!privateKeyPinEncrypted) {
            throw new Error("PIN-encrypted private key not found. Please re-set your PIN in Settings.");
          }
          const privateKeyPem = await decryptPrivateKeyWithPIN(credential, privateKeyPinEncrypted);
          rsaPrivateKey = await importRSAPrivateKey(privateKeyPem);
        }
        encryptionKey = await unwrapKeyWithRSA(rsaPrivateKey, wrappedKeyB64);
      } else {
        const salt = new Uint8Array(base64ToArrayBuffer(metadataObj.salt!));
        encryptionKey = await deriveKeyFromPassword(credential, salt, 100000);
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
    setFileToDelete({ id: fileId, filename });
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    setDeleting(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/${fileToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401) { navigate("/login"); return; }
        throw new Error("Failed to delete file");
      }
      setMyFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
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
        setMyFiles((prev) => prev.filter((file) => !deletedIds.has(file.id)));
        setSelectedFileIds((prev) => {
          const next = new Set(prev);
          succeededIds.forEach((id) => next.delete(id));
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
    }
    if (success) {
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
      case "drop-link": return selectedNode.linkName;
    }
  })();

  const TYPE_FILTER_LABELS: Record<FileTypeFilter, string> = {
    all: "All",
    images: "Images",
    documents: "Docs",
    audio: "Audio",
    video: "Video",
    archives: "Archives",
  };

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-slate-200/60">
          <h1 className="text-2xl font-bold text-slate-900">Vault</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Your encrypted file storage
          </p>
        </div>

        <div className="px-6 py-3 border-b border-slate-200/60 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search all files…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#7d4f50]/40 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {(Object.keys(TYPE_FILTER_LABELS) as FileTypeFilter[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors whitespace-nowrap ${
                    typeFilter === type
                      ? "bg-[#7d4f50] text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {TYPE_FILTER_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/30 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <aside
            className={`
              w-60 shrink-0 border-r border-slate-200/60 bg-white overflow-y-auto
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
            />
          </aside>

          <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 bg-white shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors mr-1"
                >
                  <Menu className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="text-slate-400">Vault</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="font-medium text-slate-800">{panelTitle}</span>
                  <span className="ml-1 text-xs text-slate-400">
                    ({visibleFiles.length})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {(["name", "date", "size"] as const).map((field) => (
                    <button
                      key={field}
                      onClick={() => handleSort(field)}
                      className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                        sortBy === field
                          ? "bg-[#7d4f50]/10 border-[#7d4f50]/30 text-[#7d4f50]"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
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
                      className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[#7d4f50] text-white hover:bg-[#6b4345] transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload
                    </label>
                    <input
                      id="file-input"
                      type="file"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </>
                )}
              </div>
            </div>

            {selectedFile && !isSharedView && (
              <div className="mx-6 mt-4 flex items-center gap-3 p-3 bg-[#f2d7d8] border border-[#d4a5a6] rounded-xl shrink-0">
                <File className="w-4 h-4 text-[#7d4f50] shrink-0" />
                <span className="text-sm text-[#6b4345] font-medium flex-1 truncate">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-[#7d4f50]/70">
                  {formatBytes(selectedFile.size)}
                </span>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="bg-[#7d4f50] hover:bg-[#6b4345] text-white h-7 px-3 text-xs"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Encrypt & Upload"}
                </Button>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-[#7d4f50]/60 hover:text-[#7d4f50] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {error && (
              <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading && (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading files…
                </div>
              )}

              {!loading && visibleFiles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <File className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No files here yet</p>
                  {selectedNode.type === "all" && !isSharedView && (
                    <p className="text-xs mt-1 text-slate-400">
                      Upload a file to get started
                    </p>
                  )}
                </div>
              )}

              {!loading && visibleFiles.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-3 px-3 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    <div className="w-4 shrink-0 flex items-center justify-center">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        className="w-4 h-4 rounded border-slate-300 accent-[#7d4f50] cursor-pointer"
                        aria-label={allVisibleSelected ? "Clear current view selection" : "Select current view"}
                      />
                    </div>
                    <div className="flex-1">Name</div>
                    <div className="w-28 hidden sm:block">Origin</div>
                    <div className="w-16 text-right hidden md:block">Size</div>
                    <div className="w-24 text-right hidden lg:block">Date</div>
                    <div className="w-24 shrink-0" />
                  </div>

                  {visibleFiles.map((file) => {
                    const isSelected = selectedFileIds.has(file.id);
                    const origin = fileOriginFromData(file);

                    return (
                      <div
                        key={file.id}
                        className={`
                          group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-default
                          ${isSelected
                            ? "bg-[#f2d7d8]/60 border-[#d4a5a6]/50"
                            : "bg-white border-slate-200/60 hover:border-slate-300 hover:shadow-sm"
                          }
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleFileSelection(file.id)}
                          className="w-4 h-4 rounded border-slate-300 accent-[#7d4f50] shrink-0 cursor-pointer"
                        />

                        <div
                          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                          onClick={() => setPreviewFile(file)}
                        >
                          <File className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-sm font-medium text-slate-800 truncate hover:text-[#7d4f50] transition-colors">
                            {file.filename}
                          </span>
                        </div>

                        <div className="w-28 hidden sm:block shrink-0">
                          <OriginBadge origin={origin} />
                        </div>

                        <div className="w-16 text-right text-xs text-slate-400 hidden md:block shrink-0">
                          {formatBytes(file.file_size)}
                        </div>

                        <div className="w-24 text-right text-xs text-slate-400 hidden lg:block shrink-0">
                          {formatDate(file.created_at)}
                        </div>

                        <div className="hidden md:flex items-center justify-end gap-0.5 shrink-0">
                          <button
                            onClick={() => handleDownload(file.id, file.filename, file.metadata, file.pin_wrapped_key || undefined, file.is_owner)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#7d4f50] hover:bg-[#f2d7d8]/60 transition-colors"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {file.is_owner !== false && (
                            <button
                              onClick={() => handleShareClick(file.id, file.filename, file.metadata, file.pin_wrapped_key || undefined)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                              title="Share"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {file.is_owner !== false && (
                            <button
                              onClick={() => handleCreateShareLink(file)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Create share link"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {file.is_owner !== false && (
                            <button
                              onClick={() => toggleStar(file.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                file.starred
                                  ? "text-amber-400 hover:text-amber-500"
                                  : "text-slate-400 hover:text-amber-400 hover:bg-amber-50"
                              }`}
                              title={file.starred ? "Unstar" : "Star"}
                            >
                              {file.starred
                                ? <Star className="w-3.5 h-3.5 fill-current" />
                                : <StarOff className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}

                          {file.is_owner !== false && (
                            <button
                              onClick={() => handleDeleteClick(file.id, file.filename)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {file.is_owner !== false && (
                            <button
                              onClick={() => handleManageSharesClick(file.id, file.filename)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              title="Manage shares"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="relative shrink-0 md:hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenu(openActionMenu === file.id ? null : file.id);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            title="Actions"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openActionMenu === file.id && (
                            <div className="absolute right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 min-w-[160px]">
                              <button
                                onClick={() => { handleDownload(file.id, file.filename, file.metadata, file.pin_wrapped_key || undefined, file.is_owner); setOpenActionMenu(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Download className="w-3.5 h-3.5" /> Download
                              </button>
                              <button
                                onClick={() => { setPreviewFile(file); setOpenActionMenu(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <File className="w-3.5 h-3.5" /> Preview
                              </button>
                              {file.is_owner !== false && (
                                <button
                                  onClick={() => { handleShareClick(file.id, file.filename, file.metadata, file.pin_wrapped_key || undefined); setOpenActionMenu(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                >
                                  <Share2 className="w-3.5 h-3.5" /> Share
                                </button>
                              )}
                              {file.is_owner !== false && (
                                <button
                                  onClick={() => { handleCreateShareLink(file); setOpenActionMenu(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                >
                                  <Link2 className="w-3.5 h-3.5" /> Create share link
                                </button>
                              )}
                              {file.is_owner !== false && (
                                <button
                                  onClick={() => { handleDeleteClick(file.id, file.filename); setOpenActionMenu(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {isDragging && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border-4 border-dashed border-white/60 rounded-2xl p-16 text-white text-2xl font-semibold">
            Drop files to upload
          </div>
        </div>
      )}

      {uploadTray.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 w-72 bg-[#2a1f1f] border border-white/10 rounded-xl shadow-2xl p-3 space-y-2">
          <div className="flex justify-between items-center text-white/70 text-xs font-medium px-1">
            <span>Uploads</span>
            <button onClick={() => setUploadTray([])} className="hover:text-white">✕</button>
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

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border-white/10 text-white">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-white">
                <Lock className="w-5 h-5 text-[#f2d7d8]" />
                {passwordAction === "upload" || passwordAction === "drop-upload"
                  ? "Encrypt File"
                  : (pendingDownload?.pin_wrapped_key || pendingDownload?.is_owner === false)
                  ? "Enter Your PIN"
                  : "Decrypt File"}
              </CardTitle>
              <CardDescription className="text-white/70">
                {passwordAction === "upload" || passwordAction === "drop-upload"
                  ? "Enter a password to encrypt your file. Remember this password to decrypt it later."
                  : (pendingDownload?.pin_wrapped_key || pendingDownload?.is_owner === false)
                  ? "Enter your 4-digit PIN to decrypt this file."
                  : "Enter the password you used to encrypt this file."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-[#6b4345]/30 border border-[#d4a5a6]/40 text-[#f2d7d8] text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#d4a5a6]" />
                  <span>{error}</span>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-white/90">
                  <Key className="w-4 h-4" />
                  {(pendingDownload?.pin_wrapped_key || pendingDownload?.is_owner === false) ? "4-digit PIN" : "Encryption Password"}
                </label>
                <input
                  type="password"
                  inputMode={(pendingDownload?.pin_wrapped_key || pendingDownload?.is_owner === false) ? "numeric" : undefined}
                  maxLength={(pendingDownload?.pin_wrapped_key || pendingDownload?.is_owner === false) ? 4 : undefined}
                  value={encryptionPassword}
                  onChange={(e) => setEncryptionPassword(
                    (pendingDownload?.pin_wrapped_key || pendingDownload?.is_owner === false)
                      ? e.target.value.replace(/\D/g, "").slice(0, 4)
                      : e.target.value
                  )}
                  placeholder={(pendingDownload?.pin_wrapped_key || pendingDownload?.is_owner === false) ? "••••" : "Enter password"}
                  className={`w-full px-3 py-2 border rounded-md bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-white/40 focus:bg-white/15${(pendingDownload?.pin_wrapped_key || pendingDownload?.is_owner === false) ? " text-center tracking-widest text-xl" : ""}`}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && encryptionPassword) handlePasswordSubmit(); }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setEncryptionPassword("");
                    setPasswordAction(null);
                    setPendingDownload(null);
                  }}
                  className="flex-1 border-2 border-white/40 text-white hover:bg-white/10 bg-transparent"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePasswordSubmit}
                  disabled={!encryptionPassword || uploading || downloading}
                  className="flex-1 bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
                >
                  {uploading || downloading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {passwordAction === "upload" || passwordAction === "drop-upload" ? "Encrypting…" : "Decrypting…"}
                    </>
                  ) : passwordAction === "upload" || passwordAction === "drop-upload" ? (
                    "Encrypt & Upload"
                  ) : (
                    "Decrypt & Download"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
          <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border-white/10 text-white">
            <CardHeader className="border-b border-white/10">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Users className="w-5 h-5 text-[#f2d7d8]" />
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
                  <div className="text-center py-8 text-white/70">Loading shared users…</div>
                ) : sharedUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto mb-4 text-white/70" />
                    <p className="text-white/90">This file hasn't been shared yet</p>
                    <p className="text-sm text-white/70 mt-2">Use the Share button to give others access to this file</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-white/90">
                      Shared with {sharedUsers.length} user{sharedUsers.length !== 1 ? "s" : ""}
                    </p>
                    {sharedUsers.map((user) => (
                      <div key={user.user_id} className="flex items-center justify-between p-3 rounded-lg border border-white/20 bg-white/5">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-white">{user.username}</p>
                          <div className="flex gap-3 text-sm text-white/70">
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
                          className="gap-2 border-2 border-[#ef4444]/60 text-white hover:bg-[#ef4444]/20 bg-transparent"
                        >
                          <X className="w-4 h-4" />
                          {revoking === user.user_id ? "Revoking…" : "Revoke"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-3 bg-white/5 border border-white/20 rounded-md">
                  <p className="text-xs text-white/90 flex items-start gap-2">
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
          <Card className="w-full max-w-md mx-4 bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border-white/10 text-white">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-white">
                <Trash2 className="w-5 h-5 text-[#ef4444]" />
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
              <div className="p-3 bg-[#6b4345]/30 border border-[#d4a5a6]/40 rounded-md">
                <p className="text-xs text-[#f2d7d8] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#d4a5a6]" />
                  <span>The encrypted file will be permanently deleted from the server. You will not be able to recover it.</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setShowDeleteModal(false); setFileToDelete(null); }}
                  disabled={deleting}
                  className="flex-1 border-2 border-white/40 text-white hover:bg-white/10 bg-transparent"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white border-0"
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
          <Card className="w-full max-w-lg mx-4 bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border-white/10 text-white">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-white">
                <Trash2 className="w-5 h-5 text-[#ef4444]" />
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
              <div className="p-3 bg-[#6b4345]/30 border border-[#d4a5a6]/40 rounded-md">
                <p className="text-xs text-[#f2d7d8] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#d4a5a6]" />
                  <span>This action cannot be undone. Files that fail to delete will remain selected so you can retry.</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={bulkDeleting}
                  className="flex-1 border-2 border-white/40 text-white hover:bg-white/10 bg-transparent"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDeleteConfirm}
                  disabled={bulkDeleting}
                  className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white border-0"
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
    </>
  );
}

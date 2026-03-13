import { useState, useEffect } from "react";
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
  FolderOpen,
  FolderTree,
  UploadCloud,
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
} from "../utils/crypto";
import { UploadLinksSection } from "../components/upload";
import { Tabs, TabPanel } from "../components/ui/tabs";
import { MyFilesSection } from "../components/files/MyFilesSection";
import { MyFoldersSection } from "../components/folders/MyFoldersSection";
import type { Folder } from "../components/files/FolderBreadcrumb";
import ShareModal from "../components/share-modal";
import FolderModal from "../components/folders/FolderModal";
import DeleteFolderModal from "../components/folders/DeleteFolderModal";

interface FileData {
  id: string;
  filename: string;
  file_size: number;
  created_at: string;
  metadata: string;
  drop_wrapped_key?: string;
}

export default function Files() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  // Tab navigation
  const [activeTab, setActiveTab] = useState<"files" | "folders" | "links">("files");
  // @ts-ignore - TODO: Will be used for folder filtering
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Password-based encryption states
  const [encryptionPassword, setEncryptionPassword] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordAction, setPasswordAction] = useState<
    "upload" | "download" | null
  >(null);
  const [pendingDownload, setPendingDownload] = useState<{
    fileId: string;
    filename: string;
    metadata: string;
    drop_wrapped_key?: string;
  } | null>(null);

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{
    id: string;
    filename: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // File sharing
  const [showShareModal, setShowShareModal] = useState(false);
  const [fileToShare, setFileToShare] = useState<{
    id: string;
    filename: string;
  } | null>(null);

  // Manage shares
  const [showManageSharesModal, setShowManageSharesModal] = useState(false);
  const [fileToManage, setFileToManage] = useState<{
    id: string;
    filename: string;
  } | null>(null);
  const [sharedUsers, setSharedUsers] = useState<
    Array<{
      user_id: string;
      username: string;
      email: string;
      shared_at: string;
    }>
>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Folder modals
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

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const fetchFiles = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate("/login");
          return;
        }
        throw new Error("Failed to fetch files");
      }

      const data = await response.json();
      setFiles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    setFoldersLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/folders`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate("/login");
          return;
        }
        throw new Error("Failed to fetch folders");
      }

      const data = await response.json();
      setFolders(data || []);
    } catch (err) {
      console.error("Failed to load folders:", err);
    } finally {
      setFoldersLoading(false);
    }
  };

  // Fetch folders on mount
  useEffect(() => {
    fetchFolders();
  }, []);

  const handleCreateFolder = () => {
    setFolderModalMode("create");
    setFolderModalParentId(null);
    setShowFolderModal(true);
  };

  const handleCreateSubfolder = (parentId: string) => {
    setFolderModalMode("create");
    setFolderModalParentId(parentId);
    setShowFolderModal(true);
  };

  const handleNavigateToFolder = (folderId: string) => {
    setCurrentFolderId(folderId);
    setActiveTab("files");
  };

  const handleRenameFolder = async (folderId: string, currentName: string) => {
    setFolderModalMode("rename");
    setFolderToEdit({ id: folderId, name: currentName });
    setShowFolderModal(true);
  };

  const handleDeleteFolder = async (folderId: string, name: string) => {
    // Check if folder has subfolders
    const hasSubfolders = folders.some((f) => f.parentId === folderId);

    setFolderToDelete({ id: folderId, name, hasSubfolders });
    setShowDeleteFolderModal(true);
  };

  const handleFolderModalSubmit = async (name: string) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    if (folderModalMode === "create") {
      // Create folder
      const response = await fetch(`${API_URL}/folders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          parentId: folderModalParentId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create folder");
      }
    } else {
      // Rename folder
      if (!folderToEdit) return;

      const response = await fetch(`${API_URL}/folders/${folderToEdit.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to rename folder");
      }
    }

    // Refresh folder list
    await fetchFolders();
    setShowFolderModal(false);
    setFolderToEdit(null);
    setFolderModalParentId(null);
  };

  const handleDeleteFolderConfirm = async () => {
    if (!folderToDelete) return;

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const response = await fetch(`${API_URL}/folders/${folderToDelete.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete folder");
    }

    // Refresh folder list
    await fetchFolders();
    setShowDeleteFolderModal(false);
    setFolderToDelete(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file to upload");
      return;
    }

    // Request password for encryption
    setPasswordAction("upload");
    setShowPasswordModal(true);
  };

  const performUpload = async (password: string): Promise<boolean> => {
    if (!selectedFile) return false;

    setUploading(true);
    setError("");

    try {
      // 1. Generate salt for this file
      const salt = generateSalt();

      // 2. Derive encryption key from password + salt
      console.log(
        "Deriving key for upload with password length:",
        password.length
      );
      const encryptionKey = await deriveKeyFromPassword(password, salt, 100000);

      // Debug: Export key
      const exportedKey = await window.crypto.subtle.exportKey(
        "raw",
        encryptionKey
      );
      const keyBytes = new Uint8Array(exportedKey);
      console.log(
        "Derived Key for Upload (first 5 bytes):",
        Array.from(keyBytes.slice(0, 5))
      );

      // 3. Encrypt the file
      const { encryptedData, iv } = await encryptFile(
        selectedFile,
        encryptionKey
      );

      // 4. Prepare FormData with encrypted file
      const formData = new FormData();
      const encryptedBlob = new Blob([encryptedData], {
        type: "application/octet-stream",
      });
      formData.append("file", encryptedBlob, selectedFile.name);

      // 5. Add encryption metadata (salt and IV needed for decryption)
      formData.append("iv", arrayBufferToBase64(iv));
      formData.append("salt", arrayBufferToBase64(salt));
      formData.append("algorithm", "AES-256-GCM");

      // 6. Add wrapped key (for now, we store the key derivation info)
      // In a full implementation, this would be the file key wrapped with user's public key
      const wrappedKey =
        arrayBufferToBase64(salt) + ":" + arrayBufferToBase64(iv);
      formData.append("wrapped_key", wrappedKey);

      // 7. Upload to server
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate("/login");
          return false;
        }
        throw new Error("Failed to upload file");
      }

      // Clear selected file and refresh list
      setSelectedFile(null);
      const fileInput = document.getElementById(
        "file-input"
      ) as HTMLInputElement;
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

  const handleDownload = async (
    fileId: string,
    filename: string,
    metadata: string,
    drop_wrapped_key?: string
  ) => {
    // Request password for decryption
    setPendingDownload({ fileId, filename, metadata, drop_wrapped_key });
    setPasswordAction("download");
    setShowPasswordModal(true);
  };

  const performDownload = async (password: string): Promise<boolean> => {
    if (!pendingDownload) return false;

    setDownloading(true);
    setError("");

    try {
      // 1. Fetch encrypted file from server
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/files/${pendingDownload.fileId}/download`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          navigate("/login");
          return false;
        }
        throw new Error("Failed to download file");
      }

      // 2. Get metadata from response header or use stored metadata
      let metadataStr = response.headers.get("X-File-Metadata");
      if (!metadataStr) {
        metadataStr = pendingDownload.metadata;
      }

      console.log("Metadata String:", metadataStr);

      // 3. Parse metadata to get salt and IV
      let metadataObj;
      try {
        metadataObj = JSON.parse(metadataStr);
      } catch (e) {
        console.error("Failed to parse metadata JSON:", metadataStr, e);
        throw new Error("Invalid file metadata format");
      }

      console.log("Metadata Object:", metadataObj);

      // Validate IV is present (required for all encryption methods)
      if (!metadataObj.iv) {
        console.error("Missing iv in metadata:", metadataObj);
        throw new Error("Missing encryption IV");
      }

      const iv = new Uint8Array(base64ToArrayBuffer(metadataObj.iv));
      console.log("IV length:", iv.length);

      if (iv.length !== 12) {
        console.warn("Warning: IV length is not 12 bytes:", iv.length);
      }

      // Branch based on encryption method
      const isDropUpload = !metadataObj.salt || metadataObj.salt === "";
      let encryptionKey;

      if (isDropUpload) {
        // Drop upload: Unwrap raw key from upload token
        console.log("=== DROP UPLOAD DECRYPTION ===");
        console.log("File ID:", pendingDownload.fileId);
        console.log("Filename:", pendingDownload.filename);

        // Get wrapped key from file's drop source
        const wrappedKey = pendingDownload.drop_wrapped_key;
        if (!wrappedKey) {
          console.error("✗ CRITICAL: drop_wrapped_key is missing!");
          console.error("File metadata:", JSON.stringify(metadataObj, null, 2));
          console.error("This file cannot be decrypted without the wrapped key.");
          throw new Error(
            "Missing wrapped key for drop-uploaded file. " +
            "This file was uploaded via Secure Drop but the encryption key reference is missing. " +
            "Please contact support."
          );
        }

        console.log("✓ Wrapped key present");
        console.log("Wrapped key length:", wrappedKey.length, "characters");
        console.log("Wrapped key (first 40 chars):", wrappedKey.substring(0, 40) + "...");
        console.log("Password length:", password.length, "characters");

        // Log password bytes (first few) for debugging encoding issues
        const testEncoder = new TextEncoder();
        const passwordBytes = testEncoder.encode(password);
        console.log("Password bytes (first 10):", Array.from(passwordBytes.slice(0, 10)));

        console.log("Attempting to unwrap key...");

        try {
          const rawKey = await unwrapKey(password, wrappedKey);
          console.log("✓ SUCCESS: Key unwrapped successfully!");
          console.log("Raw key length:", rawKey.length);

          // Import raw hex key as AES-256-GCM key
          const keyBytes = hexToBytes(rawKey);
          encryptionKey = await crypto.subtle.importKey(
            "raw",
            new Uint8Array(keyBytes),
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"]
          );

          console.log("✓ Encryption key imported for decryption");

        } catch (err) {
          console.error("✗ UNWRAP KEY FAILED");
          const error = err as any;
          console.error("Error type:", error?.constructor?.name || "Unknown");
          console.error("Error message:", error?.message || String(err));
          console.error("Error stack:", error?.stack || "No stack trace");

          throw new Error(
            `Failed to unwrap encryption key. This usually means:\n` +
            `1. Wrong password (must be the password used when creating the drop link)\n` +
            `2. Wrapped key format is invalid\n` +
            `3. Character encoding mismatch (special characters like ´ may be encoded differently)\n\n` +
            `Technical error: ${error?.message || String(err)}`
          );
        }
      } else {
        // Regular upload: Derive key from password + salt (PBKDF2)
        console.log("Regular upload detected - deriving key from password + salt");

        const salt = new Uint8Array(base64ToArrayBuffer(metadataObj.salt));
        console.log("Salt length:", salt.length);

        if (salt.length !== 16) {
          console.warn("Warning: Salt length is not 16 bytes:", salt.length);
        }

        encryptionKey = await deriveKeyFromPassword(password, salt, 100000);

        // Debug: Export key to verify consistency (only first few bytes)
        const exportedKey = await window.crypto.subtle.exportKey(
          "raw",
          encryptionKey
        );
        const keyBytes = new Uint8Array(exportedKey);
        console.log(
          "Derived Key (first 5 bytes):",
          Array.from(keyBytes.slice(0, 5))
        );
      }

      // 4. Get encrypted data
      const encryptedBlob = await response.blob();
      const encryptedData = await encryptedBlob.arrayBuffer();
      console.log("Encrypted Data Size:", encryptedData.byteLength);

      // 5. Decrypt the file
      console.log("Attempting decryption...");
      const decryptedData = await decryptFile(encryptedData, encryptionKey, iv);
      console.log("Decryption successful. Size:", decryptedData.byteLength);

      // 6. Create blob and trigger download
      const decryptedBlob = new Blob([decryptedData]);
      const url = window.URL.createObjectURL(decryptedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pendingDownload.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setPendingDownload(null);
      return true;
    } catch (err) {
      console.error("Download/Decryption error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to download or decrypt file. Check your password."
      );
      return false;
    } finally {
      setDownloading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate("/login");
          return;
        }
        throw new Error("Failed to delete file");
      }

      // Remove from UI
      setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));

      // Close modal
      setShowDeleteModal(false);
      setFileToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete file");
    } finally {
      setDeleting(false);
    }
  };

  const handleShareClick = (fileId: string, filename: string) => {
    setFileToShare({ id: fileId, filename });
    setShowShareModal(true);
  };

  const handleManageSharesClick = async (fileId: string, filename: string) => {
    setFileToManage({ id: fileId, filename });
    setShowManageSharesModal(true);
    setLoadingShares(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/${fileId}/shares`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate("/login");
          return;
        }
        throw new Error("Failed to fetch shared users");
      }

      const data = await response.json();
      setSharedUsers(data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load shared users"
      );
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
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          navigate("/login");
          return;
        }
        throw new Error("Failed to revoke access");
      }

      // Remove the user from the list
      setSharedUsers((prev) => prev.filter((user) => user.user_id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke access");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">File Explorer</h1>
          <p className="text-muted-foreground">
            Organize and manage your files, folders, and upload links
          </p>
        </div>

        {/* Tabs */}
        <Tabs
          tabs={[
            {
              id: "files",
              label: "My Files",
              icon: <FolderOpen className="w-4 h-4" />,
              badge: files.length,
            },
            {
              id: "folders",
              label: "My Folders",
              icon: <FolderTree className="w-4 h-4" />,
              badge: folders.length,
            },
            {
              id: "links",
              label: "My Links",
              icon: <UploadCloud className="w-4 h-4" />,
            },
          ]}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as "files" | "folders" | "links")}
        />

        {/* Files Tab */}
        <TabPanel id="files" activeTab={activeTab}>
          <MyFilesSection
            files={files}
            loading={loading}
            selectedFile={selectedFile}
            uploading={uploading}
            error={error}
            onFileSelect={handleFileSelect}
            onUpload={handleUpload}
            onDownload={handleDownload}
            onDelete={handleDeleteClick}
            onShare={handleShareClick}
            onManageShares={handleManageSharesClick}
          />
        </TabPanel>

        {/* Folders Tab */}
        <TabPanel id="folders" activeTab={activeTab}>
          <MyFoldersSection
            folders={folders}
            loading={foldersLoading}
            onCreateFolder={handleCreateFolder}
            onCreateSubfolder={handleCreateSubfolder}
            onNavigateToFolder={handleNavigateToFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
          />
        </TabPanel>

        {/* Links Tab */}
        <TabPanel id="links" activeTab={activeTab}>
          <UploadLinksSection />
        </TabPanel>


        {/* Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4 bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border-white/10 text-white">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Lock className="w-5 h-5 text-[#f2d7d8]" />
                  {passwordAction === "upload"
                    ? "Encrypt File"
                    : "Decrypt File"}
                </CardTitle>
                <CardDescription className="text-white/70">
                  {passwordAction === "upload"
                    ? "Enter a password to encrypt your file. Remember this password to decrypt it later."
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
                    Encryption Password
                  </label>
                  <input
                    type="password"
                    value={encryptionPassword}
                    onChange={(e) => setEncryptionPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 border rounded-md bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-white/40 focus:bg-white/15"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && encryptionPassword) {
                        handlePasswordSubmit();
                      }
                    }}
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
                        {passwordAction === "upload"
                          ? "Encrypting..."
                          : "Decrypting..."}
                      </>
                    ) : passwordAction === "upload" ? (
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

        {/* Share File Modal */}
        <ShareModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setFileToShare(null);
          }}
          fileId={fileToShare?.id || ""}
          fileName={fileToShare?.filename || ""}
          onShareComplete={async () => {
            await fetchFiles();
          }}
        />

        {/* Folder Modal (Create/Rename) */}
        <FolderModal
          isOpen={showFolderModal}
          onClose={() => {
            setShowFolderModal(false);
            setFolderToEdit(null);
            setFolderModalParentId(null);
          }}
          onSubmit={handleFolderModalSubmit}
          mode={folderModalMode}
          initialName={folderToEdit?.name || ""}
          parentFolderName={
            folderModalParentId
              ? folders.find((f) => f.id === folderModalParentId)?.name
              : undefined
          }
        />

        {/* Delete Folder Confirmation */}
        <DeleteFolderModal
          isOpen={showDeleteFolderModal}
          onClose={() => {
            setShowDeleteFolderModal(false);
            setFolderToDelete(null);
          }}
          onConfirm={handleDeleteFolderConfirm}
          folderName={folderToDelete?.name || ""}
          hasSubfolders={folderToDelete?.hasSubfolders || false}
        />

        {/* Manage Shares Modal */}
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
                    onClick={() => {
                      setShowManageSharesModal(false);
                      setFileToManage(null);
                      setSharedUsers([]);
                    }}
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
                    <div className="text-center py-8 text-white/70">
                      Loading shared users...
                    </div>
                  ) : sharedUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 mx-auto mb-4 text-white/70" />
                      <p className="text-white/90">
                        This file hasn't been shared yet
                      </p>
                      <p className="text-sm text-white/70 mt-2">
                        Use the Share button to give others access to this file
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-white/90">
                        Shared with {sharedUsers.length} user
                        {sharedUsers.length !== 1 ? "s" : ""}
                      </p>
                      {sharedUsers.map((user) => (
                        <div
                          key={user.user_id}
                          className="flex items-center justify-between p-3 rounded-lg border border-white/20 bg-white/5"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-white">
                              {user.username}
                            </p>
                            <div className="flex gap-3 text-sm text-white/70">
                              <span>{user.email}</span>
                              <span>•</span>
                              <span>Shared {formatDate(user.shared_at)}</span>
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
                            {revoking === user.user_id
                              ? "Revoking..."
                              : "Revoke"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-3 bg-white/5 border border-white/20 rounded-md">
                    <p className="text-xs text-white/90 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Revoking access will immediately prevent the user from
                        downloading this file. They will no longer see it in
                        their shared files list.
                      </span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && fileToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4 bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border-white/10 text-white">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Trash2 className="w-5 h-5 text-[#ef4444]" />
                  Delete File
                </CardTitle>
                <CardDescription className="text-white/70">
                  Are you sure you want to delete this file? This action cannot
                  be undone.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-white/10 border border-white/20 rounded-md">
                  <p className="text-sm font-medium truncate text-white">
                    {fileToDelete.filename}
                  </p>
                </div>

                <div className="p-3 bg-[#6b4345]/30 border border-[#d4a5a6]/40 rounded-md">
                  <p className="text-xs text-[#f2d7d8] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#d4a5a6]" />
                    <span>
                      The encrypted file will be permanently deleted from the
                      server. You will not be able to recover it.
                    </span>
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteModal(false);
                      setFileToDelete(null);
                    }}
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
                    {deleting ? "Deleting..." : "Delete File"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );

  async function handlePasswordSubmit() {
    if (!encryptionPassword) return;

    const password = encryptionPassword;
    let success = false;

    if (passwordAction === "upload") {
      success = await performUpload(password);
    } else if (passwordAction === "download") {
      success = await performDownload(password);
    }

    if (success) {
      setShowPasswordModal(false);
      setEncryptionPassword("");
      setPasswordAction(null);
    }
  }
}

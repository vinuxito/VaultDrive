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
  Upload,
  Download,
  File,
  Trash2,
  AlertCircle,
  Lock,
  Key,
  X,
  Loader2,
  Shield,
  ChevronDown,
  ChevronUp,
  Share2,
  Users,
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
} from "../utils/crypto";
import { UploadLinksSection } from "../components/upload";

interface FileData {
  id: string;
  filename: string;
  file_size: number;
  created_at: string;
  metadata: string;
}

export default function Files() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
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
  } | null>(null);

  // Metadata visibility
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

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
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sharing, setSharing] = useState(false);

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
    metadata: string
  ) => {
    // Request password for decryption
    setPendingDownload({ fileId, filename, metadata });
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

      if (!metadataObj.salt || !metadataObj.iv) {
        console.error("Missing salt or iv in metadata:", metadataObj);
        throw new Error("Missing encryption metadata");
      }

      const salt = new Uint8Array(base64ToArrayBuffer(metadataObj.salt));
      const iv = new Uint8Array(base64ToArrayBuffer(metadataObj.iv));

      console.log("Salt length:", salt.length);
      console.log("IV length:", iv.length);

      if (salt.length !== 16)
        console.warn("Warning: Salt length is not 16 bytes:", salt.length);
      if (iv.length !== 12)
        console.warn("Warning: IV length is not 12 bytes:", iv.length);

      // 4. Derive encryption key from password + salt
      console.log("Deriving key with password length:", password.length);
      const encryptionKey = await deriveKeyFromPassword(password, salt, 100000);

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

      // 5. Get encrypted data
      const encryptedBlob = await response.blob();
      const encryptedData = await encryptedBlob.arrayBuffer();
      console.log("Encrypted Data Size:", encryptedData.byteLength);

      // 6. Decrypt the file
      console.log("Attempting decryption...");
      const decryptedData = await decryptFile(encryptedData, encryptionKey, iv);
      console.log("Decryption successful. Size:", decryptedData.byteLength);

      // 7. Create blob and trigger download
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const toggleMetadata = (fileId: string) => {
    setExpandedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const maskKey = (key: string): string => {
    if (!key || key.length <= 5) return key;
    return key.substring(0, 5) + "*".repeat(Math.min(key.length - 5, 20));
  };

  const parseMetadata = (metadataStr: string) => {
    try {
      return JSON.parse(metadataStr);
    } catch {
      return null;
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

  const handleShareConfirm = async () => {
    if (!fileToShare || !recipientEmail) return;

    setSharing(true);
    setError("");

    try {
      // Get recipient's public key
      const token = localStorage.getItem("token");
      const publicKeyResponse = await fetch(
        `${API_URL}/user/public-key?email=${encodeURIComponent(
          recipientEmail
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!publicKeyResponse.ok) {
        if (publicKeyResponse.status === 404) {
          throw new Error("User not found with that email");
        }
        throw new Error("Failed to get recipient public key");
      }

      await publicKeyResponse.json();

      const wrappedKey = "placeholder_wrapped_key_" + Date.now();

      // Share the file
      const shareResponse = await fetch(
        `${API_URL}/files/${fileToShare.id}/share`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipient_email: recipientEmail,
            wrapped_key: wrappedKey,
          }),
        }
      );

      if (!shareResponse.ok) {
        const data = await shareResponse.json();
        throw new Error(data.error || "Failed to share file");
      }

      // Success feedback
      alert(`File shared successfully with ${recipientEmail}`);

      // Close modal
      setShowShareModal(false);
      setFileToShare(null);
      setRecipientEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share file");
    } finally {
      setSharing(false);
    }
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
          <h1 className="text-3xl font-bold mb-2">My Files</h1>
          <p className="text-muted-foreground">
            Upload, download, and manage your files securely
          </p>
        </div>

        {/* Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>
              Select a file from your device to upload to VaultDrive
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-8">
                <input
                  id="file-input"
                  type="file"
                  onChange={handleFileSelect}
                  className="flex-1 text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
                />
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="gap-2 bg-sky-950 hover:bg-sky-900 text-white  rounded-md"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name} (
                  {formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Files List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Files</CardTitle>
            <CardDescription>
              {loading
                ? "Loading files..."
                : `${files.length} file${files.length !== 1 ? "s" : ""} stored`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading your files...
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-12">
                <File className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No files uploaded yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Upload your first file to get started
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((file) => {
                  const isExpanded = expandedFiles.has(file.id);
                  const metadata = parseMetadata(file.metadata);

                  return (
                    <div
                      key={file.id}
                      className="rounded-lg border bg-card overflow-hidden"
                    >
                      {/* Main File Row */}
                      <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <File className="w-5 h-5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {file.filename}
                            </p>
                            <div className="flex gap-3 text-sm text-muted-foreground">
                              <span>{formatFileSize(file.file_size)}</span>
                              <span>•</span>
                              <span>{formatDate(file.created_at)}</span>
                              {metadata && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Shield className="w-3 h-3" />
                                    {metadata.algorithm || "Encrypted"}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleMetadata(file.id)}
                            className="gap-1 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                Hide Details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                Show Details
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleShareClick(file.id, file.filename)
                            }
                            className="gap-2 border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950 dark:text-purple-400"
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleManageSharesClick(file.id, file.filename)
                            }
                            className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950 dark:text-orange-400"
                          >
                            <Users className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleDownload(
                                file.id,
                                file.filename,
                                file.metadata
                              )
                            }
                            className="gap-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 dark:text-blue-400"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleDeleteClick(file.id, file.filename)
                            }
                            className="gap-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 dark:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Collapsible Metadata Section */}
                      {isExpanded && metadata && (
                        <div className="border-t bg-muted/30 p-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Lock className="w-4 h-4" />
                              <span>Encryption Details</span>
                            </div>

                            <div className="grid gap-3 text-sm">
                              {/* Algorithm */}
                              <div className="flex justify-between items-start">
                                <span className="text-muted-foreground">
                                  Algorithm:
                                </span>
                                <span className="font-mono font-medium">
                                  {metadata.algorithm || "N/A"}
                                </span>
                              </div>

                              {/* Salt */}
                              {metadata.salt && (
                                <div className="flex justify-between items-start">
                                  <span className="text-muted-foreground">
                                    Salt (Key Derivation):
                                  </span>
                                  <span className="font-mono text-xs break-all max-w-[200px] text-right">
                                    {maskKey(metadata.salt)}
                                  </span>
                                </div>
                              )}

                              {/* IV */}
                              {metadata.iv && (
                                <div className="flex justify-between items-start">
                                  <span className="text-muted-foreground">
                                    IV (Initialization Vector):
                                  </span>
                                  <span className="font-mono text-xs break-all max-w-[200px] text-right">
                                    {maskKey(metadata.iv)}
                                  </span>
                                </div>
                              )}

                              {/* File ID */}
                              <div className="flex justify-between items-start">
                                <span className="text-muted-foreground">
                                  File ID:
                                </span>
                                <span className="font-mono text-xs break-all max-w-[200px] text-right">
                                  {file.id}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                              <p className="text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>
                                  This file is encrypted with AES-256-GCM. You
                                  need your password to decrypt and download it.
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
</Card>

        {/* Upload Links */}
        <div className="mt-12">
          <UploadLinksSection />
        </div>

        {/* Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 ">
            <Card className="w-full max-w-md mx-4 bg-black">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  {passwordAction === "upload"
                    ? "Encrypt File"
                    : "Decrypt File"}
                </CardTitle>
                <CardDescription>
                  {passwordAction === "upload"
                    ? "Enter a password to encrypt your file. Remember this password to decrypt it later."
                    : "Enter the password you used to encrypt this file."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Encryption Password
                  </label>
                  <input
                    type="password"
                    value={encryptionPassword}
                    onChange={(e) => setEncryptionPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 border rounded-md bg-background"
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
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePasswordSubmit}
                    disabled={!encryptionPassword || uploading || downloading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
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
        {showShareModal && fileToShare && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4 bg-black">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                    <Share2 className="w-5 h-5" />
                    Share File
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowShareModal(false);
                      setFileToShare(null);
                      setRecipientEmail("");
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <CardDescription>
                  Share this file with another user by entering their email
                  address
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium truncate flex items-center gap-2">
                    <File className="w-4 h-4" />
                    {fileToShare.filename}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && recipientEmail) {
                        handleShareConfirm();
                      }
                    }}
                  />
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                  <p className="text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      The recipient must have a VaultDrive account. They will
                      receive access to download this file.
                    </span>
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowShareModal(false);
                      setFileToShare(null);
                      setRecipientEmail("");
                    }}
                    disabled={sharing}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleShareConfirm}
                    disabled={!recipientEmail || sharing}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {sharing ? "Sharing..." : "Share File"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Manage Shares Modal */}
        {showManageSharesModal && fileToManage && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col bg-black">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <Users className="w-5 h-5" />
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
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <CardDescription>
                  View and manage who has access to this file
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto flex-1">
                <div className="space-y-4">
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm font-medium truncate flex items-center gap-2">
                      <File className="w-4 h-4" />
                      {fileToManage.filename}
                    </p>
                  </div>

                  {loadingShares ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading shared users...
                    </div>
                  ) : sharedUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        This file hasn't been shared yet
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Use the Share button to give others access to this file
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Shared with {sharedUsers.length} user
                        {sharedUsers.length !== 1 ? "s" : ""}
                      </p>
                      {sharedUsers.map((user) => (
                        <div
                          key={user.user_id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {user.username}
                            </p>
                            <div className="flex gap-3 text-sm text-muted-foreground">
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
                            className="gap-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 dark:text-red-400"
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

                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                    <p className="text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2">
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
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="w-5 h-5" />
                  Delete File
                </CardTitle>
                <CardDescription>
                  Are you sure you want to delete this file? This action cannot
                  be undone.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium truncate">
                    {fileToDelete.filename}
                  </p>
                </div>

                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-xs text-destructive flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
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
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteConfirm}
                    disabled={deleting}
                    className="flex-1"
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

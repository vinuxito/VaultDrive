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
  AlertCircle,
  Lock,
  Users,
  Share2,
  Key,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  deriveKeyFromPassword,
  decryptFile,
  base64ToArrayBuffer,
} from "../utils/crypto";
import { API_URL } from "../utils/api";
import { FileWidget } from "../components/files";


interface SharedFile {
  id: string;
  filename: string;
  file_size: number;
  owner_username: string;
  shared_at: string;
  encrypted_metadata: string;
}

export default function SharedFiles() {
  const navigate = useNavigate();
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Password modal for decryption
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [decryptionPassword, setDecryptionPassword] = useState("");
  const [pendingDownload, setPendingDownload] = useState<{
    fileId: string;
    filename: string;
    metadata: string;
  } | null>(null);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    fetchSharedFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const fetchSharedFiles = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/shared`, {
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
        throw new Error("Failed to fetch shared files");
      }

      const data = await response.json();
      setSharedFiles(data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load shared files"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (
    fileId: string,
    filename: string,
    metadata: string
  ) => {
    // Request password for decryption
    setPendingDownload({ fileId, filename, metadata });
    setShowPasswordModal(true);
  };

  const performDownload = async (password: string) => {
    if (!pendingDownload) return;

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
          return;
        }
        throw new Error("Failed to download file");
      }

      // 2. Get metadata from response header or use stored metadata
      let metadataStr = response.headers.get("X-File-Metadata");
      if (!metadataStr) {
        metadataStr = pendingDownload.metadata;
      }

      if (!metadataStr) {
        throw new Error("File metadata not found. Cannot decrypt.");
      }

      // 3. Parse metadata to get salt and IV
      const metadataObj = JSON.parse(metadataStr);
      const salt = new Uint8Array(base64ToArrayBuffer(metadataObj.salt));
      const iv = new Uint8Array(base64ToArrayBuffer(metadataObj.iv));

      // 4. Derive encryption key from password + salt
      const encryptionKey = await deriveKeyFromPassword(password, salt, 100000);

      // 5. Get encrypted data
      const encryptedBlob = await response.blob();
      const encryptedData = await encryptedBlob.arrayBuffer();

      // 6. Decrypt the file
      const decryptedData = await decryptFile(encryptedData, encryptionKey, iv);

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
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to download or decrypt file. Check your password."
      );
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Share2 className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Shared With Me</h1>
              <p className="text-muted-foreground">
                Files that other users have shared with you
              </p>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Shared Files List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Shared Files
            </CardTitle>
            <CardDescription>
              {loading
                ? "Loading shared files..."
                : `${sharedFiles.length} file${
                    sharedFiles.length !== 1 ? "s" : ""
                  } shared with you`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading shared files...
              </div>
            ) : sharedFiles.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Share2 className="w-8 h-8 text-purple-500" />
                </div>
                <p className="text-muted-foreground font-medium">
                  No shared files yet
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Files shared with you by other users will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sharedFiles.map((file) => (
                  <FileWidget
                    key={file.id}
                    file={{
                      ...file,
                      created_at: file.shared_at,
                      metadata: file.encrypted_metadata,
                      shared_by: file.owner_username,
                      shared_by_name: file.owner_username,
                      is_owner: false,
                    }}
                    context="shared-files"
                    onDownload={handleDownload}
                    showActions={true}
                    showDetails={true}
                    enableExpand={true}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-purple-500" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">About Shared Files</p>
                <p className="text-sm text-muted-foreground">
                  These files are encrypted and shared securely. You need to
                  know the encryption password used by the file owner to decrypt
                  and download these files.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Password Modal for Decryption */}
        {showPasswordModal && pendingDownload && (
          <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4 bg-black">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Decrypt Shared File
                </CardTitle>
                <CardDescription>
                  Enter the password used to encrypt this file. Ask the file
                  owner if you don't know it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium truncate flex items-center gap-2">
                    <File className="w-4 h-4" />
                    {pendingDownload.filename}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Decryption Password
                  </label>
                  <input
                    type="password"
                    value={decryptionPassword}
                    onChange={(e) => setDecryptionPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && decryptionPassword) {
                        handlePasswordSubmit();
                      }
                    }}
                  />
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                  <p className="text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      This file was encrypted by the owner. You need the same
                      password they used to encrypt it.
                    </span>
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setDecryptionPassword("");
                      setPendingDownload(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePasswordSubmit}
                    disabled={!decryptionPassword}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Decrypt & Download
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
    if (!decryptionPassword) return;

    setShowPasswordModal(false);
    const password = decryptionPassword;
    setDecryptionPassword("");

    await performDownload(password);
  }
}

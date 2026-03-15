import { useState, useEffect, useCallback } from "react";
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
  decryptPrivateKeyWithPIN,
  importRSAPrivateKey,
  unwrapKeyWithRSA,
  decryptFile,
  base64ToArrayBuffer,
} from "../utils/crypto";
import { API_URL } from "../utils/api";
import { FileWidget } from "../components/files";
import { useSessionVault } from "../context/SessionVaultContext";
import { restorePrivateKeyFromSessionPin } from "../utils/shared-session";

interface SharedFile {
  id: string;
  filename: string;
  file_size: number;
  owner_username: string;
  shared_at: string;
  encrypted_metadata: string;
}

function shouldFallbackToPinPrompt(error: unknown): boolean {
  if (error instanceof DOMException) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("Decryption failed") || error.message.includes("OperationError");
}

export default function SharedFiles() {
  const navigate = useNavigate();
  const { getPrivateKey, getCredential, setCredential, setPrivateKey } = useSessionVault();
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pendingDownload, setPendingDownload] = useState<{
    fileId: string;
    filename: string;
    metadata: string;
  } | null>(null);

  const fetchSharedFiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/shared`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401) { navigate("/login"); return; }
        throw new Error("Failed to fetch shared files");
      }
      const data = await response.json();
      setSharedFiles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shared files");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    void fetchSharedFiles();
  }, [fetchSharedFiles, navigate]);

  const handleDownload = async (fileId: string, filename: string, metadata: string) => {
    const sessionKey = getPrivateKey();
    if (sessionKey) {
      setError("");
      try {
        await performDownloadWithKey(fileId, filename, metadata, sessionKey);
        return;
      } catch (err) {
        if (!shouldFallbackToPinPrompt(err)) {
          setError(err instanceof Error ? err.message : "Failed to download shared file.");
          return;
        }
      }
    }

    const stored = localStorage.getItem("user");
    const userObj = stored ? JSON.parse(stored) : null;
    const restoredKey = await restorePrivateKeyFromSessionPin({
      credential: getCredential(),
      privateKeyPinEncrypted: userObj?.private_key_pin_encrypted ?? null,
    });
    if (restoredKey) {
      setPrivateKey(restoredKey);
      setError("");
      try {
        await performDownloadWithKey(fileId, filename, metadata, restoredKey);
        return;
      } catch (err) {
        if (!shouldFallbackToPinPrompt(err)) {
          setError(err instanceof Error ? err.message : "Failed to download shared file.");
          return;
        }
      }
    }

    if (!userObj?.private_key_pin_encrypted) {
      setError("Your PIN is not fully enrolled for shared files yet. Open Settings and set your PIN again with your account password to finish enabling shared-file decryption.");
      return;
    }

    setPendingDownload({ fileId, filename, metadata });
    setShowPinModal(true);
  };

  const performDownloadWithKey = async (
    fileId: string,
    filename: string,
    metadata: string,
    rsaKey: CryptoKey
  ) => {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      if (response.status === 401) { navigate("/login"); return; }
      throw new Error("Failed to download file");
    }
    const wrappedKeyB64 = response.headers.get("X-Wrapped-Key");
    if (!wrappedKeyB64) throw new Error("No wrapped key in response.");
    const aesKey = await unwrapKeyWithRSA(rsaKey, wrappedKeyB64);
    const metaStr = response.headers.get("X-File-Metadata") || metadata;
    const metaObj = JSON.parse(metaStr);
    const iv = new Uint8Array(base64ToArrayBuffer(metaObj.iv));
    const encryptedBlob = await response.blob();
    const encryptedData = await encryptedBlob.arrayBuffer();
    const decryptedData = await decryptFile(encryptedData, aesKey, iv);
    const blob = new Blob([decryptedData]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const performDownload = async (pin: string) => {
    if (!pendingDownload) return false;
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files/${pendingDownload.fileId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) { navigate("/login"); return false; }
        throw new Error("Failed to download file");
      }

      const wrappedKeyB64 = response.headers.get("X-Wrapped-Key");
      if (!wrappedKeyB64) {
        throw new Error("No wrapped key in response. The file owner must re-share this file.");
      }

      const stored = localStorage.getItem("user");
      const userObj = stored ? JSON.parse(stored) : null;
      const privateKeyPinEncrypted: string | null = userObj?.private_key_pin_encrypted ?? null;

      if (!privateKeyPinEncrypted) {
        throw new Error("PIN-encrypted private key not found. Please re-set your PIN in Settings to enable PIN-based decryption.");
      }

      const privateKeyPem = await decryptPrivateKeyWithPIN(pin, privateKeyPinEncrypted);
      const rsaPrivateKey = await importRSAPrivateKey(privateKeyPem);
      setPrivateKey(rsaPrivateKey);
      setCredential(pin, "pin");

      const aesKey = await unwrapKeyWithRSA(rsaPrivateKey, wrappedKeyB64);

      const metaStr = response.headers.get("X-File-Metadata") || pendingDownload.metadata;
      if (!metaStr) throw new Error("File metadata not found");
      const metaObj = JSON.parse(metaStr);
      const iv = new Uint8Array(base64ToArrayBuffer(metaObj.iv));

      const encryptedBlob = await response.blob();
      const encryptedData = await encryptedBlob.arrayBuffer();
      const decryptedData = await decryptFile(encryptedData, aesKey, iv);

      const blob = new Blob([decryptedData]);
      const url = window.URL.createObjectURL(blob);
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
      setError(err instanceof Error ? err.message : "Failed to decrypt. Check your PIN.");
      return false;
    }
  };

  return (
    <div className="abrn-page-bg py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#7d4f50]/20 flex items-center justify-center">
              <Share2 className="w-6 h-6 text-[#c4999b]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Shared With Me</h1>
              <p className="text-muted-foreground">Files that other users have shared with you</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        <div className="abrn-glass-card p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Shared Files
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {loading
                ? "Loading shared files..."
                : `${sharedFiles.length} file${sharedFiles.length !== 1 ? "s" : ""} shared with you`}
            </p>
          </div>
          <div>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading shared files...</div>
            ) : sharedFiles.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#7d4f50]/20 flex items-center justify-center">
                  <Share2 className="w-8 h-8 text-[#c4999b]" />
                </div>
                <p className="text-muted-foreground font-medium">No shared files yet</p>
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
          </div>
        </div>

        <div className="abrn-glass-card mt-6 p-6">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-sm">About Shared Files</p>
              <p className="text-sm text-muted-foreground">
                Shared files are decrypted using your 4-digit PIN. No passwords are exchanged between users.
              </p>
            </div>
          </div>
        </div>

        {showPinModal && pendingDownload && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4 bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border-white/10 text-white">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Lock className="w-5 h-5 text-[#f2d7d8]" />
                  Decrypt Shared File
                </CardTitle>
                <CardDescription className="text-white/70">
                  Enter your 4-digit PIN to decrypt this file
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium truncate flex items-center gap-2">
                    <File className="w-4 h-4" />
                    {pendingDownload.filename}
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="shared-file-pin" className="text-sm font-medium flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Your PIN
                  </label>
                  <input
                    id="shared-file-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinValue}
                    onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
                    placeholder="4-digit PIN"
                    className="w-full px-3 py-2 border rounded-md bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-white/40"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && pinValue.length === 4) handlePinSubmit();
                    }}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPinModal(false);
                      setPinValue("");
                      setPendingDownload(null);
                    }}
                    className="flex-1 border-2 border-white/40 text-white hover:bg-white/10 bg-transparent"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePinSubmit}
                    disabled={pinValue.length !== 4}
                    className="flex-1 bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
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

  async function handlePinSubmit() {
    if (pinValue.length !== 4) return;
    const pin = pinValue;
    setPinValue("");
    const success = await performDownload(pin);
    if (success) {
      setShowPinModal(false);
    }
  }
}

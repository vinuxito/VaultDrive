import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Plus, X, Loader2, Folder as FolderIcon, Copy, Check, Link as LinkIcon, Lock } from "lucide-react";
import { API_URL } from "../../utils/api";

interface Folder {
  id: string;
  name: string;
  parentId: string;
}

interface CreateUploadLinkModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateUploadLinkModal({
  open,
  onClose,
  onSuccess
}: CreateUploadLinkModalProps) {
  // onSuccess reserved for future use
  void onSuccess;
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [expiresIn, setExpiresIn] = useState("7");
  const [maxFiles, setMaxFiles] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchingFolders, setFetchingFolders] = useState(false);
  const [error, setError] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState("");
  const [createdLink, setCreatedLink] = useState<{url: string; password: string} | null>(null);

  useEffect(() => {
    if (open) {
      fetchFolders();
    }
  }, [open]);

  const fetchFolders = async () => {
    setFetchingFolders(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/folders`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to load folders");
      }

      const data = await response.json();
      setFolders(data || []);

      if (data && data.length > 0) {
        setSelectedFolderId(data[0].id);
      }
    } catch (err) {
      console.error("Error fetching folders:", err);
      setError(err instanceof Error ? err.message : "Failed to load folders");
    } finally {
      setFetchingFolders(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError("Folder name is required");
      return;
    }

    setCreatingFolder(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/folders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: newFolderName.trim() })
      });

      if (!response.ok) {
        throw new Error("Failed to create folder");
      }

      const newFolder = await response.json();
      setFolders([...folders, newFolder]);
      setSelectedFolderId(newFolder.id);
      setNewFolderName("");
      setShowCreateFolder(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  // Auto-generate password on mount
  useEffect(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEncryptionPassword(password);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      const days = parseInt(expiresIn, 10);
      const expiresAt = days > 0
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : "";

      const response = await fetch(`${API_URL}/drop/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          target_folder_id: selectedFolderId,
          expires_at: expiresAt,
          max_files: maxFiles,
          password: encryptionPassword
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to create upload link";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (_) {
          if (errorText.includes("Unauthorized")) {
            errorMessage = "Please log in again";
          } else if (errorText.includes("Folder")) {
            errorMessage = "Folder not found";
          } else {
            errorMessage = errorText || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("Upload link created:", data);
      
      // Show success with URL and password
      setCreatedLink({
        url: data.upload_url,
        password: encryptionPassword
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create upload link");
    } finally {
      setLoading(false);
    }
  };

  const [copied, setCopied] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const copyToClipboard = async (text: string, type: "url" | "password") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "url") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="elegant-overlay w-full max-w-md mx-auto rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
            <Plus className="w-5 h-5 text-sky-500" />
            {createdLink ? "Upload Link Created" : "Create New Upload Link"}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {createdLink ? (
          // Success view
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="text-green-400 text-sm">
                <strong>Upload link created successfully!</strong>
                <br />
                Share this link with anyone - uploads are password-protected.
              </p>
            </div>

            <div>
              <Label className="text-white text-sm flex items-center gap-1">
                <LinkIcon className="w-4 h-4" />
                Upload URL
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={createdLink.url}
                  readOnly
                  className="bg-slate-800 border-slate-700 text-white text-sm"
                />
                <Button
                  onClick={() => copyToClipboard(createdLink.url, "url")}
                  className="bg-sky-900 hover:bg-sky-800 text-white"
                  title="Copy URL"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <Label className="text-amber-300 text-sm flex items-center gap-1">
                <Lock className="w-4 h-4" />
                Owner Password
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={createdLink.password}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  className="bg-slate-800 border-amber-500/40 text-amber-100 text-sm"
                />
                <Button
                  onClick={() => copyToClipboard(createdLink.password, "password")}
                  className="bg-amber-900/60 hover:bg-amber-800/70 text-amber-50"
                  title="Copy password"
                >
                  {copiedPassword ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-amber-300 text-xs mt-2">
                Keep this password safe! You'll need it to decrypt uploaded files.
                The uploader doesn't need to enter anything - the encryption key is embedded in the URL.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                onClick={onClose}
                className="bg-sky-900 hover:bg-sky-800 text-white"
              >
                Done
              </Button>
            </div>
          </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="folder" className="text-white text-sm">
                  Target Folder
                </Label>
            <div className="mt-1 flex gap-2">
              {fetchingFolders ? (
                <div className="text-slate-400 text-sm">Loading folders...</div>
              ) : showCreateFolder ? (
                <div className="flex-1 flex gap-2">
                  <Input
                    id="newFolderName"
                    type="text"
                    placeholder="Enter folder name..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                    className="bg-slate-800 border-slate-700 text-white"
                    disabled={creatingFolder}
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={handleCreateFolder}
                    disabled={creatingFolder || !newFolderName.trim()}
                    className="bg-sky-900 hover:bg-sky-800 text-white"
                  >
                    {creatingFolder ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Create"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setShowCreateFolder(false); setNewFolderName(""); }}
                    className="text-slate-400 hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <select
                    id="folder"
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="flex-1 bg-slate-800 border-slate-700 text-white rounded-md px-3 py-2"
                  >
                    {folders.length === 0 ? (
                      <option value="">-- Create a folder --</option>
                    ) : (
                      folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))
                    )}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowCreateFolder(true); setNewFolderName(""); }}
                    className="border-slate-600 text-white hover:bg-slate-800"
                    title="Create new folder"
                  >
                    <FolderIcon className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
            {folders.length === 0 && !showCreateFolder && (
              <div className="mt-1 text-sm text-sky-400">
                ↑ Click folder icon to create your first folder
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="expiresIn" className="text-white text-sm">
              Link Expiration
            </Label>
            <select
              id="expiresIn"
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              className="w-full bg-slate-800 border-slate-700 text-white rounded-md px-3 py-2 mt-1"
            >
              <option value="0">Never</option>
              <option value="1">1 Day</option>
              <option value="7">7 Days</option>
              <option value="30">30 Days</option>
            </select>
          </div>

          <div>
            <Label htmlFor="maxFiles" className="text-white text-sm">
              Max Files (0 = Unlimited)
            </Label>
            <Input
              id="maxFiles"
              type="number"
              min="0"
              value={maxFiles}
              onChange={(e) => setMaxFiles(parseInt(e.target.value, 10) || 0)}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <p className="text-sm text-blue-400">
              <strong>Secure link with encryption key</strong> will be created automatically.
              Share the link - the uploader doesn't need to enter any password.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="border-slate-600 text-white hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || fetchingFolders || (folders.length === 0 && !showCreateFolder) || !selectedFolderId}
              className="bg-sky-900 hover:bg-sky-800 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Link
                </>
              )}
            </Button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

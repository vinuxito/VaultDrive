import { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Plus, X, Loader2, Folder as FolderIcon, Copy, Check, Link as LinkIcon, Fingerprint, CheckCircle2 } from "lucide-react";
import { API_URL } from "../../utils/api";
import { useSessionVault } from "../../context/SessionVaultContext";
import { getCachedPinValue } from "../../utils/pin-trust";
import { ApiCallTrace } from "../control-plane/ApiCallTrace";

interface Folder {
  id: string;
  name: string;
  parentId: string;
}

interface CreateUploadLinkModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
}

export function CreateUploadLinkModal({
  open,
  onClose,
  onSuccess
}: CreateUploadLinkModalProps) {
  const { getCredential, setCredential } = useSessionVault();
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
  const [pinInput, setPinInput] = useState("");
  const [linkName, setLinkName] = useState("");
  const [description, setDescription] = useState("");
  const [createdLink, setCreatedLink] = useState<{ url: string } | null>(null);
  const [sealAfterUpload, setSealAfterUpload] = useState(false);
  const cachedPin = getCachedPinValue(getCredential());
  const activePin = cachedPin ?? pinInput;

  const fetchFolders = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (open) {
      void fetchFolders();
    }
  }, [open, fetchFolders]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^\d{4}$/.test(activePin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }

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
          pin: activePin,
          link_name: linkName,
          description: description,
          seal_after_upload: sealAfterUpload,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to create upload link";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          if (errorText.includes("Unauthorized")) {
            errorMessage = "Please log in again";
          } else if (errorText.includes("Folder")) {
            errorMessage = "Folder not found";
          } else if (errorText.includes("PIN")) {
            errorMessage = "Set a 4-digit PIN in Settings before creating links";
          } else {
            errorMessage = errorText || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setCredential(activePin, "pin");
      setCreatedLink({ url: data.upload_url });
      await onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create upload link");
    } finally {
      setLoading(false);
    }
  };

  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
            <Plus className="w-5 h-5 text-[#f2d7d8]" />
            {createdLink ? "Upload Link Created" : "Create Client Upload Link"}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {!createdLink && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-xs leading-relaxed text-white/72">
            Create a sender route into a specific folder. You stay in control of the route, its expiry, and whether it should seal itself after a delivery.
          </div>
        )}

        {createdLink ? (
          <div className="space-y-4">
            <div className="abrn-receipt-surface rounded-2xl px-4 py-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-emerald-900 font-semibold text-sm">Secure Drop route ready</p>
                  <p className="text-emerald-800 text-xs mt-1 leading-relaxed">Share this URL when you want a client to deliver files. You can review the route later, seal it after use, or revoke it from your vault.</p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/8 border border-white/15 space-y-1.5">
              <p className="text-sm font-medium text-white">Trust receipt</p>
              <p className="text-xs text-white/70 leading-relaxed">
                This route now accepts uploads into the folder you selected. You can watch uploads arrive, seal the route, or remove it later from Upload Links.
              </p>
            </div>

            <ApiCallTrace
              method="POST"
              path="/api/drop/create"
              note="ABRN Drive just created a bounded sender route tied to the folder and PIN trust you selected."
            />

            <div>
              <Label className="text-white/90 text-sm flex items-center gap-1">
                <LinkIcon className="w-4 h-4" />
                Upload URL
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={createdLink.url}
                  readOnly
                  className="bg-white/10 border-white/20 text-white text-sm"
                />
                <Button
                  onClick={() => copyToClipboard(createdLink.url)}
                  className="bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
                  title="Copy URL"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-white/60 text-xs">
                The encryption key travels in the URL fragment and never reaches the server. Copy the link now, or find it again later in Upload Links.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/8 border border-white/15">
              <p className="text-white/80 text-sm flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-[#f2d7d8] shrink-0" />
                Files uploaded through this route stay bound to your app-wide <strong>4-digit PIN</strong> so the route feels delegated, not detached.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                onClick={onClose}
                className="bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="linkName" className="text-white/90 text-sm">
                Link Name (optional)
              </Label>
              <Input
                id="linkName"
                type="text"
                placeholder="e.g. ALPLA"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                className="mt-1 bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-white/40 focus:bg-white/15"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-white/90 text-sm">
                Instructions for client (optional)
              </Label>
              <textarea
                id="description"
                placeholder="e.g. Please upload your Q1 financial statements here."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/50 focus:border-white/40 focus:bg-white/15 focus:outline-none px-3 py-2 text-sm resize-none"
              />
            </div>

            <div>
              <Label htmlFor="folder" className="text-white/90 text-sm">
                Target Folder
              </Label>
              <div className="mt-1 flex gap-2">
                {fetchingFolders ? (
                  <div className="text-white/70 text-sm">Loading folders...</div>
                ) : showCreateFolder ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      id="newFolderName"
                      type="text"
                      placeholder="Enter folder name..."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                      className="bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-white/40 focus:bg-white/15"
                      disabled={creatingFolder}
                      autoFocus
                    />
                    <Button
                      type="button"
                      onClick={handleCreateFolder}
                      disabled={creatingFolder || !newFolderName.trim()}
                      className="bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
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
                      className="text-white/70 hover:text-white hover:bg-white/10"
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
                      className="flex-1 bg-white/10 border border-white/20 text-white rounded-md px-3 py-2 focus:border-white/40 focus:bg-white/15"
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
                      className="border-2 border-white/40 text-white hover:bg-white/10 bg-transparent"
                      title="Create new folder"
                    >
                      <FolderIcon className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
              {folders.length === 0 && !showCreateFolder && (
                <div className="mt-1 text-sm text-[#f2d7d8]">
                  ↑ Click folder icon to create your first folder
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="expiresIn" className="text-white/90 text-sm">
                Link Expiration
              </Label>
              <select
                id="expiresIn"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white rounded-md px-3 py-2 mt-1 focus:border-white/40 focus:bg-white/15"
              >
                <option value="0">Never</option>
                <option value="1">1 Day</option>
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
              </select>
            </div>

            <div>
              <Label htmlFor="maxFiles" className="text-white/90 text-sm">
                Max Files (0 = Unlimited)
              </Label>
              <Input
                id="maxFiles"
                type="number"
                min="0"
                value={maxFiles}
                onChange={(e) => setMaxFiles(parseInt(e.target.value, 10) || 0)}
                className="bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-white/40 focus:bg-white/15"
              />
            </div>

            <div className="flex items-center gap-3 py-1">
              <button
                type="button"
                role="switch"
                aria-checked={sealAfterUpload}
                onClick={() => setSealAfterUpload((v) => !v)}
                className={`relative w-10 h-6 rounded-full transition-colors focus:outline-none ${sealAfterUpload ? "bg-amber-500" : "bg-white/20"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${sealAfterUpload ? "translate-x-4" : ""}`} />
              </button>
              <div>
                <p className="text-white/90 text-sm font-medium">Seal after first upload</p>
                <p className="text-white/68 text-xs">Link closes automatically after one use</p>
              </div>
            </div>

            {cachedPin ? (
              <div className="p-3 rounded-lg bg-white/10 border border-white/20">
                <p className="text-white/90 text-sm flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-[#f2d7d8] shrink-0" />
                  Your vault PIN is already trusted for this session. This link will use the same app-wide PIN automatically.
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="pin" className="text-white/90 text-sm flex items-center gap-1">
                  <Fingerprint className="w-4 h-4" />
                  Your 4-digit PIN
                </Label>
                <input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  className="mt-1 w-full px-3 py-2 border rounded-md bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-white/40 focus:bg-white/15 text-center tracking-widest text-xl"
                />
                <p className="text-white/60 text-xs mt-1">
                  Files will be encrypted so only you can decrypt them with this PIN.
                  Set your PIN in Settings if you haven't yet.
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-[#6b4345]/30 border border-[#d4a5a6]/40 text-[#f2d7d8] text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="border-2 border-white/40 text-white hover:bg-white/10 bg-transparent"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || fetchingFolders || (folders.length === 0 && !showCreateFolder) || !selectedFolderId || activePin.length !== 4}
                className="bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
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

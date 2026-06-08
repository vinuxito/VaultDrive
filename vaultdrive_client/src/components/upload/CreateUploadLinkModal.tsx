import { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Plus, X, Loader2, Folder as FolderIcon, Fingerprint, CheckCircle2 } from "lucide-react";
import { API_URL } from "../../utils/api";
import { useSessionVault } from "../../context/SessionVaultContext";
import { getCachedPinValue } from "../../utils/pin-trust";
import { ApiCallTrace } from "../control-plane/ApiCallTrace";
import { branding } from "../../config/branding";
import { ProtectedLinkCopyField } from "../links/ProtectedLinkCopyField";
import { useTheme } from "../theme-provider";
import { cn } from "../../lib/utils";

interface Folder {
  id: string;
  name: string;
  parentId: string;
}

interface CreateUploadLinkModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
  initialFolderId?: string;
  initialFolderName?: string;
  introMessage?: string;
}

export function CreateUploadLinkModal({
  open,
  onClose,
  onSuccess,
  initialFolderId,
  initialFolderName,
  introMessage,
}: CreateUploadLinkModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
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
  const [createdLink, setCreatedLink] = useState<{ url: string; pin: string } | null>(null);
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
        const preferredFolder = initialFolderId
          ? data.find((folder: Folder) => folder.id === initialFolderId)
          : null;
        setSelectedFolderId(preferredFolder?.id ?? data[0].id);
      }
    } catch (err) {
      console.error("Error fetching folders:", err);
      setError(err instanceof Error ? err.message : "Failed to load folders");
    } finally {
      setFetchingFolders(false);
    }
  }, [initialFolderId]);

  useEffect(() => {
    if (open) {
      void fetchFolders();
      setCreatedLink(null);
      setError("");
      setLinkName("");
      setDescription("");
      setExpiresIn("7");
      setMaxFiles(0);
      setSealAfterUpload(false);
      setPinInput("");
      setShowCreateFolder(false);
      setNewFolderName("");
      setSelectedFolderId(initialFolderId ?? "");
    }
  }, [open, fetchFolders, initialFolderId]);

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
      setCreatedLink({ url: data.upload_url, pin: activePin });
      await onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create upload link");
    } finally {
      setLoading(false);
    }
  };
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          "border rounded-2xl shadow-2xl w-full max-w-md mx-auto p-6",
          isDark
            ? "bg-gradient-to-br from-primary to-primary/90 border-white/10 text-white"
            : "bg-card border-border text-foreground"
        )}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className={cn("text-xl font-semibold flex items-center gap-2", isDark ? "text-white" : "text-foreground")}>
            <Plus className={cn("w-5 h-5", isDark ? "text-primary-foreground" : "text-primary")} />
            {createdLink ? "Upload Link Created" : "Create Client Upload Link"}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className={cn(
              isDark ? "text-white/80 hover:text-white hover:bg-white/15" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {!createdLink && (
          <div
            className={cn(
              "mb-4 rounded-2xl border px-4 py-3 text-xs leading-relaxed",
              isDark ? "border-white/10 bg-white/12 text-white/85" : "bg-muted border-border text-muted-foreground"
            )}
          >
            {introMessage ??
              `Create a sender route into a specific folder. You stay in control of the route, its expiry, and whether it should seal itself after a delivery.${initialFolderName ? ` This route will target ${initialFolderName}.` : ""}`}
          </div>
        )}

        {createdLink ? (
          <div className="space-y-4">
            <div className="brand-receipt-surface rounded-2xl px-4 py-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-emerald-900 font-semibold text-sm">Secure Drop route ready</p>
                  <p className="text-emerald-800 text-xs mt-1 leading-relaxed">
                    Share this URL when you want a client to deliver files. You can review the route later, seal it
                    after use, or revoke it from your vault.
                  </p>
                </div>
              </div>
            </div>

            <div className={cn("p-3 rounded-xl border space-y-1.5", isDark ? "bg-white/12 border-white/15" : "bg-muted border-border")}>
              <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-foreground")}>Trust receipt</p>
              <p className={cn("text-xs leading-relaxed", isDark ? "text-white/80" : "text-muted-foreground")}>
                This route now accepts uploads into the folder you selected. You can watch uploads arrive, seal the
                route, or remove it later from Upload Links.
              </p>
            </div>

            <ApiCallTrace
              method="POST"
              path="/api/drop/create"
              note={`${branding.productName} just created a bounded sender route tied to the folder and PIN trust you selected.`}
            />

            <ProtectedLinkCopyField
              label="Upload URL"
              rawUrl={createdLink.url}
              expectedPath={new URL(createdLink.url, window.location.origin).pathname}
              kind="upload-link"
              variant={isDark ? "dark" : "light"}
              copyButtonLabel="Copy full upload link"
              guidanceText="Enter your 4-digit PIN to copy the full URL."
              onResolveUrl={async (pin) => {
                if (pin !== createdLink.pin) {
                  throw new Error("That PIN didn't match. Try again.");
                }

                return createdLink.url;
              }}
            />

            <div className={cn("p-3 rounded-xl border", isDark ? "bg-white/12 border-white/10" : "bg-muted border-border")}>
              <p className={cn("text-xs", isDark ? "text-white/75" : "text-muted-foreground")}>
                The encryption key travels in the URL fragment and never reaches the server. Verify your PIN when you
                need to copy the full route, or manage it later from Upload Links.
              </p>
            </div>

            <div className={cn("p-3 rounded-xl border", isDark ? "bg-white/12 border-white/15" : "bg-muted border-border")}>
              <p className={cn("text-sm flex items-center gap-2", isDark ? "text-white/85" : "text-foreground")}>
                <Fingerprint className={cn("w-4 h-4 shrink-0", isDark ? "text-primary-foreground" : "text-primary")} />
                <span>
                  Files uploaded through this route stay bound to your app-wide <strong>4-digit PIN</strong> so the
                  route feels delegated, not detached.
                </span>
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                onClick={onClose}
                className={cn(
                  "font-semibold",
                  isDark
                    ? "bg-white text-primary hover:bg-primary/10"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="linkName" className={cn("text-sm", isDark ? "text-white" : "text-foreground")}>
                Link Name (optional)
              </Label>
              <Input
                id="linkName"
                type="text"
                placeholder="e.g. ALPLA"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                className={cn(
                  isDark
                    ? "bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/20"
                    : "bg-muted border-border text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background"
                )}
              />
            </div>

            <div>
              <Label htmlFor="description" className={cn("text-sm", isDark ? "text-white" : "text-foreground")}>
                Instructions for client (optional)
              </Label>
              <textarea
                id="description"
                placeholder="e.g. Please upload your Q1 financial statements here."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={cn(
                  "mt-1 w-full rounded-md border text-sm resize-none focus:outline-none px-3 py-2",
                  isDark
                    ? "bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/20"
                    : "bg-muted border-border text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background"
                )}
              />
            </div>

            <div>
              <Label htmlFor="folder" className={cn("text-sm", isDark ? "text-white" : "text-foreground")}>
                Destination Folder
              </Label>
              <div className="mt-1 flex gap-2">
                {fetchingFolders ? (
                  <div className={cn("text-sm", isDark ? "text-white/80" : "text-muted-foreground")}>
                    Loading folders...
                  </div>
                ) : showCreateFolder ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      id="newFolderName"
                      type="text"
                      placeholder="Enter folder name..."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                      className={cn(
                        isDark
                          ? "bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/20"
                          : "bg-muted border-border text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background"
                      )}
                      disabled={creatingFolder}
                      autoFocus
                    />
                    <Button
                      type="button"
                      onClick={handleCreateFolder}
                      disabled={creatingFolder || !newFolderName.trim()}
                      className={cn(
                        "font-semibold",
                        isDark
                          ? "bg-white text-primary hover:bg-primary/10"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                    >
                      {creatingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowCreateFolder(false);
                        setNewFolderName("");
                      }}
                      className={cn(
                        isDark
                          ? "text-white/80 hover:text-white hover:bg-white/15"
                          : "text-muted-foreground hover:text-foreground"
                      )}
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
                      className={cn(
                        "flex-1 border rounded-md px-3 py-2 focus:outline-none",
                        isDark
                          ? "bg-white/15 border-white/20 text-white focus:border-white/40 focus:bg-white/20"
                          : "bg-muted border-border text-foreground focus:border-primary focus:bg-background"
                      )}
                    >
                      {folders.length === 0 ? (
                        <option
                          value=""
                          className={cn(isDark ? "bg-card text-white" : "bg-background text-foreground")}
                        >
                          -- Create a folder --
                        </option>
                      ) : (
                        folders.map((folder) => (
                          <option
                            key={folder.id}
                            value={folder.id}
                            className={cn(isDark ? "bg-card text-white" : "bg-background text-foreground")}
                          >
                            {folder.name}
                          </option>
                        ))
                      )}
                    </select>
                    <Button
                      type="button"
                      variant="modal-cancel"
                      onClick={() => {
                        setShowCreateFolder(true);
                        setNewFolderName("");
                      }}
                      title="Create new folder"
                      className={cn(isDark ? "bg-white/15 border-white/20 text-white hover:bg-white/25 border" : "")}
                    >
                      <FolderIcon className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
              {folders.length === 0 && !showCreateFolder && (
                <div className="mt-1 text-sm text-primary-foreground">
                  ↑ Click folder icon to create your first folder
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="expiresIn" className={cn("text-sm", isDark ? "text-white" : "text-foreground")}>
                Link Expiration
              </Label>
              <select
                id="expiresIn"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className={cn(
                  "w-full border rounded-md px-3 py-2 mt-1 focus:outline-none",
                  isDark
                    ? "bg-white/15 border-white/20 text-white focus:border-white/40 focus:bg-white/20"
                    : "bg-muted border-border text-foreground focus:border-primary focus:bg-background"
                )}
              >
                <option value="0" className={cn(isDark ? "bg-card text-white" : "bg-background text-foreground")}>
                  Never
                </option>
                <option value="1" className={cn(isDark ? "bg-card text-white" : "bg-background text-foreground")}>
                  1 Day
                </option>
                <option value="7" className={cn(isDark ? "bg-card text-white" : "bg-background text-foreground")}>
                  7 Days
                </option>
                <option value="30" className={cn(isDark ? "bg-card text-white" : "bg-background text-foreground")}>
                  30 Days
                </option>
              </select>
            </div>

            <div>
              <Label htmlFor="maxFiles" className={cn("text-sm", isDark ? "text-white" : "text-foreground")}>
                Max Files (0 = Unlimited)
              </Label>
              <Input
                id="maxFiles"
                type="number"
                min="0"
                value={maxFiles}
                onChange={(e) => setMaxFiles(parseInt(e.target.value, 10) || 0)}
                className={cn(
                  isDark
                    ? "bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/20"
                    : "bg-muted border-border text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background"
                )}
              />
            </div>

            <div className="flex items-center gap-3 py-1">
              <button
                type="button"
                role="switch"
                aria-checked={sealAfterUpload}
                onClick={() => setSealAfterUpload((v) => !v)}
                className={cn(
                  "relative w-10 h-6 rounded-full transition-colors focus:outline-none",
                  sealAfterUpload
                    ? "bg-amber-500"
                    : isDark
                      ? "bg-white/25"
                      : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    sealAfterUpload ? "translate-x-4" : ""
                  )}
                />
              </button>
              <div>
                <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-foreground")}>
                  Seal after first upload
                </p>
                <p className={cn("text-xs", isDark ? "text-white/75" : "text-muted-foreground")}>
                  Link closes automatically after one use
                </p>
              </div>
            </div>

            {cachedPin ? (
              <div className={cn("p-3 rounded-lg border", isDark ? "bg-white/15 border-white/20" : "bg-muted border-border")}>
                <p className={cn("text-sm flex items-center gap-2", isDark ? "text-white" : "text-foreground")}>
                  <Fingerprint className={cn("w-4 h-4 shrink-0", isDark ? "text-primary-foreground" : "text-primary")} />
                  <span>
                    Your vault PIN is already trusted for this session. This link will use the same app-wide PIN
                    automatically.
                  </span>
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="pin" className={cn("text-sm flex items-center gap-1", isDark ? "text-white" : "text-foreground")}>
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
                  className={cn(
                    "mt-1 w-full px-3 py-2 border rounded-md text-center tracking-widest text-xl focus:outline-none",
                    isDark
                      ? "bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/20"
                      : "bg-muted border-border text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background"
                  )}
                />
                <p className={cn("text-xs mt-1", isDark ? "text-white/75" : "text-muted-foreground")}>
                  Files will be encrypted so only you can decrypt them with this PIN. Set your PIN in Settings if you
                  haven't yet.
                </p>
              </div>
            )}

            {error && (
              <div
                className={cn(
                  "p-3 rounded-lg border text-sm",
                  isDark
                    ? "bg-primary/20 border-primary/30 text-primary-foreground"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                )}
              >
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="modal-cancel"
                onClick={onClose}
                disabled={loading}
                className={cn(isDark ? "bg-white/15 border-white/20 text-white hover:bg-white/25 border" : "")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  loading ||
                  fetchingFolders ||
                  (folders.length === 0 && !showCreateFolder) ||
                  !selectedFolderId ||
                  activePin.length !== 4
                }
                className={cn(
                  "font-semibold",
                  isDark
                    ? "bg-white text-primary hover:bg-primary/10"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
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

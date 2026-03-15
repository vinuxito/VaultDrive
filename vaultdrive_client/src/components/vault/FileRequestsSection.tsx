import { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import {
  Inbox,
  RefreshCw,
  Plus,
  Copy,
  Check,
  Trash2,
  Clock,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import { API_URL } from "../../utils/api";

interface FileRequest {
  id: string;
  token: string;
  description: string;
  expires_at: string | null;
  is_active: boolean;
  uploaded_count: number;
  request_url: string;
  created_at: string;
}

type ExpiryOption = "never" | "1" | "7" | "30";

interface CreateRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateRequestModal({
  open,
  onClose,
  onSuccess,
}: CreateRequestModalProps) {
  const [description, setDescription] = useState("");
  const [expiryDays, setExpiryDays] = useState<ExpiryOption>("7");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      const expiresAt =
        expiryDays !== "never"
          ? new Date(
              Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000
            ).toISOString()
          : null;

      const response = await fetch(`${API_URL}/file-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: description.trim(),
          expires_at: expiresAt,
          max_file_size: 0,
        }),
      });

      if (!response.ok) {
        const err = (await response
          .json()
          .catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to create request");
      }

      onSuccess();
      onClose();
      setDescription("");
      setExpiryDays("7");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create request"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const expiryOptions: { value: ExpiryOption; label: string }[] = [
    { value: "never", label: "Never" },
    { value: "1", label: "1 day" },
    { value: "7", label: "7 days" },
    { value: "30", label: "30 days" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
            <Plus className="w-5 h-5 text-[#f2d7d8]" />
            New File Request
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

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div>
            <label
              htmlFor="req-description"
              className="block text-white/90 text-sm mb-1"
            >
              Instructions for sender{" "}
              <span className="text-white/50 font-normal">(optional)</span>
            </label>
            <textarea
              id="req-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Please upload your Q1 financial statements here."
              rows={3}
              className="w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/50 focus:border-white/40 focus:bg-white/15 focus:outline-none px-3 py-2 text-sm resize-none"
            />
          </div>

          <div>
            <p className="text-white/90 text-sm mb-2">Link Expiration</p>
            <div className="flex gap-2 flex-wrap">
              {expiryOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setExpiryDays(opt.value)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                    expiryDays === opt.value
                      ? "bg-white text-[#7d4f50]"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

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
              disabled={loading}
              className="bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Request
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function FileRequestsSection() {
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/file-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch file requests");
      const data = (await response.json()) as FileRequest[];
      setRequests(data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load requests"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const handleRefresh = () => {
    setRefreshing(true);
    setError("");
    void fetchRequests();
  };

  const handleCopyUrl = async (req: FileRequest) => {
    const url = `${window.location.origin}/abrn/request/${req.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(req.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (req: FileRequest) => {
    if (!confirm("Revoke this file request? Senders will no longer be able to upload."))
      return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/file-requests/${req.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        void fetchRequests();
      }
    } catch (err) {
      console.error("Error revoking request:", err);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString();

  const getStatus = (req: FileRequest) => {
    if (!req.is_active) return { label: "Revoked", color: "bg-gray-500" };
    if (req.expires_at && new Date(req.expires_at) < new Date())
      return { label: "Expired", color: "bg-red-500" };
    return { label: "Active", color: "bg-green-500" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading file requests…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#7d4f50]" />
            File Requests ({requests.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Request files from clients — they upload directly via a secure link
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            size="sm"
            className="gap-2 bg-[#7d4f50] hover:bg-[#6b4345] text-white border-0"
          >
            <Plus className="w-4 h-4" />
            New Request
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Inbox className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">No file requests yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Create a request link to receive files from external users
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Create First Request
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const status = getStatus(req);
            const requestUrl = `${window.location.origin}/abrn/request/${req.token}`;

            return (
              <div
                key={req.id}
                className="border rounded-lg overflow-hidden bg-card"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7d4f50] to-[#c4999b] flex items-center justify-center text-white shrink-0">
                          <Inbox className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${status.color}`}
                            >
                              {status.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Created {formatDate(req.created_at)}
                            </span>
                          </div>
                          {req.description && (
                            <p className="text-sm text-slate-600 mt-0.5 truncate">
                              {req.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <code className="bg-muted px-2 py-0.5 rounded text-xs flex-1 min-w-0 overflow-hidden truncate">
                          {requestUrl}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void handleCopyUrl(req);
                          }}
                          className="h-7 px-2 shrink-0"
                          title="Copy URL"
                        >
                          {copiedId === req.id ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {req.uploaded_count} file
                          {req.uploaded_count !== 1 ? "s" : ""} uploaded
                        </span>
                        {req.expires_at ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Expires {formatDate(req.expires_at)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No expiry
                          </span>
                        )}
                      </div>
                    </div>

                    {req.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void handleRevoke(req);
                        }}
                        className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Revoke request"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateRequestModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          void fetchRequests();
        }}
      />
    </div>
  );
}

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
import { API_URL, BASE_PATH } from "../../utils/api";

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
  onSuccess: (request: FileRequest) => void;
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
  const [createdRequest, setCreatedRequest] = useState<FileRequest | null>(null);
  const [copied, setCopied] = useState(false);

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

      const created = (await response.json()) as FileRequest;
      setCreatedRequest(created);
      onSuccess(created);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create request"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const requestUrl = createdRequest
    ? `${window.location.origin}${BASE_PATH}/request/${createdRequest.token}`
    : "";

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

        {createdRequest ? (
          <div className="space-y-4">
            <div className="abrn-receipt-surface rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-emerald-900">Request created and ready to share</p>
              <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                This link is live, reviewable, and revocable from your vault. Senders can only upload through the request route you just created.
              </p>
            </div>

            <div>
              <label htmlFor="req-created-url" className="block text-white/90 text-sm mb-1">Request URL</label>
              <div className="flex gap-2">
                <input
                  id="req-created-url"
                  value={requestUrl}
                  readOnly
                  className="flex-1 rounded-md bg-white/10 border border-white/20 text-white placeholder-white/50 px-3 py-2 text-sm"
                />
                <Button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(requestUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="rounded-xl bg-white/8 border border-white/15 p-3 text-sm text-white/85 space-y-1">
              <p className="font-medium">Trust receipt</p>
              <p className="text-xs text-white/70 leading-relaxed">
                The request stays under your control: you can copy it again, track uploads, or revoke it any time from the File Requests view.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                onClick={() => {
                  setCreatedRequest(null);
                  setDescription("");
                  setExpiryDays("7");
                  onClose();
                }}
                className="bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
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
        )}
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
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string>("");

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
    const url = `${window.location.origin}${BASE_PATH}/request/${req.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(req.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (req: FileRequest) => {
    try {
      setRevokingId(req.id);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/file-requests/${req.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setReceipt(`Request revoked. Senders can no longer upload through ${req.description ? 'this request' : 'that link'}.`);
        void fetchRequests();
      } else {
        setError("Could not revoke this request right now.");
      }
    } catch {
      setError("Could not revoke this request right now.");
    } finally {
      setRevokingId(null);
      setConfirmRevokeId(null);
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
            Ask clients for files through a clear, revocable request route
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

      <div className="rounded-[1.6rem] border border-[#e8d9d0] bg-[linear-gradient(180deg,#fffdfa_0%,#f8f2ee_100%)] px-4 py-4 text-sm text-slate-600 shadow-[0_16px_36px_rgba(125,79,80,0.06)] dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.94)_0%,rgba(15,23,42,0.9)_100%)] dark:text-slate-300">
        <p className="font-medium text-slate-900 dark:text-slate-100">Request only what you need</p>
        <p className="mt-1 leading-relaxed">
          File requests keep the sender journey obvious: who they are sending to, what they should provide, and how you can track or revoke the route after it is shared.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {receipt && (
        <div className="abrn-receipt-surface rounded-2xl px-4 py-4 text-sm text-emerald-800 dark:text-emerald-100">
          <p className="font-medium">Done, safe, under control.</p>
          <p className="mt-1 text-emerald-700 dark:text-emerald-200">{receipt}</p>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-[1.6rem] bg-white/70 border-[#d8cbc3] dark:bg-slate-900/60 dark:border-slate-700">
          <Inbox className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-slate-700 dark:text-slate-200 font-medium mb-2">No file requests yet</p>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Create a request when you want a sender to upload documents under a clearly framed set of instructions and a route you can revoke later.
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
            const requestUrl = `${window.location.origin}${BASE_PATH}/request/${req.token}`;

            return (
              <div
                key={req.id}
                className="rounded-[1.4rem] border border-slate-200 overflow-hidden bg-white shadow-[0_16px_36px_rgba(125,79,80,0.06)] dark:border-slate-700 dark:bg-slate-900/70"
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
                      confirmRevokeId === req.id ? (
                        <div className="shrink-0 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmRevokeId(null)}
                          >
                            Keep active
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              void handleRevoke(req);
                            }}
                            disabled={revokingId === req.id}
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                          >
                            {revokingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            {revokingId === req.id ? "Revoking…" : "Confirm revoke"}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmRevokeId(req.id)}
                          className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Revoke request"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )
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
        onSuccess={(request) => {
          setError("");
          setReceipt(`Request created. Share it when ready; you can track uploads or revoke it at any time.`);
          setRequests((current) => [request, ...current]);
          void fetchRequests();
        }}
      />
    </div>
  );
}

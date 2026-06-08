import { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { useTheme } from "../theme-provider";
import { cn } from "../../lib/utils";
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
import { ApiCallTrace } from "../control-plane/ApiCallTrace";
import { branding } from "../../config/branding";
import { DataState } from "../ui/data-state";
import { RowActionMenu, type RowAction } from "../ui/row-action-menu";
import { CONFIRM_DESTRUCTIVE, EMPTY, LOADING } from "../../constants/copy";

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
  const { theme } = useTheme();
  const isDark = theme === "dark";
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
            New File Request
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

        {createdRequest ? (
          <div className="space-y-4">
            <div className="brand-receipt-surface rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                Request created and ready to share
              </p>
              <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
                This link is live, reviewable, and revocable from your vault. Senders can only upload through the
                request route you just created.
              </p>
            </div>

            <div>
              <label htmlFor="req-created-url" className={cn("block text-sm mb-1", isDark ? "text-white/90" : "text-foreground")}>
                Request URL
              </label>
              <div className="flex gap-2">
                <input
                  id="req-created-url"
                  value={requestUrl}
                  readOnly
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none",
                    isDark
                      ? "bg-white/15 border-white/20 text-white placeholder-white/60"
                      : "bg-muted border-border text-foreground placeholder-muted-foreground"
                  )}
                />
                <Button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(requestUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className={cn(
                    "font-semibold",
                    isDark
                      ? "bg-white text-primary hover:bg-primary/10"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div
              className={cn(
                "rounded-xl border p-3 text-sm space-y-1",
                isDark ? "bg-white/12 border-white/15 text-white/85" : "bg-muted border-border text-muted-foreground"
              )}
            >
              <p className={cn("font-medium", isDark ? "text-white" : "text-foreground")}>Trust receipt</p>
              <p className={cn("text-xs leading-relaxed", isDark ? "text-white/80" : "text-muted-foreground")}>
                The request stays under your control: you can copy it again, track uploads, or revoke it any time from
                the File Requests view.
              </p>
            </div>

            <ApiCallTrace
              method="POST"
              path="/api/file-requests"
              note={`${branding.productName} just created a reviewable intake route for this sender request.`}
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                onClick={() => {
                  setCreatedRequest(null);
                  setDescription("");
                  setExpiryDays("7");
                  onClose();
                }}
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
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="req-description" className={cn("block text-sm mb-1", isDark ? "text-white/90" : "text-foreground")}>
                Instructions for sender <span className={isDark ? "text-white/75 font-normal" : "text-muted-foreground font-normal"}>(optional)</span>
              </label>
              <textarea
                id="req-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Please upload your Q1 financial statements here."
                rows={3}
                className={cn(
                  "w-full rounded-md border text-sm resize-none focus:outline-none px-3 py-2",
                  isDark
                    ? "bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/20"
                    : "bg-muted border-border text-foreground placeholder-muted-foreground focus:border-primary"
                )}
              />
            </div>

            <div>
              <p className={cn("text-sm mb-2", isDark ? "text-white/90" : "text-foreground")}>Link Expiration</p>
              <div className="flex gap-2 flex-wrap">
                {expiryOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExpiryDays(opt.value)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer",
                      expiryDays === opt.value
                        ? isDark
                          ? "bg-[hsl(var(--primary-foreground))] text-[hsl(var(--primary))]"
                          : "bg-primary text-primary-foreground shadow-sm"
                        : isDark
                          ? "bg-white/15 text-white hover:bg-white/25"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

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
                disabled={loading}
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

  useEffect(() => {
    if (!copiedId) return;
    const timer = setTimeout(() => setCopiedId(null), 2000);
    return () => clearTimeout(timer);
  }, [copiedId]);

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
    if (!req.is_active) return { label: "Revoked", color: "bg-muted text-muted-foreground" };
    if (req.expires_at && new Date(req.expires_at) < new Date())
      return { label: "Expired", color: "bg-red-500" };
    return { label: "Active", color: "bg-green-500" };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Inbox className="w-5 h-5 text-primary" />
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
            className="gap-2 bg-primary hover:bg-primary/90 text-white border-0"
          >
            <Plus className="w-4 h-4" />
            New Request
          </Button>
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-border bg-card px-4 py-4 text-sm text-muted-foreground shadow-[0_16px_36px_rgba(0,0,0,0.06)]">
        <p className="font-medium text-foreground">Request only what you need</p>
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
        <div className="brand-receipt-surface rounded-2xl px-4 py-4 text-sm text-emerald-800 dark:text-emerald-100">
          <p className="font-medium">Done, safe, under control.</p>
          <p className="mt-1 text-emerald-700 dark:text-emerald-200">{receipt}</p>
        </div>
      )}

      <DataState
        loading={loading}
        empty={requests.length === 0}
        emptyConfig={EMPTY.fileRequestsEmpty}
        loadingLabel={LOADING.workingDefault}
        onEmptyAction={() => setShowCreateModal(true)}
        skeletonRows={3}
      >
        <div className="space-y-3">
          {requests.map((req) => {
            const status = getStatus(req);
            const requestUrl = `${window.location.origin}${BASE_PATH}/request/${req.token}`;
            const isConfirming = confirmRevokeId === req.id;
            const isRevoking = revokingId === req.id;

            const rowActions: RowAction[] = [
              {
                id: "copy-url",
                label: copiedId === req.id ? "Copied!" : "Copy request URL",
                icon: copiedId === req.id ? Check : Copy,
                onSelect: () => {
                  void handleCopyUrl(req);
                },
              },
            ];
            if (req.is_active) {
              rowActions.push({
                id: "delete-request",
                label: CONFIRM_DESTRUCTIVE.deleteFileRequest.confirmLabel,
                icon: Trash2,
                kind: "destructive",
                onSelect: () => setConfirmRevokeId(req.id),
              });
            }

            return (
              <div
                key={req.id}
                className="rounded-[1.4rem] border border-border overflow-hidden bg-white shadow-[0_16px_36px_rgba(0,0,0,0.06)] dark:bg-muted/60"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary flex items-center justify-center text-white shrink-0">
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
                            <p className="text-sm text-muted-foreground mt-0.5 truncate">
                              {req.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <code className="bg-muted px-2 py-0.5 rounded text-xs flex-1 min-w-0 overflow-hidden truncate">
                          {requestUrl}
                        </code>
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

                    <RowActionMenu
                      actions={rowActions}
                      label="Manage request"
                      triggerTestId={`file-request-actions-${req.id}`}
                    />
                  </div>

                  {isConfirming && (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-700/40 p-3 space-y-2">
                      <div>
                        <p className="text-sm font-medium text-rose-900 dark:text-rose-200">{CONFIRM_DESTRUCTIVE.deleteFileRequest.title}</p>
                        <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{CONFIRM_DESTRUCTIVE.deleteFileRequest.body}</p>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmRevokeId(null)}
                          disabled={isRevoking}
                        >
                          {CONFIRM_DESTRUCTIVE.deleteFileRequest.cancelLabel}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            void handleRevoke(req);
                          }}
                          disabled={isRevoking}
                          className="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                          {isRevoking ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                          {isRevoking ? LOADING.revokingLink : CONFIRM_DESTRUCTIVE.deleteFileRequest.confirmLabel}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DataState>

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

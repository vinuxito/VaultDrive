import { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { UploadCloud, RefreshCw, Plus } from "lucide-react";
import { UploadLinkCard } from "./UploadLinkCard";
import { CreateUploadLinkModal } from "./CreateUploadLinkModal";
import { API_URL } from "../../utils/api";
import type { UploadTokenWithFiles, UploadToken } from "./types";
import { normalizeUploadToken } from "./types";

export function UploadLinksSection() {
  const [tokens, setTokens] = useState<UploadTokenWithFiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string>("");

  const fetchTokens = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/drop/tokens`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch upload links");
      }

      const data = await response.json();
      const normalized = (data || []).map(normalizeUploadToken);
      setTokens(normalized);
    } catch (err) {
      console.error("Error fetching tokens:", err);
      setError(err instanceof Error ? err.message : "Failed to load upload links");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchTokens();
  }, [fetchTokens]);

  const handleRefresh = () => {
    setRefreshing(true);
    setError("");
    void fetchTokens();
  };

  const handleExpand = async (tokenId: string) => {
    if (expandedToken === tokenId) {
      setExpandedToken(null);
      return;
    }

    setExpandedToken(tokenId);
    const token = localStorage.getItem("token");
    const tokenData = tokens.find((t) => t.token === tokenId);

    if (tokenData && !tokenData.files) {
      try {
        const response = await fetch(`${API_URL}/drop/${tokenId}/files`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const files = await response.json();
          setTokens((prev) =>
            prev.map((t) =>
              t.token === tokenId ? { ...t, files } : t
            )
          );
        }
      } catch (err) {
        console.error("Error fetching files:", err);
      }
    }
  };

  const handleDeactivate = async (token: string) => {
    try {
      const auth = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/drop/${token}/done`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth}`,
        },
      });

      if (response.ok) {
        setReceipt("Upload link sealed. No more files can be added through that route.");
        await fetchTokens();
      }
    } catch (err) {
      console.error("Error deactivating token:", err);
    } finally {
      setConfirmDeactivateId(null);
    }
  };

  const handleDelete = async (tokenId: string) => {
    try {
      const auth = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/upload-links/${tokenId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${auth}`,
        },
      });

      if (response.ok) {
        setReceipt("Upload link removed. Previously uploaded files remain in your vault.");
        await fetchTokens();
      }
    } catch (err) {
      console.error("Error deleting token:", err);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const getTokenStatus = (token: UploadToken) => {
    if (token.used) return { label: "Inactive", variant: "secondary" as const };
    const now = new Date();
    if (token.expires_at && new Date(token.expires_at) < now) {
      return { label: "Expired", variant: "destructive" as const };
    }
    if (token.max_files && token.files_uploaded && token.files_uploaded >= token.max_files) {
      return { label: "Full", variant: "destructive" as const };
    }
    return { label: "Active", variant: "default" as const };
  };

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading upload links...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-sky-500" />
            Upload Links ({tokens.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage links for secure file uploads from external users
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
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={handleOpenCreateModal}
            size="sm"
            className="gap-2 bg-[#7d4f50] hover:bg-[#6b4345] text-white border-0"
          >
            <Plus className="w-4 h-4" />
            Create New Link
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2">
          <span>{error}</span>
        </div>
      )}

      {receipt && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
          <p className="font-medium">Done, safe, under control.</p>
          <p className="mt-1 text-emerald-700">{receipt}</p>
        </div>
      )}

      {tokens.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <UploadCloud className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">
            No upload links created yet
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Create a link to let external users upload files securely
          </p>
          <Button onClick={handleOpenCreateModal} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Your First Link
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tokens.map((tokenData) => (
            <div key={tokenData.id} className="space-y-2">
              <UploadLinkCard
                token={tokenData}
                isExpanded={expandedToken === tokenData.token}
                status={getTokenStatus(tokenData)}
                onExpand={() => handleExpand(tokenData.token)}
                onDeactivate={() => setConfirmDeactivateId(tokenData.token)}
                onDelete={() => setConfirmDeleteId(tokenData.id)}
              />

              {confirmDeactivateId === tokenData.token && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  <p className="font-medium">Seal this upload link?</p>
                  <p className="mt-1 text-amber-700">No more files can be uploaded, but anything already delivered stays in your vault.</p>
                  <div className="mt-3 flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setConfirmDeactivateId(null)}>Keep active</Button>
                    <Button size="sm" onClick={() => void handleDeactivate(tokenData.token)} className="bg-amber-600 hover:bg-amber-700 text-white">Seal link</Button>
                  </div>
                </div>
              )}

              {confirmDeleteId === tokenData.id && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
                  <p className="font-medium">Remove this upload link?</p>
                  <p className="mt-1 text-rose-700">The link disappears immediately, but previously uploaded files remain available in your vault.</p>
                  <div className="mt-3 flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>Keep link</Button>
                    <Button size="sm" onClick={() => void handleDelete(tokenData.id)} className="bg-rose-600 hover:bg-rose-700 text-white">Delete link</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateUploadLinkModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchTokens}
      />
    </div>
  );
}

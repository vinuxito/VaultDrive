import { useState, useEffect } from "react";
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

  const fetchTokens = async () => {
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
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setError("");
    fetchTokens();
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
    if (!confirm("Deactivate this upload link? No more files can be uploaded.")) {
      return;
    }

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
        await fetchTokens();
      }
    } catch (err) {
      console.error("Error deactivating token:", err);
    }
  };

  const handleDelete = async (tokenId: string) => {
    if (!confirm("Delete this upload link? Files will remain but the link will be removed.")) {
      return;
    }

    try {
      const auth = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/upload-links/${tokenId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${auth}`,
        },
      });

      if (response.ok) {
        await fetchTokens();
      }
    } catch (err) {
      console.error("Error deleting token:", err);
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
            className="gap-2 bg-sky-950 hover:bg-sky-900 text-white"
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
            <UploadLinkCard
              key={tokenData.id}
              token={tokenData}
              isExpanded={expandedToken === tokenData.token}
              status={getTokenStatus(tokenData)}
              onExpand={() => handleExpand(tokenData.token)}
              onDeactivate={() => handleDeactivate(tokenData.token)}
              onDelete={() => handleDelete(tokenData.id)}
            />
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
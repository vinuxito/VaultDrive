import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FolderOpen, Link2, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { API_URL } from "../../utils/api";
import { useSessionVault } from "../../context/SessionVaultContext";
import { branding } from "../../config/branding";
import {
  syncFolderShareLinkById,
  type SyncableFolderShareLink,
} from "../../utils/folder-share-sync";

interface UpdateFolderShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (message: string) => void;
  folder: {
    id: string;
    name: string;
  };
}

export function UpdateFolderShareLinkModal({
  isOpen,
  onClose,
  onUpdated,
  folder,
}: UpdateFolderShareLinkModalProps) {
  const sessionVault = useSessionVault();
  const [links, setLinks] = useState<SyncableFolderShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [legacyUrls, setLegacyUrls] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, string>>({});

  const currentUser = useMemo(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) as {
      private_key_encrypted?: string | null;
      private_key_pin_encrypted?: string | null;
    } : null;
  }, []);

  const visibleLinks = useMemo(() => {
    return links
      .filter((link) => link.is_active && (!link.expires_at || new Date(link.expires_at).getTime() > Date.now()))
      .sort((a, b) => {
        const aTime = a.expires_at ? new Date(a.expires_at).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.expires_at ? new Date(b.expires_at).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });
  }, [links]);

  useEffect(() => {
    if (!isOpen) {
      setLinks([]);
      setErrorMsg("");
      setResults({});
      setLegacyUrls({});
      setSyncingId(null);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setErrorMsg("Sign in again to update shared links.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    fetch(`${API_URL}/folders/${folder.id}/share-links`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load shared links for this folder.");
        }
        return response.json() as Promise<SyncableFolderShareLink[]>;
      })
      .then((data) => setLinks(data))
      .catch((error) => setErrorMsg(error instanceof Error ? error.message : "Failed to load shared links."))
      .finally(() => setLoading(false));
  }, [folder.id, isOpen]);

  async function handleSync(link: SyncableFolderShareLink) {
    const token = localStorage.getItem("token");
    const credential = sessionVault.getCredential();
    if (!token || !credential) {
      setErrorMsg("Open your vault with your current credential first, then try again.");
      return;
    }

    setSyncingId(link.id);
    setErrorMsg("");
    try {
      const result = await syncFolderShareLinkById({
        link,
        authToken: token,
        credential,
        cachedPrivateKey: sessionVault.getPrivateKey(),
        currentUser,
        providedShareUrl: legacyUrls[link.id]?.trim() || undefined,
      });

      const message = result.syncedFiles > 0
        ? `${result.upgraded ? "Upgraded and updated" : "Updated"} this shared link with ${result.syncedFiles} new file${result.syncedFiles === 1 ? "" : "s"}.`
        : result.upgraded
          ? "Upgraded this shared link for future automatic updates."
          : "This shared link was already up to date.";
      setResults((prev) => ({ ...prev, [link.id]: message }));
      if (!link.owner_wrapped_folder_key && (legacyUrls[link.id]?.trim() || undefined)) {
        setLinks((prev) => prev.map((entry) => entry.id === link.id ? { ...entry, owner_wrapped_folder_key: "stored" } : entry));
        setLegacyUrls((prev) => ({ ...prev, [link.id]: "" }));
      }
      onUpdated?.(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update the shared link.";
      setResults((prev) => ({ ...prev, [link.id]: message }));
    } finally {
      setSyncingId(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl mx-4 bg-gradient-to-br from-primary to-primary/90 border-white/10 text-white">
        <CardHeader className="border-b border-white/10">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <RefreshCw className="w-5 h-5 text-primary-foreground" />
              Update Shared Link
            </CardTitle>
            <button
              type="button"
              onClick={onClose}
              className="text-white/50 hover:text-white/80 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <CardDescription className="text-white/80 truncate">
            {folder.name}
          </CardDescription>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/12 px-3 py-3 text-xs leading-relaxed text-white/85">
            Use this to add newly uploaded files into an existing folder share. Newer links update directly. Older links need the original share URL once so the browser can recover the folder key.
          </div>
        </CardHeader>

        <CardContent className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-white/90">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-8 flex flex-col items-center gap-3 text-white/85">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading shared links…</span>
            </div>
          ) : visibleLinks.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/12 px-4 py-6 text-sm text-white/80">
              No active shared links exist for this folder yet.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleLinks.map((link) => {
                const needsLegacyUrl = !link.owner_wrapped_folder_key;
                const result = results[link.id];
                const canSync = !needsLegacyUrl || Boolean(legacyUrls[link.id]?.trim());
                return (
                  <div key={link.id} className="rounded-xl border border-white/10 bg-white/12 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium text-white">
                          <FolderOpen className="w-4 h-4 text-primary-foreground" />
                          <span className="truncate">{link.token.slice(0, 12)}…</span>
                        </div>
                        <div className="text-xs text-white/75">
                          {needsLegacyUrl ? "Legacy link, needs original URL" : "Owner-recoverable link"}
                        </div>
                        {link.expires_at && (
                          <div className="text-xs text-white/75">Expires {new Date(link.expires_at).toLocaleString()}</div>
                        )}
                      </div>
                      <Button
                        type="button"
                        onClick={() => void handleSync(link)}
                        disabled={syncingId === link.id || !canSync}
                        className="bg-white text-primary/90 hover:bg-white/90"
                      >
                        {syncingId === link.id ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating…</>
                        ) : (
                          <><RefreshCw className="w-4 h-4 mr-2" />Update Link</>
                        )}
                      </Button>
                    </div>

                    {needsLegacyUrl && (
                      <div className="space-y-2">
                        <label htmlFor={`legacy-share-url-${link.id}`} className="text-xs font-medium text-white/85 flex items-center gap-2">
                          <Link2 className="w-3.5 h-3.5" />
                          Paste the original share URL
                        </label>
                        <textarea
                          id={`legacy-share-url-${link.id}`}
                          value={legacyUrls[link.id] ?? ""}
                          onChange={(event) => setLegacyUrls((prev) => ({ ...prev, [link.id]: event.target.value }))}
                          rows={3}
                          placeholder={`${branding.publicBaseURL}/folder-share/...#...`}
                          className="w-full rounded-md border border-white/20 bg-white/15 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                        />
                      </div>
                    )}

                    {result && (
                      <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${result.includes("Failed") || result.includes("Paste") || result.includes("different") ? "bg-red-500/10 text-white/90 border border-red-300/30" : "bg-emerald-500/10 text-white/90 border border-emerald-300/30"}`}>
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{result}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

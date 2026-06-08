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
import { useTheme } from "../theme-provider";
import { cn } from "../../lib/utils";

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
  const { theme } = useTheme();
  const isDark = theme === "dark";
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
      <Card
        className={cn(
          "w-full max-w-2xl mx-4 border",
          isDark
            ? "bg-gradient-to-br from-primary to-primary/90 border-white/10 text-white"
            : "bg-card border-border text-foreground"
        )}
      >
        <CardHeader className={cn("border-b", isDark ? "border-white/10" : "border-border")}>
          <div className="flex items-center justify-between">
            <CardTitle className={cn("flex items-center gap-2", isDark ? "text-white" : "text-foreground")}>
              <RefreshCw className={cn("w-5 h-5", isDark ? "text-primary-foreground" : "text-primary")} />
              Update Shared Link
            </CardTitle>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "transition-colors",
                isDark ? "text-white/50 hover:text-white/80" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <CardDescription className={isDark ? "text-white/80 truncate" : "text-muted-foreground truncate"}>
            {folder.name}
          </CardDescription>
          <div
            className={cn(
              "mt-3 rounded-2xl border px-3 py-3 text-xs leading-relaxed",
              isDark ? "border-white/10 bg-white/12 text-white/85" : "bg-muted border-border text-muted-foreground"
            )}
          >
            Use this to add newly uploaded files into an existing folder share. Newer links update directly. Older links
            need the original share URL once so the browser can recover the folder key.
          </div>
        </CardHeader>

        <CardContent className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
          {errorMsg && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                isDark
                  ? "border-red-300/40 bg-red-500/10 text-white/90"
                  : "border-destructive/20 bg-destructive/10 text-destructive"
              )}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className={cn("py-8 flex flex-col items-center gap-3", isDark ? "text-white/85" : "text-muted-foreground")}>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading shared links…</span>
            </div>
          ) : visibleLinks.length === 0 ? (
            <div
              className={cn(
                "rounded-xl border px-4 py-6 text-sm",
                isDark ? "border-white/10 bg-white/12 text-white/80" : "border-border bg-muted text-muted-foreground"
              )}
            >
              No active shared links exist for this folder yet.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleLinks.map((link) => {
                const needsLegacyUrl = !link.owner_wrapped_folder_key;
                const result = results[link.id];
                const canSync = !needsLegacyUrl || Boolean(legacyUrls[link.id]?.trim());
                return (
                  <div
                    key={link.id}
                    className={cn("rounded-xl border p-4 space-y-3", isDark ? "border-white/10 bg-white/12" : "border-border bg-muted")}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className={cn("flex items-center gap-2 text-sm font-medium", isDark ? "text-white" : "text-foreground")}>
                          <FolderOpen className={cn("w-4 h-4", isDark ? "text-primary-foreground" : "text-primary")} />
                          <span className="truncate">{link.token.slice(0, 12)}…</span>
                        </div>
                        <div className={cn("text-xs", isDark ? "text-white/75" : "text-muted-foreground")}>
                          {needsLegacyUrl ? "Legacy link, needs original URL" : "Owner-recoverable link"}
                        </div>
                        {link.expires_at && (
                          <div className={cn("text-xs", isDark ? "text-white/75" : "text-muted-foreground")}>
                            Expires {new Date(link.expires_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        onClick={() => void handleSync(link)}
                        disabled={syncingId === link.id || !canSync}
                        className={cn(
                          "font-semibold",
                          isDark
                            ? "bg-white text-primary hover:bg-primary/10"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                      >
                        {syncingId === link.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Updating…
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Update Link
                          </>
                        )}
                      </Button>
                    </div>

                    {needsLegacyUrl && (
                      <div className="space-y-2">
                        <label
                          htmlFor={`legacy-share-url-${link.id}`}
                          className={cn("text-xs font-medium flex items-center gap-2", isDark ? "text-white/85" : "text-foreground")}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          Paste the original share URL
                        </label>
                        <textarea
                          id={`legacy-share-url-${link.id}`}
                          value={legacyUrls[link.id] ?? ""}
                          onChange={(event) => setLegacyUrls((prev) => ({ ...prev, [link.id]: event.target.value }))}
                          rows={3}
                          placeholder={`${branding.publicBaseURL}/folder-share/...#...`}
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-sm focus:outline-none",
                            isDark
                              ? "border-white/20 bg-white/15 text-white placeholder:text-white/60 focus:border-white/40"
                              : "border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary"
                          )}
                        />
                      </div>
                    )}

                    {result && (
                      <div
                        className={cn(
                          "flex items-start gap-2 rounded-lg px-3 py-2 text-sm border",
                          result.includes("Failed") || result.includes("Paste") || result.includes("different")
                            ? isDark
                              ? "bg-red-500/10 text-white/90 border-red-300/30"
                              : "bg-destructive/10 text-destructive border-destructive/20"
                            : isDark
                              ? "bg-emerald-500/10 text-white/90 border-emerald-300/30"
                              : "bg-emerald-500/10 text-emerald-900 border-emerald-500/20"
                        )}
                      >
                        <CheckCircle2
                          className={cn(
                            "w-4 h-4 mt-0.5 shrink-0",
                            result.includes("Failed") || result.includes("Paste") || result.includes("different")
                              ? "text-destructive"
                              : "text-emerald-600"
                          )}
                        />
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

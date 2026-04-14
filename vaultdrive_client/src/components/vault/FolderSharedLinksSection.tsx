import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Copy, ExternalLink, FolderOpen, Link2, Loader2, Plus, RefreshCw, ShieldOff } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { API_URL, BASE_PATH } from "../../utils/api";
import { useSessionVault } from "../../context/SessionVaultContext";
import { arrayBufferToBase64, unwrapKeyWithRSA } from "../../utils/crypto";
import {
  syncFolderShareLinkById,
  type SyncableFolderShareLink,
} from "../../utils/folder-share-sync";
import { resolveOwnerPrivateKeyFromSession } from "../../utils/owner-private-key";
import { branding } from "../../config/branding";
import {
  getFolderShareOwnerCredentialType,
  resolveFolderSharePanelCredential,
} from "../../utils/folder-share-repair";

interface FolderSharedLinksSectionProps {
  folder: {
    id: string;
    name: string;
  };
  onCreateLink: () => void;
  onStatusMessage?: (message: string) => void;
  refreshKey?: number;
}

function formatDate(value?: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function getLinkLifecycleStatus(link: SyncableFolderShareLink): { label: string; tone: string; active: boolean } {
  if (!link.is_active) {
    return { label: "Revoked", tone: "bg-slate-100 text-muted-foreground", active: false };
  }
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return { label: "Expired", tone: "bg-amber-100 text-amber-700", active: false };
  }
  return { label: "Active", tone: "bg-emerald-100 text-emerald-700", active: true };
}

export function FolderSharedLinksSection({ folder, onCreateLink, onStatusMessage, refreshKey = 0 }: FolderSharedLinksSectionProps) {
  const sessionVault = useSessionVault();
  const [links, setLinks] = useState<SyncableFolderShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [legacyUrls, setLegacyUrls] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, string>>({});
  const [ownerCredentialInput, setOwnerCredentialInput] = useState("");

  const currentUser = useMemo(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) as {
      pin_set?: boolean;
      private_key_encrypted?: string | null;
      private_key_pin_encrypted?: string | null;
      public_key?: string | null;
    } : null;
  }, []);

  const visibleLinks = useMemo(() => {
    return [...links].sort((a, b) => {
      const aActive = a.is_active && (!a.expires_at || new Date(a.expires_at).getTime() > Date.now());
      const bActive = b.is_active && (!b.expires_at || new Date(b.expires_at).getTime() > Date.now());
      if (aActive !== bActive) return aActive ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [links]);

  const fetchLinksForFolder = useCallback(async (folderId: string) => {
    const token = localStorage.getItem("token");
    if (!token) {
      setErrorMsg("Sign in again to manage shared links.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const response = await fetch(`${API_URL}/folders/${folderId}/share-links`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Failed to load shared links for this folder.");
      }
      const data = (await response.json()) as SyncableFolderShareLink[];
      setLinks(data);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Failed to load shared links.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshKey;
    void fetchLinksForFolder(folder.id);
  }, [fetchLinksForFolder, folder.id, refreshKey]);

  async function handleSync(link: SyncableFolderShareLink) {
    const token = localStorage.getItem("token");
    const credential = resolveFolderSharePanelCredential(
      sessionVault.getCredential(),
      ownerCredentialInput,
      currentUser,
    );
    if (!token || !credential) {
      setErrorMsg(currentUser?.pin_set
        ? "Enter your current PIN to update this shared link."
        : "Enter your current password to update this shared link.");
      return;
    }

    setBusyId(link.id);
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
      sessionVault.setCredential(credential.value, credential.type);
      onStatusMessage?.(message);
      await fetchLinksForFolder(folder.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update this shared link.";
      setResults((prev) => ({ ...prev, [link.id]: message }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(link: SyncableFolderShareLink) {
    if (!window.confirm("Revoke this shared link? Anyone using it will lose access immediately.")) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setErrorMsg("Sign in again to manage shared links.");
      return;
    }

    setBusyId(link.id);
    try {
      const response = await fetch(`${API_URL}/folder-share-links/${link.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Failed to revoke this shared link.");
      }
      const message = "Revoked this shared link.";
      onStatusMessage?.(message);
      await fetchLinksForFolder(folder.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to revoke this shared link.";
      setResults((prev) => ({ ...prev, [link.id]: message }));
    } finally {
      setBusyId(null);
    }
  }

  async function buildShareUrl(link: SyncableFolderShareLink): Promise<string> {
    const credential = resolveFolderSharePanelCredential(
      sessionVault.getCredential(),
      ownerCredentialInput,
      currentUser,
    );
    if (!credential || !currentUser || !link.owner_wrapped_folder_key) {
      throw new Error(currentUser?.pin_set
        ? "Enter your current PIN to open or copy this link."
        : "Enter your current password to open or copy this link.");
    }

    const privateKey = await resolveOwnerPrivateKeyFromSession(
      sessionVault.getPrivateKey(),
      credential,
      currentUser,
    );
    if (!privateKey) {
      throw new Error("Could not recover this shared link in the current session.");
    }

    const folderShareKey = await unwrapKeyWithRSA(privateKey, link.owner_wrapped_folder_key);
    const rawKey = await window.crypto.subtle.exportKey("raw", folderShareKey);
    const keyB64 = arrayBufferToBase64(rawKey);
    sessionVault.setCredential(credential.value, credential.type);
    return `${window.location.origin}${BASE_PATH}/folder-share/${link.token}#${keyB64}`;
  }

  async function handleCopy(link: SyncableFolderShareLink) {
    try {
      const shareUrl = await buildShareUrl(link);
      await navigator.clipboard.writeText(shareUrl);
      const message = "Copied the full shared link.";
      setResults((prev) => ({ ...prev, [link.id]: message }));
      onStatusMessage?.(message);
    } catch (error) {
      setResults((prev) => ({ ...prev, [link.id]: error instanceof Error ? error.message : "Failed to copy link." }));
    }
  }

  async function handleOpen(link: SyncableFolderShareLink) {
    try {
      const shareUrl = await buildShareUrl(link);
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setResults((prev) => ({ ...prev, [link.id]: error instanceof Error ? error.message : "Failed to open link." }));
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Shared Links</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage every public folder link for <span className="font-medium text-foreground">{folder.name}</span>.
            </p>
          </div>
          <Button type="button" onClick={onCreateLink} className="bg-primary hover:bg-primary/90 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Create New Link
          </Button>
        </div>

        {errorMsg && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-3 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading shared links…</span>
            </CardContent>
          </Card>
        ) : visibleLinks.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">
              No shared links exist for this folder yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {!sessionVault.getCredential() && (
              <Card className="border-border/80 shadow-sm">
                <CardContent className="py-4 space-y-2">
                  <label htmlFor="folder-share-owner-credential" className="text-sm font-medium text-foreground">
                    {currentUser?.pin_set ? "Enter your current PIN" : "Enter your current password"}
                  </label>
                  <input
                    id="folder-share-owner-credential"
                    type="password"
                    inputMode={currentUser?.pin_set ? "numeric" : undefined}
                    maxLength={currentUser?.pin_set ? 4 : undefined}
                    value={ownerCredentialInput}
                    onChange={(event) => setOwnerCredentialInput(event.target.value)}
                    placeholder={currentUser?.pin_set ? "••••" : "Current password"}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary/40 focus:outline-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use your current {getFolderShareOwnerCredentialType(currentUser) === "pin" ? "PIN" : "password"} once here, then update or open links from this panel.
                  </p>
                </CardContent>
              </Card>
            )}
            {visibleLinks.map((link) => {
              const status = getLinkLifecycleStatus(link);
              const needsLegacyUrl = !link.owner_wrapped_folder_key;
              const result = results[link.id];
              const canSync = status.active && (!needsLegacyUrl || Boolean(legacyUrls[link.id]?.trim()));

              return (
                <Card key={link.id} className="border-border/80 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                          <FolderOpen className="w-4 h-4 text-primary" />
                          <span className="truncate">{link.token.slice(0, 12)}…</span>
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground flex flex-wrap items-center gap-3">
                          <span>{needsLegacyUrl ? "Legacy link" : "Owner-recoverable"}</span>
                          <span>Created {formatDate(link.created_at)}</span>
                          <span>Expires {formatDate(link.expires_at)}</span>
                          <span>Opens {link.access_count ?? 0}</span>
                          <span>Last opened {formatDate(link.last_accessed_at)}</span>
                        </CardDescription>
                      </div>
                      <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.tone}`}>
                        {status.label}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {needsLegacyUrl && (
                      <div className="space-y-2">
                        <label htmlFor={`legacy-share-url-${link.id}`} className="text-xs font-medium text-foreground flex items-center gap-2">
                          <Link2 className="w-3.5 h-3.5 text-primary" />
                          Paste original share URL once to repair this older link
                        </label>
                        <textarea
                          id={`legacy-share-url-${link.id}`}
                          value={legacyUrls[link.id] ?? ""}
                          onChange={(event) => setLegacyUrls((prev) => ({ ...prev, [link.id]: event.target.value }))}
                          rows={3}
                          placeholder={`${branding.publicBaseURL}/folder-share/...#...`}
                          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary/40 focus:outline-none"
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => void handleSync(link)} disabled={busyId === link.id || !canSync} className="bg-primary hover:bg-primary/90 text-white">
                        {busyId === link.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Update Link
                      </Button>
                      <Button type="button" variant="outline" onClick={() => void handleCopy(link)} disabled={busyId === link.id || needsLegacyUrl || !status.active}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Link
                      </Button>
                      <Button type="button" variant="outline" onClick={() => void handleOpen(link)} disabled={busyId === link.id || needsLegacyUrl || !status.active}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Link
                      </Button>
                      <Button type="button" variant="outline" onClick={() => void handleRevoke(link)} disabled={busyId === link.id || !status.active} className="text-destructive border-destructive/20 hover:bg-destructive/5 dark:border-destructive/40 dark:hover:bg-destructive/10">
                        <ShieldOff className="w-4 h-4 mr-2" />
                        Revoke
                      </Button>
                    </div>

                    {result && (
                      <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${result.includes("Failed") || result.includes("Paste") || result.includes("different") || result.includes("not wired yet") ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{result}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

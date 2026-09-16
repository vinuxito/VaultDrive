import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { API_URL } from "../utils/api";
import { ShieldCheck, Link2, Upload, FileQuestion, ExternalLink, Copy, AlertTriangle, Clock, CheckCircle, XCircle, Ban, Loader2, Trash2, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { relativeTime } from "../utils/format";
import { branding } from "../config/branding";
import { useSessionVault } from "../context/SessionVaultContext";
import { getStoredUserFromLocalStorage } from "../utils/browser-storage";
import { getFileCredentialScheme } from "../utils/file-credential";
import { recoverVerifiedOwnerFileKey, type RecoverableOwnerFile } from "../utils/access-link-recovery";
import { arrayBufferToBase64, unwrapKeyWithRSA } from "../utils/crypto";
import { resolveOwnerPrivateKeyFromSession } from "../utils/owner-private-key";

interface ShareItem {
  id: string;
  type: "file" | "folder";
  token: string;
  resource_name: string;
  resource_id: string;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
  access_count: number;
  last_accessed_at?: string;
  status: "active" | "expired" | "revoked" | "stale" | "never_used" | "closed" | "unknown";
}

interface DropToken {
  id: string;
  token: string;
  link_name?: string;
  description?: string;
  files_uploaded: number;
  last_upload_at?: string;
  expires_at?: string;
  used: boolean;
  is_active?: boolean;
  created_at: string;
  has_password: boolean;
}

type Tab = "shares" | "drop" | "all";
type StatusFilter = "all" | "active" | "expired" | "revoked" | "never_used" | "stale" | "closed" | "unknown";

interface SourceState<T> {
  data: T[];
  loading: boolean;
  error: boolean;
  stale: boolean;
  lastSuccessfulAt: number | null;
}

const SHARE_STATUSES = new Set<ShareItem["status"]>(["active", "expired", "revoked", "stale", "never_used", "closed", "unknown"]);

function parseShareItem(value: unknown): ShareItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const valid = typeof item.id === "string" && (item.type === "file" || item.type === "folder")
    && typeof item.token === "string" && typeof item.resource_name === "string"
    && typeof item.resource_id === "string" && typeof item.is_active === "boolean"
    && typeof item.created_at === "string" && typeof item.access_count === "number"
    && typeof item.status === "string";
  if (!valid) return null;
  const share = item as unknown as ShareItem;
  return { ...share, status: SHARE_STATUSES.has(share.status) ? share.status : "unknown" };
}

function parseDropToken(value: unknown): DropToken | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const valid = typeof item.id === "string" && typeof item.token === "string"
    && typeof item.files_uploaded === "number" && typeof item.used === "boolean"
    && typeof item.created_at === "string" && typeof item.has_password === "boolean";
  return valid ? item as unknown as DropToken : null;
}

const STATUS_BADGE: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  active: { label: "Active", icon: <CheckCircle className="w-3 h-3" />, cls: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-800" },
  expired: { label: "Expired", icon: <Clock className="w-3 h-3" />, cls: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/30 dark:border-amber-800" },
  revoked: { label: "Revoked", icon: <Ban className="w-3 h-3" />, cls: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/30 dark:border-red-800" },
  stale: { label: "Stale", icon: <AlertTriangle className="w-3 h-3" />, cls: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-900/30 dark:border-orange-800" },
  never_used: { label: "Never used", icon: <XCircle className="w-3 h-3" />, cls: "text-muted-foreground bg-muted border-border" },
  closed: { label: "Closed", icon: <Ban className="w-3 h-3" />, cls: "text-muted-foreground bg-muted border-border" },
  unknown: { label: "Unknown", icon: <AlertTriangle className="w-3 h-3" />, cls: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/30 dark:border-amber-800" },
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation(["drive", "common"]);
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.unknown;
  const translated = t(`drive:accessCenter.status.${status}`, { defaultValue: cfg.label });
  const label = translated === `drive:accessCenter.status.${status}` ? cfg.label : translated;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.icon}
      {label}
    </span>
  );
}

interface RecoverableFolderLink {
  id: string;
  token: string;
  owner_wrapped_folder_key?: string | null;
}

interface RecoveryDialogState {
  item: ShareItem;
  mode: "copy" | "open";
  credentialType: "pin" | "password";
  loadingMaterial: boolean;
  file?: RecoverableOwnerFile;
  folderLink?: RecoverableFolderLink;
  error: string;
  resolvedUrl: string;
}

export default function AccessCenter() {
  const { t } = useTranslation(["drive", "common"]);
  const sessionVault = useSessionVault();
  const [tab, setTab] = useState<Tab>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [shareSource, setShareSource] = useState<SourceState<ShareItem>>({ data: [], loading: true, error: false, stale: false, lastSuccessfulAt: null });
  const [dropSource, setDropSource] = useState<SourceState<DropToken>>({ data: [], loading: true, error: false, stale: false, lastSuccessfulAt: null });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recoveryDialog, setRecoveryDialog] = useState<RecoveryDialogState | null>(null);
  const [credential, setCredential] = useState("");
  const [resolving, setResolving] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<ShareItem | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const recoveryGeneration = useRef(0);

  const copy = useCallback((key: string, fallback: string) => {
    const translated = t(key, { defaultValue: fallback });
    return translated === key ? fallback : translated;
  }, [t]);

  const loadSource = useCallback(async <T,>(
    endpoint: string,
    setSource: React.Dispatch<React.SetStateAction<SourceState<T>>>,
    parse: (value: unknown) => T | null,
    signal?: AbortSignal,
  ) => {
    setSource((current) => ({ ...current, loading: true, error: false }));
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("Unexpected response");
      const parsed = data.map(parse);
      if (parsed.some((item) => item === null)) throw new Error("Unexpected response");
      setSource({ data: parsed as T[], loading: false, error: false, stale: false, lastSuccessfulAt: Date.now() });
      return true;
    } catch (error) {
      if (signal?.aborted) return;
      console.error(error);
      setSource((current) => ({
        ...current,
        loading: false,
        error: true,
        stale: current.lastSuccessfulAt !== null,
      }));
      return false;
    }
  }, []);

  const loadShares = useCallback((signal?: AbortSignal) => (
    loadSource<ShareItem>("/v1/shares", setShareSource, parseShareItem, signal)
  ), [loadSource]);

  const loadDrops = useCallback((signal?: AbortSignal) => (
    loadSource<DropToken>("/drop/tokens", setDropSource, parseDropToken, signal)
  ), [loadSource]);

  useEffect(() => {
    const controller = new AbortController();
    void loadShares(controller.signal);
    void loadDrops(controller.signal);
    return () => controller.abort();
  }, [loadDrops, loadShares]);

  useEffect(() => () => {
    recoveryGeneration.current += 1;
  }, []);

  const shares = shareSource.data;
  const dropTokens = dropSource.data;

  async function beginRecovery(item: ShareItem, mode: "copy" | "open") {
    const generation = ++recoveryGeneration.current;
    const currentUser = getStoredUserFromLocalStorage();
    const initialCredentialType = currentUser?.pin_set ? "pin" : "password";
    setCredential("");
    setActionMessage("");
    setRecoveryDialog({
      item,
      mode,
      credentialType: initialCredentialType,
      loadingMaterial: true,
      error: "",
      resolvedUrl: "",
    });

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Sign in again to recover this link.");

      if (item.type === "file") {
        const response = await fetch(`${API_URL}/files`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Could not load this file's encryption details.");
        const files = (await response.json()) as RecoverableOwnerFile[];
        const file = files.find((entry) => entry.id === item.resource_id);
        if (!file) throw new Error("This file is no longer available. Manage or recreate the link from Files.");
        const scheme = getFileCredentialScheme({ ...file, is_owner: true });
        if (scheme === "folder" && !sessionVault.getFolderKey(file.folder_id ?? "")) {
          throw new Error("Open this folder in Files first, then recover the link from Access Center.");
        }
        if (recoveryGeneration.current !== generation) return;
        setRecoveryDialog((current) => current?.item.id === item.id ? {
          ...current,
          file,
          credentialType: scheme === "password" ? "password" : "pin",
          loadingMaterial: false,
        } : current);
        return;
      }

      const response = await fetch(`${API_URL}/folders/${item.resource_id}/share-links`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Could not load this folder link's recovery material.");
      const links = (await response.json()) as RecoverableFolderLink[];
      const folderLink = links.find((entry) => entry.id === item.id || entry.token === item.token);
      if (!folderLink?.owner_wrapped_folder_key) {
        throw new Error("This older folder link cannot be recovered here. Repair or recreate it from Files.");
      }
      if (recoveryGeneration.current !== generation) return;
      setRecoveryDialog((current) => current?.item.id === item.id ? {
        ...current,
        folderLink,
        loadingMaterial: false,
      } : current);
    } catch (error) {
      if (recoveryGeneration.current !== generation) return;
      setRecoveryDialog((current) => current?.item.id === item.id ? {
        ...current,
        loadingMaterial: false,
        error: error instanceof Error ? error.message : "Could not prepare this link.",
      } : current);
    }
  }

  function closeRecoveryDialog() {
    recoveryGeneration.current += 1;
    setRecoveryDialog(null);
    setCredential("");
    setResolving(false);
  }

  async function resolveRecovery() {
    if (!recoveryDialog || recoveryDialog.loadingMaterial || recoveryDialog.resolvedUrl) return;
    if (!credential) {
      setRecoveryDialog({ ...recoveryDialog, error: `Enter your current ${recoveryDialog.credentialType === "pin" ? "PIN" : "password"}.` });
      return;
    }

    const generation = ++recoveryGeneration.current;
    setResolving(true);
    setRecoveryDialog({ ...recoveryDialog, error: "" });
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Sign in again to recover this link.");

      let fragment: string;
      if (recoveryDialog.item.type === "file") {
        if (!recoveryDialog.file) throw new Error("File recovery material is unavailable.");
        const response = await fetch(`${API_URL}/files/${recoveryDialog.file.id}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Could not verify this file key. Try again.");
        const recovered = await recoverVerifiedOwnerFileKey({
          file: recoveryDialog.file,
          credential,
          encryptedData: await response.arrayBuffer(),
          wrappedKey: response.headers.get("X-Wrapped-Key"),
          cachedFileKey: sessionVault.getFileKey(recoveryDialog.file.id),
          folderKey: recoveryDialog.file.folder_id
            ? sessionVault.getFolderKey(recoveryDialog.file.folder_id)
            : null,
        });
        if (recoveryGeneration.current !== generation) return;
        sessionVault.setFileKey(recoveryDialog.file.id, recovered.key);
        fragment = recovered.fragment;
      } else {
        const currentUser = getStoredUserFromLocalStorage();
        const wrappedKey = recoveryDialog.folderLink?.owner_wrapped_folder_key;
        if (!wrappedKey) throw new Error("This folder link's recovery material is unavailable.");
        const privateKey = await resolveOwnerPrivateKeyFromSession(
          sessionVault.getPrivateKey(),
          { value: credential, type: recoveryDialog.credentialType },
          currentUser,
        );
        if (!privateKey) throw new Error("Your current credential could not unlock the folder key.");
        const folderKey = await unwrapKeyWithRSA(privateKey, wrappedKey);
        if (recoveryGeneration.current !== generation) return;
        fragment = arrayBufferToBase64(await crypto.subtle.exportKey("raw", folderKey));
      }

      if (recoveryGeneration.current !== generation) return;
      const route = recoveryDialog.item.type === "folder" ? "folder-share" : "share";
      const fullUrl = `${baseURL}/${route}/${recoveryDialog.item.token}#${fragment}`;
      if (recoveryDialog.mode === "copy") {
        try {
          if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
          await navigator.clipboard.writeText(fullUrl);
          if (recoveryGeneration.current !== generation) return;
          setCopiedId(recoveryDialog.item.id);
          setActionMessage("Full link copied.");
          setTimeout(() => setCopiedId(null), 1500);
          closeRecoveryDialog();
          return;
        } catch {
          if (recoveryGeneration.current !== generation) return;
          setRecoveryDialog({ ...recoveryDialog, resolvedUrl: fullUrl, error: "Clipboard access was denied. Select the full URL and copy it manually." });
          return;
        }
      }

      setRecoveryDialog({ ...recoveryDialog, resolvedUrl: fullUrl, error: "" });
    } catch (error) {
      if (recoveryGeneration.current !== generation) return;
      setRecoveryDialog({
        ...recoveryDialog,
        error: error instanceof Error ? error.message : "Could not recover this full link.",
      });
    } finally {
      if (recoveryGeneration.current === generation) setResolving(false);
    }
  }

  async function revokeShare(item: ShareItem) {
    const token = localStorage.getItem("token");
    if (!token) {
      setActionMessage("Sign in again to revoke this link.");
      return;
    }
    setRevokingId(item.id);
    setActionMessage("");
    try {
      const endpoint = item.type === "folder"
        ? `/folder-share-links/${item.id}`
        : `/share-links/${item.id}`;
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Could not revoke this link. Try again.");
      const refreshed = await loadShares();
      setConfirmRevoke(null);
      setActionMessage(refreshed
        ? `${item.resource_name} link revoked.`
        : `${item.resource_name} link revoked, but the list could not refresh. Refresh before taking another action.`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Could not revoke this link. Try again.");
    } finally {
      setRevokingId(null);
    }
  }

  // Derive drop token status.
  function dropStatus(t: DropToken): string {
    if (t.used || t.is_active === false) return "closed";
    if (t.expires_at) {
      const expiration = new Date(t.expires_at);
      if (Number.isNaN(expiration.getTime())) return "unknown";
      if (expiration < new Date()) return "expired";
    }
    if (typeof t.files_uploaded !== "number") return "unknown";
    if (t.files_uploaded === 0) return "never_used";
    return "active";
  }

  // Build unified item list for "all" tab filtering.
  type UnifiedItem =
    | { kind: "share"; data: ShareItem }
    | { kind: "drop"; data: DropToken; status: string };

  const allItems: UnifiedItem[] = [
    ...shares.map((s) => ({ kind: "share" as const, data: s })),
    ...dropTokens.map((d) => ({ kind: "drop" as const, data: d, status: dropStatus(d) })),
  ];

  const filteredAllItems = allItems.filter((item) => {
    if (statusFilter === "all") return true;
    const s = item.kind === "share" ? item.data.status : item.status;
    return s === statusFilter;
  });

  const filteredShares = statusFilter === "all" ? shares : shares.filter((s) => s.status === statusFilter);
  const filteredDrops = statusFilter === "all" ? dropTokens : dropTokens.filter((d) => dropStatus(d) === statusFilter);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number | string }[] = [
    { key: "all", label: "All access", icon: <ShieldCheck className="w-4 h-4" />, count: shareSource.error || dropSource.error ? "—" : allItems.length },
    { key: "shares", label: "Share links", icon: <Link2 className="w-4 h-4" />, count: shareSource.error && shares.length === 0 ? "—" : shares.length },
    { key: "drop", label: "Drop routes", icon: <Upload className="w-4 h-4" />, count: dropSource.error && dropTokens.length === 0 ? "—" : dropTokens.length },
  ];

  const baseURL = window.location.origin + branding.basePath;

  const relevantLoading = tab === "all"
    ? shareSource.loading || dropSource.loading
    : tab === "shares" ? shareSource.loading : dropSource.loading;
  const relevantError = tab === "all"
    ? shareSource.error || dropSource.error
    : tab === "shares" ? shareSource.error : dropSource.error;

  return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Access Center</h1>
            <p className="text-sm text-muted-foreground">All outbound access grants — share links and drop routes in one place.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Status filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "active", "expired", "revoked", "never_used", "stale", "closed", "unknown"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40"
              }`}
            >
              {s === "all" ? "All" : s === "never_used" ? "Never used" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2" aria-label="Access data sources">
          {(tab === "all" || tab === "shares") && (
            <SourceStatus
              label={copy("drive:accessCenter.sources.shares", "Share links")}
              state={shareSource}
              unavailable={copy("drive:accessCenter.sources.sharesUnavailable", "Share links are unavailable.")}
              stale={copy("drive:accessCenter.sources.sharesStale", "Share links may be out of date.")}
              retryLabel={shareSource.error
                ? copy("drive:accessCenter.sources.tryShares", "Try share links again")
                : copy("drive:accessCenter.sources.refreshShares", "Refresh share links")}
              actionLabel={shareSource.error
                ? copy("drive:accessCenter.sources.tryAgain", "Try again")
                : copy("drive:accessCenter.sources.refresh", "Refresh")}
              onRetry={() => void loadShares()}
            />
          )}
          {(tab === "all" || tab === "drop") && (
            <SourceStatus
              label={copy("drive:accessCenter.sources.drops", "Drop routes")}
              state={dropSource}
              unavailable={copy("drive:accessCenter.sources.dropsUnavailable", "Drop routes are unavailable.")}
              stale={copy("drive:accessCenter.sources.dropsStale", "Drop routes may be out of date.")}
              retryLabel={dropSource.error
                ? copy("drive:accessCenter.sources.tryDrops", "Try drop routes again")
                : copy("drive:accessCenter.sources.refreshDrops", "Refresh drop routes")}
              actionLabel={dropSource.error
                ? copy("drive:accessCenter.sources.tryAgain", "Try again")
                : copy("drive:accessCenter.sources.refresh", "Refresh")}
              onRetry={() => void loadDrops()}
            />
          )}
        </div>

          <>
            {/* ALL TAB */}
            {tab === "all" && (
              filteredAllItems.length === 0 && !relevantLoading && !relevantError ? (
                <EmptyState filtered={statusFilter !== "all"} onClear={() => setStatusFilter("all")} />
              ) : (
                <div className="space-y-2">
                  {filteredAllItems.map((item, idx) =>
                    item.kind === "share" ? (
                      <ShareCard key={idx} item={item.data} copiedId={copiedId} actionsDisabled={shareSource.stale} onRecover={beginRecovery} onRevoke={setConfirmRevoke} />
                    ) : (
                      <DropCard key={idx} item={item.data} status={item.status} />
                    )
                  )}
                </div>
              )
            )}

            {/* SHARES TAB */}
            {tab === "shares" && (
              filteredShares.length === 0 && !relevantLoading && !relevantError ? <EmptyState filtered={statusFilter !== "all"} onClear={() => setStatusFilter("all")} /> : (
                <div className="space-y-2">
                  {filteredShares.map((s) => (
                    <ShareCard key={s.id} item={s} copiedId={copiedId} actionsDisabled={shareSource.stale} onRecover={beginRecovery} onRevoke={setConfirmRevoke} />
                  ))}
                </div>
              )
            )}

            {/* DROP TAB */}
            {tab === "drop" && (
              filteredDrops.length === 0 && !relevantLoading && !relevantError ? <EmptyState filtered={statusFilter !== "all"} onClear={() => setStatusFilter("all")} /> : (
                <div className="space-y-2">
                  {filteredDrops.map((d) => (
                    <DropCard key={d.id} item={d} status={dropStatus(d)} />
                  ))}
                </div>
              )
            )}
          </>

        {actionMessage && <p role="status" className="text-sm text-foreground">{actionMessage}</p>}

        {recoveryDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
            <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl" role="dialog" aria-modal="true" aria-label={`Recover ${recoveryDialog.item.type} share link`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Recover full {recoveryDialog.item.type} share link</h2>
                  <p className="mt-1 text-sm text-muted-foreground">The decryption key stays in this browser and is added after #.</p>
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Cancel link recovery" onClick={closeRecoveryDialog}><X className="h-4 w-4" /></Button>
              </div>

              {recoveryDialog.loadingMaterial ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading recovery material…</p>
              ) : recoveryDialog.resolvedUrl ? (
                <div className="space-y-3">
                  <label htmlFor="recovered-share-url" className="text-sm font-medium">Full share URL</label>
                  <textarea id="recovered-share-url" readOnly rows={4} value={recoveryDialog.resolvedUrl} onClick={(event) => event.currentTarget.select()} className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground" />
                  {recoveryDialog.mode === "open" && <a href={recoveryDialog.resolvedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><ExternalLink className="h-4 w-4" /> Open recovered link</a>}
                </div>
              ) : (
                <div className="space-y-3">
                  <label htmlFor="access-link-credential" className="text-sm font-medium">Current {recoveryDialog.credentialType === "pin" ? "PIN" : "password"}</label>
                  <input id="access-link-credential" type="password" autoComplete="new-password" inputMode={recoveryDialog.credentialType === "pin" ? "numeric" : undefined} maxLength={recoveryDialog.credentialType === "pin" ? 4 : undefined} value={credential} onChange={(event) => setCredential(recoveryDialog.credentialType === "pin" ? event.target.value.replace(/\D/g, "").slice(0, 4) : event.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground" />
                  <Button type="button" onClick={() => void resolveRecovery()} disabled={resolving || (recoveryDialog.credentialType === "pin" && credential.length !== 4)}>{resolving && <Loader2 className="h-4 w-4 animate-spin" />}{recoveryDialog.mode === "copy" ? "Verify and copy" : "Verify link"}</Button>
                </div>
              )}
              {recoveryDialog.error && <p className="text-sm text-destructive">{recoveryDialog.error}</p>}
            </div>
          </div>
        )}

        {confirmRevoke && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
            <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl" role="alertdialog" aria-modal="true" aria-labelledby="revoke-link-title">
              <div>
                <h2 id="revoke-link-title" className="font-semibold">Revoke this {confirmRevoke.type} share link?</h2>
                <p className="mt-1 text-sm text-muted-foreground">The stored {confirmRevoke.type} stays in your vault. This only closes this recipient route.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirmRevoke(null)} disabled={revokingId === confirmRevoke.id}>Cancel</Button>
                <Button type="button" variant="destructive" onClick={() => void revokeShare(confirmRevoke)} disabled={revokingId === confirmRevoke.id}>{revokingId === confirmRevoke.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Confirm revoke</Button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

function SourceStatus<T>({
  label,
  state,
  unavailable,
  stale,
  retryLabel,
  actionLabel,
  onRetry,
}: {
  label: string;
  state: SourceState<T>;
  unavailable: string;
  stale: string;
  retryLabel: string;
  actionLabel: string;
  onRetry: () => void;
}) {
  const message = state.error ? (state.stale ? stale : unavailable) : null;
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs">
      <div className="min-w-0">
        <span className="font-medium text-foreground">{label}</span>
        {state.loading && state.data.length === 0 && <span className="ml-2 text-muted-foreground">Loading…</span>}
        {message && <p className="mt-0.5 text-amber-700 dark:text-amber-300" role="status">{message}</p>}
        {state.lastSuccessfulAt !== null && <p className="mt-0.5 text-muted-foreground">Last updated: {new Date(state.lastSuccessfulAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>}
      </div>
      <Button type="button" variant="ghost" size="sm" aria-label={retryLabel} onClick={onRetry} disabled={state.loading}>
        {actionLabel}
      </Button>
    </div>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  const { t } = useTranslation(["drive"]);
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
      <FileQuestion className="w-8 h-8 opacity-30" />
      <p className="text-sm font-medium text-foreground">
        {filtered
          ? t("drive:accessCenter.empty.filtered", { defaultValue: "No access routes match this filter" })
          : t("drive:accessCenter.empty.title", { defaultValue: "No access routes yet" })}
      </p>
      <p className="max-w-sm text-center text-xs">
        {filtered
          ? t("drive:accessCenter.empty.filteredDescription", { defaultValue: "Clear the filter to review all share links and upload routes." })
          : t("drive:accessCenter.empty.description", { defaultValue: "Create a share link or an upload route from Files when you need to give someone access." })}
      </p>
      {filtered ? (
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          {t("drive:accessCenter.empty.clear", { defaultValue: "Clear filter" })}
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link to="/files">{t("drive:accessCenter.empty.openFiles", { defaultValue: "Open Files" })}</Link>
        </Button>
      )}
    </div>
  );
}

interface ShareCardProps {
  item: ShareItem;
  copiedId: string | null;
  actionsDisabled: boolean;
  onRecover: (item: ShareItem, mode: "copy" | "open") => void;
  onRevoke: (item: ShareItem) => void;
}

function ShareCard({ item, copiedId, actionsDisabled, onRecover, onRevoke }: ShareCardProps) {
  const linkAvailable = item.is_active && item.status !== "expired" && item.status !== "closed" && item.status !== "revoked" && item.status !== "unknown";
  const disabled = actionsDisabled || !linkAvailable;
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
        <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.resource_name}</p>
        <p className="text-xs text-muted-foreground">
          {item.type === "folder" ? "Folder share" : "File share"} · Created {relativeTime(item.created_at)} · {item.access_count} views
          {item.last_accessed_at && ` · Last viewed ${relativeTime(item.last_accessed_at)}`}
        </p>
      </div>
      <StatusBadge status={item.status} />
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" title="Copy full link" aria-label="Copy full link" disabled={disabled} onClick={() => onRecover(item, "copy")}>
          {copiedId === item.id ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" title="Open full link" aria-label="Open full link" disabled={disabled} onClick={() => onRecover(item, "open")}>
          <ExternalLink className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" title={`Revoke ${item.resource_name} link`} aria-label={`Revoke ${item.resource_name} link`} disabled={disabled} onClick={() => onRevoke(item)}>
          <Ban className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

interface DropCardProps {
  item: DropToken;
  status: string;
}

function DropCard({ item, status }: DropCardProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Upload className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.link_name ?? item.token.slice(0, 12) + "…"}</p>
        <p className="text-xs text-muted-foreground">
          Drop link · {item.files_uploaded} file{item.files_uploaded !== 1 ? "s" : ""} received
          {item.last_upload_at && ` · Last upload ${relativeTime(item.last_upload_at)}`}
          {item.expires_at && ` · Expires ${relativeTime(item.expires_at)}`}
          {item.has_password && " · Password protected"}
        </p>
      </div>
      <StatusBadge status={status} />
      <div className="flex items-center gap-1 shrink-0">
        <Link to="/files" state={{ manageDropToken: item.token }} className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-muted" aria-label="Manage Drop route">Manage</Link>
      </div>
    </div>
  );
}

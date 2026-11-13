import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Folder as FolderIcon,
  Link2,
  Download,
  Users,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Copy,
  QrCode,
  Share2,
  MessageCircle,
  RefreshCw,
  Key,
  UserPlus,
  Trash2,
  Search,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { API_URL, BASE_PATH } from "../../utils/api";
import {
  generateFileKey,
  exportKey,
  importRSAPublicKey,
  importRSAPrivateKey,
  wrapKeyWithAES,
  wrapKeyWithRSA,
  unwrapKeyWithRSA,
  decryptPrivateKeyWithPIN,
} from "../../utils/crypto";
import { useSessionVault } from "../../context/SessionVaultContext";
import { resolveFolderShareFileKey } from "../../utils/folder-share";
import { wrapFolderKeyForRecipient } from "../../utils/folder-share-multiuser";
import {
  syncFolderShareLinkById,
  type SyncableFolderShareLink,
} from "../../utils/folder-share-sync";
import { playTumblerClick } from "../../utils/audioHaptics";
import { encodeQrMatrix } from "../../utils/qr-svg";

export type MobileFolderShareTab = "link" | "drop" | "team";

export interface MobileFolderShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  folder: {
    id: string;
    name: string;
  } | null;
  initialTab?: MobileFolderShareTab;
  fileCount?: number;
  existingDropUrl?: string | null;
  onCreated?: () => void;
  onDropCreated?: () => void;
}

interface CollaboratorShareItem {
  id: string;
  user_id: string;
  username: string;
  wrapped_key: string;
  shared_by: string;
  created_at: string;
}

interface UserSearchResult {
  id: string;
  username: string;
  email: string;
}

const EXPIRY_OPTIONS = [
  { days: 1, pill: "1d", human: "24 horas" },
  { days: 3, pill: "3d", human: "3 días" },
  { days: 7, pill: "7d", human: "7 días" },
  { days: 30, pill: "30d", human: "30 días" },
] as const;

function splitUrlFragment(rawUrl: string): { base: string; frag: string } {
  const idx = rawUrl.indexOf("#");
  if (idx === -1) return { base: rawUrl, frag: "" };
  return { base: rawUrl.slice(0, idx), frag: rawUrl.slice(idx) };
}

export function MobileFolderShareSheet({
  isOpen,
  onClose,
  folder,
  initialTab = "link",
  fileCount = 0,
  existingDropUrl = null,
  onCreated,
  onDropCreated,
}: MobileFolderShareSheetProps) {
  const sessionVault = useSessionVault();
  const cached = sessionVault.getCredential();
  const cachedPin = cached?.type === "pin" ? cached.value : "";

  const [activeTab, setActiveTab] = useState<MobileFolderShareTab>(initialTab);
  const [pin, setPin] = useState("");
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [statusToast, setStatusToast] = useState<string>("");

  // Tab 1 (#key Folder Link) state
  const [generatingLink, setGeneratingLink] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [emptyFolderDetected, setEmptyFolderDetected] = useState(false);
  const [wrappedStats, setWrappedStats] = useState<{ wrapped: number; total: number }>({
    wrapped: fileCount,
    total: fileCount,
  });
  const [activeLinks, setActiveLinks] = useState<SyncableFolderShareLink[]>([]);
  const [syncingLinks, setSyncingLinks] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  // Tab 2 (Buzón Drop) state
  const [dropUrl, setDropUrl] = useState<string>(existingDropUrl || "");
  const [creatingDrop, setCreatingDrop] = useState(false);
  const [dropError, setDropError] = useState("");

  // Tab 3 (Equipo RSA) state
  const [shares, setShares] = useState<CollaboratorShareItem[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [showInviteSearch, setShowInviteSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [teamError, setTeamError] = useState("");

  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw
        ? (JSON.parse(raw) as {
            id?: string;
            username?: string;
            public_key?: string;
            private_key_pin_encrypted?: string;
            kek_envelope_version?: number;
          })
        : null;
    } catch {
      return null;
    }
  }, [isOpen]);

  const effectivePin = cachedPin || pin;

  const showQuickToast = useCallback((msg: string) => {
    setStatusToast(msg);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(15);
    }
    window.setTimeout(() => {
      setStatusToast((curr) => (curr === msg ? "" : curr));
    }, 2600);
  }, []);

  const fetchActiveFolderLinks = useCallback(async (folderId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/folders/${folderId}/share-links`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const list = (await res.json()) as SyncableFolderShareLink[];
        const valid = (list || []).filter(
          (l) => l.is_active && (!l.expires_at || new Date(l.expires_at).getTime() > Date.now())
        );
        setActiveLinks(valid);
      }
    } catch {
      // Non-fatal governance telemetry
    }
  }, []);

  const fetchCollaborators = useCallback(async (folderId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoadingShares(true);
    setTeamError("");
    try {
      const res = await fetch(`${API_URL}/folders/${folderId}/shares`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as CollaboratorShareItem[];
        setShares(data || []);
      }
    } catch {
      setTeamError("No se pudieron cargar los colaboradores.");
    } finally {
      setLoadingShares(false);
    }
  }, []);

  const generateFolderKeyLink = useCallback(
    async (overridePin?: string, overrideExpiryDays?: number): Promise<string | null> => {
      if (!folder) return null;
      const pinToUse = overridePin ?? effectivePin;
      if (!/^\d{4}$/.test(pinToUse)) {
        return null;
      }

      setGeneratingLink(true);
      setLinkError("");
      setEmptyFolderDetected(false);

      try {
        const authToken = localStorage.getItem("token");
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}") as {
          public_key?: string;
          private_key_pin_encrypted?: string;
          kek_envelope_version?: number;
        };

        if (!storedUser.private_key_pin_encrypted) {
          throw new Error("Configura tu PIN de 4 dígitos en Ajustes para compartir carpetas.");
        }

        const privateKeyPem = await decryptPrivateKeyWithPIN(
          pinToUse,
          storedUser.private_key_pin_encrypted,
          storedUser.kek_envelope_version
        );
        const rsaPrivateKey = await importRSAPrivateKey(privateKeyPem);

        const filesRes = await fetch(`${API_URL}/folders/${folder.id}/files-recursive`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!filesRes.ok) {
          throw new Error("No se pudieron consultar los archivos de esta carpeta.");
        }
        const filesData = (await filesRes.json()) as {
          files: Array<{ id: string; filename: string; encrypted_metadata: string }>;
          total_count: number;
        };

        if (!filesData.total_count || filesData.total_count === 0) {
          setEmptyFolderDetected(true);
          setGeneratingLink(false);
          return null;
        }

        setWrappedStats({ wrapped: 0, total: filesData.total_count });

        const fileIds = filesData.files.map((f) => f.id);
        const keysRes = await fetch(`${API_URL}/files/access-keys-batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ file_ids: fileIds }),
        });
        if (!keysRes.ok) {
          throw new Error("No se pudieron obtener las llaves cifradas del lote.");
        }
        const wrappedKeysMap = (await keysRes.json()) as Record<string, string>;

        if (!storedUser.public_key) {
          throw new Error("Llave pública del propietario no disponible.");
        }
        const folderShareKey = await generateFileKey();
        const ownerPublicKey = await importRSAPublicKey(storedUser.public_key);
        const ownerWrappedFolderKey = await wrapKeyWithRSA(ownerPublicKey, folderShareKey);

        const folderWrappedKeys: Record<string, string> = {};
        const fileMap = new Map(filesData.files.map((item) => [item.id, item]));
        let count = 0;

        for (const fileId of fileIds) {
          const wrappedKey = wrappedKeysMap[fileId];
          const entry = fileMap.get(fileId);
          if (!wrappedKey || !entry) continue;

          const fileAesKey = await resolveFolderShareFileKey({
            wrappedKey,
            encryptedMetadata: entry.encrypted_metadata,
            credential: pinToUse,
            credentialType: "pin",
            rsaPrivateKey,
          });
          folderWrappedKeys[fileId] = await wrapKeyWithAES(folderShareKey, fileAesKey);
          count++;
          setWrappedStats({ wrapped: count, total: filesData.total_count });
        }

        if (Object.keys(folderWrappedKeys).length === 0) {
          throw new Error("No se pudo envolver ninguna llave para esta carpeta.");
        }

        const days = overrideExpiryDays ?? expiryDays;
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

        const createRes = await fetch(`${API_URL}/folders/${folder.id}/share-link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            expires_at: expiresAt,
            wrapped_keys: folderWrappedKeys,
            owner_wrapped_folder_key: ownerWrappedFolderKey,
          }),
        });

        if (!createRes.ok) {
          const errBody = (await createRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(errBody.error || "Error al registrar el enlace de carpeta.");
        }

        const created = (await createRes.json()) as { token: string };
        const b64Key = await exportKey(folderShareKey);
        const url = `${window.location.origin}${BASE_PATH}/folder-share/${created.token}#${b64Key}`;
        setShareUrl(url);
        playTumblerClick();
        onCreated?.();
        void fetchActiveFolderLinks(folder.id);
        return url;
      } catch (err) {
        setLinkError(
          err instanceof Error && err.message.trim()
            ? err.message
            : "Verifica tu PIN de 4 dígitos e inténtalo de nuevo."
        );
        return null;
      } finally {
        setGeneratingLink(false);
      }
    },
    [effectivePin, expiryDays, fetchActiveFolderLinks, folder, onCreated]
  );

  const generateDropIntakeLink = useCallback(
    async (overridePin?: string): Promise<string | null> => {
      if (!folder) return null;
      const pinToUse = overridePin ?? effectivePin;
      if (!/^\d{4}$/.test(pinToUse)) {
        setDropError("Ingresa tu PIN de 4 dígitos para activar el Buzón Drop.");
        return null;
      }

      setCreatingDrop(true);
      setDropError("");
      try {
        const authToken = localStorage.getItem("token");
        const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
        const res = await fetch(`${API_URL}/drop/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            target_folder_id: folder.id,
            expires_at: expiresAt,
            max_files: 0,
            pin: pinToUse,
            link_name: `Buzón ${folder.name}`,
            description: `Recepción cifrada directa hacia ${folder.name}`,
            seal_after_upload: false,
          }),
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errBody.error || "No se pudo crear el Buzón Drop.");
        }

        const data = (await res.json()) as { upload_url: string };
        setDropUrl(data.upload_url);
        playTumblerClick();
        onDropCreated?.();
        showQuickToast(`Buzón Drop activo para «${folder.name}»`);
        return data.upload_url;
      } catch (err) {
        setDropError(err instanceof Error ? err.message : "Error al activar Buzón Drop.");
        return null;
      } finally {
        setCreatingDrop(false);
      }
    },
    [effectivePin, expiryDays, folder, onDropCreated, showQuickToast]
  );

  // Reset & auto-load when opened
  useEffect(() => {
    if (!isOpen || !folder) return;
    setActiveTab(initialTab);
    setShareUrl("");
    setLinkError("");
    setEmptyFolderDetected(false);
    setShowQr(false);
    setCopied(false);
    setDropUrl(existingDropUrl || "");
    setDropError("");
    setWrappedStats({ wrapped: fileCount, total: fileCount });

    void fetchActiveFolderLinks(folder.id);
    void fetchCollaborators(folder.id);

    if (initialTab === "link" && cachedPin) {
      void generateFolderKeyLink(cachedPin, 7);
    } else if (initialTab === "drop" && !existingDropUrl && cachedPin) {
      void generateDropIntakeLink(cachedPin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, folder?.id, initialTab]);

  // Search users for Tab 3 (Equipo RSA)
  useEffect(() => {
    if (!isOpen || activeTab !== "team" || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as UserSearchResult[];
          const existingIds = new Set(shares.map((s) => s.user_id));
          setSearchResults(
            (data || []).filter((u) => u.id !== currentUser?.id && !existingIds.has(u.id))
          );
        }
      } catch {
        // Ignore transient search error
      } finally {
        setSearchingUsers(false);
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [activeTab, currentUser?.id, isOpen, searchQuery, shares]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !folder) return null;

  const activeExpiryMeta =
    EXPIRY_OPTIONS.find((opt) => opt.days === expiryDays) ?? EXPIRY_OPTIONS[2];

  const activeDispatchUrl = activeTab === "drop" ? dropUrl : shareUrl;

  const ensureActiveUrl = async (): Promise<string | null> => {
    if (activeTab === "drop") {
      if (dropUrl) return dropUrl;
      return await generateDropIntakeLink();
    }
    if (shareUrl) return shareUrl;
    return await generateFolderKeyLink();
  };

  const handleCopyActiveUrl = async () => {
    const resolved = await ensureActiveUrl();
    if (!resolved) return;
    await navigator.clipboard?.writeText(resolved);
    setCopied(true);
    showQuickToast("Enlace #key copiado al portapapeles (<300ms)");
    window.setTimeout(() => setCopied(false), 2400);
  };

  const handleWhatsAppDispatch = async () => {
    const resolved = await ensureActiveUrl();
    if (!resolved) return;
    const msg =
      activeTab === "drop"
        ? `Sube tus archivos de forma cifrada a la carpeta "${folder.name}" en ABRN Drive (recibirás comprobante SHA-256):\n\n${resolved}`
        : `Te comparto la carpeta blindada "${folder.name}" en ABRN Drive (cifrado Zero-Knowledge #key):\n\n${resolved}`;
    showQuickToast(`Abriendo WhatsApp para «${folder.name}»`);
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleNativeShare = async () => {
    const resolved = await ensureActiveUrl();
    if (!resolved) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Carpeta ${folder.name} — ABRN Drive`,
          text:
            activeTab === "drop"
              ? `Buzón cifrado para subir archivos a "${folder.name}":`
              : `Carpeta cifrada "${folder.name}" en ABRN Drive:`,
          url: resolved,
        });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    await handleCopyActiveUrl();
  };

  const handleSyncActiveLinks = async () => {
    if (!effectivePin || activeLinks.length === 0) return;
    setSyncingLinks(true);
    try {
      const token = localStorage.getItem("token");
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}") as {
        private_key_pin_encrypted?: string;
        kek_envelope_version?: number;
      };
      if (!token || !storedUser.private_key_pin_encrypted) return;
      const pem = await decryptPrivateKeyWithPIN(
        effectivePin,
        storedUser.private_key_pin_encrypted,
        storedUser.kek_envelope_version
      );
      const rsaPriv = await importRSAPrivateKey(pem);
      for (const link of activeLinks) {
        await syncFolderShareLinkById({
          link,
          authToken: token,
          credential: { type: "pin", value: effectivePin },
          cachedPrivateKey: rsaPriv,
          currentUser: storedUser,
          providedShareUrl: shareUrl || undefined,
        });
      }
      showQuickToast(`${wrappedStats.total || fileCount} archivos sincronizados con enlaces activos`);
    } catch {
      showQuickToast("Ingresa tu PIN para sincronizar enlaces activos");
    } finally {
      setSyncingLinks(false);
    }
  };

  const handleGrantCollaborator = async (recipient: UserSearchResult) => {
    setBusyUserId(recipient.id);
    setTeamError("");
    try {
      const token = localStorage.getItem("token");
      let folderKey = sessionVault.getFolderKey(folder.id);
      if (!folderKey) {
        const ownerShare = shares.find((s) => s.user_id === currentUser?.id);
        if (ownerShare) {
          let priv = sessionVault.getPrivateKey();
          if (!priv) {
            if (!/^\d{4}$/.test(effectivePin) || !currentUser?.private_key_pin_encrypted) {
              throw new Error("Ingresa tu PIN de 4 dígitos arriba para autorizar llaves RSA.");
            }
            const pem = await decryptPrivateKeyWithPIN(
              effectivePin,
              currentUser.private_key_pin_encrypted,
              currentUser.kek_envelope_version
            );
            priv = await importRSAPrivateKey(pem);
            sessionVault.setPrivateKey(priv);
          }
          folderKey = await unwrapKeyWithRSA(priv, ownerShare.wrapped_key);
        } else {
          folderKey = await generateFileKey();
        }
        sessionVault.setFolderKey(folder.id, folderKey);
      }

      const keyRes = await fetch(`${API_URL}/users/${recipient.id}/public-key`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!keyRes.ok) throw new Error("No se encontró llave pública RSA del usuario.");
      const { public_key } = (await keyRes.json()) as { public_key: string };
      const wrappedKey = await wrapFolderKeyForRecipient(folderKey, public_key);

      const shareRes = await fetch(`${API_URL}/folders/${folder.id}/shares`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: recipient.id, wrapped_key: wrappedKey }),
      });
      if (!shareRes.ok) throw new Error("No se pudo registrar el acceso RSA.");

      const hasOwnerShare = shares.some((s) => s.user_id === currentUser?.id);
      if (!hasOwnerShare && currentUser?.id && currentUser.public_key) {
        const ownerWrapped = await wrapFolderKeyForRecipient(folderKey, currentUser.public_key);
        await fetch(`${API_URL}/folders/${folder.id}/shares`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: currentUser.id, wrapped_key: ownerWrapped }),
        });
      }

      setSearchQuery("");
      setSearchResults([]);
      setShowInviteSearch(false);
      showQuickToast(`Acceso RSA otorgado a ${recipient.username}`);
      await fetchCollaborators(folder.id);
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : "Error al compartir con colaborador.");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRevokeCollaborator = async (share: CollaboratorShareItem) => {
    setBusyUserId(share.user_id);
    setTeamError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/folders/${folder.id}/shares/${share.user_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("No se pudo revocar el acceso.");
      showQuickToast(`Acceso revocado para ${share.username}`);
      await fetchCollaborators(folder.id);
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : "Error al revocar colaborador.");
    } finally {
      setBusyUserId(null);
    }
  };

  const qrCardRef = useRef<HTMLDivElement | null>(null);
  const qrMatrix = showQr && activeDispatchUrl ? encodeQrMatrix(activeDispatchUrl) : null;

  useEffect(() => {
    if (showQr) {
      qrCardRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    }
  }, [showQr]);

  const linkParts = splitUrlFragment(
    shareUrl || `${window.location.origin}${BASE_PATH}/folder-share/pendiente#llave_aes256_local`
  );
  const dropParts = splitUrlFragment(
    dropUrl || `${window.location.origin}${BASE_PATH}/drop/${folder.id.slice(0, 8)}#llave_publica_abrn`
  );
  const visibleCollaborators = shares.filter((s) => s.user_id !== currentUser?.id);
  const displayTotalFiles = wrappedStats.total || fileCount;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Compartir carpeta ${folder.name}`}
      data-testid="mobile-folder-share-sheet"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-xs animate-in fade-in-0 duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-[24px] border-t-[1.5px] border-x border-primary/30 bg-card text-card-foreground shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200 relative"
      >
        {/* Instant <300ms Ley Tola Toast Banner */}
        {statusToast && (
          <div
            role="status"
            className="mx-3.5 mt-2.5 px-3 py-2 rounded-xl bg-foreground text-background text-[11px] font-bold flex items-center justify-between shadow-lg"
          >
            <span className="truncate">{statusToast}</span>
            <span className="text-[10px] opacity-80 ml-2 shrink-0">&lt;300ms</span>
          </div>
        )}

        {/* ================================================================
            ZONE 1: FROZEN HERO HEADER + 3-IN-1 FOLDER SHARE MODE TABS
            ================================================================ */}
        <div className="px-3.5 pt-2 pb-2.5 border-b border-border bg-card shrink-0">
          <div className="w-10 h-1 rounded-full bg-primary/30 mx-auto mb-2" />

          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/12 border border-primary/30 text-primary flex items-center justify-center shrink-0">
                <FolderIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3
                  style={{ fontFamily: "var(--font-display)" }}
                  className="text-[14.5px] font-bold text-foreground truncate"
                >
                  Compartir «{folder.name}»
                </h3>
                <p className="text-[11px] text-muted-foreground truncate">
                  {displayTotalFiles === 1 ? "1 archivo" : `${displayTotalFiles} archivos`} · Llave maestra envuelta en fragmento #key
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar hoja de carpeta"
              className="w-8 h-8 rounded-full border border-border bg-background text-foreground hover:bg-muted flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 3-in-1 Folder Share Mode Switcher */}
          <div
            role="tablist"
            aria-label="Modos para compartir carpeta"
            className="grid grid-cols-3 gap-1 bg-background p-1 rounded-xl border border-border mt-2.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "link"}
              data-testid="mobile-folder-tab-link"
              onClick={() => {
                setActiveTab("link");
                setShowQr(false);
                if (!shareUrl && cachedPin && !emptyFolderDetected) {
                  void generateFolderKeyLink(cachedPin, expiryDays);
                }
              }}
              className={cn(
                "min-h-[36px] rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                activeTab === "link"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              <span>Enlace #key</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "drop"}
              data-testid="mobile-folder-tab-drop"
              onClick={() => {
                setActiveTab("drop");
                setShowQr(false);
                if (!dropUrl && cachedPin) {
                  void generateDropIntakeLink(cachedPin);
                }
              }}
              className={cn(
                "min-h-[36px] rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                activeTab === "drop"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Buzón Drop</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "team"}
              data-testid="mobile-folder-tab-team"
              onClick={() => {
                setActiveTab("team");
                setShowQr(false);
              }}
              className={cn(
                "min-h-[36px] rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                activeTab === "team"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Equipo RSA ({visibleCollaborators.length})</span>
            </button>
          </div>
        </div>

        {/* ================================================================
            ZONE 2: BREATHABLE SCROLLABLE STAGE
            ================================================================ */}
        <div className="px-3.5 py-3 overflow-y-auto flex-1 space-y-2.5">
          {/* Shared Inline 4-Digit PIN Prompt when SessionVault doesn't have cached PIN */}
          {!cachedPin && ((activeTab === "link" && !shareUrl && !emptyFolderDetected) || (activeTab === "drop" && !dropUrl)) && (
            <div className="rounded-xl border border-primary/30 bg-background p-3 space-y-2">
              <label
                htmlFor="mobile-folder-share-pin"
                className="text-xs font-bold text-foreground flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5 text-primary" />
                <span>Autoriza con tu PIN de 4 dígitos</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="mobile-folder-share-pin"
                  data-testid="mobile-folder-pin-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  className="w-28 min-h-[42px] rounded-xl border border-border bg-card text-center text-lg tracking-widest font-mono text-foreground focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  data-testid="mobile-folder-unlock-generate-btn"
                  disabled={pin.length !== 4 || generatingLink || creatingDrop}
                  onClick={() => {
                    if (activeTab === "drop") {
                      void generateDropIntakeLink(pin);
                    } else {
                      void generateFolderKeyLink(pin, expiryDays);
                    }
                  }}
                  className="flex-1 min-h-[42px] rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {generatingLink || creatingDrop ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Desbloquear y Generar</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: ENLACE #KEY (ZERO-KNOWLEDGE FOLDER SHARE) */}
          {activeTab === "link" && (
            <>
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#2d8a6e]/12 border border-[#2d8a6e]/30 text-[#2d8a6e] dark:text-[#3eb489] text-[10.5px] font-bold">
                <span>
                  {generatingLink
                    ? `Envolviendo ${wrappedStats.wrapped}/${wrappedStats.total || "…"} llaves AES-256…`
                    : `${wrappedStats.wrapped}/${displayTotalFiles} llaves AES-256 envueltas con tu PIN`}
                </span>
                <span className="shrink-0">0 Bytes al Servidor</span>
              </div>

              {linkError && (
                <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{linkError}</span>
                </div>
              )}

              {/* Zero Dead-End Empty Folder Handoff */}
              {emptyFolderDetected ? (
                <div
                  data-testid="mobile-folder-empty-handoff"
                  className="rounded-xl border-[1.5px] border-primary/30 bg-background p-3.5 space-y-2.5"
                >
                  <p className="text-xs font-bold text-foreground">
                    «{folder.name}» aún no contiene archivos para lectura
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Los enlaces <strong>#key</strong> comparten archivos existentes. Si quieres que tu cliente te envíe documentos a esta carpeta desde su celular, activa su <strong>Buzón Drop</strong> en un toque:
                  </p>
                  <button
                    type="button"
                    data-testid="switch-to-drop-btn"
                    onClick={() => {
                      setActiveTab("drop");
                      if (effectivePin.length === 4 && !dropUrl) {
                        void generateDropIntakeLink(effectivePin);
                      }
                    }}
                    className="w-full min-h-[44px] rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Activar Buzón Drop en «{folder.name}»</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Live Glass Twin ("Espejo del Receptor") */}
                  <div
                    data-testid="mobile-folder-glass-twin"
                    className="rounded-xl border-[1.5px] border-primary/30 bg-background p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between text-[9.5px] font-bold uppercase tracking-wider text-primary">
                      <span>Espejo del Receptor (Así lo verá tu cliente)</span>
                      <span>Solo Lectura</span>
                    </div>

                    <div className="rounded-lg border border-border bg-card p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-xs text-foreground truncate">
                          Carpeta: {folder.name} ({displayTotalFiles})
                        </strong>
                        <span className="text-[10.5px] font-bold text-[#2d8a6e] dark:text-[#3eb489] shrink-0">
                          Vence en {activeExpiryMeta.human}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Tu cliente podrá previsualizar PDFs, CFDIs, imágenes y hojas de cálculo o descargar el ZIP descifrado en su celular sin crear cuenta.
                      </p>
                      <div className="font-mono text-[10px] bg-muted border border-border rounded-md px-2 py-1.5 break-all text-foreground">
                        <span>{linkParts.base}</span>
                        <span className="text-[#2d8a6e] dark:text-[#3eb489] font-bold">
                          {linkParts.frag}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expiry Preset Pills */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] font-bold text-foreground">
                      Vigencia del enlace:
                    </span>
                    <div className="flex items-center gap-1">
                      {EXPIRY_OPTIONS.map((opt) => (
                        <button
                          key={opt.days}
                          type="button"
                          onClick={() => {
                            setExpiryDays(opt.days);
                            if (effectivePin.length === 4) {
                              void generateFolderKeyLink(effectivePin, opt.days);
                            }
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer",
                            expiryDays === opt.days
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:text-foreground"
                          )}
                        >
                          {opt.pill}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Folder Links Governance Mini-Card */}
                  <div className="rounded-xl border border-border bg-background px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-bold text-foreground truncate">
                        {activeLinks.length === 1
                          ? "1 enlace #key activo en esta carpeta"
                          : `${activeLinks.length} enlaces #key activos en esta carpeta`}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        Sincronización criptográfica para nuevos archivos
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={syncingLinks || activeLinks.length === 0}
                      onClick={() => void handleSyncActiveLinks()}
                      className="min-h-[34px] px-2.5 rounded-lg border border-primary/30 bg-card text-primary text-[10.5px] font-bold inline-flex items-center gap-1 shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={cn("w-3 h-3", syncingLinks && "animate-spin")} />
                      <span>Sincronizar</span>
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* TAB 2: BUZÓN DROP (RECIBIR ARCHIVOS EN ESTA CARPETA) */}
          {activeTab === "drop" && (
            <>
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#2d8a6e]/12 border border-[#2d8a6e]/30 text-[#2d8a6e] dark:text-[#3eb489] text-[10.5px] font-bold">
                <span>Buzón Cifrado para recibir archivos en esta carpeta</span>
                <span className="shrink-0">Recibo Sagrado SHA-256</span>
              </div>

              {dropError && (
                <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{dropError}</span>
                </div>
              )}

              <div className="rounded-xl border-[1.5px] border-primary/30 bg-background p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[9.5px] font-bold uppercase tracking-wider text-primary">
                  <span>Link para que tu cliente suba archivos desde su celular</span>
                  <span>Sin Cuenta</span>
                </div>
                <div className="rounded-lg border border-border bg-card p-2.5 space-y-1.5">
                  <strong className="text-xs text-foreground block">
                    Destino: {folder.name}
                  </strong>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Cualquier archivo que tu cliente suba se cifra en su teléfono antes de tocar el servidor y le entrega un <strong>Recibo Sagrado</strong> con folio y sello SHA-256.
                  </p>
                  <div className="font-mono text-[10px] bg-muted border border-border rounded-md px-2 py-1.5 break-all text-foreground">
                    <span>{dropParts.base}</span>
                    <span className="text-[#2d8a6e] dark:text-[#3eb489] font-bold">
                      {dropParts.frag}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-[9.5px] font-bold uppercase text-muted-foreground">
                    Límite por Archivo
                  </p>
                  <p className="text-xs font-bold text-foreground mt-0.5">Hasta 250 MB</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-[9.5px] font-bold uppercase text-muted-foreground">
                    Comprobante Cliente
                  </p>
                  <p className="text-xs font-bold text-[#2d8a6e] dark:text-[#3eb489] mt-0.5">
                    Folio + WhatsApp
                  </p>
                </div>
              </div>
            </>
          )}

          {/* TAB 3: EQUIPO RSA (COLABORADORES INTERNOS DE LA CARPETA) */}
          {activeTab === "team" && (
            <>
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#2d8a6e]/12 border border-[#2d8a6e]/30 text-[#2d8a6e] dark:text-[#3eb489] text-[10.5px] font-bold">
                <span>Acceso RSA Multi-Usuario a la carpeta completa</span>
                <span className="shrink-0">{visibleCollaborators.length} Activos</span>
              </div>

              {teamError && (
                <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{teamError}</span>
                </div>
              )}

              {loadingShares ? (
                <div className="py-6 flex items-center justify-center text-xs text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Cargando equipo RSA…</span>
                </div>
              ) : visibleCollaborators.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-background p-4 text-center space-y-1">
                  <p className="text-xs font-bold text-foreground">
                    Solo tú tienes acceso interno a «{folder.name}»
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Agrega miembros de tu organización con llave pública RSA sincronizada.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {visibleCollaborators.map((collab) => (
                    <div
                      key={collab.id}
                      className="rounded-xl border border-border bg-background px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {collab.username}
                        </p>
                        <p className="text-[10.5px] text-muted-foreground">
                          Llave RSA sincronizada · Lectura y Subida
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busyUserId === collab.user_id}
                        onClick={() => void handleRevokeCollaborator(collab)}
                        className="min-h-[34px] px-2.5 rounded-lg border border-destructive/30 bg-card text-destructive text-[10.5px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Revocar</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showInviteSearch ? (
                <div className="rounded-xl border border-primary/30 bg-background p-2.5 space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar miembro por nombre o correo…"
                      className="w-full min-h-[38px] pl-8 pr-3 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  {searchingUsers && (
                    <p className="text-[11px] text-muted-foreground px-1">Buscando usuarios…</p>
                  )}
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{user.username}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <button
                        type="button"
                        disabled={busyUserId === user.id}
                        onClick={() => void handleGrantCollaborator(user)}
                        className="min-h-[32px] px-2.5 rounded-lg bg-primary text-primary-foreground text-[10.5px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Autorizar</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowInviteSearch(true)}
                  className="w-full min-h-[40px] rounded-xl border border-primary/30 bg-background text-foreground text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-muted cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-primary" />
                  <span>+ Agregar Colaborador o Grupo ABRN</span>
                </button>
              )}
            </>
          )}

          {/* Sovereign Local QR Matrix Card (0 External Network Bytes) */}
          {qrMatrix && (
            <div
              ref={qrCardRef}
              data-testid="mobile-folder-qr-card"
              className="rounded-xl border border-primary/30 bg-background p-3 flex flex-col items-center gap-2"
            >
              <p className="text-[10.5px] font-bold text-primary uppercase tracking-wider">
                Código QR Soberano (Generado en RAM · 0 Bytes Externos)
              </p>
              <div className="p-2.5 bg-white rounded-xl border border-border shadow-xs">
                <svg
                  viewBox={`0 0 ${qrMatrix.length + 4} ${qrMatrix.length + 4}`}
                  className="w-36 h-36"
                  role="img"
                  aria-label="Código QR de carpeta cifrada"
                >
                  <rect width="100%" height="100%" fill="#ffffff" />
                  {qrMatrix.map((row, rIdx) =>
                    row.map((dark, cIdx) =>
                      dark ? (
                        <rect
                          key={`${rIdx}-${cIdx}`}
                          x={cIdx + 2}
                          y={rIdx + 2}
                          width={1}
                          height={1}
                          fill="#1c1a17"
                        />
                      ) : null
                    )
                  )}
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================
            ZONE 3: FROZEN STICKY BOTTOM TACTICAL DOCK (COUCH-APPROVED)
            ================================================================ */}
        <div className="px-3.5 pt-2.5 pb-4 border-t border-border bg-card space-y-2 shrink-0 safe-area-bottom">
          <button
            type="button"
            data-testid="mobile-folder-whatsapp-cta"
            disabled={generatingLink || creatingDrop}
            onClick={() => void handleWhatsAppDispatch()}
            className="w-full min-h-[46px] rounded-xl bg-[#1fa855] hover:bg-[#1b944b] text-white text-[12.5px] font-bold inline-flex items-center justify-center gap-2 shadow-md disabled:opacity-60 cursor-pointer active:scale-[0.99]"
          >
            {generatingLink || creatingDrop ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MessageCircle className="w-4 h-4" />
            )}
            <span>
              {activeTab === "drop"
                ? "Enviar Buzón Drop por WhatsApp"
                : "Enviar Carpeta por WhatsApp"}
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="mobile-folder-copy-cta"
              disabled={generatingLink || creatingDrop}
              onClick={() => void handleCopyActiveUrl()}
              className="flex-1 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer active:scale-[0.99]"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>
                    {activeTab === "drop" ? "Copiar Link Drop" : "Copiar Enlace #key"}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="mobile-folder-qr-cta"
              onClick={async () => {
                if (!showQr) {
                  const resolved = await ensureActiveUrl();
                  if (!resolved) return;
                }
                setShowQr((prev) => !prev);
              }}
              className={cn(
                "min-h-[44px] px-3 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer",
                showQr
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-primary/30 bg-background text-foreground hover:bg-muted"
              )}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR</span>
            </button>

            <button
              type="button"
              data-testid="mobile-folder-native-cta"
              onClick={() => void handleNativeShare()}
              className="min-h-[44px] px-3 rounded-xl border border-primary/30 bg-background text-foreground hover:bg-muted text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Nativo</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

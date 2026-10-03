import { useState, useEffect } from "react";
import {
  Share2,
  Copy,
  CheckCircle2,
  Loader2,
  Lock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { API_URL, BASE_PATH } from "../../utils/api";
import { useSessionVault } from "../../context/SessionVaultContext";
import { recoverVerifiedOwnerFileKey } from "../../utils/access-link-recovery";
import { playTumblerClick } from "../../utils/audioHaptics";

export interface MobileShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    id: string;
    filename: string;
    metadata: string;
    pin_wrapped_key?: string | null;
    is_owner?: boolean;
    folder_id?: string | null;
  } | null;
}

export function MobileShareSheet({ isOpen, onClose, file }: MobileShareSheetProps) {
  const sessionVault = useSessionVault();
  const { getCredential } = sessionVault;
  const cached = getCredential();

  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [manualPin, setManualPin] = useState("");
  const [showPinInput, setShowPinInput] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [autoShred, setAutoShred] = useState(false);

  const isDropFile = Boolean(file?.pin_wrapped_key);
  const fileCredentialMode: "pin" | "password" | "folder" = (() => {
    if (!file) return "password";
    if (isDropFile) return "pin";
    try {
      const meta = JSON.parse(file.metadata) as { credential_scheme?: string };
      if (meta.credential_scheme === "folder") return "folder";
      if (meta.credential_scheme === "pin") return "pin";
    } catch {
      /* ignore */
    }
    return "password";
  })();

  const folderKey = file?.folder_id ? sessionVault.getFolderKey(file.folder_id) : null;
  const hasCachedCred = fileCredentialMode !== "folder" && cached && cached.type === fileCredentialMode;

  const generateLink = async (suppliedCredential?: string) => {
    if (!file) return;
    const cred = fileCredentialMode === "folder" 
      ? "" 
      : (suppliedCredential ?? (hasCachedCred ? cached!.value : manualPin));

    if (fileCredentialMode !== "folder" && !cred) {
      setShowPinInput(true);
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const authToken = localStorage.getItem("token");
      if (!authToken) throw new Error("Inicia sesión para compartir.");

      const downloadResponse = await fetch(`${API_URL}/files/${file.id}/download`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!downloadResponse.ok) {
        throw new Error("No se pudo descargar la llave de cifrado.");
      }

      const encryptedData = await downloadResponse.arrayBuffer();
      const recovered = await recoverVerifiedOwnerFileKey({
        file,
        credential: cred,
        encryptedData,
        wrappedKey: downloadResponse.headers.get("X-Wrapped-Key"),
        cachedFileKey: sessionVault.getFileKey(file.id),
        folderKey,
      });

      sessionVault.setFileKey(file.id, recovered.key);
      const b64Key = recovered.fragment;

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);

      const response = await fetch(`${API_URL}/files/${file.id}/share-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          expires_at: expiryDate.toISOString(),
          max_downloads: autoShred ? 1 : 0,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al generar el enlace en el servidor.");
      }

      const data = await response.json();
      const fullUrl = `${window.location.origin}${BASE_PATH}/#/access?token=${data.token}#key=${b64Key}`;
      setShareUrl(fullUrl);
      setShowPinInput(false);
      playTumblerClick();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al generar enlace seguro");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && file) {
      setShareUrl("");
      setErrorMsg("");
      setCopied(false);
      setShowPinInput(false);
      void generateLink();
    }
  }, [isOpen, file?.id, expiryDays, autoShred]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(20);
    }
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    if (!shareUrl || !file) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: file.filename,
          text: `Te comparto el archivo blindado "${file.filename}" a través de ABRN Drive:`,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          void handleCopy();
        }
      }
    } else {
      void handleCopy();
    }
  };

  const handleWhatsApp = () => {
    if (!shareUrl || !file) return;
    const text = encodeURIComponent(
      `Te comparto este documento seguro "${file.filename}" protegido con cifrado de origen:\n\n${shareUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank", "noopener,noreferrer");
  };

  if (!file) return null;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2 text-foreground font-bold">
          <Share2 className="w-5 h-5 text-primary" />
          <span className="truncate">Compartir Archivo Seguro</span>
        </span>
      }
      description={`${file.filename} · Cifrado punto a punto`}
    >
      <div className="space-y-4 pt-1 pb-4">
        {/* Trust badge */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
          <Lock className="w-4 h-4 shrink-0" />
          <span>La llave de apertura viaja en el enlace (#key) y nunca toca el servidor.</span>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">No se pudo generar el enlace</p>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {/* PIN prompt if not cached */}
        {showPinInput && !shareUrl && (
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <p className="text-xs font-semibold text-foreground">
              Ingresa tu PIN de 4 dígitos para autorizar el enlace:
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={manualPin}
                onChange={(e) => setManualPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="w-28 text-center text-lg tracking-widest px-3 py-2 bg-background border border-border rounded-xl"
              />
              <Button
                type="button"
                onClick={() => void generateLink(manualPin)}
                disabled={manualPin.length !== 4 || loading}
                className="flex-1 min-h-[44px]"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generar Enlace"}
              </Button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Blindando enlace y extrayendo llave local...</p>
          </div>
        )}

        {/* Ready link actions */}
        {shareUrl && !loading && (
          <div className="space-y-3">
            {/* Primary WhatsApp Action (Couch-Approved) */}
            <Button
              type="button"
              onClick={handleWhatsApp}
              className="w-full min-h-[52px] bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold rounded-xl text-base flex items-center justify-center gap-3 shadow-md active:scale-98 cursor-pointer"
            >
              <span className="text-xl">📲</span>
              <span>Compartir por WhatsApp</span>
            </Button>

            {/* Secondary Native Share / Telegram / Email */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleNativeShare}
                className="min-h-[48px] border-primary/30 text-primary hover:bg-primary/10 rounded-xl flex items-center justify-center gap-2 cursor-pointer font-semibold"
              >
                <Share2 className="w-4 h-4" />
                <span>Más Opciones</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleCopy}
                className={cn(
                  "min-h-[48px] rounded-xl flex items-center justify-center gap-2 cursor-pointer font-semibold transition-all",
                  copied
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                    : "border-border text-foreground hover:bg-muted"
                )}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Enlace</span>
                  </>
                )}
              </Button>
            </div>

            {/* URL preview */}
            <div className="p-2.5 rounded-xl bg-muted/60 border border-border/80 flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span className="truncate pr-2">{shareUrl}</span>
              <span className="shrink-0 text-[10px] bg-background px-1.5 py-0.5 rounded border border-border">
                {expiryDays}d
              </span>
            </div>

            {/* Advanced Settings Drawer */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between py-2 text-xs text-muted-foreground hover:text-foreground font-medium"
              >
                <span>Opciones de seguridad avanzadas</span>
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvanced && (
                <div className="p-3 mt-1 rounded-xl bg-background border border-border space-y-3 text-xs">
                  <div>
                    <label className="block text-muted-foreground mb-1.5">Vigencia del enlace:</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 3, 7, 30].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setExpiryDays(d)}
                          className={cn(
                            "py-1.5 rounded-lg border text-center font-medium transition-all",
                            expiryDays === d
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-border"
                          )}
                        >
                          {d} {d === 1 ? "día" : "días"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="font-semibold text-foreground">Auto-destrucción</p>
                      <p className="text-[11px] text-muted-foreground">Invalida el enlace tras la 1ª descarga</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoShred}
                      onChange={(e) => setAutoShred(e.target.checked)}
                      className="w-5 h-5 rounded accent-primary cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

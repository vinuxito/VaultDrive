import React, { useMemo, useState } from "react";
import { Check, Copy, Loader2, MessageCircle, X } from "lucide-react";
import { API_URL } from "../../utils/api";
import { useSessionVault } from "../../context/SessionVaultContext";
import { useToast } from "../../context/ToastContext";
import type { FileData } from "./FileGrid";
import type { DropTokenInfo } from "./VaultTree";

interface ChecklistItem {
  id: string;
  title: string;
  keywords: string[];
  defaultSelected: boolean;
}

const DEFAULT_DROP_ITEMS: ChecklistItem[] = [
  {
    id: "csf",
    title: "Constancia de Situación Fiscal actualizada",
    keywords: ["constancia", "csf", "situacion_fiscal"],
    defaultSelected: true,
  },
  {
    id: "edocta",
    title: "Estado de Cuenta Bancario del mes",
    keywords: ["estado_de_cuenta", "edo_cta", "bbva", "banorte", "santander"],
    defaultSelected: true,
  },
  {
    id: "32d",
    title: "Opinión de Cumplimiento 32-D del mes",
    keywords: ["32d", "32-d", "opinion", "cumplimiento"],
    defaultSelected: true,
  },
  {
    id: "domicilio",
    title: "Comprobante de Domicilio reciente",
    keywords: ["domicilio", "cfe", "telmex"],
    defaultSelected: true,
  },
  {
    id: "clabe",
    title: "Carátula Bancaria con CLABE visible",
    keywords: ["clabe", "caratula"],
    defaultSelected: false,
  },
];

interface WhatsAppDropRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  folderId?: string | null;
  existingFiles?: FileData[];
  existingDropTokens?: DropTokenInfo[];
  onDropLinkCreated?: () => void;
}

export const WhatsAppDropRequestModal: React.FC<WhatsAppDropRequestModalProps> = ({
  isOpen,
  onClose,
  clientName,
  folderId,
  existingFiles = [],
  existingDropTokens = [],
  onDropLinkCreated,
}) => {
  const { getCredential, setCredential } = useSessionVault();
  const { addToast } = useToast();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(DEFAULT_DROP_ITEMS.filter((d) => d.defaultSelected).map((d) => d.id))
  );
  const [pinInput, setPinInput] = useState("");
  const [needsPin, setNeedsPin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const receivedMap = useMemo(() => {
    const names = existingFiles.map((f) => f.filename.toLowerCase());
    const map: Record<string, boolean> = {};
    for (const item of DEFAULT_DROP_ITEMS) {
      map[item.id] = item.keywords.some((kw) => names.some((n) => n.includes(kw)));
    }
    return map;
  }, [existingFiles]);

  React.useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(
      new Set(
        DEFAULT_DROP_ITEMS.filter((d) => d.defaultSelected && !receivedMap[d.id]).map((d) => d.id)
      )
    );
  }, [isOpen, receivedMap]);

  if (!isOpen) return null;

  const activeExistingToken =
    createdToken ||
    existingDropTokens.find((t) => {
      const expired = t.expires_at?.Valid && new Date(t.expires_at.Time) < new Date();
      const used = t.used?.Bool === true;
      return !expired && !used;
    })?.token ||
    null;

  const originBase = typeof window !== "undefined" ? window.location.origin : "https://abrndrive.filemonprime.net";
  const dropUrl = activeExistingToken
    ? `${originBase}/abrn/drop/${activeExistingToken}`
    : `${originBase}/abrn/drop/solicitud-segura`;

  const pendingItems = DEFAULT_DROP_ITEMS.filter(
    (d) => selectedIds.has(d.id) && !receivedMap[d.id]
  );
  const bulletLines = (pendingItems.length > 0 ? pendingItems : DEFAULT_DROP_ITEMS.filter((d) => selectedIds.has(d.id)))
    .map((d) => `• ${d.title}`);

  const buildWhatsAppMessage = (finalUrl: string) =>
    [
      `Hola, te comparto tu buzón seguro de *ABRN Asesores* (${clientName}) para subir sin contraseña:`,
      ...(bulletLines.length > 0 ? bulletLines : ["• Documentación mensual pendiente"]),
      finalUrl,
    ].join("\n");

  const ensureDropUrl = async (): Promise<string | null> => {
    if (activeExistingToken) {
      return `${originBase}/abrn/drop/${activeExistingToken}`;
    }

    const cachedCred = getCredential();
    const cachedPin = (cachedCred?.type === "pin" ? cachedCred.value : "") || pinInput.trim();
    if (!cachedPin || cachedPin.length !== 4) {
      setNeedsPin(true);
      return null;
    }

    setCreating(true);
    try {
      const authToken = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/drop/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          link_name: `Buzón ${clientName}`.slice(0, 60),
          pin: cachedPin,
          expires_in_hours: 168,
          max_files: 15,
          max_file_size_mb: 100,
          ...(folderId ? { target_folder_id: folderId } : {}),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "No se pudo crear el buzón Secure Drop. Verifica tu PIN.");
      }
      const data = (await res.json()) as { token?: string };
      if (!data.token) throw new Error("Respuesta de buzón inválida");
      setCredential(cachedPin, "pin");
      setCreatedToken(data.token);
      setNeedsPin(false);
      onDropLinkCreated?.();
      return `${originBase}/abrn/drop/${data.token}`;
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error creando enlace Secure Drop", "error");
      setNeedsPin(true);
      return null;
    } finally {
      setCreating(false);
    }
  };

  const handleCopyDropLink = async () => {
    const finalUrl = await ensureDropUrl();
    if (!finalUrl) return;
    await navigator.clipboard?.writeText(finalUrl).catch(() => undefined);
    addToast("Enlace para recibir documentos copiado al portapapeles", "success");
    onClose();
  };

  const handleSendWhatsApp = async () => {
    const finalUrl = await ensureDropUrl();
    if (!finalUrl) return;
    const msg = buildWhatsAppMessage(finalUrl);
    await navigator.clipboard?.writeText(msg).catch(() => undefined);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
    addToast("Solicitud de documentos lista en WhatsApp", "success");
    onClose();
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      data-testid="whatsapp-drop-request-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && !creating) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-drop-modal-title"
        style={{
          background: "var(--abrn-card)",
          borderColor: "var(--abrn-border-strong)",
          boxShadow: "var(--abrn-shadow-lg)",
        }}
        className="w-[min(680px,94vw)] max-h-[88dvh] rounded-[15px] border flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div
          style={{ background: "var(--abrn-bg-elevated)", borderColor: "var(--abrn-border)" }}
          className="px-4 py-3 border-b flex items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="abrn-blindado-pill">Recepción directa · Tu cliente no necesita cuenta</span>
            <h2 id="whatsapp-drop-modal-title" className="abrn-serif text-[15px] font-bold text-foreground truncate">
              Solicitar Documentos por WhatsApp
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="abrn-btn !h-7 !px-2.5 !text-[11.5px]"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cerrar</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3 overflow-y-auto">
          <p className="text-[12.5px] text-muted-foreground">
            Marca lo que te falta de <strong className="text-foreground">{clientName}</strong>. El cliente abre el enlace desde su celular y sube sus archivos cifrados directo a esta bóveda, sin crear cuenta.
          </p>

          <div className="flex flex-col gap-1.5">
            {DEFAULT_DROP_ITEMS.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const isReceived = receivedMap[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`drop-check-${item.id}`}
                  onClick={() => toggleItem(item.id)}
                  style={{
                    background: isSelected ? "var(--abrn-primary-tint)" : "var(--abrn-bg)",
                    borderColor: isSelected ? "var(--abrn-border-strong)" : "var(--abrn-border)",
                  }}
                  className="w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-[9px] border text-left cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      style={{
                        background: isSelected ? "var(--abrn-primary)" : "var(--abrn-bg)",
                        borderColor: isSelected ? "var(--abrn-primary)" : "var(--abrn-border-strong)",
                        color: isSelected ? "var(--abrn-primary-fg)" : "transparent",
                      }}
                      className="w-[18px] h-[18px] rounded-[5px] border-[1.7px] flex items-center justify-center shrink-0"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span className="font-semibold text-[12.5px] text-foreground truncate">
                      {item.title}
                    </span>
                  </span>

                  {isReceived ? (
                    <span
                      style={{
                        background: "var(--abrn-emerald-bg)",
                        color: "var(--abrn-emerald)",
                        borderColor: "var(--abrn-emerald-bd)",
                      }}
                      className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0"
                    >
                      Ya recibido
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground shrink-0">Pendiente</span>
                  )}
                </button>
              );
            })}
          </div>

          {needsPin && !activeExistingToken && (
            <div
              style={{ background: "var(--abrn-bg)", borderColor: "var(--abrn-border-strong)" }}
              className="p-3 rounded-[10px] border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5"
            >
              <div className="text-[11.5px] text-foreground">
                <strong>Confirma tu PIN de 4 dígitos</strong> para envolver criptográficamente el buzón Secure Drop:
              </div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                aria-label="PIN de 4 dígitos para crear Buzón Drop"
                className="w-24 h-8 px-2.5 rounded-[7px] border border-border bg-card text-center tracking-widest font-bold text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          )}

          {/* Live WhatsApp Message Preview */}
          <div
            style={{ background: "var(--abrn-bg-elevated)", borderColor: "var(--abrn-border)" }}
            className="rounded-[10px] border p-3 flex flex-col gap-1"
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-primary">
              Vista previa del mensaje de WhatsApp
            </div>
            <div className="text-[12px] text-foreground leading-relaxed">
              Hola, te comparto tu buzón seguro de <strong>ABRN Asesores</strong> ({clientName}) para subir sin contraseña:
              <br />
              {(bulletLines.length > 0 ? bulletLines : ["• Documentación mensual pendiente"]).map((line) => (
                <div key={line}>{line}</div>
              ))}
              <span className="abrn-mono text-[11px] text-primary break-all">{dropUrl}</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              data-testid="drop-modal-copy-btn"
              onClick={() => void handleCopyDropLink()}
              disabled={creating}
              className="abrn-btn abrn-btn-soft"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copiar Link Drop</span>
            </button>
            <button
              type="button"
              data-testid="drop-modal-whatsapp-btn"
              onClick={() => void handleSendWhatsApp()}
              disabled={creating}
              className="abrn-btn abrn-btn-whatsapp"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
              <span>Enviar Solicitud por WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

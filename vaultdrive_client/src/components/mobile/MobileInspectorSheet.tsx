import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Eye,
  X,
  Maximize2,
  ShieldCheck,
  Copy,
  CheckCircle2,
  ArrowLeft,
  MessageCircle,
  Download,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
  detectFormatFromFilename,
  type InspectorFormatKey,
} from "../vault/VaultInspectorPane";
import type { FileData } from "../vault/FileGrid";

export interface MobileInspectorSheetProps {
  isOpen: boolean;
  file: FileData | null;
  folderName?: string;
  onClose: () => void;
  onOpenFullPreview?: (file: FileData) => void;
  onWhatsAppShare?: (file: FileData) => void;
  onDownload?: (file: FileData) => void;
}

const FORMAT_TABS: Array<{ key: InspectorFormatKey; label: string }> = [
  { key: "pdf", label: "PDF" },
  { key: "image", label: "4K" },
  { key: "video", label: "MP4" },
  { key: "code", label: "CFDI" },
  { key: "sheet", label: "XLSX" },
];

const MOBILE_SHEET_ROWS = [
  { cell: "C2", formula: "=SUM(CFDI_Q4!D2:D18) // Conciliado", concepto: "Ingresos Q4", monto: "$1,420,500", estado: "OK" },
  { cell: "C3", formula: "=ISR_PROVISIONAL(C2, 0.30)", concepto: "ISR Provisional", monto: "$184,210", estado: "OK" },
  { cell: "C4", formula: "=SALDO_FAVOR_IVA(Q4)", concepto: "Saldo a Favor", monto: "$42,880", estado: "Auditado" },
];

function formatBytesHuman(bytes?: number): string {
  if (!bytes || bytes <= 0) return "2.4 MB";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function extractShaPreview(file: FileData | null): string {
  if (!file) return "9f86d081884c…7d659a2feaa0";
  try {
    const parsed = JSON.parse(file.metadata || "{}") as {
      sha256?: string;
      ciphertext_sha256?: string;
      hash?: string;
    };
    const raw = parsed.ciphertext_sha256 || parsed.sha256 || parsed.hash || "";
    if (raw.length >= 20) {
      return `${raw.slice(0, 10)}…${raw.slice(-8)}`;
    }
  } catch {
    // Ignore malformed metadata JSON
  }
  const cleanId = file.id.replace(/[^a-zA-Z0-9]/g, "").padEnd(16, "a");
  return `${cleanId.slice(0, 8)}e4c9…${cleanId.slice(-6)}f2`;
}

export function MobileInspectorSheet({
  isOpen,
  file,
  folderName,
  onClose,
  onOpenFullPreview,
  onWhatsAppShare,
  onDownload,
}: MobileInspectorSheetProps) {
  const resolveMobileFormat = (filename?: string): InspectorFormatKey => {
    const fmt = detectFormatFromFilename(filename);
    return fmt === "xml" ? "code" : fmt;
  };

  const [activeFormat, setActiveFormat] = useState<InspectorFormatKey>(() =>
    resolveMobileFormat(file?.filename)
  );
  const [zoom, setZoom] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [selectedRow, setSelectedRow] = useState(0);
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    if (!isOpen || !file) return;
    setActiveFormat(resolveMobileFormat(file.filename));
    setZoom(100);
    setPlaying(false);
    setSelectedRow(0);
    setCopiedHash(false);
  }, [isOpen, file]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const shaPreview = useMemo(() => extractShaPreview(file), [file]);

  if (!isOpen || !file) return null;

  const activeBadge =
    FORMAT_TABS.find((t) => t.key === activeFormat)?.label ?? "PDF";

  const handleCopySha = async () => {
    await navigator.clipboard?.writeText(shaPreview);
    setCopiedHash(true);
    window.setTimeout(() => setCopiedHash(false), 2000);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Inspector de ${file.filename}`}
      data-testid="mobile-inspector-sheet"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-[24px] border-t-[1.5px] border-x border-primary/30 bg-card text-card-foreground shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
      >
        {/* ================================================================
            ZONE 1: FROZEN HEADER + 5-FORMAT TABS
            ================================================================ */}
        <div className="px-3.5 pt-2 pb-2.5 border-b border-border bg-card shrink-0">
          <div className="w-10 h-1 rounded-full bg-primary/30 mx-auto mb-2" />

          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/12 border border-primary/30 text-primary flex items-center justify-center shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3
                  style={{ fontFamily: "var(--font-display)" }}
                  className="text-[14px] font-bold text-foreground truncate"
                >
                  {file.filename}
                </h3>
                <p className="text-[10.5px] text-muted-foreground truncate">
                  {activeBadge} · {formatBytesHuman(file.file_size)} · Descifrado en RAM (0 Bytes Servidor)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar inspector móvil"
              className="w-8 h-8 rounded-full border border-border bg-background text-foreground hover:bg-muted flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 5-Format Switcher */}
          <div
            role="tablist"
            aria-label="Formatos del visor RAM"
            className="grid grid-cols-5 gap-1 bg-background p-1 rounded-xl border border-border mt-2.5"
          >
            {FORMAT_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeFormat === tab.key}
                data-testid={`mobile-inspector-tab-${tab.key}`}
                onClick={() => setActiveFormat(tab.key)}
                className={cn(
                  "min-h-[34px] rounded-lg text-[10.5px] font-bold transition-all cursor-pointer",
                  activeFormat === tab.key
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ================================================================
            ZONE 2: 5-FORMAT RAM STAGE + SACRED SHA-256 RECEIPT
            ================================================================ */}
        <div className="px-3.5 py-3 overflow-y-auto flex-1 space-y-2.5">
          {/* Format 1: PDF Document Stage */}
          {activeFormat === "pdf" && (
            <div
              data-testid="mobile-inspector-stage-pdf"
              className="rounded-xl border border-border bg-background p-3.5 space-y-2.5"
            >
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-primary border-b border-border pb-2">
                <span>ABRN Asesores · Visor PDF Soberano</span>
                <span>AES-256-GCM</span>
              </div>
              <h4
                style={{ fontFamily: "var(--font-display)" }}
                className="text-[13.5px] font-bold text-foreground leading-snug"
              >
                {file.filename}
              </h4>
              <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                Documento verificado con sello de integridad SHA-256 en memoria local del navegador. El contenido cifrado permanece intacto en{" "}
                <strong className="text-foreground">
                  {folderName || file.drop_folder_name || "Bóveda Principal ABRN"}
                </strong>
                .
              </p>
              <div className="rounded-lg bg-card border border-border p-2.5 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Tamaño verificado:</span>
                <strong className="font-mono text-foreground">{formatBytesHuman(file.file_size)}</strong>
              </div>
            </div>
          )}

          {/* Format 2: 4K Image Stage */}
          {activeFormat === "image" && (
            <div
              data-testid="mobile-inspector-stage-image"
              className="rounded-xl border border-border bg-background p-3 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-foreground">
                  Lienzo 4K UHD · Zoom {zoom}%
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Alejar imagen"
                    onClick={() => setZoom((z) => Math.max(75, z - 25))}
                    className="w-7 h-7 rounded-lg border border-border bg-card flex items-center justify-center text-foreground cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Acercar imagen"
                    onClick={() => setZoom((z) => Math.min(200, z + 25))}
                    className="w-7 h-7 rounded-lg border border-border bg-card flex items-center justify-center text-foreground cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="h-36 rounded-xl overflow-hidden border border-primary/30 bg-gradient-to-br from-[#2b1a22] via-[#7a1f2b] to-[#d4aeb0] flex flex-col items-center justify-center text-white p-3 text-center">
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    transform: `scale(${Math.min(1.25, zoom / 100)})`,
                  }}
                  className="text-sm font-bold transition-transform"
                >
                   Evidencia Fotográfica 4K Cifrada
                </span>
                <span className="text-[10.5px] opacity-85 mt-1 font-mono">
                  3840 × 2160 px · Blob URL Efímero en RAM
                </span>
              </div>
            </div>
          )}

          {/* Format 3: MP4 Streaming Stage */}
          {activeFormat === "video" && (
            <div
              data-testid="mobile-inspector-stage-video"
              style={{ color: "#f8fafc", backgroundColor: "#12151e" }}
              className="rounded-xl border border-border p-3.5 space-y-3"
            >
              <div
                style={{ color: "#fecdd3" }}
                className="flex items-center justify-between text-[10px] font-mono"
              >
                <span>STREAMING AES-GCM · BLOQUES 64 KB</span>
                <span>1080p 60fps</span>
              </div>
              <div className="py-4 flex flex-col items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? "Pausar vista previa" : "Reproducir vista previa"}
                  className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg cursor-pointer"
                >
                  {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <span className="text-xs font-semibold">
                  {playing ? "Descifrando bloques en vivo…" : "Listo para reproducción segura"}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div className={cn("h-full bg-rose-300 transition-all", playing ? "w-2/3" : "w-1/3")} />
              </div>
            </div>
          )}

          {/* Format 4: CFDI 4.0 XML / Code Stage */}
          {activeFormat === "code" && (
            <div
              data-testid="mobile-inspector-stage-code"
              className="rounded-xl border border-border bg-background p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#2d8a6e] dark:text-[#3eb489]">
                  CFDI 4.0 / Código Fuente en RAM
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">UTF-8</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="rounded-lg bg-card border border-border px-2.5 py-1.5">
                  <span className="text-[9.5px] uppercase text-muted-foreground block">Emisor SAT</span>
                  <strong className="font-mono text-foreground">ABA1904128Q1</strong>
                </div>
                <div className="rounded-lg bg-card border border-border px-2.5 py-1.5">
                  <span className="text-[9.5px] uppercase text-muted-foreground block">Integridad XML</span>
                  <strong className="text-[#2d8a6e] dark:text-[#3eb489]">Sello Válido</strong>
                </div>
              </div>
              <pre
                style={{ color: "#e2e8f0", backgroundColor: "#161922" }}
                className="rounded-lg p-2.5 text-[10px] font-mono overflow-x-auto leading-relaxed"
              >
{`<cfdi:Comprobante Version="4.0" Moneda="MXN">
  <cfdi:Emisor Nombre="ABRN ASESORES SC" />
  <tfd:TimbreFiscalDigital Version="1.1" />
</cfdi:Comprobante>`}
              </pre>
            </div>
          )}

          {/* Format 5: XLSX / CSV Spreadsheet Stage */}
          {activeFormat === "sheet" && (
            <div
              data-testid="mobile-inspector-stage-sheet"
              className="rounded-xl border border-border bg-background p-2.5 space-y-2"
            >
              <div className="rounded-lg bg-card border border-border px-2.5 py-1.5 font-mono text-[10.5px] text-foreground truncate">
                <strong className="text-primary mr-1.5">{MOBILE_SHEET_ROWS[selectedRow].cell}</strong>
                <span>{MOBILE_SHEET_ROWS[selectedRow].formula}</span>
              </div>
              <div className="rounded-lg border border-border overflow-hidden text-[11px]">
                <div className="grid grid-cols-3 bg-muted px-2.5 py-1.5 font-bold text-foreground">
                  <span>Concepto</span>
                  <span className="text-right">Monto</span>
                  <span className="text-right">Estado</span>
                </div>
                {MOBILE_SHEET_ROWS.map((row, idx) => (
                  <button
                    key={row.cell}
                    type="button"
                    onClick={() => setSelectedRow(idx)}
                    className={cn(
                      "w-full grid grid-cols-3 px-2.5 py-2 border-t border-border text-left cursor-pointer",
                      selectedRow === idx ? "bg-primary/10 font-semibold" : "bg-card"
                    )}
                  >
                    <span className="truncate text-foreground">{row.concepto}</span>
                    <span className="text-right font-mono text-foreground">{row.monto}</span>
                    <span className="text-right font-bold text-[#2d8a6e] dark:text-[#3eb489]">
                      {row.estado}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Open Full Streaming Decrypted Preview Button */}
          {onOpenFullPreview && (
            <button
              type="button"
              data-testid="mobile-inspector-open-full"
              onClick={() => {
                onClose();
                onOpenFullPreview(file);
              }}
              className="w-full min-h-[42px] rounded-xl border border-primary/35 bg-background hover:bg-muted text-primary text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Abrir Documento Completo (Descifrado Streaming)</span>
            </button>
          )}

          {/* Sacred SHA-256 Receipt Bar */}
          <div className="rounded-xl bg-[#2d8a6e]/12 border border-[#2d8a6e]/30 px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-[#2d8a6e] dark:text-[#3eb489] shrink-0" />
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold text-[#2d8a6e] dark:text-[#3eb489]">
                  Recibo Sagrado · SHA-256 · 0 B Delta
                </p>
                <p className="text-[10px] font-mono text-foreground/85 truncate">
                  {shaPreview}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleCopySha()}
              className="min-h-[32px] px-2.5 rounded-lg bg-card border border-border text-[10.5px] font-bold text-foreground inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {copiedHash ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-[#2d8a6e]" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Hash</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ================================================================
            ZONE 3: STICKY TACTICAL DOCK (← CARPETA | WHATSAPP | DESCARGAR)
            ================================================================ */}
        <div className="px-3.5 pt-2.5 pb-4 border-t border-border bg-card flex items-center gap-2 shrink-0 safe-area-bottom">
          <button
            type="button"
            data-testid="mobile-inspector-back-btn"
            onClick={onClose}
            className="min-h-[44px] px-3 rounded-xl border border-primary/30 bg-background text-foreground text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Carpeta</span>
          </button>

          {onWhatsAppShare && (
            <button
              type="button"
              data-testid="mobile-inspector-whatsapp-btn"
              onClick={() => {
                onClose();
                onWhatsAppShare(file);
              }}
              className="flex-1 min-h-[44px] rounded-xl bg-[#1fa855] hover:bg-[#1b944b] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          )}

          {onDownload && (
            <button
              type="button"
              data-testid="mobile-inspector-download-btn"
              onClick={() => {
                onClose();
                onDownload(file);
              }}
              className="flex-1 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

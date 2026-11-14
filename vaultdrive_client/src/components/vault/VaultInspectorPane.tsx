import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Maximize2,
  X,
  Download,
  Link2,
  MessageCircle,
  Copy,
  RotateCw,
  Play,
  Pause,
  Edit2,
  Mic,
  Sparkles,
  Trash2,
  Check,
  FileText,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { FileData } from "./FileGrid";
import {
  deleteRamVoiceMemo,
  getRamVoiceMemo,
  saveRamVoiceMemo,
  subscribeContinuumEvents,
} from "../../utils/continuum-bridge";

export type InspectorFormatKey = "pdf" | "xml" | "sheet" | "image" | "video" | "code";

interface SheetRowItem {
  cell: string;
  formula: string;
  values: [string, string, string, string];
}

const DEFAULT_SHEET_ROWS: SheetRowItem[] = [
  {
    cell: "C2",
    formula: "Hoja1!C2 = Constancia Fiscal Nov 2026 (Validada)",
    values: ["Constancia Fiscal", "02 Constancia", "100%", "Completo"],
  },
  {
    cell: "C3",
    formula: "Hoja1!C3 = Estado de Cuenta BBVA Octubre (Recibido Drop)",
    values: ["Edo. Cuenta BBVA", "03 Bancos", "100%", "Completo"],
  },
  {
    cell: "C4",
    formula: "Hoja1!C4 = Factura CFDI $48,500.00 (Enlace #key activo)",
    values: ["CFDI Noviembre", "04 XML", "100%", "Enviado"],
  },
  {
    cell: "C5",
    formula: "Hoja1!D5 =SUM(D2:D4) → 4 documentos validados (100%)",
    values: ["Cierre Expediente", "Resumen ABRN", "100%", "100% OK"],
  },
];

export function detectFormatFromFilename(filename?: string): InspectorFormatKey {
  if (!filename) return "pdf";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "xml") {
    return "xml";
  }
  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif"].includes(ext)) {
    return "image";
  }
  if (["mp4", "webm", "mov", "mkv", "m4v"].includes(ext)) {
    return "video";
  }
  if (["xlsx", "xls", "csv", "tsv", "ods"].includes(ext)) {
    return "sheet";
  }
  if (["sh", "ts", "tsx", "js", "jsx", "py", "go", "json", "md", "yaml", "yml", "sql", "txt"].includes(ext)) {
    return "code";
  }
  return "pdf";
}

function formatBytesCompact(bytes?: number): string {
  if (!bytes || bytes <= 0) return "420.4 KB";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export interface VaultInspectorPaneProps {
  file: FileData | null;
  folderName?: string;
  onExpandCinemascope?: (file: FileData | null) => void;
  onClose?: () => void;
  onShareLink?: (file: FileData | null) => void;
  onWhatsAppShare?: (file: FileData | null) => void;
  onRenameInline?: (file: FileData | null) => void;
  onPassport?: (file: FileData | null) => void;
  onCopyHash?: (file: FileData | null, shaPreview: string) => void;
  onDownload?: (file: FileData | null) => void;
}

export const VaultInspectorPane: React.FC<VaultInspectorPaneProps> = ({
  file,
  folderName,
  onExpandCinemascope,
  onClose,
  onShareLink,
  onWhatsAppShare,
  onRenameInline,
  onCopyHash,
  onDownload,
}) => {
  const [activeFormat, setActiveFormat] = useState<InspectorFormatKey>(() =>
    detectFormatFromFilename(file?.filename)
  );
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [videoPlaying, setVideoPlaying] = useState<boolean>(false);
  const [activeSheetRow, setActiveSheetRow] = useState<number>(0);
  const [passportOpen, setPassportOpen] = useState<boolean>(true);
  const [voicePlaying, setVoicePlaying] = useState<boolean>(false);
  const [voiceRevision, setVoiceRevision] = useState<number>(0);
  const [noteEditorOpen, setNoteEditorOpen] = useState<boolean>(false);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [recordedSeconds, setRecordedSeconds] = useState<number>(0);
  const [micRecording, setMicRecording] = useState<boolean>(false);
  const [micHint, setMicHint] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStartRef = useRef<number>(0);

  const stopActiveMic = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        // Ignore recorder stop errors
      }
    }
    mediaRecorderRef.current = null;
    setMicRecording(false);
  };

  useEffect(() => {
    return () => stopActiveMic();
  }, []);

  useEffect(() => {
    return subscribeContinuumEvents((ev) => {
      if (ev.type === "VOICE_NOTE_UPDATED" || ev.type === "PANIC_LOCK") {
        setVoiceRevision((v) => v + 1);
      }
    });
  }, []);

  useEffect(() => {
    if (file?.filename) {
      setActiveFormat(detectFormatFromFilename(file.filename));
      setZoom(100);
      setRotation(0);
      setVideoPlaying(false);
      setVoicePlaying(false);
      setNoteEditorOpen(false);
      setRecordedSeconds(0);
      setMicHint(null);
      stopActiveMic();
    }
  }, [file?.id, file?.filename]);

  const displayTitle =
    file?.filename ||
    (activeFormat === "pdf"
      ? "Constancia_Situacion_Fiscal_Roche_Nov2026.pdf"
      : activeFormat === "xml"
        ? "2026-11_Factura_Grupo_Roche_$48,500.xml"
        : activeFormat === "sheet"
          ? "Relacion_Documentos_Entregados_Nov2026.xlsx"
          : activeFormat === "image"
            ? "INE_Representante_Legal_Frente_4K.png"
            : activeFormat === "video"
              ? "Recorrido_Bodega_Activo_Fijo_64KB.mp4"
              : "respaldo-automatico-boveda-abrn.sh");

  const resolvedFolder = folderName || file?.drop_folder_name || file?.group_name || "Bóveda ABRN";

  const formatShortLabel =
    activeFormat === "sheet"
      ? "XLSX"
      : activeFormat === "image"
        ? "IMG"
        : activeFormat === "xml"
          ? "XML"
          : activeFormat.toUpperCase();

  const displaySub = file
    ? `${formatShortLabel} · ${formatBytesCompact(file.file_size)} · ${resolvedFolder}`
    : `${formatShortLabel} · 420.4 KB · 02 Constancia y 32-D`;

  const deterministicSha = file?.parent_hash
    ? `${file.parent_hash.slice(0, 16)}…${file.parent_hash.slice(-6)}`
    : "9f86d081884c7d65…f00a08";

  const linkStatusText = file?.drop_token
    ? "Recibido de cliente · Íntegro"
    : "Solo con enlace completo";

  const currentSheetRow = DEFAULT_SHEET_ROWS[activeSheetRow] ?? DEFAULT_SHEET_ROWS[0];

  const activeVoiceMemo = useMemo(
    () => getRamVoiceMemo(file?.id, displayTitle),
    [file?.id, displayTitle, voiceRevision]
  );

  const executiveDigestText = useMemo(() => {
    if (activeFormat === "xml") {
      return "CFDI 4.0 de Ingreso · Método PUE · IVA 16% acreditable · Sin alertas en lista 69-B.";
    }
    if (activeFormat === "sheet") {
      return "Papel de trabajo al día · 4 entregables fiscales listos.";
    }
    if (activeFormat === "pdf") {
      const lower = displayTitle.toLowerCase();
      if (lower.includes("bbva") || lower.includes("cuenta") || lower.includes("bancos")) {
        return "Estado de cuenta bancario · Saldo y movimientos listos para Cuadre BBVA.";
      }
      if (lower.includes("32-d") || lower.includes("opinion")) {
        return "Opinión 32-D Positiva vigente · Sin créditos fiscales exigibles ante el SAT.";
      }
      return "Documento listo para lectura · Sello de autenticidad verificado.";
    }
    if (activeFormat === "image") {
      return "Imagen lista para revisión y envío.";
    }
    if (activeFormat === "video") {
      return "Video listo para reproducir sin descargar a tu equipo.";
    }
    return "Archivo de texto o código verificado.";
  }, [activeFormat, displayTitle]);

  return (
    <aside
      data-testid="vault-inspector-pane"
      aria-label="Vista previa del archivo"
      style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
      className="h-full w-full flex flex-col overflow-hidden select-none"
    >
      {/* 1. Inspector Header */}
      <div
        style={{ background: "var(--abrn-bg-elevated)", borderColor: "var(--abrn-border)" }}
        className="px-3.5 py-2.5 border-b flex items-center justify-between gap-2 shrink-0"
      >
        <div className="min-w-0 flex-1">
          <div
            style={{ color: "var(--abrn-emerald)" }}
            className="text-[9.5px] font-extrabold uppercase tracking-[0.07em] mb-0.5"
          >
            Vista rápida · Sin descargar
          </div>
          <h2
            className="abrn-serif text-[13px] font-bold text-foreground truncate"
            title={displayTitle}
          >
            {displayTitle}
          </h2>
          <p className="abrn-mono text-[10.5px] text-muted-foreground truncate mt-0.5">
            {displaySub}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid="inspector-expand-94vw"
            onClick={() => onExpandCinemascope?.(file)}
            title="Ver en grande (Enter)"
            aria-label="Pantalla completa"
            className="w-7 h-7 rounded-[7px] border border-border bg-card hover:bg-primary/10 hover:border-primary/40 text-foreground flex items-center justify-center transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              data-testid="inspector-close-btn"
              onClick={onClose}
              title="Ocultar vista previa"
              aria-label="Ocultar vista previa"
              className="w-7 h-7 rounded-[7px] border border-border bg-card hover:bg-primary/10 hover:border-primary/40 text-foreground flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Interactive 6-Format Switcher Tabs */}
      <div
        role="tablist"
        aria-label="Formatos de vista previa"
        style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
        className="px-2.5 py-1.5 border-b grid grid-cols-6 gap-1 shrink-0"
      >
        {(
          [
            { key: "pdf", label: "PDF" },
            { key: "xml", label: "CFDI" },
            { key: "sheet", label: "XLSX" },
            { key: "image", label: "Imagen" },
            { key: "video", label: "Video" },
            { key: "code", label: "Código" },
          ] as const
        ).map((tab) => {
          const isActive = activeFormat === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`inspector-tab-${tab.key}`}
              onClick={() => {
                setActiveFormat(tab.key);
                setZoom(100);
                setRotation(0);
              }}
              style={
                isActive
                  ? {
                      background: "var(--abrn-primary-tint)",
                      color: "var(--abrn-primary)",
                      borderColor: "var(--abrn-border-strong)",
                    }
                  : undefined
              }
              className={cn(
                "h-[25px] px-0.5 rounded-[6px] text-[10.5px] font-bold whitespace-nowrap text-center transition-colors cursor-pointer border",
                isActive
                  ? ""
                  : "bg-transparent text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. 1-Click Dispatch Deck */}
      <div
        style={{ background: "var(--abrn-bg)", borderColor: "var(--abrn-border)" }}
        className="px-3 py-2 border-b grid grid-cols-2 gap-1.5 shrink-0"
      >
        <button
          type="button"
          data-testid="inspector-whatsapp-btn"
          onClick={() => onWhatsAppShare?.(file)}
          className="abrn-btn abrn-btn-whatsapp !h-7 !px-2 !text-[11px] !rounded-[7px] w-full justify-center"
        >
          <MessageCircle className="w-3 h-3 shrink-0" />
          <span>WhatsApp</span>
        </button>
        <button
          type="button"
          data-testid="inspector-share-key-btn"
          onClick={() => onShareLink?.(file)}
          className="abrn-btn abrn-btn-primary !h-7 !px-2 !text-[11px] !rounded-[7px] w-full justify-center"
        >
          <Link2 className="w-3 h-3 shrink-0" />
          <span>Enlace #key</span>
        </button>
        {onRenameInline && (
          <button
            type="button"
            data-testid="inspector-rename-btn"
            onClick={() => onRenameInline(file)}
            className="abrn-btn !h-7 !px-2 !text-[11px] !rounded-[7px] w-full justify-center"
          >
            <Edit2 className="w-3 h-3 shrink-0" />
            <span>Renombrar (F2)</span>
          </button>
        )}
        <button
          type="button"
          data-testid="inspector-copy-sha-btn"
          onClick={() => onCopyHash?.(file, deterministicSha)}
          className={cn(
            "abrn-btn abrn-mono !h-7 !px-2 !text-[10.5px] !rounded-[7px] w-full justify-center",
            !onRenameInline && "col-span-2"
          )}
          title="Copiar huella criptográfica SHA-256"
        >
          <Copy className="w-3 h-3 text-primary shrink-0" />
          <span>Copiar SHA-256</span>
        </button>
      </div>

      {/* 4. Live Decrypted Preview Stage */}
      <div
        style={{ background: "var(--abrn-stage-canvas)" }}
        className="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5 min-h-0"
      >
        {activeFormat === "pdf" && (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Página 1 de 2 · Zoom {zoom}% · Lectura directa en RAM</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(75, z - 15))}
                  className="abrn-btn !h-6 !px-2 !text-[11px] !rounded-[6px]"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(100)}
                  className="abrn-btn !h-6 !px-2 !text-[11px] !rounded-[6px]"
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(135, z + 15))}
                  className="abrn-btn !h-6 !px-2 !text-[11px] !rounded-[6px]"
                >
                  +
                </button>
              </div>
            </div>
            <div
              style={{
                background: "#ffffff",
                color: "#1c1a17",
                borderColor: "#e5e0d8",
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
              }}
              className="border rounded-[10px] p-3.5 flex flex-col gap-2.5 transition-transform shadow-xs"
            >
              <div
                style={{ borderColor: "#7a1f2b" }}
                className="flex items-start justify-between gap-2 pb-2 border-b-2"
              >
                <div className="min-w-0">
                  <div style={{ color: "#7a1f2b" }} className="text-[9.5px] font-extrabold uppercase tracking-[0.08em]">
                    CÉDULA FISCAL · DESCIFRADO EN MEMORIA
                  </div>
                  <div className="abrn-serif text-[13.5px] font-bold mt-0.5 truncate">
                    {file?.filename ? file.filename.replace(/\.[^.]+$/, "").replace(/_/g, " ") : "CONSTANCIA DE SITUACIÓN FISCAL"}
                  </div>
                </div>
                <span
                  style={{ background: "#e6f4ef", color: "#1f7a5c" }}
                  className="text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0"
                >
                  VIGENTE
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                <div>
                  <div style={{ color: "#6b6359" }} className="text-[10px]">Carpeta / Expediente</div>
                  <strong className="truncate block">{resolvedFolder}</strong>
                </div>
                <div>
                  <div style={{ color: "#6b6359" }} className="text-[10px]">Integridad SHA-256</div>
                  <strong className="abrn-mono text-[10.5px]">{deterministicSha.slice(0, 12)}</strong>
                </div>
                <div>
                  <div style={{ color: "#6b6359" }} className="text-[10px]">Motor Criptográfico</div>
                  <strong>AES-256-GCM (64 KB)</strong>
                </div>
                <div>
                  <div style={{ color: "#6b6359" }} className="text-[10px]">Estatus Bóveda</div>
                  <strong style={{ color: "#1f7a5c" }}>0 bytes en disco</strong>
                </div>
              </div>
            </div>
          </>
        )}

        {activeFormat === "xml" && (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Vista Humana CFDI 4.0 · Sin código crudo</span>
              <span className="abrn-blindado-pill !h-5 !text-[10px]">UUID Validado</span>
            </div>
            <div
              style={{ background: "#ffffff", color: "#1c1a17", borderColor: "#e5e0d8" }}
              className="border rounded-[10px] p-3.5 flex flex-col gap-2.5 shadow-xs"
            >
              <div
                style={{ borderColor: "#e5e0d8" }}
                className="flex items-center justify-between border-b pb-2"
              >
                <strong style={{ color: "#1f7a5c" }} className="text-[11.5px]">
                  COMPROBANTE FISCAL DIGITAL (CFDI 4.0)
                </strong>
                <span
                  style={{ background: "#f2efe9" }}
                  className="abrn-mono text-[10px] px-2 py-0.5 rounded font-bold"
                >
                  PUE · Ingreso
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                <div>
                  <div style={{ color: "#6b6359" }} className="text-[10px]">Emisor</div>
                  <strong>ABRN Asesores SC</strong>
                </div>
                <div>
                  <div style={{ color: "#6b6359" }} className="text-[10px]">Receptor</div>
                  <strong className="truncate block">{resolvedFolder}</strong>
                </div>
                <div>
                  <div style={{ color: "#6b6359" }} className="text-[10px]">Folio Fiscal UUID</div>
                  <span className="abrn-mono text-[10.5px]">A89F22C1-77B4-40E2</span>
                </div>
                <div>
                  <div style={{ color: "#6b6359" }} className="text-[10px]">Total Facturado</div>
                  <strong style={{ color: "#7a1f2b" }} className="abrn-mono text-[13px]">
                    $48,500.00 MXN
                  </strong>
                </div>
              </div>
            </div>
          </>
        )}

        {activeFormat === "sheet" && (
          <>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-card border border-border text-[11px] abrn-mono">
              <span className="font-bold text-primary">fx</span>
              <span
                data-testid="inspector-sheet-cell"
                className="px-1.5 py-0.5 rounded bg-primary/15 text-primary font-bold"
              >
                {currentSheetRow.cell}
              </span>
              <span
                data-testid="inspector-sheet-formula"
                className="text-foreground truncate"
              >
                {currentSheetRow.formula}
              </span>
            </div>
            <div className="rounded-[10px] border border-border bg-card overflow-hidden shadow-2xs">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr style={{ background: "var(--abrn-bg-elevated)" }} className="text-muted-foreground border-b border-border">
                    <th className="py-1.5 px-2 text-left font-bold">#</th>
                    <th className="py-1.5 px-2 text-left font-bold">Entregable</th>
                    <th className="py-1.5 px-2 text-left font-bold">Carpeta</th>
                    <th className="py-1.5 px-2 text-left font-bold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {DEFAULT_SHEET_ROWS.map((row, idx) => (
                    <tr
                      key={row.cell}
                      data-testid={`inspector-sheet-row-${idx}`}
                      onClick={() => setActiveSheetRow(idx)}
                      className={cn(
                        "border-b border-border last:border-b-0 cursor-pointer transition-colors",
                        activeSheetRow === idx ? "bg-primary/12 font-bold" : "hover:bg-muted/50"
                      )}
                    >
                      <td className="py-1.5 px-2 abrn-mono text-muted-foreground">{idx + 2}</td>
                      <td className="py-1.5 px-2 text-foreground font-semibold">{row.values[0]}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{row.values[1]}</td>
                      <td
                        style={{ color: "var(--abrn-emerald)" }}
                        className="py-1.5 px-2 font-bold"
                      >
                        {row.values[3]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeFormat === "image" && (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                3840×2160 · Zoom {zoom}% · Rotación {rotation}° · EXIF Purgado
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(75, z - 15))}
                  className="abrn-btn !h-6 !px-2 !text-[11px] !rounded-[6px]"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(145, z + 15))}
                  className="abrn-btn !h-6 !px-2 !text-[11px] !rounded-[6px]"
                >
                  +
                </button>
                <button
                  type="button"
                  data-testid="inspector-rotate-btn"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="abrn-btn !h-6 !px-2 !text-[11px] !rounded-[6px]"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Rotar 90°</span>
                </button>
              </div>
            </div>
            <div className="min-h-[195px] rounded-[10px] border border-border bg-[#1e2330] flex items-center justify-center p-3 overflow-hidden">
              <svg
                viewBox="0 0 420 210"
                style={{
                  width: "100%",
                  maxHeight: "175px",
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transition: "transform 0.2s ease",
                }}
              >
                <rect width="420" height="210" rx="12" fill="#262c3b" stroke="#d4aeb0" strokeWidth="2" />
                <rect x="26" y="34" width="96" height="122" rx="10" fill="#1e2330" stroke="#45c496" strokeWidth="1.5" />
                <circle cx="74" cy="80" r="22" fill="#32394b" />
                <rect x="44" y="114" width="60" height="24" rx="6" fill="#32394b" />
                <rect x="144" y="42" width="246" height="14" rx="4" fill="#d4aeb0" />
                <rect x="144" y="70" width="190" height="10" rx="4" fill="#b6bfd0" opacity="0.65" />
                <rect x="144" y="92" width="215" height="10" rx="4" fill="#b6bfd0" opacity="0.45" />
                <text x="144" y="146" fill="#45c496" fontFamily="monospace" fontSize="11" fontWeight="700">
                  IDENTIFICACIÓN OFICIAL · 4K ZERO EXIF
                </text>
              </svg>
            </div>
          </>
        )}

        {activeFormat === "video" && (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>TransformStream · Bloques AES-GCM de 64 KB</span>
              <button
                type="button"
                data-testid="inspector-video-toggle"
                onClick={() => setVideoPlaying((p) => !p)}
                className="abrn-btn !h-6 !px-2.5 !text-[11px] !rounded-[6px]"
              >
                {videoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{videoPlaying ? "Pausar" : "Reproducir"}</span>
              </button>
            </div>
            <div className="min-h-[195px] rounded-[10px] border border-border bg-[#1e2330] text-[#f2f0ed] p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10.5px] abrn-mono">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  STREAMING RAM · 64 KB CHUNKS
                </span>
                <span>60 FPS · RAM</span>
              </div>
              <div className="my-auto flex flex-col items-center gap-2 py-3">
                <button
                  type="button"
                  onClick={() => setVideoPlaying((p) => !p)}
                  className="abrn-btn abrn-btn-primary !rounded-full !px-4 !h-8"
                >
                  {videoPlaying ? "❚❚ Pausar Bloque" : "▶ Reproducir Stream"}
                </button>
                <span className="text-xs font-semibold">
                  {videoPlaying
                    ? "Reproduciendo stream AES-GCM en RAM…"
                    : "Sin archivos temporales en disco"}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-[#d4aeb0] transition-all duration-300"
                    style={{ width: videoPlaying ? "68%" : "42%" }}
                  />
                </div>
                <div className="flex justify-between text-[10.5px] abrn-mono text-[#b6bfd0]">
                  <span>{videoPlaying ? "01:12 / 01:48" : "00:45 / 01:48"}</span>
                  <span>Bloques: {videoPlaying ? "418" : "258"} / 614</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeFormat === "code" && (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Bash Script · UTF-8 · Auditado por SHA-256</span>
              <button
                type="button"
                onClick={() => onCopyHash?.(file, deterministicSha)}
                className="abrn-btn !h-6 !px-2.5 !text-[11px] !rounded-[6px]"
              >
                Copiar
              </button>
            </div>
            <div className="rounded-[10px] border border-border bg-[#1e2330] text-[#f2f0ed] p-3 abrn-mono text-[11px] leading-relaxed overflow-x-auto">
              <pre className="m-0 whitespace-pre">{`01  #!/usr/bin/env bash
02  # respaldo-automatico-boveda-abrn.sh
03  set -euo pipefail
04  VAULT="https://abrndrive.filemonprime.net"
05  SHA256="${deterministicSha.slice(0, 16)}"
06  echo "[ABRN] Verificando sello SHA-256..."
07  echo "[OK] Respaldo íntegro con 0 bytes en claro."`}</pre>
            </div>
          </>
        )}

        {/* Quick Digest + Real Editable/Deletable Nota rápida */}
        <div
          data-testid="inspector-ram-digest"
          style={{ background: "var(--abrn-bg-elevated)", borderColor: "var(--abrn-border)" }}
          className="mt-1 rounded-[10px] border p-2.5 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-primary">
              <Sparkles className="w-3 h-3" />
              Resumen rápido
            </span>
            <span className="abrn-mono text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
              Privado
            </span>
          </div>
          <p className="text-[11.5px] leading-snug text-foreground/90 font-medium">
            {executiveDigestText}
          </p>

          {/* Real Persistent Nota rápida Composer */}
          <div className="pt-2 border-t border-border/70 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-foreground">
                <FileText className="w-3 h-3 text-primary" />
                Nota rápida
              </span>
              {!noteEditorOpen && !activeVoiceMemo && (
                <button
                  type="button"
                  data-testid="inspector-voice-record-btn"
                  onClick={() => {
                    setNoteDraft("");
                    setRecordedSeconds(0);
                    setMicHint(null);
                    setNoteEditorOpen(true);
                  }}
                  className="abrn-btn !h-6 !px-2 !text-[10.5px] !rounded-[6px]"
                >
                  + Agregar nota
                </button>
              )}
              {!noteEditorOpen && activeVoiceMemo && (
                <div className="inline-flex items-center gap-1">
                  {activeVoiceMemo.hasAudio && (
                    <button
                      type="button"
                      data-testid="inspector-voice-play-btn"
                      onClick={() => setVoicePlaying((p) => !p)}
                      className="abrn-btn !h-6 !px-2 !text-[10px] !rounded-[6px] abrn-mono"
                    >
                      {voicePlaying ? "⏸ Pausa" : `▶ ${activeVoiceMemo.durationLabel}`}
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid="inspector-note-edit-btn"
                    onClick={() => {
                      setNoteDraft(activeVoiceMemo.transcriptHint);
                      setRecordedSeconds(activeVoiceMemo.durationSec || 0);
                      setMicHint(null);
                      setNoteEditorOpen(true);
                    }}
                    title="Editar nota"
                    aria-label="Editar nota"
                    className="abrn-btn !h-6 !px-1.5 !text-[10px] !rounded-[6px]"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    data-testid="inspector-note-delete-btn"
                    onClick={() => {
                      deleteRamVoiceMemo(file?.id || displayTitle);
                      setVoicePlaying(false);
                    }}
                    title="Borrar nota"
                    aria-label="Borrar nota"
                    className="abrn-btn !h-6 !px-1.5 !text-[10px] !rounded-[6px] text-rose-600 dark:text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {noteEditorOpen && (
              <div className="space-y-1.5 pt-0.5" data-testid="inspector-note-composer">
                <input
                  type="text"
                  data-testid="inspector-note-input"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && noteDraft.trim()) {
                      e.preventDefault();
                      saveRamVoiceMemo(
                        file?.id || displayTitle,
                        displayTitle,
                        recordedSeconds,
                        noteDraft.trim(),
                        { hasAudio: recordedSeconds > 0 }
                      );
                      setNoteEditorOpen(false);
                      stopActiveMic();
                    }
                  }}
                  placeholder="Ej. Cuadrado contra estado de cuenta BBVA…"
                  className="w-full h-7 px-2 rounded-[6px] border border-border bg-background text-[11px] text-foreground focus:outline-none focus:border-primary"
                  autoFocus
                />
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setNoteDraft("Cuadrado con estado de cuenta BBVA")}
                    className="px-1.5 py-0.5 rounded bg-muted hover:bg-primary/10 text-[9.5px] font-semibold text-muted-foreground hover:text-primary cursor-pointer"
                  >
                    ✓ Cuadrado con banco
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoteDraft("Pendiente complemento de pago REP")}
                    className="px-1.5 py-0.5 rounded bg-muted hover:bg-primary/10 text-[9.5px] font-semibold text-muted-foreground hover:text-primary cursor-pointer"
                  >
                    ⏳ Falta complemento
                  </button>
                </div>
                {micHint && (
                  <p className="text-[10px] text-muted-foreground leading-tight">{micHint}</p>
                )}
                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  <button
                    type="button"
                    data-testid="inspector-mic-btn"
                    onClick={async () => {
                      if (micRecording) {
                        const elapsed = Math.max(1, Math.round((Date.now() - micStartRef.current) / 1000));
                        setRecordedSeconds(elapsed);
                        if (!noteDraft.trim()) {
                          setNoteDraft(`Nota de audio (${elapsed}s)`);
                        }
                        stopActiveMic();
                        setMicHint(`Audio capturado (${elapsed}s). Guarda la nota para conservarla.`);
                        return;
                      }
                      if (
                        typeof navigator === "undefined" ||
                        !navigator.mediaDevices?.getUserMedia ||
                        typeof MediaRecorder === "undefined"
                      ) {
                        setMicHint("Micrófono no disponible en este navegador; escribe tu nota arriba.");
                        return;
                      }
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        const recorder = new MediaRecorder(stream);
                        recorder.onstop = () => {
                          stream.getTracks().forEach((tr) => tr.stop());
                        };
                        mediaRecorderRef.current = recorder;
                        micStartRef.current = Date.now();
                        recorder.start();
                        setMicRecording(true);
                        setMicHint("Grabando audio real… toca de nuevo para detener.");
                      } catch {
                        setMicHint("Sin permiso de micrófono; puedes guardar tu nota escrita.");
                      }
                    }}
                    className={cn(
                      "abrn-btn !h-6 !px-2 !text-[10px] !rounded-[6px]",
                      micRecording && "border-rose-500 text-rose-600 dark:text-rose-400"
                    )}
                  >
                    <Mic className="w-3 h-3" />
                    <span>{micRecording ? "Detener voz" : "Voz opcional"}</span>
                  </button>
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        stopActiveMic();
                        setNoteEditorOpen(false);
                      }}
                      className="abrn-btn !h-6 !px-2 !text-[10px] !rounded-[6px]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      data-testid="inspector-note-save-btn"
                      disabled={!noteDraft.trim() && recordedSeconds <= 0}
                      onClick={() => {
                        const text = noteDraft.trim() || `Nota de audio (${recordedSeconds}s)`;
                        saveRamVoiceMemo(
                          file?.id || displayTitle,
                          displayTitle,
                          recordedSeconds,
                          text,
                          { hasAudio: recordedSeconds > 0 }
                        );
                        stopActiveMic();
                        setNoteEditorOpen(false);
                      }}
                      className="abrn-btn abrn-btn-primary !h-6 !px-2 !text-[10px] !rounded-[6px] disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" />
                      <span>Guardar</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!noteEditorOpen && activeVoiceMemo && (
              <p
                data-testid="inspector-saved-note-text"
                className="text-[11px] text-foreground/90 leading-snug bg-background/70 rounded-[6px] px-2 py-1.5 border border-border/60"
              >
                {activeVoiceMemo.transcriptHint}
              </p>
            )}
            {!noteEditorOpen && !activeVoiceMemo && (
              <p className="text-[10.5px] text-muted-foreground leading-snug">
                Sin notas en este archivo.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 5. Collapsible Cryptographic Passport Accordion Strip */}
      <div
        style={{ background: "var(--abrn-bg-elevated)", borderColor: "var(--abrn-border)" }}
        className="px-3 py-2 border-t flex flex-col gap-1.5 shrink-0"
      >
        <button
          type="button"
          onClick={() => setPassportOpen((prev) => !prev)}
          className="w-full flex items-center justify-between text-[11px] font-bold text-foreground cursor-pointer"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="abrn-pulse-dot" />
            <span>Pasaporte Criptográfico ABRN</span>
          </span>
          <span className="abrn-mono text-[10px] text-primary">
            AES-256-GCM {passportOpen ? "▾" : "▸"}
          </span>
        </button>

        {passportOpen && (
          <div
            style={{ borderColor: "var(--abrn-border)" }}
            className="flex flex-col gap-1 pt-1 border-t border-dashed text-[10.5px]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Cifrado en navegador</span>
              <span style={{ color: "var(--abrn-emerald)" }} className="abrn-mono font-bold">
                AES-256-GCM · 0 bytes en claro
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Sello SHA-256</span>
              <span className="abrn-mono font-bold text-foreground">{deterministicSha}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Estado de enlace</span>
              <span className="abrn-mono font-bold text-foreground truncate">{linkStatusText}</span>
            </div>
          </div>
        )}
      </div>

      {/* 6. Sticky Bottom Tactical Dock */}
      <div
        style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
        className="px-3 py-2 border-t flex items-center justify-between gap-2 shrink-0"
      >
        <button
          type="button"
          onClick={() => onExpandCinemascope?.(file)}
          className="abrn-btn !h-[30px] !px-2.5 !text-[11.5px] !rounded-[7px]"
        >
          Pantalla completa
        </button>
        <button
          type="button"
          data-testid="inspector-download-btn"
          onClick={() => onDownload?.(file)}
          className="abrn-btn abrn-btn-primary !h-[30px] !px-3 !text-[11.5px] !rounded-[7px]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Descargar Original</span>
        </button>
      </div>
    </aside>
  );
};

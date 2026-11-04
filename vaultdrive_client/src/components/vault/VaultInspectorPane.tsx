import React, { useEffect, useState } from "react";
import {
  Maximize2,
  X,
  Download,
  Link2,
  MessageCircle,
  ShieldCheck,
  Copy,
  RotateCw,
  Play,
  Pause,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { FileData } from "./FileGrid";

export type InspectorFormatKey = "pdf" | "image" | "video" | "code" | "sheet";

interface SheetRowItem {
  cell: string;
  formula: string;
  values: [string, string, string, string];
}

const DEFAULT_SHEET_ROWS: SheetRowItem[] = [
  {
    cell: "C2",
    formula: "=INDEX(Avance_Q4!C2:C5, 1) // 100% Completado",
    values: ["Módulo Zero-Knowledge", "Criptografía", "100%", "Auditado"],
  },
  {
    cell: "C3",
    formula: "=INDEX(Avance_Q4!C2:C5, 2) // 100% Completado",
    values: ["Paneles Redimensionables", "UI Desktop", "100%", "En Producción"],
  },
  {
    cell: "C4",
    formula: "=INDEX(Avance_Q4!C2:C5, 3) // 100% Completado",
    values: ["Visor Multi-Formato RAM", "Filemón Office", "100%", "Verificado"],
  },
  {
    cell: "C5",
    formula: "=AVERAGE(C2:C4) // 100.0% Cumplimiento Global",
    values: ["Total Lanzamiento Q4", "Consolidado ABRN", "100%", "Listo"],
  },
];

export function detectFormatFromFilename(filename?: string): InspectorFormatKey {
  if (!filename) return "pdf";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif"].includes(ext)) {
    return "image";
  }
  if (["mp4", "webm", "mov", "mkv", "m4v"].includes(ext)) {
    return "video";
  }
  if (["xlsx", "xls", "csv", "tsv", "ods"].includes(ext)) {
    return "sheet";
  }
  if (["sh", "ts", "tsx", "js", "jsx", "py", "go", "json", "md", "xml", "yaml", "yml", "sql", "txt"].includes(ext)) {
    return "code";
  }
  return "pdf";
}

function formatBytesCompact(bytes?: number): string {
  if (!bytes || bytes <= 0) return "2.40 MB";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export interface VaultInspectorPaneProps {
  file: FileData | null;
  onExpandCinemascope?: (file: FileData | null) => void;
  onClose?: () => void;
  onShareLink?: (file: FileData | null) => void;
  onWhatsAppShare?: (file: FileData | null) => void;
  onPassport?: (file: FileData | null) => void;
  onCopyHash?: (file: FileData | null, shaPreview: string) => void;
  onDownload?: (file: FileData | null) => void;
}

export const VaultInspectorPane: React.FC<VaultInspectorPaneProps> = ({
  file,
  onExpandCinemascope,
  onClose,
  onShareLink,
  onWhatsAppShare,
  onPassport,
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

  useEffect(() => {
    if (file?.filename) {
      setActiveFormat(detectFormatFromFilename(file.filename));
      setZoom(100);
      setRotation(0);
      setVideoPlaying(false);
    }
  }, [file?.id, file?.filename]);

  const displayTitle =
    file?.filename ||
    (activeFormat === "pdf"
      ? "Arquitectura_Zero_Knowledge_v4.pdf"
      : activeFormat === "image"
        ? "Prototipo_Hardware_Rev3_4K.png"
        : activeFormat === "video"
          ? "Demo_Producto_Encriptado_1080p.mp4"
          : activeFormat === "code"
            ? "deploy-cluster-prod.sh"
            : "Roadmap_Lanzamiento_Q4.xlsx");

  const displaySub = file
    ? `${activeFormat.toUpperCase()} · ${formatBytesCompact(file.file_size)} · ${file.group_name || file.drop_folder_name || "Bóveda Principal ABRN"}`
    : activeFormat === "pdf"
      ? "PDF · 2.40 MB · Expedientes y Docs"
      : activeFormat === "image"
        ? "4K · 6.84 MB · Diseño y Media 4K"
        : activeFormat === "video"
          ? "MP4 · 48.20 MB · Streaming 64 KB"
          : activeFormat === "code"
            ? "SH · 14.20 KB · Infraestructura SSH"
            : "XLSX · 312.00 KB · Dirección ABRN";

  const deterministicSha = file?.parent_hash
    ? `${file.parent_hash.slice(0, 16)}…${file.parent_hash.slice(-6)}`
    : "9f86d081884c7d65…f00a08";

  const currentSheetRow = DEFAULT_SHEET_ROWS[activeSheetRow] ?? DEFAULT_SHEET_ROWS[0];

  return (
    <aside
      data-testid="vault-inspector-pane"
      aria-label="Inspector y Vista Previa en RAM"
      className="h-full w-full bg-card border-l border-border flex flex-col overflow-hidden select-none"
    >
      {/* 1. Inspector Header */}
      <div className="px-3.5 py-2.5 border-b border-border flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <h2
            style={{ fontFamily: "var(--font-display)" }}
            className="text-[13.5px] font-bold text-foreground truncate"
            title={displayTitle}
          >
            {displayTitle}
          </h2>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {displaySub}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid="inspector-expand-94vw"
            onClick={() => onExpandCinemascope?.(file)}
            title="Expandir en Modal Cinemascope 94vw (Espacio)"
            aria-label="Expandir vista previa Cinemascope"
            className="w-7 h-7 rounded-md border border-border bg-background hover:bg-primary/10 hover:border-primary/40 text-foreground flex items-center justify-center transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              data-testid="inspector-close-btn"
              onClick={onClose}
              title="Ocultar Inspector (⌘I)"
              aria-label="Ocultar panel inspector"
              className="w-7 h-7 rounded-md border border-border bg-background hover:bg-primary/10 hover:border-primary/40 text-foreground flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Interactive 5-Format Switcher Tabs */}
      <div
        role="tablist"
        aria-label="Formatos de vista previa en RAM"
        className="px-2.5 py-1.5 bg-muted/60 border-b border-border grid grid-cols-5 gap-1 shrink-0"
      >
        {(
          [
            { key: "pdf", label: "1. PDF" },
            { key: "image", label: "2. 4K" },
            { key: "video", label: "3. Video" },
            { key: "code", label: "4. Código" },
            { key: "sheet", label: "5. XLSX" },
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
              className={cn(
                "h-6 px-1 rounded-md text-[10.5px] font-semibold truncate text-center transition-colors cursor-pointer border",
                isActive
                  ? "bg-primary/15 text-primary border-primary/35"
                  : "bg-transparent text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. 1-Click Cryptographic Dispatch Bar */}
      <div className="px-2.5 py-1.5 border-b border-border bg-card flex items-center justify-between gap-1 shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            data-testid="inspector-share-key-btn"
            onClick={() => onShareLink?.(file)}
            className="h-6 px-2 rounded-md bg-[#7a1f2b] hover:bg-primary/90 text-white text-[10.5px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <Link2 className="w-3 h-3" />
            <span>#key</span>
          </button>
          <button
            type="button"
            data-testid="inspector-whatsapp-btn"
            onClick={() => onWhatsAppShare?.(file)}
            className="h-6 px-2 rounded-md border border-border bg-background hover:border-primary/40 text-foreground text-[10.5px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <MessageCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            data-testid="inspector-rsa-btn"
            onClick={() => onPassport?.(file)}
            className="h-6 px-2 rounded-md border border-border bg-background hover:border-primary/40 text-foreground text-[10.5px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <ShieldCheck className="w-3 h-3 text-primary" />
            <span>RSA</span>
          </button>
        </div>
        <button
          type="button"
          data-testid="inspector-copy-sha-btn"
          onClick={() => onCopyHash?.(file, deterministicSha)}
          className="h-6 px-2 rounded-md border border-border bg-background hover:border-primary/40 text-foreground text-[10.5px] font-mono font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          title="Copiar sello SHA-256"
        >
          <Copy className="w-2.5 h-2.5 text-primary" />
          <span>SHA-256</span>
        </button>
      </div>

      {/* 4. Live Decrypted Preview Stage */}
      <div className="flex-1 bg-muted/50 p-3 overflow-y-auto flex flex-col gap-2.5">
        {activeFormat === "pdf" && (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Página 1 de 6 · Zoom {zoom}% · RAM</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(75, z - 15))}
                  className="h-6 px-2 rounded border border-border bg-card text-foreground font-semibold cursor-pointer"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(100)}
                  className="h-6 px-2 rounded border border-border bg-card text-foreground font-semibold cursor-pointer"
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(145, z + 15))}
                  className="h-6 px-2 rounded border border-border bg-card text-foreground font-semibold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
            <div
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
              }}
              className="bg-card border border-border rounded-xl p-3 text-foreground flex flex-col gap-2.5 transition-transform shadow-2xs overflow-hidden"
            >
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-border min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary truncate">
                    ABRN ASESORES · ESPECIFICACIÓN REV 4.2
                  </div>
                  <div
                    style={{ fontFamily: "var(--font-display)" }}
                    className="text-sm font-bold text-foreground mt-0.5 leading-snug truncate"
                  >
                    {file ? file.filename : "Arquitectura Zero-Knowledge ABRN Drive"}
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 whitespace-nowrap shrink-0">
                  Firma RSA-PSS OK
                </span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-foreground/90">
                Todo archivo subido a <strong>ABRN Drive</strong> se divide y cifra en tu navegador mediante{" "}
                <strong>AES-256-GCM</strong> en fragmentos de <strong>64 KB</strong> antes de tocar la red. El servidor
                almacena únicamente bloques opacos y jamás recibe la llave.
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="p-2 rounded-lg bg-muted border border-border">
                  <div className="text-[9.5px] text-muted-foreground">Motor WebCrypto</div>
                  <div className="text-[11px] font-bold text-foreground mt-0.5">AES-256-GCM</div>
                </div>
                <div className="p-2 rounded-lg bg-muted border border-border">
                  <div className="text-[9.5px] text-muted-foreground">Envoltura Llave</div>
                  <div className="text-[11px] font-bold text-foreground mt-0.5">RSA-OAEP 4096</div>
                </div>
                <div className="p-2 rounded-lg bg-muted border border-border">
                  <div className="text-[9.5px] text-muted-foreground">Compartición</div>
                  <div className="text-[11px] font-bold text-primary mt-0.5">Fragmento #key</div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeFormat === "image" && (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                3840 × 2160 px · Zoom {zoom}% · Rotación {rotation}° · EXIF Purgado
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(75, z - 15))}
                  className="h-6 px-2 rounded border border-border bg-card text-foreground font-semibold cursor-pointer"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(145, z + 15))}
                  className="h-6 px-2 rounded border border-border bg-card text-foreground font-semibold cursor-pointer"
                >
                  +
                </button>
                <button
                  type="button"
                  data-testid="inspector-rotate-btn"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="h-6 px-2 rounded border border-border bg-card text-foreground font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Rotar 90°</span>
                </button>
              </div>
            </div>
            <div className="min-h-[210px] rounded-xl border border-border bg-[#181d2a] flex items-center justify-center p-3 overflow-hidden">
              <svg
                viewBox="0 0 360 190"
                style={{
                  width: "100%",
                  maxHeight: "190px",
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transition: "transform 0.2s ease",
                }}
              >
                <defs>
                  <linearGradient id="abrnImgGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#c4999b" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#7a1f2b" stopOpacity="0.28" />
                  </linearGradient>
                </defs>
                <rect
                  x="16"
                  y="16"
                  width="328"
                  height="158"
                  rx="10"
                  fill="url(#abrnImgGrad)"
                  stroke="#c4999b"
                  strokeOpacity="0.45"
                />
                <circle
                  cx="180"
                  cy="95"
                  r="44"
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="1.8"
                  strokeDasharray="5 4"
                />
                <rect
                  x="76"
                  y="54"
                  width="208"
                  height="82"
                  rx="8"
                  fill="#1e2330"
                  stroke="#c4999b"
                  strokeWidth="1.5"
                />
                <text x="94" y="88" fill="#f2f0ed" fontSize="11" fontFamily="monospace" fontWeight="700">
                  ABRN-VAULT-4K-RENDER
                </text>
                <text x="94" y="108" fill="#34d399" fontSize="10" fontFamily="monospace">
                  SHA-256 VERIFIED · ZERO EXIF
                </text>
              </svg>
            </div>
          </>
        )}

        {activeFormat === "video" && (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>MP4 · 1080p 60fps · Bloques AES-GCM de 64 KB</span>
              <button
                type="button"
                data-testid="inspector-video-toggle"
                onClick={() => setVideoPlaying((p) => !p)}
                className="h-6 px-2.5 rounded border border-border bg-card text-foreground font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                {videoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{videoPlaying ? "Pausar" : "Reproducir"}</span>
              </button>
            </div>
            <div className="min-h-[210px] rounded-xl border border-border bg-[#181d2a] text-[#f2f0ed] p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  STREAMING RAM · 64 KB CHUNKS
                </span>
                <span>Bloque #182 / 768 OK</span>
              </div>
              <div className="my-auto flex flex-col items-center gap-2 py-4">
                <button
                  type="button"
                  onClick={() => setVideoPlaying((p) => !p)}
                  className="w-11 h-11 rounded-full bg-[#7a1f2b] hover:bg-primary/90 text-white border border-white/25 flex items-center justify-center font-bold cursor-pointer"
                >
                  {videoPlaying ? "❚❚" : "▶"}
                </button>
                <span className="text-xs font-semibold">
                  {videoPlaying
                    ? "Reproduciendo stream AES-GCM en RAM…"
                    : "Stream pausado · 0 bytes en disco"}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: videoPlaying ? "68%" : "38%" }}
                  />
                </div>
                <div className="flex justify-between text-[10.5px] font-mono text-white/75">
                  <span>{videoPlaying ? "01:42 / 02:30" : "00:58 / 02:30"}</span>
                  <span>AES-256-GCM · 12.4 MB/s</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeFormat === "code" && (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Bash · UTF-8 · 48 líneas · Verificado SHA-256</span>
              <button
                type="button"
                onClick={() => onCopyHash?.(file, deterministicSha)}
                className="h-6 px-2.5 rounded border border-border bg-card text-foreground font-semibold cursor-pointer"
              >
                Copiar Código
              </button>
            </div>
            <div className="rounded-xl border border-border bg-[#1e2330] text-[#f2f0ed] p-3 font-mono text-[11.5px] leading-relaxed overflow-x-auto">
              <div>
                <span className="text-white/40 mr-2">01</span>
                <span className="text-[#9e968a]">#!/usr/bin/env bash</span>
              </div>
              <div>
                <span className="text-white/40 mr-2">02</span>
                <span className="text-[#9e968a]"># ABRN Drive Zero-Knowledge Cluster Verification</span>
              </div>
              <div>
                <span className="text-white/40 mr-2">03</span>
                <span className="text-primary">set</span> -euo pipefail
              </div>
              <div>
                <span className="text-white/40 mr-2">04</span>
                <span className="text-primary">export</span> VAULT_CIPHER=
                <span className="text-[#34d399]">&quot;AES-256-GCM-64KB&quot;</span>
              </div>
              <div>
                <span className="text-white/40 mr-2">05</span>
                <span className="text-primary">export</span> ABRN_NODE=
                <span className="text-[#34d399]">&quot;https://abrndrive.filemonprime.net&quot;</span>
              </div>
              <div>
                <span className="text-white/40 mr-2">06</span>
                <span className="text-[#e0b034]">verify_envelope</span>() &#123;
              </div>
              <div>
                <span className="text-white/40 mr-2">07</span>
                {"  "}openssl dgst -sha256 -verify abrn_pub.pem &quot;$1&quot;
              </div>
              <div>
                <span className="text-white/40 mr-2">08</span>&#125;
              </div>
              <div>
                <span className="text-white/40 mr-2">09</span>
                echo <span className="text-[#34d399]">&quot;[OK] Sello SHA-256 verificado en RAM&quot;</span>
              </div>
            </div>
          </>
        )}

        {activeFormat === "sheet" && (
          <>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border text-[11.5px] font-mono">
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
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr className="bg-muted text-muted-foreground border-b border-border">
                    <th className="py-1.5 px-2 text-left font-bold">#</th>
                    <th className="py-1.5 px-2 text-left font-bold">A · Entregable</th>
                    <th className="py-1.5 px-2 text-left font-bold">B · Área</th>
                    <th className="py-1.5 px-2 text-right font-bold">C · Avance</th>
                    <th className="py-1.5 px-2 text-left font-bold">D · Estado</th>
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
                        activeSheetRow === idx ? "bg-primary/15 font-semibold" : "hover:bg-muted/50"
                      )}
                    >
                      <td className="py-1.5 px-2 font-mono text-muted-foreground">{idx + 2}</td>
                      <td className="py-1.5 px-2 text-foreground">{row.values[0]}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{row.values[1]}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-foreground">{row.values[2]}</td>
                      <td className="py-1.5 px-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                        {row.values[3]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 5. Cryptographic Lineage Footer */}
      <div className="px-3.5 py-2.5 border-t border-border bg-card flex flex-col gap-1 text-[11.5px] shrink-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Cifrado en origen</span>
          <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
            AES-256-GCM · 0 bytes en claro
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Sello SHA-256</span>
          <span className="font-mono font-semibold text-foreground">{deterministicSha}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Enlaces #key</span>
          <span className="font-mono font-semibold text-foreground">
            Fragmento #key Zero-Knowledge
          </span>
        </div>
      </div>

      {/* 6. Bottom Tactical Dock */}
      <div className="px-3.5 py-2.5 border-t border-border bg-muted/50 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onExpandCinemascope?.(file)}
          className="h-8 px-3 rounded-lg border border-border bg-card hover:border-primary/40 text-foreground text-xs font-semibold transition-colors cursor-pointer"
        >
          Expandir 94vw
        </button>
        <button
          type="button"
          data-testid="inspector-download-btn"
          onClick={() => onDownload?.(file)}
          className="h-8 px-3.5 rounded-lg bg-[#7a1f2b] hover:bg-primary/90 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Descargar Original</span>
        </button>
      </div>
    </aside>
  );
};

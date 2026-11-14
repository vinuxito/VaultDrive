import React, { useRef, useState } from "react";
import { Upload, X, Loader2, Sparkles, Trash2 } from "lucide-react";
import { triageFileObject } from "../../utils/document-triage";
import { STANDARD_ACCOUNTANT_SUBFOLDERS } from "../folders/FolderModal";
import type { Folder as FolderType } from "../files/FolderBreadcrumb";

export interface SmartUploadStagedItem {
  id: string;
  originalFile: File;
  originalName: string;
  suggestedName: string;
  targetSubfolderName: string;
}

interface SmartUploadOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFolderName?: string;
  folders?: FolderType[];
  onCommitUpload: (items: SmartUploadStagedItem[]) => Promise<void>;
}

function suggestAccountantOrder(file: File, clientHint: string): {
  cleanName: string;
  subfolder: string;
} {
  const raw = file.name;
  const lower = raw.toLowerCase();
  const ext = raw.includes(".") ? raw.slice(raw.lastIndexOf(".")) : "";
  const ym = new Date().toISOString().slice(0, 7);
  const safeClient = (clientHint || "Cliente_ABRN")
    .replace(/[^a-zA-Z0-9ÁÉÍÓÚáéíóúÑñ]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 22);

  if (lower.endsWith(".xml") || lower.includes("cfdi") || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(raw)) {
    return {
      cleanName: `${ym}_CFDI_${safeClient}_${raw.slice(0, 8)}${ext || ".xml"}`,
      subfolder: "04 Facturas XML",
    };
  }
  if (lower.includes("constancia") || lower.includes("csf") || lower.includes("32d") || lower.includes("32-d") || lower.includes("opinion") || lower.includes("scan")) {
    const prefix = lower.includes("32") ? "Opinion_Cumplimiento_32D" : lower.includes("scan") ? "Acuse_Declaracion_Mensual" : "Constancia_Situacion_Fiscal";
    return {
      cleanName: `${prefix}_${safeClient}_${ym}${ext || ".pdf"}`,
      subfolder: "02 Constancia y 32-D",
    };
  }
  if (lower.includes("bbva") || lower.includes("banorte") || lower.includes("santander") || lower.includes("banamex") || lower.includes("hsbc") || lower.includes("edo") || lower.includes("cuenta") || lower.includes("estado")) {
    const bank = lower.includes("bbva")
      ? "BBVA"
      : lower.includes("banorte")
        ? "Banorte"
        : lower.includes("santander")
          ? "Santander"
          : "Banco";
    return {
      cleanName: `${bank}_Estado_de_Cuenta_${safeClient}_${ym}${ext || ".pdf"}`,
      subfolder: "03 Estados de Cuenta",
    };
  }
  if (lower.includes("ine") || lower.includes("acta") || lower.includes("poder") || lower.includes("cfe") || lower.includes("domicilio") || lower.includes("whatsapp")) {
    return {
      cleanName: `Expediente_Legal_${safeClient}_${ym}${ext || ".jpg"}`,
      subfolder: "01 Expediente Legal",
    };
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    return {
      cleanName: `Papel_Trabajo_${safeClient}_${ym}${ext}`,
      subfolder: "05 Entregables",
    };
  }
  return {
    cleanName: raw.replace(/\s+/g, "_"),
    subfolder: "05 Entregables",
  };
}

export const SmartUploadOrderModal: React.FC<SmartUploadOrderModalProps> = ({
  isOpen,
  onClose,
  activeFolderName = "Bóveda Principal ABRN",
  folders = [],
  onCommitUpload,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<SmartUploadStagedItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const subfolderOptions = Array.from(
    new Set([
      ...STANDARD_ACCOUNTANT_SUBFOLDERS,
      ...folders.map((f) => f.name),
    ])
  );

  const ingestFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (!arr.length) return;
    setIsAnalyzing(true);
    try {
      const staged: SmartUploadStagedItem[] = [];
      for (const f of arr) {
        const triaged = await triageFileObject(f).catch(() => null);
        const fallback = suggestAccountantOrder(f, activeFolderName);
        const suggestedName =
          triaged?.triage?.suggestedFilename && triaged.triage.suggestedFilename !== f.name
            ? triaged.triage.suggestedFilename
            : fallback.cleanName;
        staged.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          originalFile: f,
          originalName: f.name,
          suggestedName,
          targetSubfolderName: fallback.subfolder,
        });
      }
      setItems((prev) => [...prev, ...staged]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadSampleBatch = async () => {
    const samples: File[] = [
      new File(
        ["%PDF-1.4 ABRN Acuse Declaracion Mensual Noviembre 2026"],
        "scan_0019_final(2).pdf",
        { type: "application/pdf" }
      ),
      new File(
        [`<?xml version="1.0" encoding="UTF-8"?><cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Serie="A" Folio="4821" Fecha="2026-11-14T10:30:00" Total="19200.00" SubTotal="16551.72" Moneda="MXN" TipoDeComprobante="I" MetodoPago="PUE" FormaPago="03" LugarExpedicion="06600"><cfdi:Emisor Nombre="Proveedor Logistica SA" Rfc="PLO180101AA1" RegimenFiscal="601"/><cfdi:Receptor Nombre="${activeFolderName}" Rfc="GRO190412AB4" UsoCFDI="G03" DomicilioFiscalReceptor="06600" RegimenFiscalReceptor="601"/><cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="E48" Descripcion="Servicios de Asesoria Contable y Fiscal Mensual" ValorUnitario="16551.72" Importe="16551.72"/></cfdi:Conceptos><cfdi:Complemento><tfd:TimbreFiscalDigital Version="1.1" UUID="A89F22C1-77B4-40E2-9104-88C019F44A10" FechaTimbrado="2026-11-14T10:31:05"/></cfdi:Complemento></cfdi:Comprobante>`],
        "a89f22c1-77b4-40e2.xml",
        { type: "application/xml" }
      ),
      new File(
        ["Comprobante de Domicilio CFE verificado por ABRN Asesores"],
        "WhatsApp Image 2026-11-13.jpg",
        { type: "image/jpeg" }
      ),
      new File(
        ["%PDF-1.4 Estado de Cuenta Bancario Banorte Octubre 2026"],
        "edo_cta_banorte_descarga.pdf",
        { type: "application/pdf" }
      ),
    ];
    await ingestFiles(samples);
  };

  const handleCommit = async () => {
    if (!items.length || isUploading) return;
    setIsUploading(true);
    try {
      await onCommitUpload(items);
      setItems([]);
      onClose();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      data-testid="smart-upload-order-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUploading) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="smart-upload-modal-title"
        style={{
          background: "var(--abrn-card)",
          borderColor: "var(--abrn-border-strong)",
          boxShadow: "var(--abrn-shadow-lg)",
        }}
        className="w-[min(820px,94vw)] max-h-[88dvh] rounded-[15px] border flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div
          style={{ background: "var(--abrn-bg-elevated)", borderColor: "var(--abrn-border)" }}
          className="px-4 py-3 border-b flex items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="abrn-blindado-pill">Orden automático · Privado</span>
            <h2 id="smart-upload-modal-title" className="abrn-serif text-[15px] font-bold text-foreground truncate">
              Subir y Ordenar Archivos Sueltos
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="abrn-btn !h-7 !px-2.5 !text-[11.5px]"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cerrar</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3.5 overflow-y-auto">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            data-testid="smart-upload-file-input"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                void ingestFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) {
                void ingestFiles(e.dataTransfer.files);
              }
            }}
            style={{
              background: "var(--abrn-primary-tint)",
              borderColor: dragOver ? "var(--abrn-primary)" : "var(--abrn-border-strong)",
            }}
            className="border-2 border-dashed rounded-[12px] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors"
          >
            <div className="min-w-0">
              <div className="abrn-serif font-bold text-[14.5px] text-foreground">
                Suelta aquí facturas, PDFs o fotos de WhatsApp
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                ABRN Drive detecta qué documento es, sugiere un nombre limpio para{" "}
                <strong className="text-foreground">{activeFolderName}</strong>, lo protege antes de subirlo y lo acomoda en su carpeta.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isAnalyzing}
                className="abrn-btn"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Elegir Archivos</span>
              </button>

              {items.length > 0 && (
                <button
                  type="button"
                  data-testid="smart-upload-commit-btn"
                  onClick={() => void handleCommit()}
                  disabled={isUploading}
                  className="abrn-btn abrn-btn-primary"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Cifrando…</span>
                    </>
                  ) : (
                    <span>Cifrar y Guardar ({items.length})</span>
                  )}
                </button>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div
              style={{ background: "var(--abrn-bg)", borderColor: "var(--abrn-border)" }}
              className="rounded-[10px] border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="text-[12px] text-muted-foreground">
                <strong className="text-foreground block mb-0.5">
                  ¿Cómo funciona el Auto-Orden en navegador?
                </strong>
                 Convierte nombres caóticos como <code className="abrn-mono">scan_0019(2).pdf</code> o{" "}
                <code className="abrn-mono">a89f22c1.xml</code> en nombres contables limpios antes de cifrarlos con AES-256-GCM.
              </div>
              <button
                type="button"
                data-testid="smart-upload-load-sample-btn"
                onClick={() => void loadSampleBatch()}
                className="abrn-btn abrn-btn-soft shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Cargar lote ejemplo (4)</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{ background: "var(--abrn-bg)", borderColor: "var(--abrn-border)" }}
                  className="grid grid-cols-1 md:grid-cols-[1fr_20px_1.3fr_auto_auto] items-center gap-2 px-3 py-2 rounded-[9px] border text-[12px]"
                >
                  <span className="abrn-mono text-muted-foreground line-through truncate" title={item.originalName}>
                    {item.originalName}
                  </span>
                  <span className="hidden md:block text-primary font-extrabold text-center">→</span>
                  <input
                    type="text"
                    value={item.suggestedName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItems((prev) =>
                        prev.map((x) => (x.id === item.id ? { ...x, suggestedName: val } : x))
                      );
                    }}
                    aria-label={`Nombre limpio para ${item.originalName}`}
                    className="h-7 px-2 rounded-[6px] border border-border bg-card font-bold text-foreground text-[12px] focus:outline-none focus:border-primary"
                  />
                  <select
                    value={item.targetSubfolderName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItems((prev) =>
                        prev.map((x) => (x.id === item.id ? { ...x, targetSubfolderName: val } : x))
                      );
                    }}
                    aria-label={`Subcarpeta destino para ${item.originalName}`}
                    className="abrn-type-pill !py-1 !px-2 cursor-pointer"
                  >
                    {subfolderOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                    aria-label={`Quitar ${item.originalName}`}
                    className="abrn-cap-btn is-danger"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

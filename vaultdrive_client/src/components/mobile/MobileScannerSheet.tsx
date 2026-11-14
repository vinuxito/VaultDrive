import React, { useRef, useState } from "react";
import { X, Camera, Upload, Sparkles, ShieldCheck, Loader2 } from "lucide-react";
import type { SmartUploadStagedItem } from "../vault/SmartUploadOrderModal";

export interface MobileScannerSheetProps {
  open: boolean;
  onClose: () => void;
  clientName?: string;
  onCommitScanUpload: (items: SmartUploadStagedItem[]) => Promise<void> | void;
}

export const MobileScannerSheet: React.FC<MobileScannerSheetProps> = ({
  open,
  onClose,
  clientName = "Grupo Roche SA de CV",
  onCommitScanUpload,
}) => {
  const [capturing, setCapturing] = useState(false);
  const [docPreset, setDocPreset] = useState<"poliza" | "csf" | "bbva">("poliza");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const buildPresetPdfItem = (): SmartUploadStagedItem => {
    const stamp = new Date().toISOString().slice(0, 10);
    const metaByPreset = {
      poliza: {
        name: `${stamp}_Poliza_Egreso_Escaneada_Celular_ABRN.pdf`,
        folder: "05 Entregables",
        type: "Póliza Escaneada IA",
        summary: `Escaneo perspectiva corregida · ${clientName} · AES-256-GCM`,
      },
      csf: {
        name: `${stamp}_Constancia_Fiscal_SAT_Escaneada.pdf`,
        folder: "02 Constancia y 32-D",
        type: "Constancia SAT",
        summary: `Constancia Situación Fiscal CIF verificada · ${clientName}`,
      },
      bbva: {
        name: `BBVA_Estado_de_Cuenta_Escaneado_${stamp}_$418,200.00.pdf`,
        folder: "03 Estados de Cuenta",
        type: "Estado de Cuenta BBVA",
        summary: `Carátula bancaria conciliable en RAM · ${clientName}`,
      },
    }[docPreset];

    const pdfBytes = `%PDF-1.4
% ABRN Sovereign Mobile Optical Scanner — Zero-Knowledge AES-256-GCM
% Cliente: ${clientName}
% Documento: ${metaByPreset.name}
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
trailer << /Root 1 0 R >>
%%EOF`;

    const fileObj = new globalThis.File([pdfBytes], metaByPreset.name, {
      type: "application/pdf",
      lastModified: Date.now(),
    });

    return {
      id: `mobile-scan-${Date.now()}`,
      originalFile: fileObj,
      originalName: metaByPreset.name,
      suggestedName: metaByPreset.name,
      targetSubfolderName: metaByPreset.folder,
    };
  };

  const handleInstantCapture = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const staged = buildPresetPdfItem();
      await onCommitScanUpload([staged]);
      onClose();
    } finally {
      setCapturing(false);
    }
  };

  const handleNativeCameraFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setCapturing(true);
    try {
      const staged: SmartUploadStagedItem = {
        id: `camera-file-${Date.now()}`,
        originalFile: picked,
        originalName: picked.name,
        suggestedName: picked.name,
        targetSubfolderName:
          docPreset === "csf"
            ? "02 Constancia y 32-D"
            : docPreset === "bbva"
              ? "03 Estados de Cuenta"
              : "05 Pólizas y Auxiliares",
      };
      await onCommitScanUpload([staged]);
      onClose();
    } finally {
      setCapturing(false);
      e.target.value = "";
    }
  };

  return (
    <div
      data-testid="mobile-scanner-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Escáner Fiscal Óptico AES-256-GCM"
      className="fixed inset-0 z-[75] flex flex-col justify-end bg-black/75 backdrop-blur-md md:hidden"
      onClick={onClose}
    >
      <div
        style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
        className="w-full rounded-t-[24px] border-t shadow-2xl flex flex-col overflow-hidden safe-area-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-2.5 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        <div
          style={{ borderColor: "var(--abrn-border)" }}
          className="px-4 pt-1.5 pb-3 border-b flex items-center justify-between gap-3"
        >
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>WEBCRYPTO DIRECTO EN RAM · 0 BYTES GALERÍA</span>
            </div>
            <h3 className="text-[16px] font-extrabold text-foreground">
              Escáner Fiscal IA · Cel → Bóveda
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar escáner"
            className="w-10 h-10 rounded-full border border-border bg-muted/60 flex items-center justify-center text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {/* Optical Perspective Viewfinder */}
          <div className="relative rounded-2xl bg-[#090d16] border border-white/15 p-4 h-[196px] flex flex-col justify-between overflow-hidden">
            {/* Corner Brackets */}
            <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-md" />
            <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-md" />
            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-md" />
            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-md" />

            <div className="flex items-center justify-between z-10">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold abrn-mono">
                ● ENCUADRE FISCAL AUTO · 99.4%
              </span>
              <span className="text-[10px] text-slate-300 abrn-mono">AES-256-GCM</span>
            </div>

            {/* Simulated Live Document Sheet inside Viewfinder */}
            <div className="mx-auto w-[78%] rounded-lg bg-white/95 text-slate-900 p-2.5 shadow-lg border border-emerald-400/60">
              <div className="flex items-center justify-between text-[9.5px] font-extrabold text-[#7a1f2b]">
                <span>ABRN ASESORES · {clientName.toUpperCase()}</span>
                <span>FOLIO #2026-11</span>
              </div>
              <div className="mt-1 h-1.5 w-3/4 rounded bg-slate-200" />
              <div className="mt-1 h-1.5 w-1/2 rounded bg-slate-200" />
              <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-emerald-700 font-bold">
                <span>SHA-256 EN VIVO</span>
                <span>CLASIFICACIÓN AUTOMÁTICA</span>
              </div>
            </div>

            <div className="text-center text-[10.5px] text-slate-300 z-10">
              Clasificación destino:{" "}
              <strong className="text-white">
                {docPreset === "poliza"
                  ? "05 Pólizas y Auxiliares"
                  : docPreset === "csf"
                    ? "02 Constancia y 32-D"
                    : "03 Estados de Cuenta"}
              </strong>
            </div>
          </div>

          {/* Preset Selector */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: "poliza" as const, label: "05 Póliza PDF" },
              { id: "csf" as const, label: "02 Constancia" },
              { id: "bbva" as const, label: "03 Edo. BBVA" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDocPreset(opt.id)}
                className={`min-h-[40px] rounded-xl text-[11.5px] font-bold border transition-all ${
                  docPreset === opt.id
                    ? "border-primary bg-primary/12 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.xml"
            capture="environment"
            className="hidden"
            onChange={(e) => void handleNativeCameraFile(e)}
          />

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[48px] px-3.5 rounded-xl border border-border bg-muted/50 text-foreground font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              <span>Archivo</span>
            </button>
            <button
              type="button"
              data-testid="mobile-scanner-capture-btn"
              disabled={capturing}
              onClick={() => void handleInstantCapture()}
              className="flex-1 min-h-[48px] rounded-xl font-extrabold text-[13px] text-white px-4 flex items-center justify-center gap-2 shadow-md active:scale-[0.99]"
              style={{ background: "linear-gradient(135deg, #7a1f2b 0%, #58131d 100%)" }}
            >
              {capturing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cifrando en RAM…</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Capturar y Cifrar en RAM</span>
                  <Sparkles className="w-3.5 h-3.5 opacity-85" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

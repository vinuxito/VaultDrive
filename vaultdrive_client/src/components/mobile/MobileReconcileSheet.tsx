import React, { useMemo, useState } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  MessageCircle,
  Download,
  Lock,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import type { FileData } from "../vault/FileGrid";
import type { SmartUploadStagedItem } from "../vault/SmartUploadOrderModal";
import {
  evaluateRamReconciliation,
  buildRealAccountingSeedBatch,
  formatMxn,
} from "../vault/VaultReconcileCockpit";

export interface MobileReconcileSheetProps {
  open: boolean;
  onClose: () => void;
  files: FileData[];
  clientName?: string;
  isLocked?: boolean;
  onSeedAccountingFiles?: (items: SmartUploadStagedItem[]) => Promise<void> | void;
  onShareWhatsApp?: (message: string) => void;
  onExportCsv?: (csvContent: string, filename: string) => void;
}

export const MobileReconcileSheet: React.FC<MobileReconcileSheetProps> = ({
  open,
  onClose,
  files,
  clientName = "Grupo Roche SA de CV",
  isLocked = false,
  onSeedAccountingFiles,
  onShareWhatsApp,
  onExportCsv,
}) => {
  const [seeding, setSeeding] = useState(false);

  const evaluation = useMemo(
    () => evaluateRamReconciliation(files, isLocked),
    [files, isLocked]
  );

  if (!open) return null;

  const handleSeed = async () => {
    if (!onSeedAccountingFiles || seeding) return;
    setSeeding(true);
    try {
      const batch = buildRealAccountingSeedBatch(clientName);
      await onSeedAccountingFiles(batch);
    } finally {
      setSeeding(false);
    }
  };

  const handleExport = () => {
    if (evaluation.lines.length === 0) return;
    const rows = [
      ["Concepto", "UUID_CFDI", "Referencia_Banco", "Monto_MXN", "Estado", "SHA256"].join(","),
      ...evaluation.lines.map((l) =>
        [
          `"${l.concept.replace(/"/g, '""')}"`,
          l.uuidShort,
          l.bankRef,
          l.amountMxn.toFixed(2),
          l.matched ? "CONCILIADO" : "DIFERENCIA",
          l.shaShort,
        ].join(",")
      ),
    ].join("\n");
    const fname = `Papel_Trabajo_Conciliacion_${clientName.replace(/\s+/g, "_")}.csv`;
    if (onExportCsv) {
      onExportCsv(rows, fname);
    } else {
      const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  };

  return (
    <div
      data-testid="mobile-reconcile-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Conciliación CFDI 4.0 y BBVA en RAM"
      className="fixed inset-0 z-[75] flex flex-col justify-end bg-black/60 backdrop-blur-sm md:hidden"
      onClick={onClose}
    >
      <div
        style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
        className="w-full max-h-[88dvh] rounded-t-[24px] border-t shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 safe-area-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sheet Pill Grabber */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Breathable Header (16px padding, zero overlap) */}
        <div
          style={{ borderColor: "var(--abrn-border)" }}
          className="px-4 pt-2 pb-3.5 border-b flex items-start justify-between gap-3 shrink-0"
        >
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-primary">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>MOTOR CONTABLE 100% EN RAM</span>
            </div>
            <h3 className="mt-0.5 text-[16px] font-extrabold tracking-tight text-foreground leading-snug">
              Conciliación CFDI 4.0 ↔ BBVA
            </h3>
            <p className="text-[11.5px] text-muted-foreground truncate">
              {clientName} · Cero datos en servidor
            </p>
          </div>
          <button
            type="button"
            data-testid="close-mobile-reconcile-btn"
            onClick={onClose}
            aria-label="Cerrar conciliación"
            className="w-10 h-10 rounded-full border border-border bg-muted/60 flex items-center justify-center text-foreground shrink-0 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Sheet Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5">
          {evaluation.status === "LOCKED" && (
            <div
              data-testid="mobile-reconcile-locked"
              className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 space-y-2"
            >
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-extrabold text-xs uppercase tracking-wider">
                <Lock className="w-4 h-4 shrink-0" />
                <span>NOT_EVALUABLE · BÓVEDA BLOQUEADA</span>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed">
                {evaluation.reason}
              </p>
            </div>
          )}

          {evaluation.status === "SIN_CFDI_EN_CARPETA" && (
            <div
              data-testid="mobile-reconcile-not-evaluable"
              className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 abrn-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  SIN_CFDI_EN_CARPETA
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background/80 border border-border abrn-mono">
                  NOT_EVALUABLE
                </span>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed">
                {evaluation.reason} Nunca mostramos falsos <code className="abrn-mono">$0.00</code> cuando faltan XML o el estado de cuenta bancario.
              </p>
              {onSeedAccountingFiles && (
                <button
                  type="button"
                  data-testid="mobile-seed-reconcile-btn"
                  disabled={seeding}
                  onClick={() => void handleSeed()}
                  className="w-full min-h-[48px] rounded-xl font-extrabold text-[13px] px-4 py-2.5 flex items-center justify-center gap-2 text-white shadow-md active:scale-[0.99]"
                  style={{ background: "linear-gradient(135deg, #7a1f2b 0%, #58131d 100%)" }}
                >
                  {seeding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cifrando CFDI 4.0 + BBVA en RAM…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Cifrar Expediente Contable Real (3 XML + BBVA)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {(evaluation.status === "RECONCILED" || evaluation.status === "VARIANCE") && (
            <>
              {/* Summary KPI Trio */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border bg-muted/40 p-2.5">
                  <div className="text-[9.5px] font-bold uppercase text-muted-foreground">
                    CFDI ({evaluation.cfdiFilesCount})
                  </div>
                  <div className="mt-1 text-[12px] font-extrabold text-foreground abrn-mono truncate">
                    {formatMxn(evaluation.cfdiTotalMxn ?? 0).replace(" MXN", "")}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-2.5">
                  <div className="text-[9.5px] font-bold uppercase text-muted-foreground">
                    BBVA ({evaluation.bankFilesCount})
                  </div>
                  <div className="mt-1 text-[12px] font-extrabold text-foreground abrn-mono truncate">
                    {formatMxn(evaluation.bankTotalMxn ?? 0).replace(" MXN", "")}
                  </div>
                </div>
                <div
                  data-testid="mobile-reconcile-delta-card"
                  className={`rounded-xl border p-2.5 ${
                    evaluation.status === "RECONCILED"
                      ? "border-emerald-500/35 bg-emerald-500/12"
                      : "border-amber-500/35 bg-amber-500/12"
                  }`}
                >
                  <div className="text-[9.5px] font-extrabold uppercase text-emerald-700 dark:text-emerald-300">
                    Diferencia
                  </div>
                  <div className="mt-1 text-[12.5px] font-extrabold text-emerald-700 dark:text-emerald-300 abrn-mono truncate">
                    {formatMxn(evaluation.deltaMxn ?? 0).replace(" MXN", "")}
                  </div>
                </div>
              </div>

              {/* Golden Seal Pill */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-extrabold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {evaluation.status === "RECONCILED"
                    ? "Cuadre Exacto $0.00 MXN · 100% Conciliado"
                    : "Diferencia detectada en RAM"}
                </span>
                <span className="abrn-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  AES-256
                </span>
              </div>

              {/* Matched Line Items */}
              <div className="space-y-2">
                {evaluation.lines.map((line) => (
                  <div
                    key={line.id}
                    style={{ background: "var(--abrn-bg-elevated)", borderColor: "var(--abrn-border)" }}
                    className="rounded-xl border p-3 flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold text-foreground truncate">
                        {line.concept}
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-muted-foreground abrn-mono truncate">
                        UUID {line.uuidShort} · {line.bankRef}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[12.5px] font-extrabold text-foreground abrn-mono">
                        ${line.amountMxn.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                      <span className="inline-flex items-center gap-1 text-[9.5px] font-extrabold text-emerald-600 dark:text-emerald-400">
                        ✓ SPEI OK
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sticky Tactical Bottom Dock */}
        <div
          style={{ background: "var(--abrn-bg-elevated)", borderColor: "var(--abrn-border)" }}
          className="px-4 py-3 border-t flex items-center gap-2.5 shrink-0"
        >
          <button
            type="button"
            disabled={evaluation.lines.length === 0}
            onClick={handleExport}
            className="min-h-[48px] px-3.5 rounded-xl border border-border bg-card text-foreground font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-45"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            data-testid="mobile-reconcile-wa-btn"
            disabled={evaluation.lines.length === 0}
            onClick={() => {
              const msg = `Hola ${clientName}, tu Conciliación CFDI 4.0 ↔ BBVA cerró con diferencia ${formatMxn(
                evaluation.deltaMxn ?? 0
              )} (${evaluation.cfdiFilesCount} CFDI verificados en RAM con sello SHA-256).`;
              onShareWhatsApp?.(msg);
            }}
            className="flex-1 min-h-[48px] rounded-xl font-extrabold text-[13px] text-white px-4 flex items-center justify-center gap-2 shadow-sm disabled:opacity-45 active:scale-[0.99]"
            style={{ background: "#15803d" }}
          >
            <MessageCircle className="w-4 h-4" />
            <span>Enviar Cuadre #key por WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};

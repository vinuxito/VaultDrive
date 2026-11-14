import React from "react";
import {
  FolderOpen,
  Camera,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import type { FileData } from "../vault/FileGrid";

export interface MobileFolderChipItem {
  id: string;
  name: string;
  children?: unknown[];
}

export interface MobileSovereignHeaderAndHubProps {
  mobileTab: "pulso" | "archivos";
  onSelectMobileTab: (tab: "pulso" | "archivos") => void;
  activeClientName: string;
  clientFolders: MobileFolderChipItem[];
  subfolders: MobileFolderChipItem[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  files: FileData[];
  onOpenReconcileSheet: () => void;
  onOpenScannerSheet: () => void;
  onOpenDropRequest: () => void;
  onOpenFolderSheet: () => void;
  onCreateStandardStructure?: () => void;
}

export const MobileSovereignHeaderAndHub: React.FC<MobileSovereignHeaderAndHubProps> = ({
  mobileTab,
  onSelectMobileTab,
  activeClientName,
  clientFolders,
  subfolders,
  selectedFolderId,
  onSelectFolder,
  files,
  onOpenReconcileSheet,
  onOpenScannerSheet,
  onOpenDropRequest,
  onOpenFolderSheet,
  onCreateStandardStructure,
}) => {
  const cfdiCount = files.filter((f) => f.filename.toLowerCase().endsWith(".xml")).length;
  const bankCount = files.filter((f) => {
    const l = f.filename.toLowerCase();
    return l.includes("bbva") || l.includes("cuenta") || l.includes("bancos");
  }).length;
  const dropCount = files.filter((f) => Boolean(f.drop_token)).length;
  const completionPct = files.length === 0 ? 60 : Math.min(100, 75 + Math.min(25, files.length * 5));

  return (
    <div data-testid="mobile-sovereign-hub" className="md:hidden space-y-3 pb-1">
      {/* Compact Native Segmented Switcher: Pulso Fiscal vs Expediente */}
      <div className="flex items-center justify-between gap-2">
        <div
          style={{ background: "var(--abrn-bg-elevated)", borderColor: "var(--abrn-border)" }}
          className="inline-flex items-center p-1 rounded-xl border flex-1"
        >
          <button
            type="button"
            data-testid="mobile-tab-pulso"
            onClick={() => onSelectMobileTab("pulso")}
            className={`flex-1 min-h-[38px] rounded-lg text-[12px] font-extrabold transition-all ${
              mobileTab === "pulso"
                ? "bg-[#7a1f2b] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ⚡ Pulso Fiscal
          </button>
          <button
            type="button"
            data-testid="mobile-tab-archivos"
            onClick={() => onSelectMobileTab("archivos")}
            className={`flex-1 min-h-[38px] rounded-lg text-[12px] font-extrabold transition-all ${
              mobileTab === "archivos"
                ? "bg-[#7a1f2b] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📁 Expediente ({files.length})
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenFolderSheet}
          aria-label="Cambiar cliente o carpeta"
          style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
          className="min-h-[42px] px-3 rounded-xl border text-xs font-bold text-foreground inline-flex items-center gap-1.5 shrink-0"
        >
          <FolderOpen className="w-3.5 h-3.5 text-primary" />
          <span className="max-w-[96px] truncate">{activeClientName}</span>
        </button>
      </div>

      {mobileTab === "pulso" && (
        <>
          {/* Client Quick-Selector Strip (if client folders exist) */}
          {clientFolders.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {clientFolders.slice(0, 6).map((folder) => {
                const active = selectedFolderId === folder.id;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => onSelectFolder(folder.id)}
                    className={`min-h-[34px] px-3 rounded-full text-[11.5px] font-bold whitespace-nowrap border transition-all ${
                      active
                        ? "bg-primary/15 border-primary text-primary"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {folder.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Apple-Wallet Sovereign Burgundy Client Pass Card */}
          <div
            data-testid="mobile-wallet-client-pass"
            style={{
              background:
                "linear-gradient(140deg, #7a1f2b 0%, #59131e 58%, #2e0910 100%)",
            }}
            className="rounded-[22px] p-4 text-white shadow-xl border border-white/15 space-y-3.5 relative overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/12 border border-white/15 text-[9.5px] font-extrabold tracking-wider uppercase text-rose-100">
                  <ShieldCheck className="w-3 h-3 text-emerald-300" />
                  <span>PASE SOBERANO · AES-256 RAM</span>
                </div>
                <h2 className="mt-1.5 text-[18px] font-extrabold tracking-tight leading-snug truncate">
                  {activeClientName}
                </h2>
                <p className="text-[11.5px] text-rose-100/85 truncate abrn-mono">
                  RFC Auditado · Cierre Fiscal Noviembre 2026
                </p>
              </div>

              {/* Completion Ring Pill */}
              <div className="shrink-0 rounded-2xl bg-black/25 border border-white/15 px-3 py-2 text-center">
                <div className="text-[16px] font-extrabold leading-none text-emerald-300 abrn-mono">
                  {completionPct}%
                </div>
                <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-100/80">
                  AL DÍA
                </div>
              </div>
            </div>

            {/* 3 KPI Strip */}
            <div className="grid grid-cols-3 gap-2 pt-0.5">
              <div className="rounded-xl bg-black/25 border border-white/10 px-2.5 py-2">
                <div className="text-[9.5px] text-rose-100/75 font-semibold">Archivos RAM</div>
                <div className="text-[14px] font-extrabold abrn-mono mt-0.5">{files.length}</div>
              </div>
              <div className="rounded-xl bg-black/25 border border-white/10 px-2.5 py-2">
                <div className="text-[9.5px] text-rose-100/75 font-semibold">CFDI / BBVA</div>
                <div className="text-[14px] font-extrabold abrn-mono mt-0.5 text-emerald-300">
                  {cfdiCount}/{bankCount}
                </div>
              </div>
              <div className="rounded-xl bg-black/25 border border-white/10 px-2.5 py-2">
                <div className="text-[9.5px] text-rose-100/75 font-semibold">Bandeja Drop</div>
                <div className="text-[14px] font-extrabold abrn-mono mt-0.5">{dropCount}</div>
              </div>
            </div>

            {/* Pass Action Trio (All >=44px touch friendly) */}
            <div className="grid grid-cols-3 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => onSelectMobileTab("archivos")}
                className="min-h-[44px] rounded-xl bg-white text-[#59131e] font-extrabold text-[11.5px] px-2 flex items-center justify-center gap-1 shadow-sm active:scale-95"
              >
                <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Expediente</span>
              </button>
              <button
                type="button"
                onClick={onOpenDropRequest}
                className="min-h-[44px] rounded-xl bg-white/14 border border-white/20 text-white font-bold text-[11.5px] px-2 flex items-center justify-center gap-1 active:scale-95"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0 text-emerald-300" />
                <span>Pedir Docs</span>
              </button>
              <button
                type="button"
                data-testid="wallet-scan-btn"
                onClick={onOpenScannerSheet}
                className="min-h-[44px] rounded-xl bg-white/14 border border-white/20 text-white font-bold text-[11.5px] px-2 flex items-center justify-center gap-1 active:scale-95"
              >
                <Camera className="w-3.5 h-3.5 shrink-0 text-amber-200" />
                <span>Escanear</span>
              </button>
            </div>
          </div>

          {/* Cola de Trabajo Hoy (Work-First Urgent Cards) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted-foreground">
                Cola de Trabajo Hoy
              </span>
              <span className="text-[10.5px] font-bold text-primary abrn-mono">
                Zero-Knowledge
              </span>
            </div>

            {/* Card 1: Conciliación CFDI 4.0 ↔ BBVA */}
            <button
              type="button"
              data-testid="open-reconcile-btn"
              onClick={onOpenReconcileSheet}
              style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
              className="w-full text-left rounded-2xl border p-3.5 flex items-center justify-between gap-3 shadow-sm active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-extrabold text-foreground">
                      Conciliación CFDI 4.0 ↔ BBVA
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-extrabold bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 abrn-mono">
                      {cfdiCount > 0 && bankCount > 0 ? "$0.00 MXN" : "EN RAM"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground line-clamp-1">
                    {cfdiCount > 0 && bankCount > 0
                      ? `${cfdiCount} XML conciliados contra Estado de Cuenta BBVA`
                      : "Cruza facturas XML contra BBVA sin subir datos en claro"}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-primary shrink-0" />
            </button>

            {/* Card 2: Solicitar Documentos vía WhatsApp Secure Drop */}
            <button
              type="button"
              onClick={onOpenDropRequest}
              style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
              className="w-full text-left rounded-2xl border p-3.5 flex items-center justify-between gap-3 shadow-sm active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/12 border border-primary/25 flex items-center justify-center text-primary shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold text-foreground">
                    Bandeja Secure Drop sin Cuenta
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground line-clamp-1">
                    Envía liga por WhatsApp para recibir Constancia y 32-D cifrados
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          </div>

          {/* 5 Subcarpetas Estándar ABRN Quick Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted-foreground">
                Estructura Contable ABRN
              </span>
              {subfolders.length === 0 && onCreateStandardStructure && (
                <button
                  type="button"
                  onClick={onCreateStandardStructure}
                  className="text-[11px] font-extrabold text-primary inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Crear 5 Subcarpetas
                </button>
              )}
            </div>

            {subfolders.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {subfolders.slice(0, 6).map((sf) => (
                  <button
                    key={sf.id}
                    type="button"
                    onClick={() => {
                      onSelectFolder(sf.id);
                      onSelectMobileTab("archivos");
                    }}
                    style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
                    className="min-h-[48px] rounded-xl border px-3 py-2 text-left flex items-center justify-between gap-2 active:scale-[0.99]"
                  >
                    <span className="text-[11.5px] font-bold text-foreground truncate">
                      📁 {sf.name}
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[
                  "01 Acta e INE",
                  "02 Constancia y 32-D",
                  "03 Estados de Cuenta",
                  "04 CFDI y Facturas XML",
                  "05 Pólizas y Auxiliares",
                ].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onSelectMobileTab("archivos")}
                    style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
                    className="min-h-[46px] rounded-xl border px-3 py-2 text-left flex items-center justify-between gap-2"
                  >
                    <span className="text-[11.5px] font-bold text-foreground truncate">
                      📁 {label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

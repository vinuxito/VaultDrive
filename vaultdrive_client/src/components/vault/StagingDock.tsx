import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Download, Link2, X, AlertOctagon, FileText, MessageCircle } from "lucide-react";
import { formatBytes } from "../../utils/format";
import { playTumblerClick } from "../../utils/audioHaptics";
import type { FileData } from "./FileGrid";

interface StagingDockProps {
  dockedFiles: FileData[];
  onClearDock: () => void;
  onBatchDownload: (files: FileData[]) => void;
  onBatchShare?: (files: FileData[]) => void;
  onBatchWhatsApp?: (files: FileData[]) => void;
  onBatchSever?: (files: FileData[]) => void;
  onDownloadBatchSlip?: (files: FileData[]) => void;
}

export const StagingDock: React.FC<StagingDockProps> = ({
  dockedFiles,
  onClearDock,
  onBatchDownload,
  onBatchShare,
  onBatchWhatsApp,
  onBatchSever,
  onDownloadBatchSlip,
}) => {
  const { t } = useTranslation(["drive"]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dockedFiles.length > 0) {
        onClearDock();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dockedFiles, onClearDock]);

  if (dockedFiles.length === 0) return null;

  const totalBytes = dockedFiles.reduce((acc, f) => acc + (f.file_size || 0), 0);

  return (
    <div
      role="region"
      data-testid="canasta-staging-dock"
      aria-label="Executive Staging Dock"
      style={{
        background: "#161922",
        color: "#f5f2ed",
        borderColor: "rgba(212, 174, 176, 0.36)",
        boxShadow: "var(--abrn-shadow-lg)",
      }}
      className="fixed bottom-9 left-1/2 -translate-x-1/2 z-[45] flex items-center gap-2 border rounded-[14px] px-3 py-1.5 max-w-[95vw] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden animate-in fade-in slide-in-from-bottom-4 duration-200 whitespace-nowrap"
    >
      <div className="flex items-center gap-2 shrink-0">
        <span className="abrn-pulse-dot" />
        <div className="w-6 h-6 rounded-md bg-white/12 border border-white/20 flex items-center justify-center text-[#f5f2ed] font-bold text-xs abrn-mono">
          {dockedFiles.length}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[11.5px] font-bold text-[#f5f2ed]">
            {t("drive:vault.stagingDock.stagedForAction", { defaultValue: "En Canasta #key" })}
          </span>
          <span className="text-[10px] text-[#b6bfd0] abrn-mono">
            {formatBytes(totalBytes)} · Canasta #key
          </span>
        </div>
      </div>

      <div className="h-5 w-px bg-white/18 mx-0.5" />

      <div className="flex items-center gap-1.5">
        {(onBatchWhatsApp || onBatchShare) && (
          <button
            type="button"
            onClick={() => {
              playTumblerClick();
              (onBatchWhatsApp ?? onBatchShare)?.(dockedFiles);
            }}
            className="abrn-btn abrn-btn-whatsapp !h-[30px] !px-2.5 !text-[11.5px] !rounded-[8px]"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp (#key Lote)</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            playTumblerClick();
            onBatchDownload(dockedFiles);
          }}
          className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-[8px] bg-white/14 hover:bg-white/22 text-[#f5f2ed] border border-white/22 text-[11.5px] font-bold transition-all cursor-pointer select-none"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t("drive:vault.stagingDock.batchDownload", { defaultValue: "Batch Download" })}</span>
        </button>

        {onBatchShare && onBatchWhatsApp && (
          <button
            type="button"
            onClick={() => {
              playTumblerClick();
              onBatchShare(dockedFiles);
            }}
            className="hidden sm:inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-[8px] bg-white/10 hover:bg-white/18 text-[#f5f2ed] border border-white/18 text-[11.5px] font-semibold transition-all cursor-pointer select-none"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>{t("drive:vault.stagingDock.combinedLink", { defaultValue: "Combined Link" })}</span>
          </button>
        )}

        {onDownloadBatchSlip && (
          <button
            type="button"
            onClick={() => {
              playTumblerClick();
              onDownloadBatchSlip(dockedFiles);
            }}
            title="Download Consolidated Cryptographic Transfer Slip"
            className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-[8px] bg-white/10 hover:bg-white/18 text-[#f5f2ed] border border-white/18 text-[11.5px] font-semibold transition-all cursor-pointer select-none"
          >
            <FileText className="w-3.5 h-3.5 text-[#d4aeb0]" />
            <span>{t("drive:vault.stagingDock.transferSlip", { defaultValue: "Transfer Slip" })}</span>
          </button>
        )}

        {onBatchSever && (
          <button
            type="button"
            onClick={() => {
              playTumblerClick();
              onBatchSever(dockedFiles);
            }}
            title="Sever External Access for All Docked Files"
            className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-[8px] bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-400/35 text-[11.5px] font-bold transition-all cursor-pointer select-none"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>{t("drive:vault.stagingDock.batchSever", { defaultValue: "Batch Sever" })}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            playTumblerClick();
            onClearDock();
          }}
          title={t("drive:vault.stagingDock.clearDock", { defaultValue: "Clear Dock (Esc)" })}
          aria-label={t("drive:vault.stagingDock.clearDock", { defaultValue: "Clear dock" })}
          className="h-[30px] px-2 rounded-[8px] text-[#b6bfd0] hover:text-white hover:bg-white/12 text-[11.5px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer select-none"
        >
          <X className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Vaciar</span>
        </button>
      </div>
    </div>
  );
};

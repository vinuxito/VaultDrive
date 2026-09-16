import React from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, UploadCloud, Lock } from "lucide-react";

interface UploadZoneProps {
  isDragging: boolean;
  folderName?: string | null;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ isDragging, folderName }) => {
  const { t } = useTranslation(["drive"]);

  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md flex items-center justify-center pointer-events-none ring-4 ring-primary ring-inset shadow-[inset_0_0_100px_rgba(16,185,129,0.2)] animate-in fade-in duration-150">
      <div className="relative border-2 border-dashed border-primary/60 bg-card/90 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl flex flex-col items-center space-y-4 ring-1 ring-black/5">
        <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary animate-bounce">
          <UploadCloud className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-foreground">
            {folderName ? `Drop to encrypt into "${folderName}"` : t("drive:vault.dropToUpload", { defaultValue: "Drop files to securely upload" })}
          </h2>
          <div className="flex items-center justify-center gap-1.5 text-xs text-primary font-medium">
            <Lock className="w-3.5 h-3.5" />
            <span>Files are AES-256 encrypted in your browser before upload</span>
          </div>
        </div>

        <div className="w-full pt-2 border-t border-border flex items-center justify-center gap-2 text-[11px] text-muted-foreground font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>ZERO-KNOWLEDGE BROWSER ENCRYPTION PIPELINE</span>
        </div>
      </div>
    </div>
  );
};

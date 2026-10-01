import { useEffect } from "react";
import { ShieldCheck, Share2, Check, X } from "lucide-react";

export interface MobileProofPillProps {
  isOpen: boolean;
  filename: string;
  filesize?: string;
  sha256?: string;
  shareUrl?: string;
  onClose: () => void;
  onShare?: () => void;
  autoDismissMs?: number;
}

export function MobileProofPill({
  isOpen,
  filename,
  filesize,
  sha256,
  shareUrl,
  onClose,
  onShare,
  autoDismissMs = 6000,
}: MobileProofPillProps) {
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [isOpen, autoDismissMs, onClose]);

  if (!isOpen) return null;

  const handleShareClick = async () => {
    if (onShare) {
      onShare();
      return;
    }

    if (shareUrl && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Archivo blindado: ${filename}`,
          text: `Te comparto este documento seguro vía ABRN Drive:\n📄 ${filename}\n🔒 Cifrado de extremo a extremo:`,
          url: shareUrl,
        });
        onClose();
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }

    if (shareUrl && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      onClose();
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 right-4 z-50 md:hidden flex justify-center pointer-events-none"
    >
      <div className="w-full max-w-sm rounded-2xl bg-card/95 border border-emerald-500/40 shadow-2xl backdrop-blur-xl p-3.5 text-card-foreground pointer-events-auto animate-in slide-in-from-bottom-5 duration-200 ring-1 ring-emerald-500/20">
        <div className="flex items-start gap-3">
          {/* Glowing Green Shield Receipt Icon */}
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
                1. ¿Qué pasó? · Blindado
              </span>
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <p className="text-xs font-semibold text-foreground truncate mt-0.5">
              {filename}
            </p>

            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground font-mono">
              {filesize && <span>{filesize}</span>}
              {filesize && <span>•</span>}
              <span className="text-emerald-600 dark:text-emerald-400">AES-256 verificado</span>
              {sha256 && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[80px]" title={sha256}>
                    {sha256.slice(0, 8)}…
                  </span>
                </>
              )}
            </div>

            {/* Step 3: ¿Qué sigue? - 1-Tap Action Buttons */}
            <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={handleShareClick}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer min-h-[36px]"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartir</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Listo"
                className="py-2 px-3 rounded-lg bg-muted hover:bg-muted/80 active:scale-95 text-foreground text-xs font-medium transition-all cursor-pointer min-h-[36px] flex items-center justify-center"
              >
                <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                <span>Listo</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar notificación"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer -mr-1 -mt-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

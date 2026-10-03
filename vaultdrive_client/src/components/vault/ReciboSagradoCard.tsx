import { useState, useEffect } from "react";
import { ShieldCheck, Share2, X, Check, Copy, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { formatSize } from "../../utils/format";
import { playDeadboltThud } from "../../utils/audioHaptics";

export interface ReciboData {
  fileId: string;
  filename: string;
  size: number;
  hash?: string;
  timestamp: Date;
}

export interface ReciboSagradoCardProps {
  receipt: ReciboData | null;
  onClose: () => void;
  onShare: (fileId: string) => void;
}

export function ReciboSagradoCard({ receipt, onClose, onShare }: ReciboSagradoCardProps) {
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    if (receipt) {
      playDeadboltThud();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }
      const timer = setTimeout(() => {
        onClose();
      }, 12000);
      return () => clearTimeout(timer);
    }
  }, [receipt, onClose]);

  if (!receipt) return null;

  const handleCopyHash = async () => {
    if (!receipt.hash) return;
    await navigator.clipboard.writeText(receipt.hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const shortHash = receipt.hash 
    ? `${receipt.hash.slice(0, 8)}...${receipt.hash.slice(-8)}`
    : "SHA-256 Verificado";

  return (
    <div
      role="region"
      aria-label="Recibo Sagrado de Blindaje"
      className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:bottom-8 z-40 md:w-96 animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
    >
      <div className="bg-card/95 backdrop-blur-xl border-2 border-emerald-500/40 rounded-2xl p-4 shadow-2xl shadow-emerald-500/10 space-y-3">
        {/* Header with seal and close */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
              <ShieldCheck className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Recibo Sagrado
                </span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <h4 className="text-sm font-bold text-foreground truncate max-w-[200px]">
                {receipt.filename}
              </h4>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar recibo"
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Proof Statement (Ley Tola: ¿Cómo sé que jaló?) */}
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
          <p className="text-foreground font-medium">
            🔒 Blindado en tu chip (AES-256-GCM) antes de salir.
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
            <span>Tamaño: {formatSize(receipt.size)}</span>
            <span>{receipt.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          </div>
        </div>

        {/* Hash Fingerprint */}
        {receipt.hash && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border/80 text-[11px] font-mono text-muted-foreground">
            <span className="truncate">{shortHash}</span>
            <button
              type="button"
              onClick={handleCopyHash}
              className="ml-2 text-primary hover:text-primary/80 font-sans flex items-center gap-1 text-[10px] cursor-pointer"
            >
              {copiedHash ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copiedHash ? "Copiado" : "Copiar"}</span>
            </button>
          </div>
        )}

        {/* Next Safe Action (Ley Tola: ¿Qué sigue?) */}
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            onClick={() => {
              onShare(receipt.fileId);
              onClose();
            }}
            className="flex-1 min-h-[46px] bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Compartir Enlace</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="min-h-[46px] px-4 rounded-xl border-border text-foreground hover:bg-muted text-xs cursor-pointer"
          >
            Listo
          </Button>
        </div>
      </div>
    </div>
  );
}

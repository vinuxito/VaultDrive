import { CheckCircle2, MessageCircle, Copy, X } from "lucide-react";
import { useState } from "react";

export interface QuickShareReceiptProps {
  filename: string;
  shareUrl: string;
  onDismiss: () => void;
  onMoreOptions?: () => void;
}

export function QuickShareReceipt({
  filename,
  shareUrl,
  onDismiss,
  onMoreOptions,
}: QuickShareReceiptProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
      if (navigator.vibrate) navigator.vibrate(25);
    } catch {
      setCopyFailed(true);
    }
  };

  const handleWhatsApp = () => {
    const text = `Te comparto este documento seguro vía ABRN Drive:\n📄 ${filename}\n🔒 Cifrado de extremo a extremo:\n${shareUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 rounded-2xl border border-emerald-500/40 bg-card/95 text-card-foreground p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-500 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              ¡Enlace protegido copiado!
            </h4>
            <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
              {filename}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Cerrar recibo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
        Tu archivo está blindado con llave efímera. Quien reciba la liga podrá descifrarlo en su navegador.
      </p>

      {copyFailed && (
        <div className="mb-3 space-y-1 animate-in fade-in-0 duration-150">
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            Selecciona y copia la liga directamente:
          </p>
          <input
            type="text"
            readOnly
            value={shareUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="w-full px-2.5 py-1 text-xs rounded-lg border border-border bg-muted font-mono select-all focus:outline-none"
          />
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <button
          type="button"
          onClick={handleWhatsApp}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors active:scale-95 cursor-pointer"
        >
          <MessageCircle className="w-3.5 h-3.5 fill-current" />
          <span>Enviar por WhatsApp</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center justify-center gap-1 h-9 px-3 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition-colors active:scale-95 cursor-pointer"
          title="Copiar de nuevo"
        >
          {copied ? (
            <span className="text-emerald-500 text-[11px] font-semibold">Copiado</span>
          ) : (
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        {onMoreOptions && (
          <button
            type="button"
            onClick={onMoreOptions}
            className="flex items-center justify-center h-9 px-2.5 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground text-xs font-medium transition-colors active:scale-95 cursor-pointer"
            title="Opciones avanzadas"
          >
            ⚙️
          </button>
        )}
      </div>
    </div>
  );
}

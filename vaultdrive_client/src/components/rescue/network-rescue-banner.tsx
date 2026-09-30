import { WifiOff, RefreshCw, X } from "lucide-react";

export interface NetworkRescueBannerProps {
  stagedCount: number;
  onResume: () => void;
  onDismiss: () => void;
  isResuming?: boolean;
}

export function NetworkRescueBanner({
  stagedCount,
  onResume,
  onDismiss,
  isResuming = false,
}: NetworkRescueBannerProps) {
  if (stagedCount <= 0) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-24 sm:bottom-6 left-4 sm:left-6 z-40 max-w-md rounded-2xl border border-amber-500/40 bg-card/95 text-card-foreground p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-500 shrink-0">
            <WifiOff className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Se nos cortó la señal tantito
            </h4>
            <p className="text-xs text-muted-foreground">
              Tus {stagedCount} archivo{stagedCount !== 1 ? "s están" : " está"} a salvo en tu teléfono.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Cerrar aviso de recuperación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border/40">
        <button
          type="button"
          onClick={onResume}
          disabled={isResuming}
          className="flex-1 flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isResuming ? "animate-spin" : ""}`} />
          <span>{isResuming ? "Subiendo..." : "Continuar subida"}</span>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="h-10 px-3 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground text-xs font-medium transition-colors cursor-pointer"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

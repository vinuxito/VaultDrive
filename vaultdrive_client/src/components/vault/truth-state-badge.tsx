import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, RefreshCw, Smartphone } from "lucide-react";
import { cn } from "../../lib/utils";

export type PhysicalState = "sealed" | "syncing" | "offline_safe" | "calculating";

export interface TruthStateBadgeProps {
  state: PhysicalState;
  className?: string;
  onClickReceipt?: () => void;
}

export function TruthStateBadge({
  state,
  className,
  onClickReceipt,
}: TruthStateBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const configs: Record<
    PhysicalState,
    {
      label: string;
      desc: string;
      icon: React.ReactNode;
      style: string;
    }
  > = {
    sealed: {
      label: "Blindado",
      desc: "Cifrado en tu chip con AES-256 y sellado en el servidor.",
      icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />,
      style: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    },
    syncing: {
      label: "Subiendo...",
      desc: "Transfiriendo paquete cifrado a la nube segura.",
      icon: <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />,
      style: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    },
    offline_safe: {
      label: "A salvo en cel",
      desc: "Guardado intacto en tu teléfono; se subirá en cuanto tengas señal.",
      icon: <Smartphone className="w-3.5 h-3.5 text-amber-500" />,
      style: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    },
    calculating: {
      label: "Calculando...",
      desc: "Verificando firmas de integridad de tu bóveda.",
      icon: <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground animate-pulse" />,
      style: "bg-muted text-muted-foreground border-border",
    },
  };

  const config = configs[state];

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => {
          setShowTooltip((prev) => !prev);
          onClickReceipt?.();
        }}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer select-none",
          config.style,
          className
        )}
        title={config.desc}
      >
        {config.icon}
        <span>{config.label}</span>
      </button>

      {showTooltip && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 w-52 p-2.5 rounded-xl border border-border bg-popover text-popover-foreground text-xs shadow-xl animate-in fade-in-0 duration-150"
        >
          <div className="font-semibold mb-0.5">{config.label}</div>
          <div className="text-[11px] text-muted-foreground leading-normal">
            {config.desc}
          </div>
        </div>
      )}
    </div>
  );
}

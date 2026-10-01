import React, { useEffect, useCallback } from "react";
import { Delete, RotateCcw } from "lucide-react";
import { playTumblerClick, playUnlockChime } from "../../utils/audioHaptics";
import { cn } from "../../lib/utils";

export interface SovereignPinPadProps {
  value: string;
  onChange: (pin: string) => void;
  onSubmit: (pin: string) => void;
  pinLength?: number;
  disabled?: boolean;
  autoSubmit?: boolean;
  className?: string;
}

export const SovereignPinPad: React.FC<SovereignPinPadProps> = ({
  value,
  onChange,
  onSubmit,
  pinLength = 4,
  disabled = false,
  autoSubmit = true,
  className,
}) => {
  const triggerHaptic = useCallback((ms = 12) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }, []);

  const handleDigit = useCallback(
    (digit: string) => {
      if (disabled || value.length >= pinLength) return;
      playTumblerClick();
      triggerHaptic(12);

      const nextVal = value + digit;
      onChange(nextVal);

      if (autoSubmit && nextVal.length === pinLength) {
        setTimeout(() => {
          playUnlockChime();
          triggerHaptic(25);
          onSubmit(nextVal);
        }, 50);
      }
    },
    [disabled, value, pinLength, onChange, autoSubmit, onSubmit, triggerHaptic]
  );

  const handleDelete = useCallback(() => {
    if (disabled || value.length === 0) return;
    playTumblerClick();
    triggerHaptic(10);
    onChange(value.slice(0, -1));
  }, [disabled, value, onChange, triggerHaptic]);

  const handleClear = useCallback(() => {
    if (disabled || value.length === 0) return;
    playTumblerClick();
    triggerHaptic(15);
    onChange("");
  }, [disabled, value, onChange, triggerHaptic]);

  // Support physical hardware keyboards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleDelete();
      } else if (e.key === "Escape" || e.key === "c" || e.key === "C") {
        e.preventDefault();
        handleClear();
      } else if (e.key === "Enter" && value.length === pinLength) {
        e.preventDefault();
        playUnlockChime();
        onSubmit(value);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, handleDigit, handleDelete, handleClear, value, pinLength, onSubmit]);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className={cn("flex flex-col items-center select-none w-full max-w-xs mx-auto", className)}>
      {/* 4 Glowing PIN Indicators */}
      <div className="flex items-center justify-center gap-4 py-4 mb-2">
        {Array.from({ length: pinLength }).map((_, idx) => {
          const isFilled = idx < value.length;
          return (
            <div
              key={idx}
              className={cn(
                "h-4 w-4 rounded-full transition-all duration-150",
                isFilled
                  ? "bg-primary scale-125 ring-4 ring-primary/20 shadow-md shadow-primary/40"
                  : "bg-muted border-2 border-border/80"
              )}
            />
          );
        })}
      </div>

      {/* 4x3 Tactical Dialpad Grid */}
      <div className="grid grid-cols-3 gap-3 w-full px-2">
        {digits.map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => handleDigit(digit)}
            aria-label={`Dígito ${digit}`}
            className="h-16 w-full rounded-2xl bg-card border border-border/70 hover:bg-muted/70 active:bg-primary active:text-primary-foreground active:scale-95 text-foreground text-2xl font-bold font-mono shadow-sm transition-all duration-100 flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            {digit}
          </button>
        ))}

        {/* Bottom Row: Clear, 0, Backspace */}
        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={handleClear}
          aria-label="Borrar todo el PIN"
          className="h-16 w-full rounded-2xl bg-card/60 border border-border/50 hover:bg-muted/70 active:scale-95 text-muted-foreground hover:text-foreground text-xs font-semibold shadow-sm transition-all duration-100 flex flex-col items-center justify-center cursor-pointer disabled:opacity-30"
        >
          <RotateCcw className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-wider uppercase">Borrar</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => handleDigit("0")}
          aria-label="Dígito 0"
          className="h-16 w-full rounded-2xl bg-card border border-border/70 hover:bg-muted/70 active:bg-primary active:text-primary-foreground active:scale-95 text-foreground text-2xl font-bold font-mono shadow-sm transition-all duration-100 flex items-center justify-center cursor-pointer disabled:opacity-50"
        >
          0
        </button>

        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={handleDelete}
          aria-label="Retroceso"
          className="h-16 w-full rounded-2xl bg-card/60 border border-border/50 hover:bg-muted/70 active:scale-95 text-muted-foreground hover:text-foreground text-xs font-semibold shadow-sm transition-all duration-100 flex flex-col items-center justify-center cursor-pointer disabled:opacity-30"
        >
          <Delete className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-wider uppercase">Borrar</span>
        </button>
      </div>
    </div>
  );
};

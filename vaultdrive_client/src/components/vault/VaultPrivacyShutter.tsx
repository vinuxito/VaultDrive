import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Unlock, KeyRound } from "lucide-react";
import { playDeadboltThud, playUnlockChime, playTumblerClick } from "../../utils/audioHaptics";

interface VaultPrivacyShutterProps {
  isLocked: boolean;
  onUnlock: () => void;
  onScrubMemory?: () => void;
}

export const VaultPrivacyShutter: React.FC<VaultPrivacyShutterProps> = ({
  isLocked,
  onUnlock,
  onScrubMemory,
}) => {
  const { t } = useTranslation(["drive"]);
  const [pin, setPin] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLocked) {
      playDeadboltThud();
      onScrubMemory?.();
      setPin("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isLocked, onScrubMemory]);

  if (!isLocked) return null;

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    playTumblerClick();
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    setPin(val);
    if (val.length === 4) {
      setTimeout(() => {
        playUnlockChime();
        onUnlock();
      }, 50);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playUnlockChime();
    onUnlock();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vault Privacy Shutter"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-2xl text-foreground p-6 select-none animate-in fade-in duration-300"
    >
      <div className="flex flex-col items-center max-w-sm w-full text-center space-y-6">
        {/* Glowing Shield Emblem */}
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-2xl ring-1 ring-primary/20">
            <Lock className="w-10 h-10 text-primary" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-primary"></span>
          </span>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {t("drive:vault.privacyShutter.title", { defaultValue: "Vault Locked for Privacy" })}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("drive:vault.privacyShutter.description", {
              defaultValue: "All decrypted memory buffers scrubbed. Enter your session PIN or press Unlock to restore your workspace.",
            })}
          </p>
        </div>

        {/* PIN Entry or Quick Unlock */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-2">
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={handlePinChange}
              placeholder="••••"
              autoFocus
              className="w-48 mx-auto block text-center text-2xl tracking-[0.5em] font-mono py-2.5 rounded-xl border border-border bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-inner"
            />
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground font-mono">
              <KeyRound className="w-3 h-3" />
              <span>{t("drive:vault.privacyShutter.pinLabel", { defaultValue: "4-DIGIT SOVEREIGN PIN" })}</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold shadow-lg transition-all active:scale-[0.99] cursor-pointer"
          >
            <Unlock className="w-4 h-4" />
            <span>{t("drive:vault.privacyShutter.resumeSession", { defaultValue: "Resume Sovereign Session" })}</span>
          </button>
        </form>

        <p className="text-[10px] text-muted-foreground font-mono">
          {t("drive:vault.privacyShutter.hotkey", { defaultValue: "HOTKEY: ⌘L TO TOGGLE PRIVACY SHUTTER" })}
        </p>
      </div>
    </div>
  );
};

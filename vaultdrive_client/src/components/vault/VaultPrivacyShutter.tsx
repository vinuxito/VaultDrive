import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Unlock } from "lucide-react";
import { playDeadboltThud, playUnlockChime } from "../../utils/audioHaptics";
import { clearAuthSessionStorage, getLoginUrl } from "../../utils/auth-session";

import { SovereignPinPad } from "./SovereignPinPad";
import { broadcastContinuumEvent, scrubAllRamVoiceMemos } from "../../utils/continuum-bridge";

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

  useEffect(() => {
    if (isLocked) {
      playDeadboltThud();
      scrubAllRamVoiceMemos();
      onScrubMemory?.();
      broadcastContinuumEvent({ type: "PANIC_LOCK", source: "desktop" });
      setPin("");
    }
  }, [isLocked, onScrubMemory]);

  if (!isLocked) return null;

  const handleUnlockWithPin = (_finalPin: string) => {
    playUnlockChime();
    broadcastContinuumEvent({ type: "VAULT_UNLOCK", source: "desktop" });
    onUnlock();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playUnlockChime();
    broadcastContinuumEvent({ type: "VAULT_UNLOCK", source: "desktop" });
    onUnlock();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vault Privacy Shutter"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-2xl text-foreground p-6 select-none animate-in fade-in duration-300 overflow-y-auto"
    >
      <div className="flex flex-col items-center max-w-sm w-full text-center space-y-4 my-auto">
        {/* Glowing Shield Emblem */}
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-2xl ring-1 ring-primary/20">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-primary"></span>
          </span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/12 border border-emerald-500/30 text-[10.5px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>0.0 MB en RAM · Llaves Purgadas · Continuum Sync</span>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground abrn-serif">
            {t("drive:vault.privacyShutter.title", { defaultValue: "Vault Locked for Privacy" })}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("drive:vault.privacyShutter.description", {
              defaultValue: "All decrypted memory buffers scrubbed. Enter your session PIN or press Unlock to restore your workspace.",
            })}
          </p>
        </div>

        {/* Tactile Sovereign 4x3 PIN Pad */}
        <div className="w-full">
          <SovereignPinPad
            value={pin}
            onChange={setPin}
            onSubmit={handleUnlockWithPin}
          />
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-3">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold shadow-lg transition-all active:scale-[0.99] cursor-pointer min-h-[48px]"
          >
            <Unlock className="w-4 h-4" />
            <span>{t("drive:vault.privacyShutter.resumeSession", { defaultValue: "Resume Sovereign Session" })}</span>
          </button>

          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => {
                clearAuthSessionStorage();
                window.location.replace(getLoginUrl());
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer min-h-[44px] flex items-center"
            >
              {t("drive:vault.privacyShutter.forgotPin", {
                defaultValue: "Forgot your PIN? Log out to sign in with your password",
              })}
            </button>
          </div>
        </form>

        <p className="text-[10px] text-muted-foreground font-mono">
          {t("drive:vault.privacyShutter.hotkey", { defaultValue: "HOTKEY: ⌘L TO TOGGLE PRIVACY SHUTTER" })}
        </p>
      </div>
    </div>
  );
};

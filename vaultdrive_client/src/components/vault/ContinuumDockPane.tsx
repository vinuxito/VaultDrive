import React, { useEffect, useRef, useState } from "react";
import { Smartphone, Zap, ShieldCheck, Lock, RefreshCw, Sparkles, X } from "lucide-react";
import { BASE_PATH } from "../../utils/api";
import type { Skin } from "../theme-context";
import {
  broadcastContinuumEvent,
  skinToMobilePreviewId,
  skinToPreviewTheme,
  type ContinuumViewportMode,
} from "../../utils/continuum-bridge";

export interface ContinuumDockPaneProps {
  mode: Extract<ContinuumViewportMode, "dual" | "mobile-studio">;
  skin: Skin;
  activeClientName?: string;
  isLocked?: boolean;
  onMagicScanToPc: () => Promise<void> | void;
  onTriggerReconcileBoth: () => void;
  onToggleLockBoth: () => void;
  onCloseDock: () => void;
}

export const ContinuumDockPane: React.FC<ContinuumDockPaneProps> = ({
  mode,
  skin,
  activeClientName = "Grupo Roche SA de CV",
  isLocked = false,
  onMagicScanToPc,
  onTriggerReconcileBoth,
  onToggleLockBoth,
  onCloseDock,
}) => {
  const [deviceBezel, setDeviceBezel] = useState<"iphone" | "android">("android");
  const [mobileSrcDoc, setMobileSrcDoc] = useState<string>("");
  const [loadingFrame, setLoadingFrame] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadCompanionHtml = async () => {
      setLoadingFrame(true);
      try {
        const res = await fetch(`${BASE_PATH}/previews/mobile.html`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rawHtml = await res.text();
        if (cancelled) return;
        const bootPayload = JSON.stringify({
          skin: skinToMobilePreviewId(skin),
          embed: true,
          client: activeClientName,
        });
        // Inject boot payload right after <head> without <base> tag so strict CSP base-uri 'self' passes 100%
        const hydrated = rawHtml.replace(
          /<head([^>]*)>/i,
          `<head$1><script>window.__ABRN_BOOT=${bootPayload};</script>`
        );
        setMobileSrcDoc(hydrated);
      } catch {
        if (!cancelled) {
          setMobileSrcDoc("");
        }
      } finally {
        if (!cancelled) setLoadingFrame(false);
      }
    };
    void loadCompanionHtml();
    return () => {
      cancelled = true;
    };
  }, []);

  const pushSkinToCompanion = (targetSkin: Skin) => {
    broadcastContinuumEvent(
      {
        type: "THEME_CHANGE",
        skin: targetSkin,
        theme: skinToPreviewTheme(targetSkin),
        source: "desktop",
      },
      iframeRef.current
    );
  };

  // Push 0ms skin & lock sync to embedded mobile companion whenever skin or lock changes
  useEffect(() => {
    pushSkinToCompanion(skin);
  }, [skin, mobileSrcDoc]);

  useEffect(() => {
    broadcastContinuumEvent(
      {
        type: isLocked ? "PANIC_LOCK" : "VAULT_UNLOCK",
        source: "desktop",
      },
      iframeRef.current
    );
  }, [isLocked]);

  const handleMagicCrossScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          {
            __abrnContinuum: true,
            source: "desk_react",
            type: "MAGIC_CROSS_DEMO",
            payload: {},
            ts: Date.now(),
          },
          "*"
        );
      } catch {
        // Ignore cross-frame transient races
      }
      broadcastContinuumEvent(
        {
          type: "MOBILE_SCAN_UPLOADED",
          filename: "Poliza_Egresos_Escaneada_Android13_Nov2026_$48,500.00.pdf",
          folderName: activeClientName,
          source: "mobile",
        },
        iframeRef.current
      );
      await onMagicScanToPc();
    } finally {
      setScanning(false);
    }
  };

  const phoneChassis = (
    <div className="flex flex-col items-center gap-2.5">
      {/* Device Bezel Selector + Magic Cross-Device Action Bar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-1.5 px-1">
        <div
          role="group"
          aria-label="Chasis físico móvil"
          style={{ background: "var(--abrn-bg)", borderColor: "var(--abrn-border)" }}
          className="inline-flex items-center p-0.5 rounded-lg border text-[10.5px] font-bold"
        >
          <button
            type="button"
            data-testid="continuum-frame-iphone"
            onClick={() => setDeviceBezel("iphone")}
            className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
              deviceBezel === "iphone"
                ? "bg-card text-primary shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            iPhone 16 Pro
          </button>
          <button
            type="button"
            data-testid="continuum-frame-android"
            onClick={() => setDeviceBezel("android")}
            className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
              deviceBezel === "android"
                ? "bg-card text-primary shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Android 13
          </button>
        </div>

        <button
          type="button"
          data-testid="btn-magic-cross"
          disabled={scanning}
          onClick={() => void handleMagicCrossScan()}
          className="abrn-btn abrn-btn-primary !h-7 !px-2.5 !text-[11px]"
          title="Escanea desde el celular en vivo y cifra AES-256-GCM directo a esta carpeta de PC"
        >
          {scanning ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Zap className="w-3 h-3" />
          )}
          <span>⚡ Escanear Cel → PC</span>
        </button>
      </div>

      {/* Tactile Hardware Bezel */}
      <div
        data-testid="continuum-phone-chassis"
        data-device={deviceBezel}
        style={{
          borderRadius: deviceBezel === "iphone" ? "44px" : "30px",
          border:
            deviceBezel === "iphone"
              ? "8px solid #1c1f26"
              : "7px solid #111827",
          boxShadow: "0 24px 60px rgba(0,0,0,0.42), inset 0 0 0 1px rgba(255,255,255,0.14)",
        }}
        className="relative w-[372px] max-w-full h-[720px] max-h-[calc(100dvh-165px)] bg-[#030712] overflow-hidden flex flex-col shrink-0"
      >
        {loadingFrame ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-2 text-xs abrn-mono">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
            <span>Cargando vista celular…</span>
          </div>
        ) : mobileSrcDoc ? (
          <iframe
            ref={iframeRef}
            title="Vista en vivo del celular ABRN"
            data-testid="continuum-mobile-iframe"
            srcDoc={mobileSrcDoc}
            onLoad={() => pushSkinToCompanion(skin)}
            className="w-full h-full border-0 bg-transparent"
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-200 gap-2">
            <Smartphone className="w-8 h-8 text-emerald-400" />
            <p className="text-xs font-bold">Vista celular lista</p>
            <p className="text-[11px] text-slate-400">
              Abre esta misma ruta en tu Android o iPhone para usar la barra inferior táctil.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  if (mode === "mobile-studio") {
    return (
      <div
        data-testid="continuum-mobile-studio-stage"
        style={{ background: "var(--abrn-stage-canvas)" }}
        className="flex-1 h-full overflow-y-auto p-4 sm:p-6 flex flex-col lg:flex-row items-center justify-center gap-6"
      >
        {phoneChassis}

        {/* Companion Controls */}
        <div
          style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
          className="w-full max-w-md rounded-2xl border p-5 space-y-4 shadow-md"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="abrn-blindado-pill">
              <span className="abrn-pulse-dot" />
              <span>Vista en vivo de tu celular</span>
            </span>
            <button
              type="button"
              onClick={onCloseDock}
              className="abrn-btn !h-7 !px-2.5 !text-[11px]"
            >
              <X className="w-3.5 h-3.5" />
              <span>Volver a PC</span>
            </button>
          </div>

          <div className="space-y-1">
            <h2 className="abrn-serif text-lg font-bold text-foreground">
              Tus mismos archivos en versión móvil
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Revisa cómo se ve el expediente de <strong>{activeClientName}</strong>, el escáner y el Cuadre BBVA desde un teléfono.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => void handleMagicCrossScan()}
              className="abrn-btn abrn-btn-primary !h-10 justify-center"
            >
              <Sparkles className="w-4 h-4" />
              <span>⚡ Escanear documento del celular a PC</span>
            </button>
            <button
              type="button"
              onClick={() => {
                broadcastContinuumEvent({ type: "OPEN_RECONCILE", source: "desktop" }, iframeRef.current);
                onTriggerReconcileBoth();
              }}
              className="abrn-btn !h-9 justify-center"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Abrir Cuadre CFDI ↔ BBVA</span>
            </button>
            <button
              type="button"
              onClick={onToggleLockBoth}
              className="abrn-btn !h-9 justify-center"
            >
              <Lock className="w-4 h-4 text-amber-500" />
              <span>Bloquear PC y celular al mismo tiempo (⌘L)</span>
            </button>
          </div>

          <div
            style={{ background: "var(--abrn-bg)", borderColor: "var(--abrn-border)" }}
            className="rounded-xl border p-3 text-[11px] space-y-1.5 text-muted-foreground"
          >
            <div className="font-bold text-foreground">Comodidad en celular:</div>
            <div>• Sin recortes laterales y botones fáciles de tocar con una mano</div>
            <div>• El botón físico Atrás cierra ventanas sin sacarte de tu cuenta</div>
            <div>• Tus documentos se protegen antes de salir de tu teléfono</div>
          </div>
        </div>
      </div>
    );
  }

  // Dual Live Mode: Docked Right-Hand Companion Pane alongside Desktop Workstation!
  return (
    <aside
      data-testid="continuum-dual-dock"
      aria-label="Vista en vivo del celular"
      style={{ background: "var(--abrn-bg-elevated)", borderColor: "var(--abrn-border)" }}
      className="hidden lg:flex w-[408px] xl:w-[422px] shrink-0 h-full border-l flex-col overflow-hidden select-none"
    >
      <div
        style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
        className="px-3.5 py-2 border-b flex items-center justify-between gap-2 shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold text-foreground truncate">
              Celular sincronizado en vivo
            </div>
            <div className="text-[9.5px] text-muted-foreground truncate">
              Cambios reflejados al instante
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid="continuum-dual-reconcile-btn"
            onClick={() => {
              broadcastContinuumEvent({ type: "OPEN_RECONCILE", source: "desktop" }, iframeRef.current);
              onTriggerReconcileBoth();
            }}
            className="abrn-btn !h-6 !px-2 !text-[10.5px]"
            title="Abrir Cuadre BBVA en ambos dispositivos"
          >
            <span>Cuadre en ambos</span>
          </button>
          <button
            type="button"
            onClick={onCloseDock}
            aria-label="Cerrar vista celular"
            className="w-6 h-6 rounded-md border border-border bg-background hover:text-primary inline-flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col items-center justify-start">
        {phoneChassis}
      </div>
    </aside>
  );
};

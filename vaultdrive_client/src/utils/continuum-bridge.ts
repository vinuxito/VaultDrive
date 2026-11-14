import type { Skin } from "../components/theme-context";

export type ContinuumViewportMode = "desktop" | "dual" | "mobile-studio";
export type ContinuumCenterModule = "files" | "reconcile" | "access";
export type ContinuumMobileTab = "pulso" | "archivos" | "entregas" | "boveda";

export interface ContinuumEventPayload {
  type:
    | "THEME_CHANGE"
    | "PANIC_LOCK"
    | "VAULT_UNLOCK"
    | "OPEN_RECONCILE"
    | "MOBILE_SCAN_UPLOADED"
    | "VOICE_NOTE_UPDATED"
    | "SELECT_CLIENT";
  theme?: "abrn-cream" | "abrn-slate" | "abrn-oled";
  skin?: Skin;
  filename?: string;
  sha256?: string;
  folderName?: string;
  fileId?: string;
  durationLabel?: string;
  source?: "desktop" | "mobile";
  timestamp?: number;
}

export interface EncryptedRamVoiceMemo {
  fileId: string;
  filename: string;
  durationSec: number;
  durationLabel: string;
  transcriptHint: string;
  createdAt: string;
}

const CHANNEL_NAME = "abrn_continuum_v25";

// Ephemeral in-RAM map (scrubbed immediately on VaultPrivacyShutter lock!)
const ramVoiceMemos = new Map<string, EncryptedRamVoiceMemo>();

export function skinToPreviewTheme(skin: Skin): "abrn-cream" | "abrn-slate" | "abrn-oled" {
  if (skin === "oled") return "abrn-oled";
  if (skin === "dark" || skin === "quantix" || skin === "cyberpunk" || skin === "elegant") {
    return "abrn-slate";
  }
  return "abrn-cream";
}

export function skinToMobilePreviewId(skin: Skin): "abrn-light" | "abrn-dark" | "abrn-oled" {
  if (skin === "oled") return "abrn-oled";
  if (skin === "dark" || skin === "quantix" || skin === "cyberpunk" || skin === "elegant") {
    return "abrn-dark";
  }
  return "abrn-light";
}

export function previewThemeToSkin(theme?: string): Skin {
  if (theme === "abrn-oled") return "oled";
  if (theme === "abrn-slate" || theme === "abrn-dark") return "dark";
  return "light";
}

export function broadcastContinuumEvent(
  payload: ContinuumEventPayload,
  targetIframe?: HTMLIFrameElement | null
): void {
  const stamped: ContinuumEventPayload = {
    ...payload,
    timestamp: payload.timestamp ?? Date.now(),
  };

  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    try {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.postMessage(stamped);
      bc.close();
    } catch {
      // Safe fallback when BroadcastChannel is restricted
    }
  }

  if (targetIframe?.contentWindow) {
    try {
      targetIframe.contentWindow.postMessage(
        { __abrnContinuum: true, source: "desk_react", ...stamped },
        "*"
      );
      if (stamped.type === "THEME_CHANGE" && stamped.skin) {
        targetIframe.contentWindow.postMessage(
          {
            __abrnContinuum: true,
            source: "desk_react",
            type: "SKIN_CHANGE",
            payload: { skin: skinToMobilePreviewId(stamped.skin) },
            ts: Date.now(),
          },
          "*"
        );
      } else if (stamped.type === "OPEN_RECONCILE") {
        targetIframe.contentWindow.postMessage(
          {
            __abrnContinuum: true,
            source: "desk_react",
            type: "RUN_SCENARIO",
            payload: { scenario: 2 },
            ts: Date.now(),
          },
          "*"
        );
      }
    } catch {
      // Ignore cross-frame transient races
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("abrn-continuum-local", { detail: stamped }));
  }
}

export function subscribeContinuumEvents(
  handler: (event: ContinuumEventPayload) => void
): () => void {
  const normalizeIncoming = (raw: unknown): ContinuumEventPayload | null => {
    if (!raw || typeof raw !== "object") return null;
    const data = raw as Record<string, unknown>;
    if (data.type === "SKIN_CHANGE" && data.payload && typeof data.payload === "object") {
      const skinStr = (data.payload as Record<string, unknown>).skin;
      if (typeof skinStr === "string") {
        const mappedSkin = previewThemeToSkin(skinStr);
        return {
          type: "THEME_CHANGE",
          skin: mappedSkin,
          theme: skinToPreviewTheme(mappedSkin),
          source: "mobile",
        };
      }
    }
    const allowedTypes = new Set([
      "THEME_CHANGE",
      "PANIC_LOCK",
      "VAULT_UNLOCK",
      "OPEN_RECONCILE",
      "MOBILE_SCAN_UPLOADED",
      "VOICE_NOTE_UPDATED",
      "SELECT_CLIENT",
    ]);
    if (typeof data.type === "string" && allowedTypes.has(data.type)) {
      return data as unknown as ContinuumEventPayload;
    }
    return null;
  };

  let bc: BroadcastChannel | null = null;
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (ev: MessageEvent) => {
        const parsed = normalizeIncoming(ev?.data);
        if (parsed) handler(parsed);
      };
    } catch {
      bc = null;
    }
  }

  const onWindowMessage = (ev: MessageEvent) => {
    const parsed = normalizeIncoming(ev?.data);
    if (parsed) handler(parsed);
  };

  const onLocalCustom = (ev: Event) => {
    const custom = ev as CustomEvent<ContinuumEventPayload>;
    if (custom.detail) {
      handler(custom.detail);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("message", onWindowMessage);
    window.addEventListener("abrn-continuum-local", onLocalCustom);
  }

  return () => {
    if (bc) {
      try {
        bc.close();
      } catch {
        // Ignore
      }
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("message", onWindowMessage);
      window.removeEventListener("abrn-continuum-local", onLocalCustom);
    }
  };
}

export function getRamVoiceMemo(fileId?: string | null, filename?: string | null): EncryptedRamVoiceMemo | null {
  if (fileId && ramVoiceMemos.has(fileId)) {
    return ramVoiceMemos.get(fileId)!;
  }
  const lower = (filename || "").toLowerCase();
  if (lower.includes("bbva") || lower.includes("banorte") || lower.includes("estado_de_cuenta") || lower.includes("cfdi") || lower.includes("factura")) {
    return {
      fileId: fileId || "default-memo",
      filename: filename || "Expediente_Contable",
      durationSec: 12,
      durationLabel: "0:12",
      transcriptHint: "Nota contadora: Amarre verificado contra CFDI 4.0 del periodo; póliza lista para cierre mensual.",
      createdAt: "En RAM · AES-256",
    };
  }
  return null;
}

export function saveRamVoiceMemo(
  fileId: string,
  filename: string,
  durationSec = 14,
  transcriptHint = "Dictado cifrado en RAM: Revisado por contabilidad ABRN, autorizado para envío #key."
): EncryptedRamVoiceMemo {
  const mins = Math.floor(durationSec / 60);
  const secs = String(durationSec % 60).padStart(2, "0");
  const memo: EncryptedRamVoiceMemo = {
    fileId,
    filename,
    durationSec,
    durationLabel: `${mins}:${secs}`,
    transcriptHint,
    createdAt: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
  };
  ramVoiceMemos.set(fileId, memo);
  broadcastContinuumEvent({
    type: "VOICE_NOTE_UPDATED",
    fileId,
    filename,
    durationLabel: memo.durationLabel,
  });
  return memo;
}

export function scrubAllRamVoiceMemos(): void {
  ramVoiceMemos.clear();
}

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
  hasAudio?: boolean;
  audioDataUrl?: string;
}

const CHANNEL_NAME = "abrn_continuum_v25";
const NOTES_STORAGE_KEY = "abrn_vault_file_notes_v1";

// Active in-memory map (scrubbed immediately on VaultPrivacyShutter lock, restored on unlock)
const ramVoiceMemos = new Map<string, EncryptedRamVoiceMemo>();
let notesHydrated = false;
let notesLocked = false;

function persistNotesToStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const serialized: Record<string, EncryptedRamVoiceMemo> = {};
    ramVoiceMemos.forEach((memo, key) => {
      serialized[key] = memo;
    });
    window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

function hydrateNotesIfNeeded(): void {
  if (notesLocked || notesHydrated || typeof window === "undefined") return;
  notesHydrated = true;
  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, EncryptedRamVoiceMemo>;
    if (!parsed || typeof parsed !== "object") return;
    Object.entries(parsed).forEach(([key, val]) => {
      if (val && typeof val.transcriptHint === "string") {
        ramVoiceMemos.set(key, val);
      }
    });
  } catch {
    // Ignore malformed storage entries
  }
}

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

export function getRamVoiceMemo(fileId?: string | null, _filename?: string | null): EncryptedRamVoiceMemo | null {
  if (notesLocked || !fileId) return null;
  hydrateNotesIfNeeded();
  return ramVoiceMemos.get(fileId) ?? null;
}

export function saveRamVoiceMemo(
  fileId: string,
  filename: string,
  durationSec = 0,
  transcriptHint = "",
  options?: { hasAudio?: boolean; audioDataUrl?: string }
): EncryptedRamVoiceMemo {
  notesLocked = false;
  hydrateNotesIfNeeded();
  const cleanText = transcriptHint.trim() || "Revisado por contabilidad";
  const hasAudio = Boolean(options?.hasAudio);
  const mins = Math.floor(Math.max(0, durationSec) / 60);
  const secs = String(Math.max(0, durationSec) % 60).padStart(2, "0");
  const memo: EncryptedRamVoiceMemo = {
    fileId,
    filename,
    durationSec: hasAudio ? Math.max(1, durationSec) : 0,
    durationLabel: hasAudio ? `${mins}:${secs}` : "Nota",
    transcriptHint: cleanText,
    createdAt: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
    hasAudio,
    audioDataUrl: options?.audioDataUrl,
  };
  ramVoiceMemos.set(fileId, memo);
  persistNotesToStorage();
  broadcastContinuumEvent({
    type: "VOICE_NOTE_UPDATED",
    fileId,
    filename,
    durationLabel: memo.durationLabel,
  });
  return memo;
}

export function deleteRamVoiceMemo(fileId: string): void {
  hydrateNotesIfNeeded();
  ramVoiceMemos.delete(fileId);
  persistNotesToStorage();
  broadcastContinuumEvent({
    type: "VOICE_NOTE_UPDATED",
    fileId,
  });
}

export function scrubAllRamVoiceMemos(): void {
  notesLocked = true;
  ramVoiceMemos.clear();
  broadcastContinuumEvent({
    type: "VOICE_NOTE_UPDATED",
  });
}

export function restoreRamVoiceMemos(): void {
  notesLocked = false;
  notesHydrated = false;
  hydrateNotesIfNeeded();
  broadcastContinuumEvent({
    type: "VOICE_NOTE_UPDATED",
  });
}

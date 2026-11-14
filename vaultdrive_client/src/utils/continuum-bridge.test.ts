import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteRamVoiceMemo,
  getRamVoiceMemo,
  restoreRamVoiceMemos,
  saveRamVoiceMemo,
  scrubAllRamVoiceMemos,
} from "./continuum-bridge";

describe("continuum-bridge truthful file notes", () => {
  beforeEach(() => {
    window.localStorage.clear();
    restoreRamVoiceMemos();
  });

  it("never invents fake 0:12 voice notes on unannotated BBVA or CFDI filenames", () => {
    expect(
      getRamVoiceMemo("file-bbva-1", "BBVA_Estado_de_Cuenta_Nov2026_$418,200.00.pdf")
    ).toBeNull();
    expect(
      getRamVoiceMemo("file-cfdi-1", "2026-11_CFDI_Grupo_Roche_$245,000.00.xml")
    ).toBeNull();
  });

  it("persists saved notes to localStorage, scrubs them on privacy lock, restores on unlock, and deletes permanently", () => {
    const saved = saveRamVoiceMemo(
      "file-roche-99",
      "2026-11_CFDI_Grupo_Roche.xml",
      0,
      "Revisado y amarrado contra SPEI"
    );
    expect(saved.hasAudio).toBe(false);
    expect(saved.durationLabel).toBe("Nota");
    expect(getRamVoiceMemo("file-roche-99")?.transcriptHint).toBe(
      "Revisado y amarrado contra SPEI"
    );

    const rawStored = window.localStorage.getItem("abrn_vault_file_notes_v1");
    expect(rawStored).toContain("Revisado y amarrado contra SPEI");

    // Privacy lock hides in-memory notes immediately without destroying storage
    scrubAllRamVoiceMemos();
    expect(getRamVoiceMemo("file-roche-99")).toBeNull();

    // Unlock restores persisted notes
    restoreRamVoiceMemos();
    expect(getRamVoiceMemo("file-roche-99")?.transcriptHint).toBe(
      "Revisado y amarrado contra SPEI"
    );

    // Explicit delete removes from memory and localStorage
    deleteRamVoiceMemo("file-roche-99");
    expect(getRamVoiceMemo("file-roche-99")).toBeNull();
    restoreRamVoiceMemos();
    expect(getRamVoiceMemo("file-roche-99")).toBeNull();
  });
});

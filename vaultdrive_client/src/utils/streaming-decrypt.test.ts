import { describe, it, expect } from "vitest";
import {
  decryptWithManagedMemory,
  extractSnippetForIndexing,
  type DecryptProgressEvent,
} from "./streaming-decrypt";

describe("streaming-decrypt", () => {
  it("extracts text snippets from text/xml buffers", () => {
    const text = "<?xml version='1.0'?><cfdi:Comprobante Total='1450.00'/>";
    const enc = new TextEncoder();
    const buffer = enc.encode(text).buffer;

    const snippet = extractSnippetForIndexing(buffer, "text/xml");
    expect(snippet).toBe(text);
  });

  it("extracts readable strings from PDF byte buffers", () => {
    const fakePdf = "%PDF-1.7 Contrato de Arrendamiento 2026 Pago Mensual $15000";
    const enc = new TextEncoder();
    const buffer = enc.encode(fakePdf).buffer;

    const snippet = extractSnippetForIndexing(buffer, "application/pdf");
    expect(snippet).toContain("Contrato de Arrendamiento 2026");
  });

  it("performs AES-GCM decryption with progress events", async () => {
    // Generate AES key
    const key = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = "Secreto Soberano ABRN";
    const enc = new TextEncoder();
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(plaintext)
    );

    const progressLogs: DecryptProgressEvent[] = [];
    const artifact = await decryptWithManagedMemory(
      encrypted,
      key,
      iv,
      "text/plain",
      (evt) => progressLogs.push(evt)
    );

    expect(progressLogs.length).toBeGreaterThanOrEqual(3);
    expect(progressLogs[progressLogs.length - 1].stage).toBe("ready");
    expect(artifact.snippet).toBe(plaintext);
    expect(typeof artifact.revoke).toBe("function");

    // Cleanup
    artifact.revoke();
  });
});

/**
 * El Cerebro Ciego — Sub-100ms Streaming & Decryption Pipeline
 * Zero-Plaintext Transmission, Progressive Memory Decryption, Safe URL Management.
 */

export interface DecryptProgressEvent {
  stage: "init" | "decrypting" | "extracting" | "ready";
  percent: number;
}

export type DecryptProgressCallback = (event: DecryptProgressEvent) => void;

export interface DecryptedArtifact {
  data: ArrayBuffer;
  blob: Blob;
  objectUrl: string;
  snippet?: string;
  revoke: () => void;
}

/**
 * Decrypts AES-256-GCM ArrayBuffer in memory and creates a managed safe Object URL
 */
export async function decryptWithManagedMemory(
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array,
  mimeType = "application/octet-stream",
  onProgress?: DecryptProgressCallback
): Promise<DecryptedArtifact> {
  onProgress?.({ stage: "init", percent: 15 });

  onProgress?.({ stage: "decrypting", percent: 45 });
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    encryptedData
  );

  onProgress?.({ stage: "extracting", percent: 85 });
  const snippet = extractSnippetForIndexing(decrypted, mimeType);

  const blob = new Blob([decrypted], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  onProgress?.({ stage: "ready", percent: 100 });

  return {
    data: decrypted,
    blob,
    objectUrl,
    snippet,
    revoke: () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * Extracts searchable text snippet from decrypted memory buffer
 */
export function extractSnippetForIndexing(
  buffer: ArrayBuffer,
  mimeType = "",
  maxCharsOrFilename: number | string = 2000,
  filenameArg = ""
): string | undefined {
  const maxChars = typeof maxCharsOrFilename === "number" ? maxCharsOrFilename : 2000;
  const filename = (typeof maxCharsOrFilename === "string" ? maxCharsOrFilename : filenameArg).toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  try {
    const isText =
      mime.includes("text") ||
      mime.includes("xml") ||
      mime.includes("json") ||
      mime.includes("csv") ||
      mime.includes("javascript") ||
      /\.(?:xml|txt|md|csv|json|html|htm|js|ts|py|go|sh|yaml|yml)$/.test(filename);

    if (isText) {
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const fullText = decoder.decode(buffer.slice(0, maxChars * 2));
      return fullText.slice(0, maxChars).replace(/\s+/g, " ").trim();
    }

    // For PDF or other documents, extract readable strings if possible
    if (mime.includes("pdf") || filename.endsWith(".pdf")) {
      const bytes = new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 16384)));
      let ascii = "";
      for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if ((b >= 32 && b <= 126) || b === 10 || b === 13) {
          ascii += String.fromCharCode(b);
        } else if (ascii.length > 0 && ascii[ascii.length - 1] !== " ") {
          ascii += " ";
        }
      }
      const clean = ascii.replace(/\s+/g, " ").trim();
      return clean.length > 30 ? clean.slice(0, maxChars) : undefined;
    }
  } catch {
    /* fallback to undefined */
  }

  return undefined;
}


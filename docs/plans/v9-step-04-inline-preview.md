# v9 — Step 4: Inline File Preview
> **Operation Go Live** | Step 4 of 7
> **Index**: [v9-go-live-index.md](./v9-go-live-index.md)
> **Estimated Time**: ~4 hours
> **Priority**: 🟠 High — The #1 feature request from beta users

---

## Problem Statement

Every encrypted file in the vault today requires a full download to view it. For images, PDFs, and text files, this is unnecessary friction. Beta users consistently say: "I just want to peek at it."

The previous plan flagged this as deferred because of "WASM bundle size." That concern was about compiling PDFium. We don't need to do that.

**The actual solution is simpler:**
1. For **images** (PNG, JPG, WebP, GIF, SVG): decrypt the ciphertext in a Web Worker, create an `ObjectURL` from the decrypted `ArrayBuffer`, and display it in an `<img>` tag. Zero external dependencies.
2. For **plain text + Markdown** (TXT, MD, JSON, CSV): decrypt, decode UTF-8, render in a `<pre>` tag or a minimal Markdown renderer.
3. For **PDFs**: decrypt, create an `ObjectURL`, embed in `<iframe src={objectUrl}>`. The browser's native PDF viewer handles rendering. No WASM needed.
4. For everything else: show the "Download to view" fallback.

This is entirely client-side. The server just streams the encrypted blob — same as a download, but we stop before writing to disk.

---

## Architecture

```
User clicks preview →
  InlinePreview modal opens →
    preview.worker.ts receives encrypted blob + key material →
      Worker decrypts in background (no UI block) →
        Returns ObjectURL or decoded text →
          Modal renders result
```

We use a dedicated Web Worker (`preview.worker.ts`) so the decryption never blocks the UI thread. The worker is already the pattern used by `argon2.worker.ts`.

---

## Exact Files to Create/Modify

### NEW: `vaultdrive_client/src/workers/preview.worker.ts`

```typescript
/**
 * preview.worker.ts
 * Receives encrypted file data + AES-GCM key material, decrypts,
 * and returns the decrypted ArrayBuffer to the main thread.
 *
 * Messages in:  { type: "DECRYPT", ciphertext: ArrayBuffer, keyHex: string, ivHex: string }
 * Messages out: { type: "DECRYPTED", buffer: ArrayBuffer } | { type: "ERROR", message: string }
 */

self.onmessage = async (e: MessageEvent) => {
  const { type, ciphertext, keyHex, ivHex } = e.data;
  if (type !== "DECRYPT") return;

  try {
    const keyBytes = hexToBuf(keyHex);
    const iv = hexToBuf(ivHex);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertext
    );

    self.postMessage({ type: "DECRYPTED", buffer: decrypted }, [decrypted]);
  } catch (err) {
    self.postMessage({ type: "ERROR", message: (err as Error).message });
  }
};

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
```

---

### NEW: `vaultdrive_client/src/components/files/InlinePreview.tsx`

```tsx
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Loader2 } from "lucide-react";
import PreviewWorker from "../../workers/preview.worker?worker";

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; type: "image" | "pdf" | "text"; url: string; text?: string }
  | { status: "error"; message: string }
  | { status: "unsupported" };

const PREVIEWABLE_IMAGES = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
const PREVIEWABLE_TEXT = ["txt", "md", "json", "csv", "log", "yaml", "toml"];
const PREVIEWABLE_PDF = ["pdf"];

function getPreviewType(filename: string): "image" | "pdf" | "text" | "unsupported" {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (PREVIEWABLE_IMAGES.includes(ext)) return "image";
  if (PREVIEWABLE_PDF.includes(ext)) return "pdf";
  if (PREVIEWABLE_TEXT.includes(ext)) return "text";
  return "unsupported";
}

interface InlinePreviewProps {
  fileId: string;
  filename: string;
  /** AES-GCM key hex (already derived from PIN/RSA by the files page) */
  fileKeyHex: string;
  ivHex: string;
  onClose: () => void;
  onDownload: () => void;
}

export function InlinePreview({
  fileId,
  filename,
  fileKeyHex,
  ivHex,
  onClose,
  onDownload,
}: InlinePreviewProps) {
  const [state, setState] = useState<PreviewState>({ status: "idle" });
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const previewType = getPreviewType(filename);
    if (previewType === "unsupported") {
      setState({ status: "unsupported" });
      return;
    }

    setState({ status: "loading" });

    const worker = new PreviewWorker();

    // Fetch the encrypted blob from the server
    fetch(`/api/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((res) => res.arrayBuffer())
      .then((ciphertext) => {
        worker.postMessage({ type: "DECRYPT", ciphertext, keyHex: fileKeyHex, ivHex }, [ciphertext]);
      })
      .catch((err) => setState({ status: "error", message: err.message }));

    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === "DECRYPTED") {
        const buffer: ArrayBuffer = e.data.buffer;
        const pType = getPreviewType(filename);

        if (pType === "text") {
          const text = new TextDecoder().decode(buffer);
          setState({ status: "ready", type: "text", url: "", text });
        } else {
          const mimeTypes: Record<string, string> = {
            image: "image/*",
            pdf: "application/pdf",
          };
          const blob = new Blob([buffer], { type: mimeTypes[pType] });
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          setState({ status: "ready", type: pType as "image" | "pdf", url });
        }
      } else {
        setState({ status: "error", message: e.data.message });
      }
      worker.terminate();
    };

    return () => {
      worker.terminate();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [fileId, filename, fileKeyHex, ivHex]);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        <motion.div
          className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border px-5 py-3 flex-shrink-0">
            <p className="flex-1 truncate text-sm font-medium text-foreground">{filename}</p>
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto min-h-0">
            {state.status === "loading" && (
              <div className="flex h-64 items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Decrypting…</span>
              </div>
            )}

            {state.status === "error" && (
              <div className="flex h-64 items-center justify-center">
                <p className="text-sm text-red-400">Preview failed: {state.message}</p>
              </div>
            )}

            {state.status === "unsupported" && (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                <p className="text-sm">Preview not available for this file type.</p>
                <button onClick={onDownload} className="text-primary text-sm underline">
                  Download to view
                </button>
              </div>
            )}

            {state.status === "ready" && state.type === "image" && (
              <img
                src={state.url}
                alt={filename}
                className="max-h-[75vh] w-full object-contain p-4"
              />
            )}

            {state.status === "ready" && state.type === "pdf" && (
              <iframe
                src={state.url}
                title={filename}
                className="h-[75vh] w-full border-0"
              />
            )}

            {state.status === "ready" && state.type === "text" && (
              <pre className="p-5 text-xs text-foreground font-mono whitespace-pre-wrap overflow-auto max-h-[75vh]">
                {state.text}
              </pre>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
```

---

### MODIFY: `vaultdrive_client/src/pages/files.tsx`

Add a "Preview" action to the file row action menu:

```typescript
const [previewFile, setPreviewFile] = useState<{
  id: string;
  filename: string;
  keyHex: string;
  ivHex: string;
} | null>(null);

// In action menu for each file, add:
<button onClick={() => handlePreviewClick(file.id, file.filename, file.metadata)}>
  Preview
</button>
```

```typescript
const handlePreviewClick = async (fileId: string, filename: string, metadata: string) => {
  // metadata contains the AES key + IV, same as used during download
  // This is already parsed in the download flow, just reuse that logic
  const { fileKeyHex, ivHex } = parseFileMetadata(metadata, currentPin);
  setPreviewFile({ id: fileId, filename, keyHex: fileKeyHex, ivHex });
};
```

Add the modal at the bottom of the return:
```tsx
{previewFile && (
  <InlinePreview
    fileId={previewFile.id}
    filename={previewFile.filename}
    fileKeyHex={previewFile.keyHex}
    ivHex={previewFile.ivHex}
    onClose={() => setPreviewFile(null)}
    onDownload={() => { setPreviewFile(null); handleDownload(previewFile.id, previewFile.filename); }}
  />
)}
```

---

## Verification Checklist

- [ ] `npm run build` green — confirm `preview.worker?worker` resolves.
- [ ] Upload a `.jpg` file → right-click/action menu → "Preview" → image appears inline without download.
- [ ] Upload a `.pdf` file → "Preview" → PDF renders in the inline iframe.
- [ ] Upload a `.txt` file → "Preview" → text content appears in monospace.
- [ ] Upload a `.zip` file → "Preview" → "Preview not available" fallback with download link.
- [ ] Close modal → `ObjectURL` is revoked (check memory in DevTools).
- [ ] Preview works with files owned by the user (uses their PIN-derived key).

---

## Commit Message

```
feat(v9/step-4): add inline file preview for images, PDFs, and text via Web Worker decryption
```

---

*← [v9-step-03-monitoring-dashboard.md](./v9-step-03-monitoring-dashboard.md) | Next → [v9-step-05-openapi.md](./v9-step-05-openapi.md)*

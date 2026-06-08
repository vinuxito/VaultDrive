# Step 5 — Sandboxed WASM Document Viewer (Zero-Leak Previews)

## 1. Technical Concept
Provide safe previews for PDFs, images, and text documents without downloading raw decrypted files to the local filesystem or sending them to third-party rendering APIs. Decryption and rendering occur entirely in-memory inside an isolated Web Worker running compiled WebAssembly (WASM) modules, rendering straight to an HTML5 Canvas.

```
[Go Server Ciphertext Stream] ──▶ [Sandboxed Web Worker (WASM)] ──▶ [Decrypts in-memory] ──▶ [Renders to HTML5 Canvas]
```

---

## 2. Cryptographic Architecture
1. **Streaming Decryption:**
   - Instead of downloading the full file before decrypting, the client makes range requests (`HTTP 206`) to the backend.
   - The encrypted bytes are streamed directly into a Web Worker.
   - The Web Worker decrypts the chunks in-memory using Web Crypto AES-GCM stream mode.
2. **Sandbox Rendering:**
   - The worker runs a compiled WebAssembly binary (e.g. `pdfium` or `libspng` compiled to WASM) to parse the decrypted bytes.
   - The WASM module renders document pages to an OffscreenCanvas.
   - The OffscreenCanvas is transferred back to the main UI thread. Raw text or binary bytes never leak to the main thread's DOM or local storage.

---

## 3. Implementation Plan

### Go Backend (Range support)
- **Http Handlers:**
  - Verify that file download endpoints (`handle_file_download.go`) support partial content range requests (`Range` headers) to allow segment-by-segment streaming.

### React Frontend (WASM Viewer)
- **Web Worker (`sandbox.worker.ts`):**
  - Scaffold the worker file which imports the WASM compiled binaries.
  - Expose postMessage API: `init`, `decryptChunk`, `renderPage`.
- **UI Viewer Component (`SandboxedPreviewer.tsx`):**
  - Implements a modal overlay with zoom/rotate controls.
  - Renders a canvas element which receives the offscreen canvas transfer.
  - Automatically shreds the decrypted memory buffer when the modal is closed.

---

## 4. Downstream Branding Adaptation
- **QuantiX:** Glassmorphic modal containers with dark navy backgrounds and cyan loading rings.
- **ABRN:** Serif headers in preview drawers, using off-white/cream paper backgrounds with soft shadow cards.

---

## 5. Verification & Test Plan
- **Memory Purge Unit Test:** A Vitest unit test verifying that closing the `SandboxedPreviewer` destroys the ArrayBuffer cache and leaves no trace in local storage or global JS context.
- **Preview Render Playwright Test:**
  1. Boot E2E test.
  2. Upload an encrypted test PDF document.
  3. Click "Preview".
  4. Assert that the canvas element is visible, contains non-empty image data, and that no standard browser `<embed>` or `<iframe>` tags were created (verifying ZK sandbox containment).

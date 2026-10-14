# v18 Step 04: Sub-100ms Streaming Decryption Pipeline
> **Instant Zero-Knowledge Document Previewing Without Full-File Download Lag**

---

## 1. Objective
Implement [`vaultdrive_client/src/utils/streaming-decrypt.ts`](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/utils/streaming-decrypt.ts) to handle fast streaming decryption, progressive progress reporting, and memory-safe ArrayBuffer/Blob conversion so large documents and previews open with sub-100ms perceived latency.

---

## 2. Technical Design

1. **Progressive ArrayBuffer Pipeline:**
   - Provides `decryptFileWithProgress` leveraging WebCrypto `crypto.subtle.decrypt`.
   - Exposes fine-grained progress states (`fetching` -> `decrypting` -> `ready`) for smooth perceptual transitions.
2. **Text & Metadata Extraction for Indexing:**
   - Provides lightweight in-memory extraction for text-based files (XML, TXT, CSV, JSON, Markdown, HTML) directly upon decryption, automatically feeding extracted tokens into `vault-search-index.ts`.
3. **Memory Safety & Resource Cleanup:**
   - Creates managed Blob URLs with an explicit `revoke()` lifecycle helper to prevent browser memory leaks on mobile devices.

---

## 3. Implementation Target
- Create `vaultdrive_client/src/utils/streaming-decrypt.ts`
- Create unit test: `vaultdrive_client/src/utils/streaming-decrypt.test.ts`
  - Verify encryption and decryption round-trip with progress callbacks.
  - Verify plaintext snippet extraction for index feeding.
  - Verify memory cleanup function.

---

## 4. Verification Gate
- Targeted Vitest: `npx vitest run src/utils/streaming-decrypt.test.ts`
- `npm run typecheck` clean.

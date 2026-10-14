# v18 Cerebro Ciego: Master Index & Architectural Blueprint
> **Sovereign Client-Side Telepathic Search, Smart Document Triage & Instant Streaming Decryption**

---

## 1. Executive Summary & Vision

For decades, cloud storage forced humans into a painful choice:
- **Convenience (Google Drive):** Fast search, smart extraction, automatic tagging — but zero privacy. Big Tech scans every invoice, reads every contract, and trains models on private documents.
- **Privacy (Proton Drive, Mega):** Zero-knowledge encryption — but cold, dumb, and blind. You cannot search inside PDFs, you cannot remember filenames, and organizing files requires endless manual labor.

**El Cerebro Ciego (The Blind Brain)** shatters this compromise.

It transforms ABRN Drive into a **sovereign client-side intelligence engine** that executes full-text search, automatic document triage (CFDI XML, SAT certificates, legal contracts), and sub-100ms streaming decryption **100% inside browser memory**. The Go backend and PostgreSQL database remain mathematically blind, storing only encrypted ciphertext blobs.

---

## 2. The 5 Sequential Incremental Steps

| Step | Plan File | Subsystem | Core Deliverable |
|---|---|---|---|
| **Step 01** | [`v18-step-01-encrypted-inverted-search-index.md`](v18-step-01-encrypted-inverted-search-index.md) | `crypto / search` | Ephemeral in-memory inverted index (`vault-search-index.ts`) supporting fuzzy search, n-gram tokenization, and metadata ranking in <5ms. |
| **Step 02** | [`v18-step-02-client-side-smart-document-triage.md`](v18-step-02-client-side-smart-document-triage.md) | `intake / UX` | Client-side pattern recognition (`document-triage.ts`) for Mexican CFDIs, SAT certificates, RFCs, and contracts, with auto-naming. |
| **Step 03** | [`v18-step-03-telepathic-omnibar-modal.md`](v18-step-03-telepathic-omnibar-modal.md) | `UI / UX` | Ethereal luxury Omnibar (`VaultOmnibar.tsx`) activated by `/`, `⌘⇧F`, header button, or mobile dock with highlighted snippets and 1-tap quick actions (`↵`, `⌘S`, `⌘⇧C`, `⌘D`). |
| **Step 04** | [`v18-step-04-sub-100ms-streaming-decrypt-pipeline.md`](v18-step-04-sub-100ms-streaming-decrypt-pipeline.md) | `performance / worker` | Chunked streaming decryption pipeline (`streaming-decrypt.ts`) feeding extracted snippets and SHA-256 seals into `VaultSearchIndex` on upload and preview. |
| **Step 05** | [`v18-step-05-full-vault-integration-and-mobile-polish.md`](v18-step-05-full-vault-integration-and-mobile-polish.md) | `integration / QA` | Deep integration into `files.tsx`, `FilePreviewModal.tsx`, `bottom-nav.tsx`, `command-palette.tsx`, and `SessionVaultProvider.tsx`, full bilingual i18n, and Panic Lock memory scrubbing. |

---

## 3. Strict Operating Invariants

1. **Zero Plaintext Leakage:** No plaintext document text, queries, or extracted tokens may ever be transmitted in HTTP requests, headers, or query parameters.
2. **Deterministic Cryptographic Seals:** SHA-256 ciphertext golden seals and AES-256-GCM formats remain untouched.
3. **Whole Test Suite Rule:** Do NOT run `npm run test` (the full 113-test battery) until the user performs live testing. Run targeted unit tests, `npm run typecheck`, and production builds.
4. **Couch Ergonomics:** All mobile interactions must fit within the bottom 40% thumb zone and respect safe-area insets.
5. **Single-Modal Discipline:** `⌘K` opens the global `CommandPalette` (which also queries `globalVaultSearchIndex`), while `/`, `⌘⇧F`, the `Cerebro Ciego (/)` header pill, and the mobile `BottomNav` search button open `VaultOmnibar` with zero modal collision.


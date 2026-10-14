---
name: filemon-office-mx
description: "Reconstruct or improve ABRN-Drive's (VaultDrive) in-app Filemón Office: zero-knowledge browser-decrypted spreadsheet (CSV/XLSX), PDF, Markdown, Code, and Mexican CFDI 4.0 XML reading for humans and AI agents, with original ciphertext SHA-256 identity, local triage enrichment, shared fragment-key permissions, recovery, and live verification."
---

# Filemón Office MX — ABRN-Drive Zero-Knowledge Edition

Build and harden `/lamp/www/ABRN-Drive`'s embedded document workspace (`FilePreviewModal.tsx`, `streaming-decrypt.ts`, `document-triage.ts`, `vault-search-index.ts`). Carry forward the lessons from Filemón Office in NanoRed while enforcing ABRN-Drive's browser-first AES-256-GCM encryption boundary.

**Premium means maximum system capability converted into minimum effort for humans and AI agents.** Each can open an authorized encrypted file, decrypt it in volatile browser memory, understand it naturally (including Mexican CFDI 4.0 XML invoices, contracts, bank statements, and spreadsheets), and immediately obtain trustworthy SHA-256 evidence of what was read.

## Choose the authorized mode

- **Recon:** inspect existing flows, representative file signatures, capabilities and gaps; report without implementation changes.
- **Plan:** produce the requested incremental roadmap, with prerequisites, proof and recovery for each step. If the user asks for one MD per step and an index, follow that format.
- **Build:** adapt the reconstruction sequence, implement complete authorized slices and verify their real flows.
- **Repair:** reproduce the failure, identify which layer failed and make the smallest supported correction.

Respect the user's chosen scope. A read-only decrypted viewer is the baseline when editing/importing has not been requested. This skill does not grant permission to install unapproved dependencies, migrate data, change infrastructure, send messages, deploy, or run the full test suite when held by the owner.

## ABRN-Drive Architecture & Contract

| Surface | ABRN-Drive Owner | Invariant |
|---|---|---|
| **In-App Document Reader** | `vaultdrive_client/src/components/vault/FilePreviewModal.tsx` | Decrypts ciphertext in browser RAM (`window.crypto.subtle`), verifies/displays SHA-256 seal, revokes `Blob` URLs on close. |
| **Streaming Decrypt & 64KB Snippet** | `vaultdrive_client/src/utils/streaming-decrypt.ts` | Zero-allocation `TransformStream` for large files; `extractSnippetForIndexing()` extracts up to 64KB of UTF-8 text without OOM. |
| **Mexican Fiscal & Document Triage** | `vaultdrive_client/src/utils/document-triage.ts` | Parses CFDI 4.0 XML (`<cfdi:Emisor Rfc/Nombre>`, `Total`, `Moneda`, `UUID`), contracts, bank statements, and IDs (`INE`/`Pasaporte`/`CURP`) locally in RAM. |
| **Zero-Knowledge Search Index** | `vaultdrive_client/src/utils/vault-search-index.ts` | `enrichDocument()` indexes local `#tags`, `detectedType`, and 64KB snippets; `scrub()` zeroes RAM on panic lock (`SessionVaultProvider.clearVault()`). |
| **Public Share & Drop Readers** | `vaultdrive_client/src/pages/public-share.tsx`, `drop.tsx` | Fragment-key `#key` never leaves the browser on public share links; Secure Drop uses documented server-coordinated delivery-key recovery. |

## Read the relevant references

- For discovery, architecture and ordered delivery, use [reconstruction](references/reconstruction.md).
- Before implementing storage, parsers or APIs, use [document contracts](references/document-contracts.md).
- For the workspace, inspector, accessibility and failures, use [UX and recovery](references/ux-and-recovery.md).
- Before claiming a flow works, use [verification](references/verification.md).
- When transferring a NanoRed pattern or diagnosing a familiar symptom, use [proven lessons](references/proven-lessons.md). These are dated evidence, not inherited acceptance of the target project.

## Essential invariants

- Resolve identifiers through ABRN-Drive's authorized catalog/storage boundary and active `SessionVault` key. Recheck caller, folder/group scope, and file identity for preview, inline view, and download.
- Keep original encrypted bytes immutable and anchored to their SHA-256 hash. A rendered, extracted, or triaged view is derived in browser RAM; record its lineage and its limits.
- Detect formats from both MIME type and filename/content signature (`extractSnippetForIndexing` + `analyzeDocumentTriage`). Reject or gracefully fall back on unsupported binary formats with a truthful download recovery action.
- Treat decrypted file content as untrusted data. Bound parsing (`64KB` snippet cap), prevent external XML entity (XXE) or network access, and never inject raw file contents via `innerHTML` without sanitization.
- Expose what is partial, unavailable, or unverified. Missing CFDI attributes, locked vault keys, or binary-only blobs are not `$0.00` or successful fiscal validation.

## Finish with evidence

Walk representative files (CFDI XML, PDF, Markdown/CSV, image) and real entry points (`/files`, `VaultOmnibar`, `FilePreviewModal`). Follow the user's test gate (`npm run typecheck`, targeted `npx vitest run`, `npm run build`, deferring the full 113-suite run until the owner's live walk when instructed). Deliver the requested session memory, verification MD/HTML report, README alignment, and Git receipt.

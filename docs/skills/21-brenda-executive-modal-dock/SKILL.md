---
name: 21-brenda-executive-modal-dock
description: >-
  Brenda's Executive Modal & Sticky Tactical Dock UI/UX architecture tuned for ABRN-Drive (VaultDrive).
  Builds high-impact, widescreen (90-94vw Cinemascope) modal viewports with frozen hero headers,
  1-click instant dispatch decks (WhatsApp, Share Link, Download Decrypted, Copy SHA-256), and
  frozen bottom tactical docks with cryptographic receipts.
---

# Brenda's Executive Modal & Sticky Tactical Dock — ABRN-Drive Edition

> **The High-Impact, Full-Width Vault Asset Canvas with Frozen Bottom Action Dock**  
> Tuned specifically for `/lamp/www/ABRN-Drive` (`vaultdrive_client/src/components/vault/`).

---

## 1. Vision & ABRN-Drive Adaptation

When inspecting an encrypted vault asset in ABRN-Drive (`FilePreviewModal.tsx`, `VaultOmnibar.tsx`, `CreateShareLinkModal.tsx`, or a `Secure Drop` submission), the interface must never trap the user in a cramped 480px drawer or force them to scroll back to the top to share, download, or verify a SHA-256 seal:

1. **Full-Width Cinemascope Canvas (`clamp(720px, 92vw, 1200px)` on desktop, `88dvh` bottom sheet on mobile):** Give decrypted PDFs, CFDI 4.0 XMLs, high-res photos, spreadsheets, and code files room to breathe.
2. **Zone 1 — Frozen Hero Header (`sticky top-0 z-30`):**
   - Detected Type Badge (`[CFDI 4.0]`, `[CONTRATO LEGAL]`, `[CREDENCIAL ID]`, `[AES-256-GCM]`) from `document-triage.ts`.
   - Origin / Folder Breadcrumb Pill (`📁 Fiscal 2026`, `📥 Secure Drop`).
   - True Telemetry (`2.4 MB • AES-256-GCM • Chunked 64KB`).
   - Esc Close (`[Cerrar Esc]`).
3. **Zone 2 — 1-Click Instant Dispatch Deck ("Entrega Inmediata"):**
   - Direct single-touch transmutations and actions right above the preview stage:
     - `💬 Enviar por WhatsApp` (via `MobileShareSheet` / Web Share API)
     - `🔗 Crear Link Temporal (#key)` (fragment-key zero-knowledge share)
     - `📥 Descargar Original Descifrado` (streaming `TransformStream` decrypt)
     - `🏷️ Auto-nombrar / Etiquetar` (via `analyzeDocumentTriage` in `document-triage.ts`)
4. **Zone 3 — Frozen Sticky Bottom Tactical Dock (`sticky bottom-0 z-30`):**
   - **Left:** `← Volver a Bóveda (Esc)` (`48px` trucker target).
   - **Center:** Live cryptographic receipt (`Sello SHA-256: e3b0c442... • 0 Bytes Delta`).
   - **Right:** `🗑️ Borrar (2-Step Armed 5s)` + Primary Hero CTA (`🔗 COMPARTIR AHORA` / `📥 DESCARGAR`).

---

## 2. ABRN-Drive Component Mapping

| Modal Zone / Feature | ABRN-Drive File | Contract |
|---|---|---|
| **File Preview & Streaming Stage** | `vaultdrive_client/src/components/vault/FilePreviewModal.tsx` | Decrypts into ephemeral `ArrayBuffer`/revoked `Blob` URL; enriches `globalVaultSearchIndex` via `extractSnippetForIndexing`. |
| **Omnibar Instant Inspector** | `vaultdrive_client/src/components/vault/VaultOmnibar.tsx` | Triggered via `/` or `⌘⇧F`; supports `Enter` (Preview), `⌘S` (Share), `⌘D` (Download), `⌘⇧C` (Copy SHA-256). |
| **1-Tap Mobile Share Sheet** | `vaultdrive_client/src/components/vault/MobileShareSheet.tsx` | Bottom-sheet dispatch deck with 48px targets, WhatsApp deep link, and `navigator.share`. |
| **Sacred Cryptographic Receipt** | `vaultdrive_client/src/components/vault/ReciboSagradoCard.tsx` | Displays verifiable SHA-256 seal, folio, and `<300ms` Ley Tola actions. |
| **Local Triage & Auto-Tagger** | `vaultdrive_client/src/utils/document-triage.ts` | Extracts CFDI RFC/Total/UUID, contracts, bank statements, and IDs in browser RAM. |

---

## 3. Sequential Reference Blueprints

Read the step files in this skill directory when designing or auditing a multi-step modal upgrade:

1. [00-index.md](00-index.md) — Master vision and architectural laws.
2. [01-executive-modal-canvas.md](01-executive-modal-canvas.md) — Cinemascope viewport geometry (`92vw`), backdrop blur, and internal scroll orchestration.
3. [02-impact-hero-header.md](02-impact-hero-header.md) — Folio, bold status badges, and fast action pills.
4. [03-instant-dispatch-deck.md](03-instant-dispatch-deck.md) — 1-click delivery deck (`WhatsApp`, `Share Link`, `Download`).
5. [04-sticky-tactical-dock.md](04-sticky-tactical-dock.md) — Frozen bottom bar with return button, center SHA-256 receipt, and primary closing levers.
6. [05-unit-executive-integration.md](05-unit-executive-integration.md) — Component wiring and state persistence.
7. [06-experiencia-barrio-verification.md](06-experiencia-barrio-verification.md) — 7 Iron Laws of Barrio UX verification checklist.

---

## 4. Non-Negotiable ABRN-Drive Rules

- **Zero-Knowledge Boundary:** Revoke all temporary `Blob` URLs (`URL.revokeObjectURL`) and clear decrypted buffers when the modal closes or when `SessionVault` locks (`isVaultLocked`).
- **Ley Tola (`<300ms`):** Copy SHA-256, Share Link creation, and Auto-Rename must give visual + haptic confirmation in under `300ms`.
- **Ergonomía de Sillón:** Primary buttons rest in the bottom sticky dock (`≥48px` height) with `≥12px` separation between destructive (`Borrar`) and constructive (`Compartir` / `Descargar`) actions.
- **Cero Mamadas:** Never show `$0.00` or `0 B` for unknown/unloaded metadata; show `[ Calculando sello SHA-256... ]` or `NOT_EVALUABLE`.

---
name: skill-for-filemon-or-something
description: ABRN-Drive (VaultDrive) Sovereign UI/UX field guide plus the Live Glass Twin, tuned specifically for /lamp/www/ABRN-Drive (vaultdrive_client/src/ pages, components, locales, and 6-skin theme tokens). Covers WCAG 4.5:1 contrast across all 6 skins, Studio Slate (#f8fafc) and Sovereign Dark (#030712), 4 button tiers, status pills, 48px touch targets, Couch-Approved mobile fold ergonomics, plain-Spanish/English copy, and live-twin receipts (ReciboSagradoCard, MobileProofPill, CreateShareLinkModal).
---

# Filemón's Field Guide for ABRN-Drive: Sovereign Design, Live Twin, and Proof

This skill merges the *Sovereign UI/UX Manual* and the *Live Glass Twin Manual*, tuned specifically for **`/lamp/www/ABRN-Drive`** (`VaultDrive`): its real React 18 + TypeScript + Tailwind screens, 6-skin theme system, zero-knowledge WebCrypto boundaries, and test runners.

Reference files in this skill directory:

| File | Load it when |
|---|---|
| [references/design.md](references/design.md) | choosing colors, contrast, buttons, pills, spacing, touch targets, dark theme, responsive layout, copy |
| [references/live-twin.md](references/live-twin.md) | building or reviewing a live preview / receipt ("gemelo en vivo", `ReciboSagradoCard`, `CreateShareLinkModal`) |
| [references/verification.md](references/verification.md) | proving a UI change: typecheck, targeted Vitest, contrast probes, browser/Android walks, closeout docs |

---

## 0. Hard Safety Rules for `/lamp/www/ABRN-Drive`

1. **Respect the Owner's Test Hold.** When the user says *"DONT RUN THE WHOLE TESTS, until I test it live"*, never run `npm run test` (the full 113-file suite). Run only `npm run typecheck`, targeted `npx vitest run <changed-file>`, `go test ./...`, and `npm run build`.
2. **Respect the Coordinated Release Boundary (`deploy/release/`).** Do not run ad-hoc database migrations or restart `abrndrive.service` without explicit owner authorization.
3. **Zero-Knowledge Honesty (`docs/trust-copy-contract.md`).** Never claim universal zero knowledge where metadata or Secure Drop delivery-key recovery is server-coordinated. Never expose encryption keys, URL `#fragment` keys, or plaintext snippets to the server.
4. **Panic Lock Scrubbing.** Any new in-memory cache or preview state must zeroize on `SessionVaultProvider.clearVault()` and `isVaultLocked` (e.g., `globalVaultSearchIndex.scrub()` and `URL.revokeObjectURL()`).
5. **Everything goes on `main`.** Single branch rule; leave the working tree 100% clean.

---

## 1. The Working Loop for Any ABRN-Drive UI Task

1. **Frame:** Which route (`files.tsx`, `login.tsx`, `access-center.tsx`, `groups.tsx`, `drop.tsx`, `settings.tsx`, `home.tsx`), which persona, and which job? What must stay unbroken: hotkeys (`⌘K` vs `/` and `⌘⇧F`), `SessionVault` key cache, i18n (`en`/`es` `drive.json`), and mobile FAB/dock clearance?
2. **Success Condition:** Write it as something measurable (e.g. *"100% of login inputs above the fold on 480×960 portrait, 0 TypeScript errors, targeted Vitest green, zero double-modal collision on mobile upload"*).
3. **Inspect Reality:** Check `git status`, inspect the component and its tests (`*.test.tsx`), and check both `locales/en/drive.json` and `locales/es/drive.json`.
4. **Smallest Strong Move:** Reuse existing vault components (`ReciboSagradoCard`, `MobileProofPill`, `MobileShareSheet`, `VaultOmnibar`, `FilePreviewModal`) rather than inventing competing modals.
5. **Verify:** Run `npm run typecheck`, targeted `npx vitest run`, and `npm run build`. Verify on desktop (`1440×900`) and mobile (`390×844` / Android 13 Waydroid `480×960`).

---

## 2. Sovereign Design Contract in One Page

- **Luminance & 6-Skin WCAG 4.5:1 Contrast:**
  - **Studio Light:** Crisp studio slate `#f8fafc` canvas, pure white `#ffffff` cards, authoritative slate `#0f172a` primary buttons, royal sapphire `#2563eb` accents. (Never revert to muddy burgundy `#7d4f50`).
  - **Sovereign Dark:** Deep obsidian `#030712` canvas, electric iris `#6366f1` primary accents, emerald `#10b981` cryptographic security seals.
  - All 6 skins are guarded by the WCAG 4.5:1 contrast test suite (`78/78` checks).
- **60-30-10 Hierarchy:** 60% canvas background, 30% card surfaces with subtle 1px borders, ≤10% accent color reserved for the **single primary CTA** on screen (e.g., one primary Upload CTA in the `/files` header — never duplicate competing upload buttons).
- **No False Zeros:** Never display `0 B` or `$0.00` when data is loading, locked, or unknown. State `NOT_EVALUABLE` or a clear human reason.
- **Tactile & Couch-Approved Mobile Ergonomics:**
  - Hit areas `≥ 48px` on mobile (`MobileShareSheet`, `BottomNav`, `SovereignPinPad`).
  - Bottom `pb-24` / `pb-36` scroll clearance so the mobile dock and FAB never obscure file rows.
  - Single-surface feedback: on mobile (`<768px`), show `MobileProofPill` after upload rather than colliding `ReciboSagradoCard` + `MobileProofPill` over `bottom-20`.
- **Keyboard Discipline:**
  - `⌘K` / `Ctrl+K` → Global `CommandPalette` (`command-palette.tsx`)
  - `/` or `⌘⇧F` (`Ctrl+Shift+F`) → `VaultOmnibar` ("El Cerebro Ciego" in `VaultOmnibar.tsx`)
  - `⌘L` / `Ctrl+L` → Instant Panic Lock ("Bloquear Bóveda" deadbolt in `files.tsx`)
  - `J/K` or `↑/↓` → Row selection; `Enter` → Preview; `Esc` → Close modal.

---

## 3. Live Glass Twin in ABRN-Drive (`ReciboSagradoCard` & Share Previews)

- **El Recibo Sagrado (`ReciboSagradoCard.tsx` & `drop.tsx`):**
  - Calculates the real in-memory SHA-256 hash of the ciphertext (`e3b0c442...`) and renders a tactile cryptographic receipt in `<300ms` (Ley Tola) with immediate next actions: **1-Tap Share (`MobileShareSheet` / WhatsApp)**, **Copy Link**, or **Download TXT Folio**.
- **Local Document Triage Preview (`files.tsx` + `document-triage.ts`):**
  - As soon as a user selects a file to upload, `triageFileObject(file)` reads the first 64KB in browser RAM, detects CFDI 4.0 XML (`Rfc`, `Nombre`, `Total`, `UUID`), contracts, bank statements, or IDs (`INE`/`Pasaporte`/`CURP`), displays `#tag` chips, and offers a 1-click **`Auto-nombrar: {suggestedFilename}`** button before encryption even begins.
- **Safe DOM & Memory Cleanup:**
  - Never use `innerHTML` with untrusted filenames or file snippets (React text nodes / `<mark>` token slices only).
  - Always call `URL.revokeObjectURL()` when closing `FilePreviewModal.tsx`.

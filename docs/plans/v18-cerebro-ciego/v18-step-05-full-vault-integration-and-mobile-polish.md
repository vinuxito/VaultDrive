# v18 Step 05: Full Vault Integration & Mobile Polish
> **Deep Wiring into Files, Mobile Thumb Dock, Command Palette & Android 13 Audit**

---

## 1. Objective
Wire the search index, smart document triage, and `VaultOmnibar` into [`vaultdrive_client/src/pages/files.tsx`](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/pages/files.tsx), [`bottom-nav.tsx`](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/components/mobile/bottom-nav.tsx), and [`dashboard-layout.tsx`](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/components/layout/dashboard-layout.tsx), ensuring full Mexican Spanish and English localization, zero regressions, and verified mobile ergonomics on Native Android 13.

---

## 2. Integration Points

1. **`files.tsx`:**
   - Initialize and synchronize the `VaultSearchIndex` when files load or update.
   - When the user presses `⌘K` or `/`, open `VaultOmnibar`.
   - When the user selects a search match in the Omnibar, instantly focus or preview the target file.
   - When uploading a file, run `analyzeDocumentTriage()` to auto-suggest filename and tags in the upload confirmation if appropriate.
2. **`bottom-nav.tsx`:**
   - Ensure the search action button in the bottom dock triggers the telepathic Omnibar on mobile with 1 tap.
3. **`locales/en/drive.json` and `locales/es/drive.json`:**
   - Add all necessary strings for Omnibar, smart triage suggestions, and matching badges.
4. **Memory Lifecycle:**
   - On Emergency Panic Lock (`⌘L` or Lock button), scrub the in-memory search index alongside session vault keys.

---

## 3. Verification & Closeout Battery
1. `npm run typecheck`: Must pass with 0 errors across all configs.
2. Targeted Vitest suites: Must pass 100% across all 4 new test suites + mobile test battery.
3. Production build: `npm run build` must compile cleanly in `vaultdrive_client/dist`.
4. Native Android 13 (LineageOS 20 on Waydroid via ADB):
   - Capture screencaps of Omnibar active state, smart triage trigger, and mobile thumb interaction.
5. Deliverables:
   - Session Memory: `docs/memories/session-2026-10-04-v18-cerebro-ciego.md`.
   - Verification Markdown Report: `docs/reports/2026-10-04-v18-cerebro-ciego-verification.md`.
   - Self-contained HTML Dashboard: `docs/reports/2026-10-04-v18-cerebro-ciego-verification.html`.
   - Update `README.md`.
   - Single commit on `origin/main`.

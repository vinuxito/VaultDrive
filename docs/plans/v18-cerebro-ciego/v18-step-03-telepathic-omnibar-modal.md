# v18 Step 03: Telepathic Omnibar Search Overlay
> **Ethereal High-Speed Search Command Center for Desktop & Couch Mobile**

---

## 1. Objective
Create [`vaultdrive_client/src/components/vault/VaultOmnibar.tsx`](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/components/vault/VaultOmnibar.tsx), a lightning-fast search overlay inspired by Linear and Spotlight, providing instant live search, snippet highlights, file tags, and 1-tap quick actions (Preview, WhatsApp Share, Copy Link, Download).

---

## 2. UI & Ergonomic Specifications

1. **Trigger Affordances:**
   - Desktop: `⌘K` or `Ctrl+K`, `/` key, or clicking the search bar in the header.
   - Mobile: Persistent search action button in the bottom thumb dock (`BottomNav`) and search icon in header.
2. **Visual Hierarchy (Fintech Luxury Theme):**
   - High-grade translucent backdrop (`backdrop-blur-xl bg-background/80`).
   - Clean, elevated card with subtle border glow.
   - Search input with clear button and live match count indicator.
   - Instant live results list with:
     - Icon by MIME type (PDF, XML, Spreadsheet, Image, Generic).
     - Filename with matching characters highlighted.
     - Folder badge and tags.
     - Extracted snippet or matched metadata reason.
     - File size and cryptographic seal badge.
3. **Keyboard & Touch Navigation:**
   - `ArrowDown` / `ArrowUp` or `J` / `K` row selection.
   - `Enter` immediately opens the selected file in Quick Look / Preview.
   - Quick action shortcuts: `⌘S` (Share), `⌘C` (Copy Link), `⌘D` (Download).
   - `Escape` or tapping backdrop closes the overlay smoothly with exit animation.

---

## 3. Implementation Target
- Create `vaultdrive_client/src/components/vault/VaultOmnibar.tsx`
- Create unit test: `vaultdrive_client/src/components/vault/VaultOmnibar.test.tsx`
  - Test input change triggering real-time matches.
  - Test keyboard navigation (`ArrowDown`, `Enter`).
  - Test quick action dispatchers.
  - Test empty state and "no matches" feedback with Lenguaje de Cancha.

---

## 4. Verification Gate
- Targeted Vitest: `npx vitest run src/components/vault/VaultOmnibar.test.tsx`
- `npm run typecheck` clean.

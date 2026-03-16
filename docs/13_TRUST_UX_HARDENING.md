# 13 — Trust UX Hardening

## Summary

3-iteration UI/UX hardening pass across all trust surfaces in ABRN Drive. The goal was to make the product feel undeniable — calm, premium, and emotionally clear — without breaking existing behavior or weakening the one-PIN trust doctrine.

**Session date:** March 15, 2026 (night)  
**Starting commit:** `0ada09a` (docs: record verified one-pin trust flow state)  
**Build state at session end:** Go build PASS · Frontend build PASS (bundle split) · 12/12 tests PASS

---

## What Was Hardened

### Trust Rail (`components/vault/TrustRail.tsx`)

**Before:** "Trust Rail" debug-panel label, 4-column grid with duplicate visibility card, "visibility records" developer language, "Visible and revocable from this screen" (inaccurate), raw "Checking..." text on load.

**After:** "Protection & Access" label, 3-column grid (Encryption / Source / Last Event), "active access points" language, "Full history below" copy, animated skeleton loader on initial fetch.

### File Security Timeline (`components/vault/FileSecurityTimeline.tsx`)

**Before:** Plain colored dots with raw ISO timestamps. No event-type differentiation. Empty state: plain text.

**After:** Event-type icon badges in tone-colored circles (Upload, Link2, Share2, ShieldOff, Inbox, Eye icons). "Security History" section label. `relativeTime()` function showing "3 days ago" etc. Reassuring empty state with ShieldCheck icon.

### Access Visibility Panel (`components/vault/AccessPanel.tsx`)

**Before:** Immediate destructive "Revoke all" action (no confirmation). Header showed only filename. No owner visibility.

**After:** "You (owner) / Full access, always" emerald anchor always at top. 2-step inline revoke: "Keep access" / "Yes, revoke all". Header: "Access Control" primary + filename secondary.

### Agent API Keys (`components/settings/AgentApiKeysSection.tsx`)

**Before:** `window.confirm()` for revoke. Flat 16-checkbox list with raw scope strings (`files:list`). No grouping, no descriptions.

**After:** Per-key inline confirmation state (no browser dialogs). 6 grouped scope categories with descriptions: Files, Folders, Sharing, File Requests, Audit & Trust, API Keys. `scopeLabels` map shows human-readable names on both creation and key cards.

### Share Link Trust Receipt (`components/vault/CreateShareLinkModal.tsx`)

**Before:** Amber `AlertTriangle` warning: "Anyone with this link can decrypt and download the file until you revoke it or it expires."

**After:** Emerald success frame: "Link created — revocable anytime" / "Access control stays with you". Calm neutral note: "Share this link with the recipient. The decryption key travels in the link — the server never sees it. Revoke anytime from the file's access panel."

### Secure Drop Trust Receipt (`components/upload/CreateUploadLinkModal.tsx`)

**Before:** Green success banner + amber AlertTriangle warning with "Copy and save this URL now."

**After:** Emerald CheckCircle2 + "Secure Drop link ready" with descriptive subtitle. Neutral note: "Save this link. The encryption key in the URL fragment is shown once — it never reaches the server."

### Onboarding Wizard (`components/onboarding/OnboardingWizard.tsx`)

**Before:** Step 1 title "Calm by design". Cards: "What the server can do" / "What the server cannot do" (negative framing, developer language). Step 4: "You're ready!" + vague copy.

**After:** Step 1 title "Your files, your control". Cards: "What stays private" / "What you control" / "Agents work within bounds" (positive framing, plain language). Step 4: "Vault is ready" + 3-item verification checklist.

### Settings PIN Card (`pages/settings.tsx`)

**Before:** "Secure Drop PIN" — misleading title. Description implied PIN was only for Secure Drop.

**After:** "Your Vault PIN". Description: "A single 4-digit PIN used across your vault, shares, Secure Drop, and quick login."

### Settings Privacy & Trust Card (`pages/settings.tsx`)

**Before:** "Privacy explainer" — internal jargon title. Lists without visual hierarchy.

**After:** "Privacy & Trust" title. Dot markers on lists. Tighter copy. Bottom card shortened.

### Settings Security Card (`pages/settings.tsx`)

**Before:** Generic developer bullet list (JWT auth, Bcrypt, PBKDF2, "public key cryptography").

**After:** 2 focused trust claim badges: "Server never decrypts / All operations happen in your browser" + "Sharing uses key exchange / RSA wrapping, revocable anytime".

### Origin Badge (`components/vault/OriginBadge.tsx`)

**Before:** "My Upload" — inconsistent with TrustRail "Uploaded to vault" language.

**After:** "Vault" — consistent with TrustRail source language throughout.

### Vault Explorer (`pages/files.tsx`)

**Before:** Inline SVG shield button (inconsistent with Lucide icon system). `gap-0.5` action button spacing. "Your encrypted file storage" subtitle.

**After:** `<Shield />` from Lucide. `gap-1` breathing room. "Encrypted, visible, revocable" subtitle (the 3 product values).

### FilePreviewModal — Collapsible Trust Section (`components/vault/FilePreviewModal.tsx`)

**Before:** TrustRail + FileSecurityTimeline always fully expanded above file preview content, pushing preview down.

**After:** Collapsible "Protection & History" toggle. Default: collapsed (preview is immediately visible). Click to expand/collapse.

### Bundle Splitting (`vaultdrive_client/vite.config.ts`)

**Before:** Single 831KB bundle (gzip 234KB). Vite warning on every build.

**After:** Explicit `manualChunks`: vendor (44KB), radix (103KB), motion (124KB), lucide (19KB), main (541KB). Gzip 140KB for main. ~40% reduction in main bundle. Vendor chunks are independently cacheable.

### Pre-existing CSS Bug (`src/index.css`)

Stray timestamp `Wed 04 Feb 2026 05:07:44 PM UTC` at end of file was causing CSS parse errors in LSP. Removed.

---

## Files Changed

| File | Change Type |
|------|------------|
| `components/vault/TrustRail.tsx` | Redesign |
| `components/vault/FileSecurityTimeline.tsx` | Redesign |
| `components/vault/AccessPanel.tsx` | Safety + UX |
| `components/vault/CreateShareLinkModal.tsx` | Copy |
| `components/vault/FilePreviewModal.tsx` | UX (collapsible) |
| `components/vault/OriginBadge.tsx` | Copy consistency |
| `components/settings/AgentApiKeysSection.tsx` | Safety + Information architecture |
| `components/onboarding/OnboardingWizard.tsx` | Copy |
| `components/upload/CreateUploadLinkModal.tsx` | Trust receipt |
| `pages/files.tsx` | Icon + copy consistency |
| `pages/settings.tsx` | Multiple cards |
| `vaultdrive_client/vite.config.ts` | Performance |
| `src/index.css` | Bug fix (stray timestamp) |

No backend files were changed.

---

## Trust Doctrines — All Preserved

| Doctrine | Preserved? |
|---------|-----------|
| One PIN per user, used everywhere | ✅ |
| No per-action re-prompting for the owner | ✅ |
| Server stores only ciphertext | ✅ |
| Fragment URL keys never reach server | ✅ (copy explicitly states this) |
| All external access visible and revocable | ✅ (strengthened) |
| Agent keys are ciphertext-first | ✅ (scope descriptions clarify this) |

---

## Open Items After This Session

1. Route-level lazy loading (`React.lazy()`) would further reduce initial bundle — deferred
2. Shared-download two-user E2E browser test — coverage exists at unit level, full browser proof still pending
3. ~~Mobile file row: "Who can access" (AccessPanel) is desktop-only via row button~~ — **Fixed in Pass 2**: Shield "Access control" action added to mobile dropdown menu
4. FilePreviewModal trust section defaults to collapsed — consider auto-expand on first view of a new file if desired

---

## Pass 2 — Visual Calm & Premium Polish (same day, later session)

**Starting commit:** `91ca320` (feat: trust UX hardening — 3-iteration polish pass)

Second 3-iteration loop focusing on the feel and rhythm of the trust surfaces.

### Key Changes

**File row calm (files.tsx):**
- Desktop: 8 simultaneously-visible action buttons split into primary (4 always visible) + secondary (4 revealed on row hover via `opacity-0 group-hover:opacity-100`)
- Primary: Download, Create share link, Star, Shield (access control)
- Secondary: Share with user, Quick Share, Delete, Manage shares
- Mobile: Shield "Access control" action added to dropdown menu (was missing)

**Trust surface polish:**
- TrustRail skeleton: flat `animate-pulse` replaced with gradient shimmer animation
- Timeline connector lines: `bg-white/8` → `bg-white/15` for visibility
- AccessPanel: raw dates replaced with `relativeTime()` (relative timestamps like "3 days ago")
- AccessPanel entry spacing: `space-y-2` → `space-y-2.5` for breathing room
- FilePreviewModal trust toggle: hover background + rounded hit area added

**Onboarding icon consistency:**
- All 3 privacy briefing cards now have icons: Lock ("What stays private"), Eye ("What you control"), Bot ("Agents work within bounds")

**Empty state + notification quality:**
- Vault empty state redesigned: Lock icon in container, contextual per-view messages, trust-first copy
- Success messages: icon-in-circle pattern (emerald circle + CheckCircle2)
- Error messages: matching icon-in-circle pattern (red circle + AlertCircle)
- Loading state: vertical centered "Loading your vault..." matching empty state proportions

**Dead UI removal:**
- Removed empty Storage placeholder card from settings (no content, broken feel)
- Removed unused HardDrive Lucide import (bundle size reduced)

**Readability:**
- Privacy & Trust card body text: `leading-relaxed` + increased spacing for reading rhythm

### Additional Files Changed (Pass 2 only)

| File | Change Type |
|------|------------|
| `pages/files.tsx` | File row calm, mobile parity, empty/loading/error/success states |
| `components/vault/TrustRail.tsx` | Shimmer skeleton, access count emphasis |
| `components/vault/FileSecurityTimeline.tsx` | Connector visibility, empty state |
| `components/vault/AccessPanel.tsx` | Relative time, spacing |
| `components/vault/FilePreviewModal.tsx` | Trust toggle hover feedback |
| `components/onboarding/OnboardingWizard.tsx` | Privacy card icons |
| `pages/settings.tsx` | Storage card removal, readability |

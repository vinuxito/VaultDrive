# 16 — Enterprise Polish: "SaaS / SAP / Deloitte Ready" UX

**Date:** March 20, 2026
**Goal:** Polish ABRN Drive presentation to enterprise-grade. Every user-facing surface should feel like something a Deloitte partner hands to a client without hesitation.

---

## Background

The application was functionally solid: encryption, access control, drop links, agent API keys all working. The gap was presentation — mixed informal copy, cluttered action surfaces, developer artifacts bleeding into user-facing screens, and patterns that signal "work in progress" rather than "production enterprise tool."

---

## Step 1 — Dashboard: Clarity-First Layout

**File:** `src/pages/dashboard.tsx`

### Changes
- **Section headings renamed:** "Quick Stats" → "Vault Overview" · "Quick Actions" → "Start Here" · "Recent Activity" → "Activity"
- **Security Posture moved to top** of the dashboard (below greeting), renamed to "Attention" — the most important status signal is now the first thing a user sees
- **🔒 emoji removed** from the subtitle — Shield icon only
- **"Activity feed coming soon" placeholder replaced** with proper empty state: "No activity yet. Upload or share a file to begin."
- **Get-started checklist added** (only when `activity.length === 0 && stats.files === 0`): Upload a file / Create a client upload link / Share with a colleague
- **"New Drop Link" renamed** to "Create Client Upload Link"
- Old bottom Security Posture block removed (now rendered at top only)

---

## Step 2 — Navigation: Remove Confusion, Clarify Intent

**Files:** `src/components/layout/sidebar.tsx` · `src/components/layout/mobile-nav.tsx` · `src/components/mobile/bottom-nav.tsx` · `src/pages/shared.tsx` · `src/pages/groups.tsx`

### Changes
- **"Home" nav item removed** from sidebar, mobile nav, and bottom nav — when authenticated, clicking Home took users to the public landing page (jarring and confusing); Dashboard is now the de-facto landing page
- **"Shared" renamed to "Shared with Me"** in sidebar, mobile nav, and bottom nav — removes ambiguity about direction of sharing
- **`shared.tsx`:** description updated to "Files shared with you by other vault owners."
- **`groups.tsx`:** heading "Groups" and description "Groups let you share files with multiple people at once." added

### TypeScript fixes required
- `sidebar.tsx`: `item.action` property removed from type after Home nav item was deleted; `navigate(item.path)` call simplified
- `mobile-nav.tsx`: `handler={item.handler}` prop reference removed (no longer in type); `Home` import cleaned up
- `bottom-nav.tsx`: `Home` import cleaned up

---

## Step 3 — File Cards: Progressive Disclosure

**File:** `src/components/files/file-card.tsx`

### Changes
- **5 visible icon buttons reduced to 2** (Star + Download) plus a `•••` more-actions menu
- **MoreMenu dropdown added** inline: "Share Link" / "View Details" / "Delete File" with labeled actions (not icon-only)
- **Encryption metadata removed from card expansion** — algorithm, salt, IV, key preview were developer-facing; these belong in `FilePreviewModal`, not on the card
- **Metadata line condensed:** `{fileSize} · {relativeDate}` on one line (e.g. "2.4 MB · 3 days ago")
- **`formatRelativeDate` helper added** replacing the old `formatDate` (ISO string → human-readable relative)
- Removed: `maskKey`, `parseMetadata`, `formatDate`, `ChevronDown`, `ChevronUp`, `Lock` imports and functions

---

## Step 4 — Settings: 3-Tab Structure

**File:** `src/pages/settings.tsx`

### Changes
- **3-tab layout implemented** using existing `<Tabs>` / `<TabPanel>` from `src/components/ui/tabs.tsx`:
  - **Account** — Username/email, organization, appearance (theme toggle)
  - **Security** — Security PIN setup/change, encryption info, privacy & trust
  - **Advanced** — Agent API Keys, Control Plane Status, Agent Operations, API Simulation, API reference, Pipeline examples, Raw audit log
- **Default tab:** "Account"
- **Hero callout** padding tightened (`py-6` → `py-4`) so settings are visible without scrolling
- **"Vault PIN" → "Security PIN"** in form labels and headings
- **"One-PIN doctrine" → "One PIN for everything"** — cleaner, client-accessible phrasing
- Developer tools (agent keys, control plane, audit log) moved to "Advanced" tab, out of first-view

---

## Step 5 — Copy: Remove Jargon

**Files:** `src/pages/dashboard.tsx` · `src/components/vault/VaultTree.tsx` · `src/components/upload/CreateUploadLinkModal.tsx` · `src/pages/drop-upload.tsx` · `src/pages/PublicSharePage.tsx` · `src/pages/files.tsx`

### Changes
| Before | After | File |
|--------|-------|------|
| "New Drop Link" | "Create Client Upload Link" | dashboard.tsx |
| "Drop Links" (section label) | "Client Upload Links" | VaultTree.tsx |
| "No drop links" | "No upload links yet" | VaultTree.tsx |
| `case "manage-drops": return "Drop Links"` | `return "Client Upload Links"` | files.tsx |
| "Create New Upload Link" (modal title) | "Create Client Upload Link" | CreateUploadLinkModal.tsx |
| "Upload Link Error" (error heading) | "This upload link is no longer available" | drop-upload.tsx |
| "Files delivered securely" | "Your files have been delivered securely." | drop-upload.tsx |
| "Missing decryption key" | "This share link is incomplete. Ask the sender to re-send the full link." | PublicSharePage.tsx |
| "Missing file metadata in server response" | "This file is unavailable" | PublicSharePage.tsx |

---

## Step 6 — Empty & Loading States

**Files:** `src/pages/shared.tsx` · `src/pages/groups.tsx` · `src/pages/dashboard.tsx` · `src/components/upload/dropzone.tsx`

### Changes
- **`shared.tsx` loading state:** plain text → 3-row skeleton loader (animated pulse)
- **`shared.tsx` empty state CTA:** "Ask someone to share a file with you using your vault address."
- **`groups.tsx` top-level loading:** plain text → grid of 3 skeleton cards
- **`groups.tsx` GroupDetail loading:** plain text → skeleton rows
- **`groups.tsx` empty state:** proper "Create your first group" CTA
- **`dashboard.tsx` get-started checklist:** 3-item ordered list on first-time use (no files, no activity)
- **`dropzone.tsx` info footer:** added "All files are encrypted before leaving your device" — connects feature to benefit

---

## Step 7 — Public Pages: Client Experience

**Files:** `src/pages/drop-upload.tsx` · `src/pages/PublicSharePage.tsx`

### Changes
- **`drop-upload.tsx` loading text:** `"Loading file info…"` → `"Verifying your upload link…"`
- **`drop-upload.tsx` error heading:** `"Upload Link Error"` → `"This upload link is no longer available"`
- **`drop-upload.tsx` success heading:** `"Files delivered securely"` → `"Your files have been delivered securely."`
- **`drop-upload.tsx` success body:** Added `". Keep this reference for your records."`
- **`PublicSharePage.tsx` loading text:** `"Loading file info…"` → `"Verifying share link…"`
- **`PublicSharePage.tsx` expired state:** Added `"Contact the file owner to request a new link."`
- **`PublicSharePage.tsx` missing key error:** Replaced technical string with `"This share link is incomplete. Ask the sender to re-send the full link."`
- **`PublicSharePage.tsx` missing metadata error:** Replaced `"Missing file metadata in server response"` with `"This file is unavailable"`

---

## Verification

| Check | Result |
|-------|--------|
| `tsc -b && vite build` | ✓ PASS (built in ~8s, 0 TypeScript errors) |
| `npx vitest run` | ✓ 21/21 PASS |
| Files changed | 14 files, 284 insertions, 257 deletions |

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/dashboard.tsx` | Section headings, Security Posture position, empty state, CTA rename |
| `src/components/layout/sidebar.tsx` | Remove Home, rename Shared with Me, TS fix |
| `src/components/layout/mobile-nav.tsx` | Remove Home, rename Shared with Me, TS fix |
| `src/components/mobile/bottom-nav.tsx` | Remove Home |
| `src/pages/shared.tsx` | Description, skeleton loader, empty state CTA |
| `src/pages/groups.tsx` | Heading, description, skeleton loaders, empty state CTA |
| `src/components/files/file-card.tsx` | Progressive disclosure: 5 icons → 2 + ••• dropdown |
| `src/pages/settings.tsx` | 3-tab structure (Account / Security / Advanced) |
| `src/components/vault/VaultTree.tsx` | "Drop Links" → "Client Upload Links" |
| `src/components/upload/CreateUploadLinkModal.tsx` | Modal title rename |
| `src/components/upload/dropzone.tsx` | Security reassurance text added |
| `src/pages/files.tsx` | Tab label rename |
| `src/pages/drop-upload.tsx` | Professional client-facing copy |
| `src/pages/PublicSharePage.tsx` | Professional client-facing copy |

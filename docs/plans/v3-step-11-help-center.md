# Step 11 — Help Center & Documentation

**Parent:** [v3 Hackathon Index](./v3-hackathon-index.md)  
**Status:** ✅ DONE  
**Commit:** `f87a73c`  
**Deployed:** 2026-05-22

---

## Why This Matters

A Help Center tells judges: "This isn't a hackathon project. This is a product." When a judge clicks around and finds a fully localized, role-aware documentation system built into the app — that's the "funded startup" signal.

## What We Built

### 1. In-App Help Center Route (`/help`)
A two-pane documentation layout accessible from the authenticated sidebar. Left pane: section navigation. Right pane: content with rich typography.

**File:** `vaultdrive_client/src/pages/help/index.tsx`

### 2. Sidebar Navigation
Added a `HelpCircle` icon link to the sidebar and mobile nav, using the same styling pattern as Settings and Logout.

**File:** `vaultdrive_client/src/components/layout/sidebar.tsx`

### 3. User Guide Sections
- **Getting Started** — Welcome, zero-knowledge architecture overview
- **Your Vault & Recovery PIN** — PIN management, zero-knowledge guarantees
- **Uploads & Sharing** — Drag-and-drop, share links, access control
- **Workspaces & Groups** — Team collaboration, E2E group encryption

### 4. Admin Guide Sections (Admin-Only)
These sections are **hidden from non-admin users** — the sidebar check uses `getStoredUserFromLocalStorage().is_admin`:

- **User Management** — Invite, revoke, role assignment
- **Agent API Keys** — Scoped automation, read-only keys, audit
- **System Audit Logs** — Event tracking, compliance, transparency

**File:** `vaultdrive_client/src/pages/help/components/HelpSidebar.tsx`

### 5. Dynamic Branding
All content uses `{{product}}` interpolation via `react-i18next`. When deployed on QuantiX-Drive, it reads "QuantiX Drive Help Center". When deployed on ABRN-Drive, it reads "ABRN Drive Help Center". Zero code duplication.

### 6. Full Bilingual Support (EN/ES)
Complete translations in both English and Spanish:
- `vaultdrive_client/src/locales/en/help.json`
- `vaultdrive_client/src/locales/es/help.json`

The `help` namespace is registered in `i18n/index.ts`.

### 7. Contextual Callouts
The Vault & PIN section shows an amber "Zero-Knowledge Guarantee" callout. The Uploads section shows a primary-colored "End-to-End Encryption" callout. These are visual trust signals, not just text.

**File:** `vaultdrive_client/src/pages/help/components/HelpContent.tsx`

## Verification

| Check | Result |
|-------|--------|
| `/help` route loads | ✅ |
| Sidebar link to Help Center | ✅ |
| User Guide sections render | ✅ 4 sections |
| Admin Guide hidden for non-admins | ✅ |
| English content complete | ✅ |
| Spanish content complete | ✅ |
| Branding uses productName | ✅ |
| Build succeeds | ✅ |
| E2E suite still green | ✅ 41/41 |

## Evidence

- Commit: `f87a73c` — `feat(ui): implement enterprise Help Center (User & Admin Manuals)`
- Files created: 5 new files (index.tsx, HelpSidebar.tsx, HelpContent.tsx, en/help.json, es/help.json)
- i18n namespace: `help` registered in `i18n/index.ts`

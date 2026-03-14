# ABRN Drive — 7-Step UX Upgrade Plan
> Written: March 14, 2026  
> Author: Sisyphus (AI Engineering Agent)  
> Scope: User-first product upgrade. Not cosmetic. Not compliance. Not infra.  
> North Star: **The owner should never think about security. It should just work, invisibly.**

---

## Context: What We're Working With

**Stack:** Go 1.24.4 + React 19 + TypeScript + PostgreSQL + AES-256-GCM zero-knowledge encryption  
**Live URL:** https://dev-app.filemonprime.net/abrn/  
**Test user:** filemon@abrn.mx / 986532

### What's already built (don't reinvent)
- Zero-knowledge encryption (AES-256-GCM, RSA-2048 key wrapping)
- Secure Drop: write-only upload links for clients, no auth required
- Vault Explorer: split-pane tree, origin badges, bulk actions
- 4-digit PIN system (replaces password for file access)
- User-to-user sharing and group sharing
- Public share links (with AES key embedded in URL fragment)
- Activity log table (`026_activity_log.sql`) — **no UI yet**
- Secure notes schema (`010_secure_notes.sql`) — **no UI yet**
- File tags schema (`007_tags.sql`) — **no UI yet**
- File requests schema (`011_file_requests.sql`) — **no UI yet**
- Email handlers (preserved as `.disabled`) — **dormant, ready to activate**

### The actual user pain today
1. Every single download demands a PIN — even if you already entered it 30 seconds ago
2. The client drop page looks like a dev prototype, not a premium service
3. Owner finds out a client dropped files only by manually checking
4. Sharing a file with a colleague requires knowing their email AND entering a password
5. Managing 10+ drop links is a flat list with no context about activity
6. Can't glance at a file without downloading the whole thing
7. No sense of "my drive is healthy and secure" — just a file list

---

## Step 1 — Session Credential Cache ("PIN Once Per Session")

### The Problem
Every file download requires re-entering the 4-digit PIN. This is cryptographically correct but operationally brutal. Downloading 5 files = entering PIN 5 times. Users hate it and start looking for workarounds.

### The Fix
Cache the decrypted AES key **in memory only** (never localStorage, never sessionStorage) for the duration of the browser session. One PIN entry unlocks all files until the tab closes or the user logs out.

### What It Feels Like
- First download: "Enter your PIN" prompt appears
- Downloads 2–N in same session: instant, no prompt
- Tab close / logout: cache wiped, PIN required again on next session
- Mobile: same behavior

### Technical Sketch

**Frontend only — no backend changes needed.**

```typescript
// utils/sessionKeyCache.ts (NEW FILE)
// In-memory Map: fileId → Uint8Array (AES key)
// Also store: decryptedPrivateKey → CryptoKey (for RSA unwrapping)
// TTL: none (clears on tab close automatically, Map lives in module scope)

const keyCache = new Map<string, CryptoKey>();
let cachedPrivateKey: CryptoKey | null = null;
let cachedPIN: string | null = null;

export function cachePrivateKey(key: CryptoKey, pin: string) { ... }
export function getCachedPrivateKey(): CryptoKey | null { ... }
export function cacheFileKey(fileId: string, key: CryptoKey) { ... }
export function getCachedFileKey(fileId: string): CryptoKey | null { ... }
export function clearSessionCache() { ... }  // called on logout
```

**Files to touch:**
| File | Change |
|------|--------|
| `vaultdrive_client/src/utils/sessionKeyCache.ts` | New file — in-memory key cache |
| `vaultdrive_client/src/utils/crypto.ts` | Use cache before prompting PIN |
| `vaultdrive_client/src/pages/files.tsx` | Skip PIN modal if cache hit |
| `vaultdrive_client/src/components/vault/BulkDownloadModal.tsx` | Skip per-file PIN prompts for cached keys |

**Security tradeoff accepted:** Memory-only cache means a XSS attack on the active tab could extract keys. This is the same threat model as any web app where the user is actively logged in. Acceptable for this use case. Not acceptable if we add multi-user shared computers — document this clearly.

**Effort:** 1 day  
**User Impact:** ⭐⭐⭐⭐⭐ Eliminates the single most-complained-about friction point.

---

## Step 2 — Client Drop Portal Redesign

### The Problem
`drop-upload.tsx` is a functional skeleton. It works but it looks like something you'd send to a contractor to test, not a client whose trust you need. It has no personality, no brand, no reassurance, and no context for the client.

### The Fix
Full redesign of the public drop page into a premium, branded file submission portal. The client should feel: "This is professional. My files are going somewhere safe. I know exactly what I'm doing here."

### What It Feels Like (client perspective)
1. Client opens the link → sees a full-screen, branded page: "Secure File Delivery for [Owner Name]"
2. A brief note (set by owner when creating the link) explains what to send: "Please drop your Q1 financial statements here."
3. Large drag-and-drop zone with file-type guidance
4. As client drops files, each shows: icon, name, size, upload progress bar (animated)
5. Client can optionally add a short message: "Here are the 3 files you requested. Let me know if you need anything else."
6. On completion: "✓ Delivered securely. Your files are encrypted end-to-end."
7. If files are already over limit: friendly explanation, not a raw error message

### What's New for the Owner (when creating a link)
- **Description field** on the link creation modal: "What should the client see as instructions?"  
  → stored in `upload_tokens.description` (new column)
- **Owner display name** on drop page (from user profile)
- **Client message** stored as a note per drop session

### Technical Sketch

**DB change (1 migration):**
```sql
-- 028_upload_tokens_description.sql
ALTER TABLE upload_tokens ADD COLUMN description TEXT;
ALTER TABLE upload_tokens ADD COLUMN client_message TEXT; -- message from client on drop
```

**Files to touch:**
| File | Change |
|------|--------|
| `vaultdrive_client/src/pages/drop-upload.tsx` | Full redesign — branded, drag-and-drop, progress, message field |
| `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx` | Add description field |
| `handle_drop.go` | Return `description` and owner display name; save client message on upload |
| `sql/schema/028_upload_tokens_description.sql` | New migration |
| `sql/queries/upload_tokens.sql` | Update queries |

**Effort:** 2 days  
**User Impact:** ⭐⭐⭐⭐⭐ Clients feel respected. Owner looks professional. Reduces "what is this link?" support questions to zero.

---

## Step 3 — Instant Notifications (Drop Alerts + In-App Activity Feed)

### The Problem
The owner has zero awareness unless they actively check. A client drops sensitive documents at 11 PM. The owner finds out Monday morning when the client calls asking if they got them. This is unacceptable for a secure drive that people depend on.

The `activity_log` table (migration `026`) already exists. Email handler code is already written (preserved in `.disabled` files). This is activation work, not invention work.

### The Fix

**Part A — Drop Notifications (Email)**  
When a client successfully uploads via a drop link, send an email to the owner:  
> "Secure Drop Alert: [Client name/anonymous] dropped [N] file(s) to '[Link Name]' • [timestamp]"

Re-activate and adapt the email handlers in `handle_email_accounts.go.disabled`. Use a simple SMTP send (not IMAP). Environment variable for SMTP config.

**Part B — In-App Activity Feed**  
A notification bell in the top nav. Badge with unread count. Click → drawer/panel showing last 50 events from `activity_log`:
- "Client dropped 2 files via 'Contabilidad Q1' link"
- "You shared 'contrato_2026.pdf' with maria@example.com"
- "New file dropped to 'Clientes/ACME' folder"

Events are logged by backend handlers into `activity_log`. Frontend polls every 60s (or uses SSE for real-time feel).

### Technical Sketch

**Backend:**
```go
// New: internal/notifications/email.go
// SendDropAlert(ownerEmail, linkName, fileCount, clientMessage string) error
// Uses SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars

// Modified: handle_drop.go
// After successful upload: log to activity_log + trigger SendDropAlert

// New: handle_activity.go
// GET /abrn/api/activity — returns last 50 events for current user
// GET /abrn/api/activity/unread-count — returns count since last_seen_at
// POST /abrn/api/activity/mark-seen — update last_seen_at
```

**Frontend:**
```typescript
// New: src/components/notifications/NotificationBell.tsx
// New: src/components/notifications/ActivityFeed.tsx
// Modified: src/components/layout/sidebar.tsx (or top nav) — add bell icon with badge
```

**DB change (1 migration):**
```sql
-- 029_user_notification_prefs.sql
ALTER TABLE users ADD COLUMN email_notifications BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN last_activity_seen_at TIMESTAMPTZ;
```

**New env vars:**
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@abrn.mx
SMTP_PASS=...
SMTP_FROM="ABRN Drive <noreply@abrn.mx>"
```

**Effort:** 2 days  
**User Impact:** ⭐⭐⭐⭐⭐ Owner goes from "I have no idea what's happening" to "I know immediately when something arrives."

---

## Step 4 — In-Browser File Preview (Decrypt in Memory, View Without Downloading)

### The Problem
To see the contents of any file, you must: enter PIN → wait for download → open in external app. For a 50-page PDF you just want to glance at, this is 45 seconds of friction. You end up with files scattered on your desktop.

### The Fix
Decrypt the file in memory (using the session key cache from Step 1) and render it directly in the browser in a modal. No file ever touches the local filesystem unless the user explicitly clicks "Save."

### What It Feels Like
- File row has "Preview" icon (eye icon) alongside Download
- Click → modal opens → "Decrypting..." → file renders inline
- Images: full-resolution display with zoom
- PDFs: embedded PDF viewer (PDF.js, already used in many React apps)
- Text/Markdown/Code: syntax-highlighted, copyable
- Office docs (optional): convert to PDF server-side or use iframe (complex — defer to v2)
- "Download" button inside preview modal for when they want to save

### Technical Sketch

**Frontend only — no backend changes needed** (download API already returns the encrypted blob).

```typescript
// New: src/components/vault/FilePreviewModal.tsx
// Props: fileId, filename, metadata, onClose
// 1. Downloads encrypted blob (existing API)
// 2. Gets decryption key from session cache (Step 1) or prompts PIN
// 3. Decrypts in memory using crypto.ts
// 4. Detects file type from filename extension / MIME
// 5. Renders: <img> / <canvas> (PDF.js) / <pre> (text) / fallback message

// New: src/utils/filePreview.ts
// detectFileType(filename: string): 'image' | 'pdf' | 'text' | 'unsupported'
// renderPreview(type, decryptedBytes: Uint8Array): JSX.Element
```

**Dependencies to add:**
```bash
npm install pdfjs-dist
```

**Files to touch:**
| File | Change |
|------|--------|
| `vaultdrive_client/src/components/vault/FilePreviewModal.tsx` | New file |
| `vaultdrive_client/src/utils/filePreview.ts` | New file |
| `vaultdrive_client/src/pages/files.tsx` | Add "Preview" button to file row actions |
| `vaultdrive_client/src/components/files/FileWidget.tsx` | Add preview button in widget context |

**Effort:** 2 days  
**User Impact:** ⭐⭐⭐⭐ Transforms the "paranoid file manager" feel into "smart, fluid vault."

---

## Step 5 — Smart Drop Link Management Dashboard

### The Problem
Drop links are a list. No context. No analytics. You can't tell which links are active, which have received files recently, or which are about to expire. Managing 10 client drop boxes requires clicking into each link individually.

### The Fix
The "Drop Links" section of Vault Explorer becomes a rich management surface. Each link shows:
- Status badge (Active / Used / Expired / Disabled)
- File count: "3 files received" with a link to view them
- Last activity: "Last upload: 2 hours ago"
- Expiry: "Expires in 3 days" (with warning color when < 24h)
- Quick actions: Copy URL, Extend, Disable, Duplicate, View Files

Plus a "Create New Link" wizard that feels like filling out a form, not a modal.

### Technical Sketch

**DB change (1 migration):**
```sql
-- 030_upload_tokens_last_used.sql
ALTER TABLE upload_tokens ADD COLUMN last_used_at TIMESTAMPTZ;
ALTER TABLE upload_tokens ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
```
(Update `handle_drop.go` to set `last_used_at` on every successful upload)

**Backend additions:**
```go
// Modified: handle_drop.go
// GET /abrn/api/drop/tokens — already exists, enrich response with file count + last_used_at

// New query: sql/queries/upload_tokens.sql
// GetTokensWithStats — joins with files count, last_used_at
```

**Frontend:**
```typescript
// New: src/components/drop/DropLinkCard.tsx
//   — rich card with status, stats, quick actions
// Modified: src/pages/files.tsx (VaultTree Drop Links section)
//   — render DropLinkCard instead of plain list item
// Modified: src/components/upload/CreateUploadLinkModal.tsx
//   — add description field (from Step 2), expiry date picker, file limit stepper
```

**Effort:** 1.5 days  
**User Impact:** ⭐⭐⭐⭐ Owner gains full situational awareness of all client channels at a glance.

---

## Step 6 — Onboarding Flow + Quick Share

### The Problem
New users land on the files page and stare at an empty vault. There's a "Set PIN" banner, but no guidance on what to do next. The security model (PIN, RSA keys, drop links) is genuinely complex — users shouldn't need to understand it to use it, but right now they kind of do.

### Part A — First-Login Guided Setup (3 steps)
Trigger on first login when: `pin_set == false` AND `file count == 0`.

```
Step 1: "Set your 4-digit PIN"
  → This is how you unlock files. Think of it like a vault code.
  → PIN input × 2 (confirm)

Step 2: "Create your first client folder"
  → Enter a name: e.g. "Clients" or "ACME Corp"
  → One click creates folder

Step 3: "Create your first drop link"
  → Describe what you want clients to send
  → Copy the link
  → "You're ready. Share this link with your client."
```

No user should exit onboarding without: a PIN set, a folder, and their first drop link copied.

### Part B — Quick Share (2 clicks from any file)
Every file row gets a "⚡ Quick Share" option in its context menu:
1. Click "Quick Share"
2. System generates a public share link (with encrypted AES key in URL fragment)
3. Link copied to clipboard with a toast: "Link copied! Valid for 7 days."

Zero modals. Zero password prompts. Zero friction. (Uses existing `public_share_links` infrastructure from `027_public_share_links.sql`.)

### Technical Sketch

**Frontend:**
```typescript
// New: src/components/onboarding/OnboardingWizard.tsx
//   — 3-step modal shown on first login
//   — step 1: PIN (already have SetPINModal, reuse it)
//   — step 2: CreateFolderForm (existing API)
//   — step 3: CreateUploadLinkModal (existing API)

// Modified: src/components/layout/dashboard-layout.tsx
//   — Show OnboardingWizard when shouldShowOnboarding() returns true
//   — shouldShowOnboarding: JWT payload has no PIN + no files

// Modified: src/pages/files.tsx
//   — Add "Quick Share" to file row context menu
//   — Quick share handler: POST /abrn/api/files/{id}/share-link → copy to clipboard
```

**Backend:**
```go
// Modified: handle_public_share_links.go
// POST /abrn/api/files/{id}/quick-share
// Creates a share link with default 7-day expiry
// Returns {url, expires_at}
```

**Effort:** 1.5 days  
**User Impact:** ⭐⭐⭐⭐ Converts confused first-timers into confident users within 3 minutes. Quick Share removes the biggest everyday sharing friction.

---

## Step 7 — Personal Dashboard (Home Screen + Audit Trail)

### The Problem
The app has no home. You land on `/files` and get a file list. There's no sense of:
- What happened recently
- Whether your drive is healthy
- What your clients are doing  
- Whether you have pending attention items (files awaiting review, expiring links)

The `activity_log` table exists. The data is being written. There's just no view.

### The Fix
A proper dashboard at `/` (or `/dashboard`) that serves as the owner's control center:

```
┌─────────────────────────────────────────────────────┐
│ Good morning, Filemon.  Your vault is secure. 🔒     │
├──────────────┬─────────────────────────────────────  │
│ Quick Stats  │ Recent Activity                        │
│ 47 files     │ • ACME dropped 2 files (2h ago)        │
│ 8 drop links │ • You shared contrato.pdf (yesterday)  │
│ 3 shared     │ • New drop: Q1_Datos.xlsx (Mon)        │
├──────────────┴────────────────────────────────────── │
│ Quick Actions                                         │
│ [📤 Upload]  [🔗 New Drop Link]  [🤝 Share File]     │
├──────────────────────────────────────────────────────│
│ Attention Needed                                      │
│ ⚠ "ACME Link" expires in 1 day — Extend?             │
│ 📥 3 new files via "Q1 Financials" — View             │
└─────────────────────────────────────────────────────-┘
```

**"Attention Needed"** panel shows auto-surfaced items:
- Drop links expiring in < 48h
- New files received since last visit (unread indicator)
- Shared files that have been accessed by recipient

**Security Reassurance Widget:**
- "Your files are protected by AES-256-GCM zero-knowledge encryption"
- "Server cannot read your files"
- (Small, subtle — builds confidence without being noisy)

### Technical Sketch

**Backend:**
```go
// New: handle_dashboard.go
// GET /abrn/api/dashboard
// Returns:
// {
//   stats: { file_count, active_drop_tokens, shared_files_count },
//   recent_activity: activity_log rows (last 10),
//   attention_items: { expiring_tokens, unread_drops, new_shares }
// }
```

**Frontend:**
```typescript
// New: src/pages/dashboard.tsx
//   — DashboardLayout wrapper
//   — QuickStats, RecentActivity, QuickActions, AttentionItems sections

// Modified: src/App.tsx
//   — Route "/" → Dashboard (currently may go to files or login)

// New: src/components/dashboard/QuickStats.tsx
// New: src/components/dashboard/RecentActivity.tsx  (reuse from Step 3 Activity Feed)
// New: src/components/dashboard/AttentionItems.tsx
// New: src/components/dashboard/QuickActions.tsx
```

**Effort:** 2 days  
**User Impact:** ⭐⭐⭐⭐⭐ Transforms the app from a "file list" into a product that feels built for the user. First impression changes from "this is an app" to "this is MY drive."

---

## Implementation Order (Recommended)

| # | Step | Effort | User Impact | Dependencies |
|---|------|--------|-------------|--------------|
| 1 | Session Credential Cache | 1 day | ⭐⭐⭐⭐⭐ | None |
| 2 | Client Drop Portal Redesign | 2 days | ⭐⭐⭐⭐⭐ | None |
| 3 | Instant Notifications | 2 days | ⭐⭐⭐⭐⭐ | None |
| 5 | Smart Drop Link Dashboard | 1.5 days | ⭐⭐⭐⭐ | None |
| 6 | Onboarding + Quick Share | 1.5 days | ⭐⭐⭐⭐ | Step 1 (PIN cache helps Quick Share) |
| 4 | File Preview | 2 days | ⭐⭐⭐⭐ | Step 1 (session cache makes it smooth) |
| 7 | Dashboard | 2 days | ⭐⭐⭐⭐⭐ | Step 3 (activity feed data) |

**Total: ~12 developer-days.**  
Start with steps 1–3 in parallel (they have no shared dependencies). Then 5+6 together. Then 4+7.

---

## DB Migration Map

| Migration | Table Change | Required By |
|-----------|-------------|-------------|
| `028_upload_tokens_description.sql` | Add `description`, `client_message` to `upload_tokens` | Step 2 |
| `029_user_notification_prefs.sql` | Add `email_notifications`, `last_activity_seen_at` to `users` | Step 3 |
| `030_upload_tokens_last_used.sql` | Add `last_used_at`, `is_active` to `upload_tokens` | Step 5 |

All migrations are non-destructive `ALTER TABLE ADD COLUMN`.

---

## What This Plan Does NOT Touch (Intentionally)

- **Encryption model** — zero-knowledge stays exactly as is. Don't touch it.
- **Go backend architecture** — REST API stays, no GraphQL, no WebSockets yet
- **Auth system** — PIN + JWT is fine. No TOTP/hardware key additions here.
- **Email handler refactor** — reactivate the existing `.disabled` files; don't rewrite
- **Mobile app** — web responsive is enough for v1 of this plan
- **Multi-tenancy** — this is a single-owner drive; don't add tenant isolation complexity
- **File versioning** — schema exists (`009_file_versions.sql`), defer to a future plan

---

## Files That Will Be Created (New)

```
vaultdrive_client/src/
  utils/
    sessionKeyCache.ts          (Step 1)
    filePreview.ts              (Step 4)
  components/
    notifications/
      NotificationBell.tsx      (Step 3)
      ActivityFeed.tsx          (Step 3)
    drop/
      DropLinkCard.tsx          (Step 5)
    onboarding/
      OnboardingWizard.tsx      (Step 6)
    dashboard/
      QuickStats.tsx            (Step 7)
      RecentActivity.tsx        (Step 7)
      AttentionItems.tsx        (Step 7)
      QuickActions.tsx          (Step 7)
    vault/
      FilePreviewModal.tsx      (Step 4)
  pages/
    dashboard.tsx               (Step 7)

Backend:
  internal/notifications/email.go    (Step 3)
  handle_activity.go                 (Step 3)
  handle_dashboard.go                (Step 7)
  sql/schema/028_upload_tokens_description.sql
  sql/schema/029_user_notification_prefs.sql
  sql/schema/030_upload_tokens_last_used.sql
```

---

## The North Star Check

For each step, ask: "Does this release the owner from thinking about security?"

| Step | Test |
|------|------|
| Step 1 | Owner downloads 10 files without entering PIN 10 times ✓ |
| Step 2 | Client says "this looks professional" instead of asking what the link is ✓ |
| Step 3 | Owner knows a file arrived within 5 minutes, without checking ✓ |
| Step 4 | Owner reviews a document without it landing on their desktop ✓ |
| Step 5 | Owner sees all drop channels + their health at a glance ✓ |
| Step 6 | New user is operational in 3 minutes, not 30 ✓ |
| Step 7 | Owner opens the app and immediately knows what needs attention ✓ |

---

*Last reviewed: March 14, 2026*  
*Next review: After Steps 1–3 are shipped.*

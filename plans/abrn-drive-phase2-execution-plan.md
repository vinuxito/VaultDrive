# ABRN Drive — Phase 2: Secure Platform Execution Plan

> Written: March 14, 2026  
> Author: Sisyphus (Architecture + UX Analysis)  
> Scope: Next phase of execution after Phase 1 UX completion.  
> Status at writing: Phase 1 (session cache, drop portal, onboarding, quick share, dashboard) is DONE and verified.  
> This plan covers what remains: security hardening, operational visibility, and client trust completion.  
> Excludes: email module.

---

## Where We Are

Phase 1 shipped five major improvements:
- **Session AES key cache** — one PIN entry unlocks all files until logout
- **Drop portal redesign** — branded, description-aware, client message, success screen
- **UploadLinksSection** — drop link management wired as a full panel
- **OnboardingWizard** — 3-step guided setup for new users
- **Quick Share** — one-click public link generation
- **Dashboard** — stats, quick actions, activity feed surface (feed gracefully shows "coming soon" — backend not yet wired)

### The remaining honest picture

Phase 1 made the product feel better. But under the hood, three critical security integrity issues are still live, and several trust features the user needs to see every day are still unbuilt.

If someone audits the app today, they will find:
- The server is storing the literal AES-256 encryption key for every drop upload in plaintext in the database. The zero-knowledge claim is not true for drop uploads.
- Every drop link ever created has its wrapped key sitting in Apache access logs right now, because the key travels in the URL query string.
- Anyone can enumerate every user account on the platform without being authenticated.
- The 4-digit PIN that wraps the entire crypto chain has no rate limiting. 10,000 values, no lockout.
- CORS is set to wildcard `*` on all endpoints.

These are not theoretical risks. They are live. They need to close before anything else.

Beyond security, there are four high-value features that affect how trusted and useful the platform feels every day:
- No one can see who has access to a given file
- Share links and drop links have no expiry by default
- The drop portal doesn't tell clients who they're sending to or give them a receipt
- The dashboard shows "coming soon" for recent activity because the backend endpoint was never built

This plan closes every one of these gaps, in the right order.

---

## The 7 Steps

---

### Step 1 — Seal the Zero-Knowledge Promise

**What must be improved**

The platform claims zero-knowledge encryption, but the database table `upload_tokens` has a column called `raw_encryption_key` that stores the literal plaintext AES-256 key for every file uploaded via a drop link. `handle_drop.go` actively writes this key on every drop creation and returns it to clients on request. Any admin with DB read access, any log scraper, or any future code change can read every drop-uploaded file in cleartext.

**Why it matters**

This is not a UX problem. It is an architecture integrity problem. If the platform is ever evaluated by a client, partner, or auditor, this will be found immediately. The security story collapses the moment someone looks past the UI.

**How it helps the user**

The platform actually becomes what it says it is. When the owner tells a client "your files are zero-knowledge encrypted," that becomes true.

**How it improves security and usability together**

This fix removes risk without changing anything the user sees or does. The PIN-based decrypt path already works. This just eliminates the server-side shortcut that was never supposed to survive past development.

**What should be built or changed**

Phase A — Stop writing the raw key. In `handle_drop.go` around line 702: remove `RawEncryptionKey` from `CreateUploadTokenParams`. Remove the `handlerDropGetEncryptionKey` function entirely. Remove the route `GET /abrn/api/drop/{token}/encryption-key` from `main.go`.

Phase B — Verify the download path is PIN-only. Owner downloads a drop file: browser calls `UnwrapKey(PIN, pin_wrapped_key)` → gets raw AES key → decrypts file client-side. Confirm the frontend in `drop-upload.tsx` no longer calls the encryption-key endpoint. Test: upload via drop, download with PIN only.

Phase C — Drop the column after verification. Write migration `029_drop_raw_key_removal.sql`: `ALTER TABLE upload_tokens DROP COLUMN raw_encryption_key`. Run only after confirming no active code path touches it. This is the only destructive migration in this plan — do it last, after the live test passes.

| File | Change |
|------|--------|
| `handle_drop.go` | Remove RawEncryptionKey from CreateUploadTokenParams; delete handlerDropGetEncryptionKey |
| `main.go` | Remove encryption-key route |
| `vaultdrive_client/src/pages/drop-upload.tsx` | Remove query to encryption-key endpoint; confirm PIN path only |
| `sql/schema/029_drop_raw_key_removal.sql` | DROP COLUMN (run after verification) |

**Effort:** 4–6 hours  
**Trust impact:** ★★★★★ This is the difference between claiming zero-knowledge and being zero-knowledge.

---

### Step 2 — Move Drop Keys Out of Server Logs

**What must be improved**

Drop link URLs are currently structured as `/drop/:token?key=<wrapped_key>`. Query parameters are sent to the server on every GET request and are recorded in Apache access logs and the systemd journal. Every wrapped key for every drop link ever generated is sitting in log files on disk right now.

URL fragments (`#`) are never sent to the server by browser design. The browser retains them locally. No proxy, no log aggregator, no server ever receives them. This is a browser-spec guarantee, not a convention.

**Why it matters**

Log files are the most commonly breached part of production infrastructure. Access logs are often forwarded to log aggregation systems, shared with external monitoring tools, and rotated to backup storage. Every wrapped key ever created is in those logs. This makes the theoretical "encrypted keys" argument hollow.

**How it helps the user**

The wrapped key is never logged anywhere. It exists only in the browser and the database. The zero-knowledge transport story becomes complete.

**How it improves security and usability together**

Zero UX change for the person uploading. The URL looks the same. The behavior is identical. Only the transport changes — from server-visible to browser-only.

**What should be built or changed**

Change the URL format in `handle_drop.go` when generating the drop URL — replace `?key=` with `#key=`. Update the frontend in `vaultdrive_client/src/pages/drop-upload.tsx` to read from `window.location.hash` instead of `window.location.search`. Remove the key validation from the GET `/drop/{token}` info handler on the server side — the server should only confirm the token exists and is active. Key validation already happens at upload time when the client sends `wrapped_key` in the POST body.

Also update the URL displayed in `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx` to generate the `#key=` format.

| File | Change |
|------|--------|
| `handle_drop.go` | Generate `#key=` URL format; remove key validation from GET handler |
| `vaultdrive_client/src/pages/drop-upload.tsx` | Read key from `window.location.hash` |
| `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx` | Display `#key=` format URL |

**Effort:** 2–3 hours  
**Trust impact:** ★★★★ Keys are never in any log. Ever.

---

### Step 3 — Close the Open API Doors

**What must be improved**

Three unrelated security gaps that are each quick to close but together create a significant attack surface:

1. `GET /api/user-by-username` and `GET /api/user-by-email` require no authentication. Any external actor can enumerate every user account on the platform by username or email address. For a platform used with external clients and partners, this leaks the internal staff directory to anyone who probes the API.

2. `Access-Control-Allow-Origin: *` is set on all endpoints in `main.go`. CORS wildcard eliminates the browser Same-Origin Policy protection entirely. A malicious page can make cross-origin requests to this API on behalf of any authenticated user in the same browser.

3. The 4-digit PIN has 10,000 possible values. There is no rate limiting on any PIN validation endpoint. At bcrypt cost 10 (~100ms per check), exhausting all values takes under 17 minutes of sequential requests. The PIN wraps the entire crypto chain — file access keys, RSA private key, drop link creation.

**Why it matters**

Each of these is exploitable today without special tools. The PIN brute-force issue is the most severe: it turns the primary protection mechanism for all encrypted content into a short-lived obstacle.

**How it helps the user**

These fixes are invisible in normal use. No extra steps, no new friction. The platform just stops being vulnerable to the most common API-level attacks.

**How it improves security and usability together**

Closing these gaps is pure security gain with zero UX cost. PIN rate limiting specifically makes the 4-digit convenience mechanism actually secure, not just convenient.

**What should be built or changed**

Auth-gate the user lookup endpoints in `main.go` — wrap both routes with `apiConfig.middlewareAuth`. No handler code changes needed; they just need authentication context.

Replace CORS wildcard with an explicit origins list. Read allowed origins from an environment variable `CORS_ALLOWED_ORIGINS` that lists the production and development domains.

Add PIN rate limiting. Write migration `030_pin_attempt_tracking.sql` to add `pin_failed_attempts INTEGER NOT NULL DEFAULT 0` and `pin_locked_until TIMESTAMPTZ` to the `users` table. In any handler that validates a PIN: check `pin_locked_until` first — return 429 if locked. On failure: increment `pin_failed_attempts`; lock for 15 minutes after 5 failures. On success: reset both fields.

| File | Change |
|------|--------|
| `main.go` | Add middlewareAuth to user lookup routes; update CORS handler to read allowed origins |
| `handle_drop.go` | Add PIN lockout check before PIN validation |
| `handle_user_pin.go` | Add PIN lockout check |
| `sql/schema/030_pin_attempt_tracking.sql` | New migration — pin_failed_attempts, pin_locked_until |
| `.env` | Add CORS_ALLOWED_ORIGINS |

**Effort:** 4–6 hours  
**Trust impact:** ★★★★★ Closes the most common attack vectors. PIN rate limiting is non-negotiable.

---

### Step 4 — Build the Activity Feed the Dashboard Is Waiting For

**What must be improved**

The dashboard built in Phase 1 is live but the recent activity section shows "coming soon." The `activity_log` table (migration `026`) exists, the `broadcastToUser` calls that write to it are already in place, the frontend component is already rendering. The only missing piece is the `GET /api/activity` endpoint that the frontend is already trying to fetch.

Beyond wiring the activity feed, the dashboard should surface one more thing: a calm security posture panel that answers "is everything OK in my vault right now?" not as a security scanner, but as a health board. The owner should be able to open the app and verify vault health in under 10 seconds.

**Why it matters**

The owner currently has no operational awareness. A client can drop files at 11 PM and the owner finds out when the client calls Monday asking if they arrived. The activity_log table is already being written — the data is there. It just has no read path.

The security posture panel prevents blind spots: forgotten drop links still active months later, share links that have never been accessed (possibly a dead link), rate anomalies on drop endpoints.

**How it helps the user**

Opens the app → sees what happened → knows what needs attention → moves on. That's the flow. Right now: opens the app → sees nothing → checks manually → misses things.

**How it improves security and usability together**

Awareness is a security tool. Knowing that a drop link is expiring tomorrow removes the class of "accidentally expired link" incidents. Knowing unusual upload activity happened on a drop link surfaces potential abuse.

**What should be built or changed**

Create `handle_activity.go` with two endpoints:
- `GET /api/activity?limit=50` — reads `activity_log` rows for the authenticated user, ordered by `created_at DESC`
- `GET /api/security-posture` — pure SQL joins across `upload_tokens`, `public_share_links`, `activity_log` returning: `{ expiring_tokens: [...], stale_share_links: [...], rate_anomalies: [...] }`

Register both routes in `main.go`. The frontend already fetches `/api/activity` in `vaultdrive_client/src/pages/dashboard.tsx` with a graceful 404 fallback — wiring the endpoint will automatically make the activity feed live.

Add a `SecurityPosturePanel` component to the dashboard. Its default state is visually quiet: "Everything looks healthy." Attention items only appear when they are genuinely actionable. Do not surface information the owner cannot act on.

| File | Change |
|------|--------|
| `handle_activity.go` | New file — GET /api/activity and GET /api/security-posture |
| `main.go` | Register new routes |
| `vaultdrive_client/src/pages/dashboard.tsx` | Wire SecurityPosturePanel; activity feed already wired |
| `vaultdrive_client/src/components/dashboard/SecurityPosturePanel.tsx` | New component |

**Effort:** 1 day  
**Trust impact:** ★★★★★ Transforms the dashboard from a placeholder into an actual operational surface.

---

### Step 5 — Ship Safer Defaults: Expiry, Sealing, and Status

**What must be improved**

Public share links have no default expiry. A link shared for a one-time document delivery stays valid forever unless the owner remembers to revoke it. Drop links have no automatic "done" state after their intended use. Most secure file mistakes are not dramatic attacks. They are forgotten links that outlive their purpose.

**Why it matters**

The owner should not have to remember to clean up. The system should default safe and require explicit action to stay open, not the other way around. For a professional advisory firm, an undated share link to a client contract that never expires is an audit liability, not a feature.

**How it helps the user**

Set it and forget it — in the right direction. Links expire unless the owner chooses otherwise. Drop portals seal themselves after their job is done. The owner stops worrying about what is still live.

**How it improves security and usability together**

The safest path becomes the easiest path. No extra friction — just better defaults that happen automatically.

**What should be built or changed**

**Default 7-day expiry on public share links.** In `handle_public_share_links.go`: if no `expires_at` is provided, default to `NOW() + 7 days`. In the share link creation UI (`vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx`): add a "Permanent link" checkbox that users must explicitly check. Default state is 7 days. This is a defaults change only — permanent links remain possible.

**"Seal after first upload" on drop links.** Write migration `031_upload_tokens_seal_option.sql`: add `seal_after_upload BOOLEAN NOT NULL DEFAULT FALSE` and `last_used_at TIMESTAMPTZ` columns. In `handle_drop.go`: after a successful upload, if `seal_after_upload` is true, deactivate the token immediately. In `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx`: add a "Seal this link after first upload" toggle.

**Visual status badges for drop links in VaultTree.** The `upload_tokens` table already has `expires_at`, `is_used`, `is_active`. Compose these into four calm states: 🟢 Active, 🟡 Expiring soon (< 48h), ⬛ Sealed (used, expired, disabled), 🔴 Attention (expired with zero uploads — possible dead link). These should feel informational, not alarming. Sealed is gray, not red.

| File | Change |
|------|--------|
| `handle_public_share_links.go` | Default 7-day expiry when expires_at not provided |
| `handle_drop.go` | Seal logic after upload; set last_used_at |
| `sql/schema/031_upload_tokens_seal_option.sql` | New migration |
| `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx` | Seal toggle |
| `vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx` | Permanent link checkbox |
| `vaultdrive_client/src/components/vault/VaultTree.tsx` | Status badges on drop links |

**Effort:** 6–8 hours  
**Trust impact:** ★★★★ Security by default reduces the "I forgot to close that link" class of incidents entirely.

---

### Step 6 — Give the Drop Portal a Professional Identity

**What must be improved**

When a client opens a drop link, they see a file upload interface with no context about who they are sending to or why. The owner's name, organization, and context are absent. There is no proof after the upload that anything happened.

The Phase 1 redesign added branded styling and the description instructions field. But the identity layer — "you are sending files to [Name] at [Organization]" — was not built. And there is no upload receipt.

For a client uploading sensitive accounting documents or contracts, the absence of identity context is a trust barrier. They have no basis for confidence other than the URL.

**Why it matters**

The drop page is the highest-stakes trust moment in the app. It is the moment an external person is evaluating whether ABRN is a professional service or a developer experiment. That judgment happens in the first 3 seconds.

**How it helps the user**

The owner looks organized and credible. The client feels guided. The "what is this link?" support call disappears.

**How it improves security and usability together**

Identity context is not just trust-building — it is verification. A named, organization-branded drop page is harder to spoof in a phishing scenario than a generic upload form.

**What should be built or changed**

**Owner identity on the drop page.** The `handle_drop.go` token info handler already returns owner metadata. Extend it to include `owner_display_name` (first_name + last_name from users) and `owner_organization` (new field). In `drop-upload.tsx`, render an identity bar: "You're sending files securely to: **[Name]** · [Organization]" and below the upload zone: "🔒 Files are encrypted in your browser before being sent."

**Organization name field.** Add `organization_name TEXT` to the users table via migration `032_user_organization.sql`. Add a one-field text input to the settings page. Display it in the drop portal identity bar.

**Upload receipt.** After successful upload, the drop page shows a receipt block:
```
✓ Delivered securely
To: [Owner Name] · [Organization]
Files: [count] file(s)
Time: [timestamp]
Reference: [first 8 chars of token]
```
Offer "Copy receipt" button (copies to clipboard). No new backend needed — all data is available at upload completion.

| File | Change |
|------|--------|
| `handle_drop.go` | Add owner_display_name and owner_organization to token info response |
| `vaultdrive_client/src/pages/drop-upload.tsx` | Identity bar + upload receipt block |
| `vaultdrive_client/src/pages/settings.tsx` | Organization name field |
| `sql/schema/032_user_organization.sql` | New migration |

**Effort:** 4–6 hours  
**Trust impact:** ★★★★★ Named, branded, receipted. The client experience goes from "what is this" to "I know exactly what I just did."

---

### Step 7 — Make File Access Visible and Revocable

**What must be improved**

There is currently no way to answer "who can access file X right now?" without manually reconstructing it from: direct shares in `file_access_keys`, group memberships in `group_members`, public share links in `public_share_links`, and drop-linked provenance in the file metadata. For a platform used with external clients and partners, this is not an acceptable answer to an access audit question.

Additionally, public share links have no access tracking. An owner cannot know if a client ever opened a document they shared.

**Why it matters**

Permission visibility is part of the product, not just a backend rule. For an accounting or advisory firm, being able to state — and prove — who had access to a document is operationally required. The data model already supports this. It just has no surface.

**How it helps the user**

The owner can verify access state before sharing additional sensitive material. They can revoke external access in one click instead of hunting through four separate UI sections. They can see whether a shared document was ever actually accessed.

**How it improves security and usability together**

Visibility removes the need for defensive friction. When the owner can see exactly who has access, they do not need to over-restrict by default — they can share confidently and correct quickly.

**What should be built or changed**

**File access summary endpoint.** Create a new handler (or add to existing share handlers): `GET /api/files/{id}/access-summary`. This is a join across `file_access_keys`, `group_file_shares`, `public_share_links` for a given `file_id`. Returns a structured list of access entries: who, via what mechanism, since when, last accessed (for public links).

**Share link access tracking.** Write migration `033_share_link_access_tracking.sql`: add `access_count INTEGER NOT NULL DEFAULT 0` and `last_accessed_at TIMESTAMPTZ` to `public_share_links`. In `handle_public_share_links.go`, after serving the file, update these counters. Cost: one UPDATE per download.

**Access panel in the file UI.** In `vaultdrive_client/src/pages/files.tsx` and the `FileWidget` component: add a collapsible "🔒 Access" section collapsed by default. On expand: fetch the access-summary endpoint and render the roster. Human-readable labels, not technical IDs:
- "Only you" (green, reassuring default)
- "Shared with Maria García"
- "Available via public link · accessed 3 times · expires Mar 21"
- "Drop file from ACME portal"

Add a "Revoke all external access" button: one click deletes all share link and user share entries for the file. Internal team shares (via groups or direct share) are not affected by this — they require explicit individual revoke.

The access panel should feel calm, not alarming. The base state — only the owner has access — should look quietly confident. The panel grows in detail as files are shared. It is a status surface, not a warning system.

| File | Change |
|------|--------|
| `handle_access.go` (new file) | GET /api/files/{id}/access-summary handler |
| `handle_public_share_links.go` | Update access_count and last_accessed_at on file serve |
| `main.go` | Register new route |
| `sql/schema/033_share_link_access_tracking.sql` | New migration |
| `sql/queries/public_share_links.sql` | Add access counter query |
| `vaultdrive_client/src/pages/files.tsx` | Wire access panel |
| `vaultdrive_client/src/components/files/FileWidget.tsx` | Add Access Panel section |

**Effort:** 1–1.5 days  
**Trust impact:** ★★★★★ Transforms the owner from "hoping things are OK" to "knowing they are." This is operational trust made tangible.

---

## Execution Order

| # | Step | Effort | Priority | Blocks |
|---|------|--------|----------|--------|
| 1 | Seal Zero-Knowledge Promise | 4–6h | Critical | None |
| 2 | Move Drop Keys Out of Logs | 2–3h | Critical | None |
| 3 | Close Open API Doors | 4–6h | Critical | None |
| 4 | Activity Feed + Security Posture | 1 day | High | None |
| 5 | Safer Defaults + Status Badges | 6–8h | High | None |
| 6 | Drop Portal Identity + Receipt | 4–6h | High | None |
| 7 | File Access Panel | 1–1.5 days | Medium | None |

Steps 1–3 are the immediate priority. They close real vulnerabilities that are live today. They are also the lowest-effort steps. All three can ship in under a day combined.

Steps 4–6 can be worked in parallel once 1–3 are done.

Step 7 builds on the access infrastructure from earlier work and can close out the phase.

**Total estimated effort: ~5–6 developer-days.**

---

## DB Migration Map

| Migration | Change | Required By |
|-----------|--------|-------------|
| `029_drop_raw_key_removal.sql` | DROP COLUMN raw_encryption_key on upload_tokens | Step 1 (Phase C — run after verification) |
| `030_pin_attempt_tracking.sql` | pin_failed_attempts, pin_locked_until on users | Step 3 |
| `031_upload_tokens_seal_option.sql` | seal_after_upload, last_used_at on upload_tokens | Step 5 |
| `032_user_organization.sql` | organization_name on users | Step 6 |
| `033_share_link_access_tracking.sql` | access_count, last_accessed_at on public_share_links | Step 7 |

All are non-destructive `ADD COLUMN` except `029` which is a `DROP COLUMN`. Run `029` only after confirming the raw key endpoint is removed and the PIN-only download path is verified live.

---

## What This Plan Does NOT Touch

- Encryption primitives — AES-256-GCM, RSA-2048 OAEP, PBKDF2 100k iterations are correct. Do not change them.
- JWT authentication flow — PIN + JWT is appropriate. No TOTP additions in this phase.
- Group sharing model — architecturally sound.
- File versioning — schema exists in `009_file_versions.sql`. Defer.
- File requests / inbound request system — dormant schema in `011_file_requests.sql` exists. This is real product value, but it is Phase 3 work, not Phase 2.
- Hosting infrastructure — single-server Apache + systemd is appropriate for current scale.

---

## The Trust Test

For each step: "Does the owner or a careful client feel genuinely more confident after this change?"

| Step | The Trust Test |
|------|----------------|
| Step 1 | The server cannot read your files. This is now actually true, not just claimed. ✓ |
| Step 2 | Your drop link key is never seen by any server. It lives only in the browser. ✓ |
| Step 3 | No one can learn the user directory, and your PIN cannot be brute-forced. ✓ |
| Step 4 | You open the app and know within 10 seconds whether everything is OK. ✓ |
| Step 5 | Links expire by default. You don't have to remember to clean them up. ✓ |
| Step 6 | Your client sees your name and gets a receipt. They know they sent to the right person. ✓ |
| Step 7 | You can see who has access to any file and revoke it in one click. ✓ |

---

## The Outcome

When this phase is done, ABRN Drive will be:
- **Actually zero-knowledge**, not just marketed as such
- **Operationally transparent** — the owner knows what happened, who has access, and what needs attention
- **Professionally trusted** by clients who see identity, context, and receipts on the drop portal
- **Self-managing by default** — links expire, portals seal, the system cleans up after itself
- **Auditable** — access history is visible, revocable, and provable

The owner will feel relief because secure file handling will finally be simple.

---

*Last reviewed: March 14, 2026*  
*Phase 1 status: COMPLETE — session cache, drop portal, onboarding, quick share, dashboard all shipped and verified.*  
*Phase 2 starts with Steps 1–3 (security) and should close within 2 days.*

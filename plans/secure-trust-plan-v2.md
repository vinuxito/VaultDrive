# ABRN Drive — Secure File Exchange: Trust & Architecture Plan (v2)

> Written: March 14, 2026
> Author: Oracle (Architecture Consultation)
> Scope: Architectural trust gaps and safer defaults. Complementary to upgrade-plan-v1.md (UX).
> North Star: **A platform that is genuinely zero-knowledge, not just marketed as such — and that users trust because it earns trust, not because it asserts it.**

---

## Context

This plan is written alongside . That plan addresses daily UX friction.
This plan addresses the architectural integrity gaps that, if left unresolved, undermine the
security claims regardless of how polished the interface becomes.

**Ground truth from codebase review:**
- Stack: Go 1.24.4 + React 19 + TypeScript + PostgreSQL + AES-256-GCM + RSA-2048
- 28 DB migrations, active zero-knowledge architecture, PIN system, Secure Drop live
- Existing plan (v1) covers: session cache, drop portal redesign, notifications, file preview, drop link dashboard, onboarding, personal dashboard

**What v1 does NOT cover:** raw key in DB, key in server logs, user enumeration, CORS wildcard, PIN brute-force exposure, access visibility, dangerous defaults.

---

## Part I — Sharp Critique

### What a Trusted File Exchange Platform Must Get Right

Trust is established in layers. Break any layer and the whole stack fails regardless of
what the other layers do.

**Layer 1 — Perceived trust:** Does the platform look and feel like something a serious
business would use? (v1 plan addresses this)

**Layer 2 — Operational trust:** Can the owner verify what is happening, who has access,
and what changed? (Partially missing — no access visibility UI despite schema existing)

**Layer 3 — Architectural trust:** Are the security claims actually true?
(Has at least one critical failure — see Failure 1 below)

**Layer 4 — Cryptographic trust:** Are the primitives sound and correctly applied?
(Strong — AES-256-GCM, RSA-2048 OAEP, PBKDF2 100k iterations, bcrypt are all correct.
One weakness: PIN entropy)

ABRN Drive is strong at layer 4, improving at layer 1, partially failing at layer 2,
and has a critical failure at layer 3.

---

### Critical Failure Modes

**Failure 1 (Critical): The Zero-Knowledge Claim Is False for Drop Uploads**

 stores the literal plaintext AES-256 key for
every file uploaded via a drop link. The endpoint
 returns this key to any client presenting the
matching wrapped key. The server is not blind: it can decrypt every drop-uploaded file.

This is the single most serious architectural integrity problem. It is not a
theoretical concern — any admin with DB read access, any log aggregator reading
query results, or any future code change that reads this column could expose
every drop-uploaded file in cleartext.

**Failure 2 (Serious): Drop Link Wrapped Key in Server Logs**

Drop link URLs are structured as . Query parameters
are sent to the server on every GET request and appear in Apache access logs, reverse
proxy logs, and any analytics middleware. Every wrapped key for every drop link ever
created is sitting in log files on disk.

URL fragments () are NEVER sent to the server by the browser. This is a
one-line change that makes a real difference.

**Failure 3 (Serious): Unauthenticated User Enumeration**

 and  require no authentication.
Any external actor can enumerate all platform users by email address or username.
For a platform used with external clients and partners, this leaks the entire
internal staff directory to anyone who probes the API.

**Failure 4 (Serious): No Rate Limiting + 4-Digit PIN = Brute-Forceable**

The 4-digit PIN has 10,000 possible values. It is used to:
- Wrap file access keys
- Wrap drop link encryption keys
- Authenticate drop link creation
- Protect the RSA private key (migration 025: private_key_pin_encrypted)

No rate limiting exists on any endpoint. With bcrypt cost 10 (~100ms/check on
modest hardware), exhausting all 10,000 PIN values takes under 17 minutes of
sequential requests. The PIN is protecting the entire crypto chain.

**Failure 5 (Moderate): CORS Wildcard on Authenticated Endpoints**

 is set on all endpoints. While JWT Bearer tokens
are not CSRF-vulnerable in the traditional cookie sense, wildcard CORS eliminates
the browser Same-Origin Policy protection entirely. A malicious page can make
requests to this API on behalf of an authenticated user in the same browser.
As the platform adds more endpoint types, this becomes progressively riskier.

**Failure 6 (Operational): No "Who Can See This?" View**

There is no UI that answers "who can access file X right now?" An owner must
mentally reconstruct access from: direct shares + group memberships + drop links +
public share links. The activity_log and public_share_links tables exist in schema
but have no access tracking or UI surface. For professional use with client documents,
proving access history is operationally required.

**Failure 7 (Trust): No PIN Recovery Path**

If the owner forgets their 4-digit PIN, all drop-link-encrypted files are permanently
inaccessible.  (migration 025) means the PIN also wraps
the RSA private key used for shared file access. A forgotten PIN is a catastrophic
data loss event with no escape hatch — not a security feature, just a failure mode.

---

### What Security Theater Looks Like Here (Avoid These)

- Adding CAPTCHA to drop upload pages (breaks client experience, does not prevent real attacks)
- Showing encryption algorithm names in the UI (creates anxiety without building trust)
- Requiring 2FA for every file operation (adds friction without proportional improvement)
- Adding password complexity requirements without fixing the PIN brute-force problem first
- Encrypting the PostgreSQL database at rest without removing raw_encryption_key from the table

The rule: if a security change does not prevent a real attack or does not make
the owner/client feel demonstrably safer without adding friction, it is theater.

---

## Part II — The 7 Upgrade Themes

---

### Step 1 — Close the Zero-Knowledge Gap: Remove Raw Encryption Key From Storage

**Category:** Security (Critical), Architecture
**Effort:** Short (1-4h) if the PIN-based decrypt path already works; Medium (1-2d) if raw key endpoint is still in the active download path

**The Problem**

 stores  — the literal plaintext AES-256 key.
 returns this key to clients. The server is not
zero-knowledge for drop uploads. Any DB read access, log scraping, or future code
change exposes every drop-uploaded file in cleartext.

The correct architecture requires only  server-side. The owner
decrypts via: PIN → unwrap pin_wrapped_key → get raw AES key → decrypt file client-side.

**The Fix**

Phase 1 — Stop writing the raw key (handle_drop.go):
- In : stop populating  in CreateUploadTokenParams
- Remove  endpoint entirely
- Remove the route  from main.go

Phase 2 — Verify the download path is PIN-only:
- Owner downloads a drop file: frontend calls UnwrapKey(PIN, pin_wrapped_key) → gets
  raw AES key → decrypts file client-side using crypto.ts
- Confirm that this path does NOT call the raw key endpoint
- Test: upload a file via drop, then download it using only the PIN

Phase 3 — Remove the column after confirming no active dependency:
- Migration: ALTER TABLE upload_tokens DROP COLUMN raw_encryption_key
- This is the only migration in this plan that is destructive — do it AFTER test verification

**Files to Touch**
| File | Change |
|------|--------|
|  | Remove RawEncryptionKey from CreateUploadTokenParams; delete handlerDropGetEncryptionKey |
|  | Remove  route |
|  | DROP COLUMN migration (run after verification) |
|  | Confirm drop file download uses pin_wrapped_key only |

**Trust Impact:** ★★★★★
This is the difference between "claims to be zero-knowledge" and "actually is zero-knowledge."
Any security review of this codebase will find this column immediately.

---

### Step 2 — Move Drop Key Out of Server Logs: URL Fragment Migration

**Category:** Security, Low Friction
**Effort:** Quick (<1h) — 3-file coordinated change

**The Problem**

Drop URLs: 

Query parameters are sent to the server on every GET request. Apache access logs record
them. Every wrapped key for every drop link ever generated is sitting in:
 and the systemd journal for abrndrive.

URL fragments () are never sent to the server by design in HTTP.
The browser retains them locally. No proxy, no log aggregator, no server ever receives them.

**The Fix**

Change 1 — URL generation in :


Change 2 —  response: same pattern for the upload_url field.

Change 3 — : extract key from window.location.hash instead of
window.location.search. The key is still present on the client; it just never
traveled to the server.

Change 4 — : remove the  query param validation on GET.
The server should only confirm the token exists and is active. Key validation happens
at upload time when the client sends wrapped_key in the POST body (already implemented).

**What Does NOT Change**
- The wrapped key is still sent in the POST body on upload — this is correct and
  keeps server-side key validation intact
- The encrypted files themselves are unchanged
- Owner decryption is unchanged

**Files to Touch**
| File | Change |
|------|--------|
|  | Change URL format to fragment; remove GET key validation in handlerDropTokenInfo |
|  | Read key from window.location.hash |
|  | Display correct fragment URL |

**Trust Impact:** ★★★★
The wrapped key is never logged by any server component. This fulfills the zero-knowledge
promise at the transport layer with zero UX change for uploaders.

---

### Step 3 — Lock the Open API Doors: Auth Gates, CORS, and PIN Rate Limiting

**Category:** Security, Defaults
**Effort:** Quick (<1h) for auth gates + CORS; Short (1-4h) for PIN rate limiting

**The Problem**

Three doors are open that should be closed, and one protection is missing entirely:

1.  — unauthenticated user enumeration by username
2.  — unauthenticated user enumeration by email
3.  — wildcard CORS on all authenticated endpoints
4. No rate limiting on PIN attempts (10,000 values, no lockout, no delay)

**The Fix**

Part A — Authentication gates (5 minutes each):
In , wrap both user lookup endpoints with :

The handlers themselves don't need changes — they just need authentication context.

Part B — CORS hardening:
Replace wildcard with explicit allowed origins list in :


Part C — PIN attempt tracking (new migration):

In  and any handler that validates a PIN:
- Before validating: check  → return 429 if locked
- On failure: ; if  set 
- On success: reset both fields to 0/null

**Files to Touch**
| File | Change |
|------|--------|
|  | Add middlewareAuth to user lookup routes; update middlewareCORS |
|  | Add PIN lockout check in handlerCreateDropToken |
|  | Add PIN lockout check in PIN verification |
|  | New migration |
|  | Add CORS_ALLOWED_ORIGINS production value |

**Trust Impact:** ★★★★★
Closes the most common attack vectors. The PIN rate limiting is non-negotiable:
a 4-digit secret protecting crypto keys with no rate limiting is not security.

---

### Step 4 — Access Visibility: "Who Can See This?" Panel

**Category:** Trust UX, Day-to-Day Operations
**Effort:** Medium (1-2d)

**The Problem**

An owner managing client documents cannot answer "who has access to file X right now?"
without mentally reconstructing it from: direct shares + group memberships +
drop links + public share links. For an accounting or advisory firm, being able
to state — and prove — who had access to a document on what date is operationally required.

Additionally, public share links have no access tracking. An owner cannot see if
a client ever opened a shared document.

**The Fix**

Part A — File access roster endpoint:

This is a join across: file_access_keys, file_shares, group_file_shares,
public_share_links for a given file_id. No new tables needed.

Part B — Share link access tracking (1 migration):

In : after serving the file, update these counters.
Cost: one UPDATE per download. Acceptable.

Part C — Frontend: Access Panel in FileWidget
In :
- Add a collapsible "🔒 Access" section (collapsed by default)
- On expand: fetch /api/files/{id}/access-summary, render the roster
- Tone: calm status display, not a security alert
- Green "Only you" is the base state; it grows to show others as files are shared
- Add "Revoke all external access" button: one click → calls revoke on all share links
  and user shares for this file

**UX Principle**
The access panel should answer the question calmly, not alarm the user. Default state
(only owner has access) should look reassuringly quiet. The panel expands into detail
when the user wants it — not shoved in their face.

**Files to Touch**
| File | Change |
|------|--------|
|  (or new handle_access.go) | New GET /api/files/{id}/access-summary handler |
|  | Add access counter update in handlerGetPublicShareLinkFile |
|  | Register new route |
|  | New migration |
|  | New GetFileAccessSummary query |
|  | Add Access Panel |

**Trust Impact:** ★★★★★
This is operational trust made tangible. Seeing exactly who has access — and having a
one-click revoke — transforms the owner from "hoping things are OK" to "knowing they are."

---

### Step 5 — Safer Sharing Defaults: Expiry, Sealing, and Visual Status

**Category:** Safer Defaults, Friction Reduction
**Effort:** Quick (<1h) for default expiry and seal option; Short (1-4h) for visual status states

**The Problem**

Public share links have no default expiry. A link shared for a one-time delivery
is valid forever unless the owner remembers to revoke it. Drop links have no
automatic "sealed" state after their intended use is complete.

Security by default means links should expire unless the owner explicitly opts for
permanent access — not the other way around.

**The Fix**

Part A — Default 7-day expiry on public share links:
In : if  is not provided in the request,
default to .

Frontend: in the share link creation UI, add a checkbox "Permanent link (no expiry)"
that users must explicitly check. Default state = 7 days. This is a defaults change
only — permanent links remain possible.

Part B — "Seal after first upload" option for drop links:
New DB column:

In : after a successful upload, if ,
call  immediately. Use case: "one document in, then sealed."
Show this as a checkbox in : "Seal this link after first upload."

Part C — Visual status states for drop links in Vault Explorer:
Drop tokens have , , ,  — but the UI
shows a flat list with no clear status. Surface these as composited status badges:

- 🟢 Active — accepting uploads
- 🟡 Expiring Soon — < 48h remaining
- ⬛ Sealed — used, expired, manually disabled, or reached file limit
- 🔴 Overdue — max files exceeded or expired with zero uploads (possible setup error)

Color coding: calm, not alarmist. Sealed is grey (neutral), not red.

**Files to Touch**
| File | Change |
|------|--------|
|  | Add default 7-day expiry |
|  | Add seal_after_upload logic; set last_used_at |
|  | New migration |
|  | Add seal checkbox |
|  (VaultTree drop section) | Add status badges |

**Trust Impact:** ★★★★
Security by default reduces the "I forgot to expire that link" incidents.
Operators should not have to remember to clean up — the system should default safe.

---

### Step 6 — Client Drop Portal: Identity Layer and Upload Receipt

**Category:** Trust UX, Client Experience
**Effort:** Short (1-4h)

**The Problem (complementing v1 Step 2)**

V1 Step 2 redesigns the drop portal aesthetically. This step addresses the
identity and trust architecture of the drop flow:

1. A client who receives a drop link has no way to verify they are uploading
   to the right person or organization
2. There is no receipt — no proof the upload happened
3. The owner's name and organization are not displayed on the drop page

A client handling sensitive documents needs to see: "I am uploading to [Name] at
[Organization]." Without this, they have no basis for trust other than the URL.

**The Fix**

Part A — Drop portal identity:
 already returns  and .
Add to the response:
- : first_name + " " + last_name from users table
- : new users field (see Part C)

The drop page renders:
"You're sending files securely to: **[Name]** | [Organization]"

Below the upload zone: "🔒 Files are encrypted in your browser before being sent.
[Organization] cannot be impersonated — this link was created by a verified account."

This is factual, calm, and trust-building without being dramatic.

Part B — Upload receipt:
After successful upload, the drop page shows a receipt block:

Offer "Copy receipt" (copies text to clipboard). No new backend needed —
all data is already available at the point of upload completion.

Part C — Organization name on user profile:

Add to settings page: one text field. Display on drop page + in the owner's profile.

**Files to Touch**
| File | Change |
|------|--------|
|  | Add owner_display_name and owner_organization to handlerDropTokenInfo response |
|  | Render identity block and receipt |
|  | Add organization_name field |
|  | New migration |

**Trust Impact:** ★★★★★
The moment a client opens a drop link is the moment ABRN Drive is being evaluated.
A named, branded experience with a receipt closes the trust loop and eliminates
the "what is this link?" support call.

---

### Step 7 — Operational Security Posture: The Owner's Control Surface

**Category:** Day-to-Day Usefulness, Audit, Trust
**Effort:** Medium (1-2d) — builds on v1 dashboard and existing activity_log schema

**The Problem (complementing v1 Step 7)**

V1 Step 7 designs a personal dashboard with activity stats. This step designs
the security posture component — the view that answers: "Is everything OK with
my vault right now?"

The  table (migration 026) exists but has no UI. The owner cannot:
- See their own activity history
- Identify files with unusually broad access
- Get warned about expiring or high-activity drop links
- Verify their security setup at a glance

**The Fix**

Part A — Security posture panel (new section within v1 dashboard):


Items in the attention list are auto-surfaced:
- Drop links expiring in < 48h
- Public share links created > 30 days ago that have never been accessed
  (possible forgotten link)
- Any drop link with > 10 upload attempts in 1 hour (rate anomaly)
- Files shared with > 5 external users (broad-access flag)

Part B — Activity log endpoint + UI:
New endpoint: 
Reads from  table for the current user. Frontend: render as a calm
chronological feed in the dashboard. This is the same endpoint planned in v1 Step 3
(notification system) — unified backend, reused in dashboard.

Part C — Security posture API:
New endpoint: 
Returns:

This is pure SQL: joins across upload_tokens, public_share_links, activity_log.
No new tables needed beyond what Steps 4 and 5 add.

**UX Principle**
The security posture panel should feel like a calm status board, not a security scanner.
The default state — "Everything looks fine" — should be visually quiet and reassuring.
Attention items appear only when they are genuinely actionable. Do not surface information
that the owner cannot act on.

**Files to Touch**
| File | Change |
|------|--------|
|  (new file) | GET /api/activity endpoint reading from activity_log |
|  (new file) | GET /api/security-posture aggregation endpoint |
|  | Register new routes |
|  | SecurityPosturePanel component (new section) |
|  | New component |

**Trust Impact:** ★★★★★
Closes the operational awareness gap. The owner can verify in 10 seconds that their
vault is healthy. This is the difference between "I hope nothing is wrong" and
"I know everything is fine."

---

## Implementation Priority

| # | Step | Effort | Risk of Not Doing | Prerequisite |
|---|------|--------|-------------------|--------------|
| 1 | Remove Raw Key from DB | Short/Medium | Zero-knowledge claim is false — any auditor finds this | None |
| 2 | Move Key to URL Fragment | Quick | Drop keys in server logs permanently | Confirm Step 1 path works |
| 3 | API Auth Gates + Rate Limiting | Quick/Short | User enumeration + PIN brute-force window | None |
| 4 | Access Visibility Panel | Medium | Owner cannot verify or prove access state | None (link tracking is Part B) |
| 5 | Safer Defaults (expiry, seal) | Quick/Short | Links outlive their intended lifetime | None |
| 6 | Drop Portal Identity + Receipt | Short | Client trust deficit at the key trust moment | v1 Step 2 for full redesign |
| 7 | Security Dashboard | Medium | Operational blindness; no audit trail | v1 Step 7 + Step 4 data |

**Immediate priority: Steps 1, 2, 3. All are low-effort and close real vulnerabilities.**

Steps 4–7 run in parallel with v1 UX upgrades.

---

## DB Migration Map

| Migration | Change | Required By |
|-----------|--------|-------------|
|  | pin_failed_attempts, pin_locked_until on users | Step 3 |
|  | DROP COLUMN raw_encryption_key on upload_tokens | Step 1 (Phase 3) |
|  | access_count, last_accessed_at on public_share_links | Step 4 |
|  | seal_after_upload, last_used_at on upload_tokens | Step 5 |
|  | organization_name on users | Step 6 |

All are non-destructive ADD COLUMN except 031_drop_raw_key_removal which is a
DROP COLUMN — run only after confirming no active code path uses raw_encryption_key.

---

## The Trust Test

For each step: "Does a careful partner or client feel MORE confident using this platform
after this change?"

| Step | The Trust Test |
|------|----------------|
| Step 1 | The server cannot read your files. This is now actually true, not just claimed. ✓ |
| Step 2 | Your drop link key is never seen by any server. It lives only in your browser. ✓ |
| Step 3 | No one can learn our user list, and your PIN cannot be brute-forced. ✓ |
| Step 4 | You can see exactly who has access to any file, and revoke it in one click. ✓ |
| Step 5 | Links expire by default. You don't have to remember to clean them up. ✓ |
| Step 6 | Your client sees your name, your organization, and gets a receipt. ✓ |
| Step 7 | You can verify your vault is secure in under 10 seconds, any time. ✓ |

---

## What This Plan Does NOT Touch

- Encryption primitives — AES-256-GCM, RSA-2048 OAEP, PBKDF2 100k iterations are correct
- JWT authentication flow — PIN + JWT is appropriate for this use case
- Group sharing model — architecturally sound, no changes needed
- File versioning — schema exists (009_file_versions.sql), defer to a future plan
- Email/IMAP handlers — remain disabled per product direction
- Hosting infrastructure — single-server Apache + systemd is appropriate for current scale
- Multi-tenancy — single-owner drive model is correct for this product stage

---

## Appendix: Security Findings Summary

| Finding | Severity | Step | Effort |
|---------|----------|------|--------|
| raw_encryption_key stored in DB (ZK violation) | Critical | Step 1 | Short-Medium |
| Drop wrapped key in server/Apache logs | Serious | Step 2 | Quick |
| Unauthenticated user enumeration endpoints | Serious | Step 3 | Quick |
| CORS wildcard on authenticated endpoints | Serious | Step 3 | Quick |
| No PIN rate limiting (10k values, no lockout) | Serious | Step 3 | Short |
| No access visibility / audit trail UI | Moderate | Step 4 | Medium |
| Share links no default expiry | Moderate | Step 5 | Quick |
| Drop portal shows no owner identity | Moderate | Step 6 | Short |
| No PIN recovery path (data loss risk) | Moderate | Step 3+future | Deferred |
| No operational security dashboard | Low | Step 7 | Medium |

---

*Complementary to upgrade-plan-v1.md. V1 addresses daily UX. This plan addresses architectural trust.*
*Estimated total: 8-12 developer-days. Steps 1-3 can ship in < 1 day combined.*
*Last reviewed: March 14, 2026*

# ABRN Drive - Secure File Platform Upgrade Plan (v3)

> Written: March 14, 2026
> Scope: Product, UX, and architecture upgrade plan for ABRN Drive as an internal secure file exchange platform
> Excludes: email module
> North Star: Make secure file handling feel protective, calm, fast, and obvious for our team, partners, and clients.

---

## What the codebase already gives us

ABRN Drive is not starting from zero. The repo already has strong foundations:

- Real client-side encryption and key wrapping in `vaultdrive_client/src/utils/crypto.ts`
- Internal sharing, group sharing, public share links, and drop links across `handle_file_share.go`, `handle_public_share_links.go`, and `handle_drop.go`
- A workable vault UI in `vaultdrive_client/src/pages/files.tsx`
- Activity and audit schema in `sql/schema/026_activity_log.sql` and `sql/schema/013_audit_logs.sql`
- Dormant but valuable schema for `file_requests`, tags, and secure notes in `sql/schema/011_file_requests.sql`, `sql/schema/007_tags.sql`, `sql/schema/010_secure_notes.sql`

That means the upgrade path should not be "add more features." It should be:

1. fix the trust-breaking architecture gaps,
2. expose control and clarity that already exists in the data model,
3. turn file exchange into a cleaner, calmer day-to-day workflow.

---

## What is currently holding trust back

The repo review and background research surfaced four major problems:

- The security story is stronger than the trust story. The crypto is good, but some live flows still feel raw, technical, and stressful.
- A few real architectural gaps undermine trust claims: wildcard CORS and open user lookup routes in `main.go`, plus drop-link key handling that still leaks via query strings in `vaultdrive_client/src/pages/drop-upload.tsx`.
- The product does not clearly answer the owner's core question: who can access what right now, what happened recently, and what needs my attention?
- External collaboration is fragmented. There is secure drop, public share, and dormant `file_requests`, but not yet one coherent partner/client exchange experience.

---

## The 7-Step Plan

### Step 1 - Fix the trust-breaking security gaps first

**What should be improved**

Close the architectural issues that make the platform feel less safe the moment someone audits it.

**Why it matters**

Trust collapses fast if the platform claims zero-knowledge behavior but still leaks key material or leaves basic attack surfaces open.

**How it helps the user**

The user gets a platform that is actually safe by default, not just styled to look safe.

**How it improves security and usability together**

These fixes remove invisible risk without adding friction to normal work.

**What should likely be built or changed**

- Move drop-link wrapped key transport from query string to URL fragment so it never hits server logs; current query usage is visible in `vaultdrive_client/src/pages/drop-upload.tsx:52` and `vaultdrive_client/src/pages/drop-upload.tsx:258`
- Remove the raw drop-key retrieval path in `main.go:115` and eliminate any dependency on `raw_encryption_key` from the upload token flow
- Replace `Access-Control-Allow-Origin: *` in `main.go:35` with explicit allowed origins
- Protect `GET /api/user-by-username` and `GET /api/user-by-email` in `main.go:92` and `main.go:94` behind auth
- Add PIN attempt throttling and temporary lockouts so the 4-digit PIN behaves like a convenience layer, not an easy brute-force target

---

### Step 2 - Turn secure drop into a trusted client handoff experience

**What should be improved**

Redesign the drop flow so a client immediately knows who they are sending to, what the request is for, what happens to the files, and what proof they get afterward.

**Why it matters**

The drop page is the highest-stakes trust moment in the app. If it feels technical or vague, clients hesitate before uploading sensitive files.

**How it helps the user**

The owner looks organized and credible. The client feels guided instead of dumped into a tool.

**How it improves security and usability together**

Clear identity, scope, and receipts reduce mistakes while making the secure path feel easier than email or ad-hoc file transfer.

**What should likely be built or changed**

- Add sender identity and organization context to the drop info response in `handle_drop.go`, then show it prominently in `vaultdrive_client/src/pages/drop-upload.tsx`
- Rework copy in `vaultdrive_client/src/pages/drop-upload.tsx:577` so it explains outcomes in human language instead of "owner will need the encryption key"
- Show request purpose, allowed file types, size limits, expiry, and destination context above the upload area
- Add a post-upload receipt with timestamp, recipient, file count, and short reference code that can be copied client-side
- Keep the page branded, quiet, and mobile-friendly so it feels like a professional client portal rather than a developer utility

---

### Step 3 - Unify sharing into one clear external collaboration model

**What should be improved**

Bring public share links, secure drop links, and the dormant `file_requests` capability into one coherent external exchange model: send files out, request files in, and track both from one place.

**Why it matters**

Today the building blocks exist, but the product still feels like separate tools. Partners and clients need a single mental model: "send securely," "request securely," and "review access."

**How it helps the user**

The owner can choose the right flow quickly without thinking through implementation details.

**How it improves security and usability together**

The more clearly the app distinguishes download links, upload requests, and collaborative access, the easier it is to apply the right permissions and safer defaults to each one.

**What should likely be built or changed**

- Activate the dormant `file_requests` stack from `sql/schema/011_file_requests.sql` and `sql/queries/file_requests.sql` as the primary one-off client-request workflow
- Reframe external actions in the UI around three verbs: `Share file`, `Request file`, `Create drop portal`
- Consolidate management into one external exchange dashboard instead of splitting context across `UploadLinksSection`, public shares, and manual folder browsing
- Keep public share links for outbound delivery, use file requests for targeted inbound collection, and keep secure drop links for ongoing partner/client intake
- Add plain-language flow selection in the creation UI so users do not have to infer the right mechanism from technical labels

---

### Step 4 - Make access and permissions visible at the file level

**What should be improved**

Give every file a calm, explicit access view that answers who can access it, how they got access, whether the access expires, and how to revoke it.

**Why it matters**

For a trusted file platform, permission clarity is part of the product, not just a backend rule.

**How it helps the user**

The owner stops guessing. They can verify access in seconds before sending sensitive material to a client or partner.

**How it improves security and usability together**

Visibility reduces accidental oversharing and removes the need for defensive friction like needless password rituals.

**What should likely be built or changed**

- Add an `access-summary` API that joins direct shares, group access, public share links, and drop-linked provenance
- Surface that summary in the file UI around `vaultdrive_client/src/pages/files.tsx` and the existing file widgets
- Replace technical or ambiguous labels with human language like `Only you`, `Shared with Maria`, `Available via public link until Mar 21`, `Drop-off file from ACME portal`
- Add one-click revoke for external access and separate it from internal team sharing
- Show access badges inline in file rows so the user gets instant clarity before opening a menu

---

### Step 5 - Ship safer defaults that reduce cleanup work

**What should be improved**

Default external access to expiring, scoped, low-risk behavior instead of permanent, unlimited, owner-has-to-remember behavior.

**Why it matters**

Most secure file mistakes are not dramatic hacks. They are forgotten links, open-ended drop portals, and unclear upload scope.

**How it helps the user**

The owner spends less time policing old links and worrying about what is still live.

**How it improves security and usability together**

The safest path also becomes the easiest path.

**What should likely be built or changed**

- Change the upload-link modal in `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx:28` and `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx:374` so default expiration is 7 days, not never
- Give drop links a `seal after first upload` or `seal after limit reached` option
- Default public share links to expiration unless the owner deliberately chooses a permanent link
- Add status states like `Active`, `Expiring soon`, `Sealed`, and `Needs review` to link management views
- Add file-count, size, and scope defaults that are sensible for client workflows instead of unlimited by default

---

### Step 6 - Make the product feel calmer in everyday use

**What should be improved**

Remove repetitive stress and technical language from the most common flows: login, download, share, drop, and activity review.

**Why it matters**

If secure work feels annoying, users invent shortcuts. Calm products are safer because people keep using them.

**How it helps the user**

The app feels like it was built around how they actually work: open, verify, send, receive, move on.

**How it improves security and usability together**

Lower friction means less temptation to fall back to insecure channels.

**What should likely be built or changed**

- Expand session-based decryption caching through `vaultdrive_client/src/context/SessionVaultContext.tsx` so users do not re-enter credentials on every related action
- Replace raw technical copy in `vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx` and `vaultdrive_client/src/components/share-modal.tsx` with user-facing explanations of what is happening and what risk the user is accepting
- Finish the activity feed by implementing the missing `/api/activity` backend that `vaultdrive_client/src/pages/dashboard.tsx` and the activity components expect
- Improve empty states, success states, and error recovery so they reassure the user and explain the next safe action
- Remove legacy credibility-killing copy in public-facing pages like `vaultdrive_client/src/pages/home.tsx` and `vaultdrive_client/src/pages/about.tsx`, especially references that make the app feel like a student project or source-code demo instead of a production client workspace

---

### Step 7 - Build the owner's control center for secure operations

**What should be improved**

Turn the dashboard from a basic surface into an operational control center for secure file exchange.

**Why it matters**

Trust is not just how the app looks; it is whether the owner can tell, at a glance, that everything is under control.

**How it helps the user**

The owner can open the app and immediately know what arrived, what is shared, what is expiring, and what needs attention.

**How it improves security and usability together**

Operational visibility prevents blind spots without forcing extra confirmation steps into normal flows.

**What should likely be built or changed**

- Build a dashboard summary that combines activity, incoming files, active external links, expiring access, and unusual states
- Use `activity_log` and `audit_logs` to support real event timelines and downloadable evidence, not just decorative widgets
- Activate dormant organizational features like tags from `sql/schema/007_tags.sql` and `sql/schema/008_file_tags.sql` so people can manage real client work at scale
- Add filters such as `recent drop-offs`, `shared externally`, `awaiting review`, and `high-risk access` so the owner can work from context instead of from folders alone
- Keep the tone calm: default state should feel like "everything looks healthy," with attention panels only when there is something actionable

---

## Recommended order of execution

### Phase 1 - Trust repair

1. Step 1 - Fix trust-breaking security gaps
2. Step 5 - Safer defaults
3. Step 4 - Access visibility

### Phase 2 - Client and partner experience

4. Step 2 - Trusted drop handoff
5. Step 3 - Unified external collaboration model

### Phase 3 - Daily product quality

6. Step 6 - Calmer day-to-day use
7. Step 7 - Owner control center

This order matters. The app should first become genuinely safer, then more legible, then more polished.

---

## The outcome we should be aiming for

When this plan is done, ABRN Drive should feel like this:

- Sharing a sensitive file feels deliberate, not risky
- Asking a client for documents feels structured, not improvised
- Dropping files into the system feels trustworthy even for non-technical people
- Permissions are visible and understandable
- The safest option is usually the fastest option
- The owner feels relief because secure file handling has finally become simple

That is the product shift: from an encrypted file app to a secure file-handling relief system for real work.

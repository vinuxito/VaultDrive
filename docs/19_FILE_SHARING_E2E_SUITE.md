# 19. File Sharing E2E Test Suite

**Date:** March 23, 2026
**Scope:** 7-iteration loop adding 18 new Playwright E2E tests across 6 spec files, covering file upload, share links, upload links, groups, and trust UX

---

## Summary

This session added comprehensive Playwright E2E coverage for the entire file sharing subsystem. Tests run against a self-hosted Go server on port 8090. All 32 tests (14 pre-existing + 18 new) pass with zero failures.

---

## New E2E Spec Files

### 1. `e2e/file-upload-flow.spec.ts` (2 tests)

| Test | What it proves |
|------|---------------|
| Upload encrypts file in browser and shows it in vault | File selection, PIN modal, encrypt+upload, file visible in vault |
| Uploaded file metadata confirms AES-256-GCM encryption | Query `/api/files`, parse metadata JSON, assert `algorithm: AES-256-GCM` and `credential_scheme: pin` |

### 2. `e2e/upload-link-lifecycle.spec.ts` (3 tests)

| Test | What it proves |
|------|---------------|
| UI link creation with expiry picker | Owner creates upload link via modal, API call trace receipt shown |
| Anonymous sender delivery | Anonymous user (no account) uploads file via drop link, success receipt shown |
| 24h expiry via API token list | Token `expires_at` is within 22-26h of creation (tolerance for test timing) |

### 3. `e2e/share-link-lifecycle.spec.ts` (3 tests)

| Test | What it proves |
|------|---------------|
| Create share link with AES key in fragment | Share link URL contains `#` fragment with base64-encoded AES key |
| Access count increments | Accessing share link info endpoint increments `access_count` |
| Revoke makes link inaccessible | DELETE on share link returns immediate 404 on next access |

### 4. `e2e/group-crud.spec.ts` (3 tests)

| Test | What it proves |
|------|---------------|
| Create group via UI | Modal with name+description, group appears in list |
| Add/remove members | Two-user registration, add member via API, verify count, remove and verify |
| Delete group | Group removed from list after deletion |

### 5. `e2e/group-sharing.spec.ts` (2 tests)

| Test | What it proves |
|------|---------------|
| Share file to group | File accessible via `/api/groups/{id}/files` endpoint |
| Remove file from group | File no longer accessible after removal |

### 6. `e2e/trust-safety-ux.spec.ts` (5 tests)

| Test | What it proves |
|------|---------------|
| PIN setup during onboarding | Confirmation flow, security messaging, "Enter Protected Vault" button |
| Settings Security tab | "One PIN for everything", "Privacy & Trust", "AES-256-GCM" visible |
| Empty states guidance | Files, Groups, Shared pages all show clear instructional empty states |
| Upload link API call trace | Trust receipt shows `POST /api/drop/create` after link creation |
| Drop upload encryption footer | "End-to-end encrypted" and "encrypted in...browser" on drop page |

---

## Bug Found and Fixed

**`handle_group_members.go:228` — path parameter mismatch**

- Route: `DELETE /api/groups/{id}/files/{fileId}`
- Handler read: `r.PathValue("groupId")` — should be `r.PathValue("id")`
- Effect: DELETE always failed with "Invalid group ID" (empty string parsed as invalid UUID)
- Fix: Changed to `r.PathValue("id")`
- Discovery: Found during iteration 5 when E2E test for group file removal failed

---

## Helper Additions

`e2e/helpers/trust.ts` gained:
- `uploadFileAsOwner(page, account, file)` — handles file input, PIN modal, upload wait
- `getAuthToken(page)` — exported (was private)
- `resolveApiUrl(path)` — exported (was private)
- Removed duplicate private copies and unused `resolveAppUrl`

---

## Design Note: Group-Shared Files

Group-shared files are stored in `group_file_shares` table, separate from `file_access_keys`. The "Shared with Me" page (`/api/files/shared`) only queries `file_access_keys`, so group-shared files do not appear there. They are accessible through `/api/groups/{id}/files` instead. This is a design choice, not a bug, but could confuse users who expect one unified view.

---

## Verification Snapshot

| Check | Result |
|-------|--------|
| `go build ./...` | CLEAN |
| `go vet ./...` | CLEAN |
| `go test ./...` | PASS |
| `tsc --noEmit` | CLEAN |
| `npx vitest run` | 21/21 |
| `npx vite build` | SUCCESS |
| `npx playwright test` | **32/32** |

---

## Commit History

```
c9fc473  test: file upload flow E2E — browser encryption + AES-256-GCM metadata
0063d96  test: upload link lifecycle E2E — creation, anonymous delivery, expiry
33ac684  test: share link lifecycle E2E — fragment key, access count, revoke
845a571  test: group CRUD E2E — create, members, delete
ca540ac  test: group file sharing E2E + fix removeFileFromGroup path param bug
c4119d1  test: trust and safety UX E2E — PIN onboarding, security tab, empty states
36210fd  test: full E2E suite verification — 32/32 green
465a89b  docs: session memory and README update for file sharing E2E suite
```

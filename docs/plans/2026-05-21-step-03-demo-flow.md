# Step 3 — Demo Flow: The Golden Path

**Parent:** [Hackathon Index](./2026-05-21-hackathon-index.md)  
**Priority:** 🔴 Critical  
**Effort:** M (1 day)

---

## Why This Matters

A hackathon demo is 60 seconds. Maybe 90. Every second of friction — a confusing label, a missing confirmation, an unclear next step — costs you the win.

The "golden path" is the one flow you rehearse and execute flawlessly. It's the story the app tells about itself. Right now, every feature works, but there's no **choreographed sequence** that shows the product's full power in under a minute.

---

## The Golden Path (Target: 60 seconds)

```
[5s]   Landing page → "Get Started" → Login/Register
[10s]  Register with email + password → Onboarding PIN setup
[10s]  Dashboard appears → "Your vault is secure"
[10s]  Upload a file → See it encrypted in the vault
[10s]  Create a share link → Copy it
[10s]  Open share link in new tab → See the shared file (zero-knowledge verified)
[5s]   Back to dashboard → Activity feed shows the share event
```

**Total: 60 seconds.** Every step visible, every transition smooth, every feature undeniable.

---

## Current State (Verified)

The flow above is **already implemented and working**. The E2E Playwright suite covers all of these steps (41/41 passing). What's missing is **demo polish** — the small UX touches that make the flow feel rehearsed and effortless.

### Current friction points:
1. **Register form** — functional but doesn't guide the user. No inline password policy hint.
2. **Onboarding PIN setup** — works, but the transition from register to onboarding could be smoother.
3. **File upload** — the encryption happens fast, but there's no visual "encrypting..." moment for the audience.
4. **Share link creation** — the modal works, but the "copy to clipboard" feedback is subtle.
5. **Share link access** — works perfectly, but the public page could better communicate "this file was encrypted client-side."

---

## Success Condition

After this step:
1. The register → onboarding → dashboard flow takes **under 15 seconds** with no confusion.
2. File upload shows a brief, visible **"Encrypting..."** state before upload completes.
3. Share link copy shows a **bold toast or animation** confirming the copy succeeded.
4. The public share page displays a **trust footer** showing "Decrypted in your browser. Server never saw this file."
5. The dashboard activity feed updates **immediately** after the share (no reload needed).
6. Every button on the golden path has a clear, action-oriented label.

---

## Implementation Plan

### 3.1 — Register Form Polish

**File:** `vaultdrive_client/src/pages/login.tsx`

- Add inline password policy hint below the password field: *"8–64 characters"*
- Ensure the "Register" button has a loading state (spinner) during the API call.
- After successful registration, auto-navigate to onboarding without a manual redirect step.

### 3.2 — Encryption Visibility During Upload

**File:** `vaultdrive_client/src/pages/files.tsx` (upload flow)

The browser-side AES-256-GCM encryption is the product's superpower, but it happens so fast that the user doesn't notice it. For the demo, add a brief visual state:

```
[Encrypting...] → [Uploading...] → [Done ✓]
```

This can be as simple as a progress label that transitions through states. The encryption itself takes <50ms for small files, so we may want a minimum display time (200ms) for the "Encrypting..." label to be visible.

**Important:** Do NOT artificially slow down the upload. Just make the encryption step visible in the UI for the brief moment it runs.

### 3.3 — Share Link Copy Feedback

**File:** `vaultdrive_client/src/components/share-modal.tsx`

When the user copies a share link:
- The "Copy" button should transition to a **"Copied ✓"** state with a green check.
- Hold the state for 2 seconds before reverting.
- Add a subtle pulse animation on success.

### 3.4 — Public Share Page Trust Footer

**Files:** `vaultdrive_client/src/pages/PublicSharePage.tsx`, `PublicFolderSharePage.tsx`

Add a small footer or badge on the public share page:

```
🔒 This file was encrypted in the sender's browser.
   Decrypted here, in yours. The server never saw it.
```

This is the "mic drop" moment in the demo — the judge realizes the zero-knowledge claim is real.

### 3.5 — Activity Feed Real-Time Refresh

**File:** `vaultdrive_client/src/pages/dashboard.tsx`

After returning from the share flow, the activity feed should show the share event immediately. Options:
- **Optimistic update:** Inject the event into the local state before the API confirms.
- **SSE refresh:** Use the existing SSE ticket system to push activity updates.
- **Simple polling:** Re-fetch activity on window focus.

The simplest approach is a `visibilitychange` listener that re-fetches activity when the tab regains focus.

### 3.6 — Golden Path Rehearsal Script

Create a markdown file documenting the exact demo script:
- What to click
- What to say at each step
- What the audience should see
- Timing for each step

**File:** `docs/plans/2026-05-21-demo-script.md`

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| Register → Dashboard | Under 15 seconds, no confusion | Time the flow manually |
| Encryption visibility | "Encrypting..." label visible during upload | Upload a file, observe |
| Copy feedback | "Copied ✓" with green check, 2s hold | Click copy on share link |
| Trust footer | Visible on public share page | Open a share link |
| Activity refresh | Share event appears without reload | Complete share, return to dashboard |
| Full golden path | Under 60 seconds, zero friction | Execute the demo script |

---

## Risk

**Low.** All changes are UI polish on existing, working flows. No new features. No data model changes. The golden path is already E2E tested.

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |

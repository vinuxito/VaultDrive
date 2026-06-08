# Step 3 — Demo Golden Path: The 60-Second Story

**Parent:** [Hackathon Index](./2026-05-22-hackathon-index.md)  
**Priority:** 🔴 Critical  
**Effort:** M (1 day)  
**Status:** 🔲 TODO

---

## Why This Matters

A hackathon demo is 60 seconds. Maybe 90. Every second of friction — a confusing label, a missing confirmation, an unclear next step — costs you the win.

The "golden path" is the one flow you rehearse and execute flawlessly. It's the story the app tells about itself. Right now, every feature works (41/41 E2E), but there's no **choreographed sequence** that shows the product's full power in under a minute. We need to remove every micro-hesitation on the critical path.

---

## The Golden Path (Target: 60 seconds)

```
[0-5s]   Landing page loads → judge sees animated hero → clicks "Get Started"
[5-15s]  Register: name + email + password → "Create Account" → auto-login
[15-20s] Onboarding: "Set your PIN" → 4 digits → confirmed → dashboard lands
[20-30s] Dashboard → "Upload file" → file picker → watch "Encrypting..." state
[30-40s] File appears in vault → right-click → "Share" → modal opens
[40-50s] Copy share link → open in new browser tab → see file, see trust footer
[50-55s] Back to dashboard → activity feed shows the share event
[55-60s] Switch theme to Cyberpunk → everything looks premium → mic drop
```

**Total: 60 seconds.** Every step visible, every transition smooth, every feature undeniable.

---

## Current State (Verified)

The flow above is **already functional and E2E tested**. The 41/41 Playwright suite covers register, upload, share, and verification flows. What's missing is the **demo polish** — the small UX touches that make the difference between "it works" and "it's rehearsed."

### Current friction points:

1. **Register form** — No inline password policy hint below the field.
2. **Onboarding PIN** — The transition from register to PIN setup could be smoother. Is there a brief flash?
3. **File upload** — Encryption happens in <50ms. No visual "Encrypting..." moment for the audience to see. The product's superpower is invisible.
4. **Share link copy** — Feedback is subtle. The "Copy" button needs to scream "Copied ✓" with animation.
5. **Public share page** — Works, but doesn't communicate the zero-knowledge claim visually. No trust footer.
6. **Dashboard activity** — After sharing, does the activity feed update without refresh?

---

## Implementation Plan

### 3.1 — Register Form Polish

**File:** `vaultdrive_client/src/pages/login.tsx`

**Changes:**
- Add inline password policy hint below the password field: *"Must be 8–64 characters."*
- Ensure the "Create Account" button has a loading state (spinner + "Creating account...") during the API call.
- After successful registration, auto-navigate to onboarding without a manual redirect step.
- Verify the "Sign up" → "Login" tab switch is instant and obvious.

**Acceptance:**
- A user can go from "Get Started" on landing to "Create Account" click in under 8 seconds.
- The password policy is visible BEFORE they type, not after a validation error.
- The button loading state eliminates the "did it work?" moment.

### 3.2 — Encryption Visibility During Upload

**File:** `vaultdrive_client/src/pages/files.tsx` (upload flow)

The browser-side AES-256-GCM encryption is the product's superpower, but it happens so fast the user doesn't notice it. For the demo, add a brief visual state machine:

```
[Encrypting...] → [Uploading...] → [Done ✓]
```

**Implementation approach:**
1. Before the `fetch()` call, show an "Encrypting..." label with a lock icon.
2. The actual encryption is <50ms for small files. Add a minimum display time of 300ms for the label so the audience can register it.
3. After encryption completes, transition to "Uploading..." with a progress indicator.
4. On success, flash "Done ✓" with a green check for 1.5 seconds.

**CRITICAL:** Do NOT artificially slow down the upload. The 300ms minimum is only for the *label* — the encryption proceeds immediately. We're making the speed *visible*, not fake.

**Why this is the demo moment:** When the audience sees "Encrypting..." → "Uploading...", they understand the separation. The file was encrypted *before* it was sent. That's the zero-knowledge proof in action, visible to a non-technical judge.

### 3.3 — Share Link Copy Feedback

**File:** `vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx` (or equivalent)

When the user copies a share link:
1. The "Copy" button transitions to **"Copied ✓"** with a green check icon.
2. The button background briefly flashes green (200ms).
3. Hold the "Copied ✓" state for 2 seconds before reverting.
4. Add a subtle scale pulse on success (`scale(1.03)` → `scale(1.0)` over 200ms).

**Why it matters:** The copy action is the transition from "I uploaded a file" to "I shared a file." It needs to feel like a *moment*, not an afterthought.

### 3.4 — Public Share Page Trust Footer

**Files:** `vaultdrive_client/src/pages/PublicSharePage.tsx`, `PublicFolderSharePage.tsx`

Add a small footer/banner at the bottom of the public share page:

```
🔒 This file was encrypted in the sender's browser.
   Decrypted here, in yours. The server never saw it.
```

Style it as a `brand-glass-card` with a lock icon. Use the same monospace treatment as the landing page encryption signal.

**This is the mic drop moment:** The judge opens the share link in a new tab, downloads the file, and reads the footer. They realize the zero-knowledge claim isn't marketing — it's architecture. The server genuinely cannot read the file.

### 3.5 — Activity Feed Refresh on Focus

**File:** `vaultdrive_client/src/pages/dashboard.tsx`

After the judge shares a file and switches back to the dashboard tab, the activity feed must show the share event **immediately** — no manual refresh.

**Simplest implementation:** Add a `visibilitychange` event listener that re-fetches activity data when the tab regains focus:

```tsx
useEffect(() => {
  const handleFocus = () => {
    if (document.visibilityState === "visible") {
      refetchActivity();
    }
  };
  document.addEventListener("visibilitychange", handleFocus);
  return () => document.removeEventListener("visibilitychange", handleFocus);
}, []);
```

Alternatively, use the existing SSE ticket system to push real-time updates. The `visibilitychange` approach is safer and requires no backend changes.

### 3.6 — Demo Rehearsal Checklist

Create a simple markdown file the operator can read before the demo:

**File:** `docs/plans/2026-05-22-demo-checklist.md`

```
PRE-DEMO:
□ Clear browser cookies/storage
□ Set theme to Elegant (professional default)
□ Set language to English
□ Have a test file ready (small PDF or image, <1MB)
□ Have two browser tabs ready (one for owner, one for share recipient)

DEMO SCRIPT:
1. [5s] Show landing page. Point out animated hero + trust signal.
2. [10s] Click "Get Started" → register → create account.
3. [5s] Set PIN → arrive at dashboard.
4. [10s] Click upload → select file → watch "Encrypting..." → "Done ✓".
5. [10s] Right-click file → Share → copy link → "Copied ✓".
6. [10s] Open link in tab 2 → download → point out trust footer.
7. [5s] Switch back to dashboard → activity shows the share.
8. [5s] Open theme picker → switch to Cyberpunk → everything transforms.

POST-DEMO:
□ "Questions?" → Mic drop.
```

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| Register → Dashboard | Under 15 seconds, no confusion | Time the flow manually |
| Password hint | Visible before typing | Visual check on register form |
| Encryption visibility | "Encrypting..." label visible for ≥300ms | Upload a file, observe |
| Copy feedback | "Copied ✓" with green check, 2s hold | Click copy on share link |
| Trust footer | Visible on public share page | Open a share link in new tab |
| Activity refresh | Share event appears without reload | Complete share, switch to dashboard tab |
| Full golden path | Under 60 seconds, zero friction | Execute the demo checklist |
| Tests remain green | 41/41 E2E, 116/116 vitest | Run test suites |

---

## Risk

**Low.** All changes are UI polish on existing, working flows. No new features. No data model changes. The golden path is already E2E tested. The only risk is over-polishing and introducing a visual regression — mitigate with E2E run after each sub-step.

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |

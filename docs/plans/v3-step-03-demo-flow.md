# Step 3 — Demo Golden Path: The 60-Second Story

**Parent:** [v3 Hackathon Index](./v3-hackathon-index.md)  
**Status:** ✅ DONE  
**Commit:** `6336521`  
**Deployed:** 2026-05-22

---

## Why This Matters

A hackathon demo is 60 seconds. Maybe 90. Every second of friction — a confusing label, a missing confirmation, an unclear next step — costs you the win.

The "golden path" is the one flow you rehearse and execute flawlessly. It's the story the app tells about itself.

## The 5-Beat Demo Script

### Beat 1: The Hook (0–10s)
**Say**: *"QuantiX Drive is a zero-knowledge encrypted file vault. The server never sees your data — and we can prove it."*

**Do**: Open landing page → Show the animated hero with the cycling encryption badge. Click **"Get Started"**.

### Beat 2: The Vault (10–25s)
**Say**: *"Everything is encrypted in the browser before upload. Watch the proof."*

**Do**: Login → Complete onboarding (PIN) → Drag a file into the vault → Point at AES-256-GCM metadata.

### Beat 3: The Share (25–40s)
**Say**: *"Sharing is cryptographic. The decryption key lives in the URL fragment — it never touches our server."*

**Do**: Create Share Link → Copy → Open in incognito → File decrypts in recipient browser. Back in dashboard → access count increments via SSE.

### Beat 4: The Proof (40–55s)
**Say**: *"Every action is auditable. Agent API keys let you automate with scoped access."*

**Do**: Settings → Advanced → Create agent key with `files:list` scope → Show audit log event → Run Filemon Operator.

### Beat 5: The Close (55–60s)
**Say**: *"Six premium themes. Bilingual. Mobile-ready. 41 E2E tests. Zero-knowledge — and we'll prove it."*

**Do**: Toggle theme picker (QuantiX → Cyberpunk → Business) → Switch language to Spanish → Smile.

## Pre-Demo Checklist

- [ ] Demo account pre-registered (PIN set, 2-3 files uploaded)
- [ ] Browser: Chrome, incognito window ready for share link test
- [ ] Theme: Start on QuantiX (dark neon)
- [ ] Language: Start on English
- [ ] Network: Stable connection, backend running
- [ ] Screen: 1920×1080, browser zoom 100%

## What We Built to Support This

1. **Help Center (`/help`)** — Judge can explore on their own after the demo.
2. **Sidebar navigation** — Clean, fast access to every surface.
3. **Command palette (⌘K)** — Power users can search anything.

## Verification

| Check | Result |
|-------|--------|
| Full demo path completable in 60s | ✅ Timed rehearsal |
| Demo script written and committed | ✅ `docs/plans/2026-05-22-step-10-demo-script.md` |
| E2E suite still green | ✅ 41/41 |

## Evidence

- Commit: `6336521` — demo script and supporting changes
- Full script: [2026-05-22-step-10-demo-script.md](./2026-05-22-step-10-demo-script.md)

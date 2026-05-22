# Step 10 — Demo Script & Video: The 90-Second Story

**Parent:** [Hackathon Index](./2026-05-22-hackathon-index.md)  
**Priority:** 🔴 Critical  
**Effort:** S (half day)  
**Status:** 🔲 TODO

---

## Why This Is New (Not in v1)

The v1 plan assumed the hackathon demo would be improvised. That's a losing strategy. The best hackathon demos are **rehearsed performances** — every click is intentional, every pause is dramatic, every transition is timed.

This step creates two artifacts:
1. **A written demo script** — word for word, click for click
2. **A 90-second narrated screen recording** — for async judging, social media, and portfolio

---

## The Script (90 seconds)

### Pre-Demo Setup (Done Before Going on Stage)

```
□ Browser: Chrome, clean profile (no extensions, no bookmarks bar)
□ Window: Full screen, dark mode
□ Theme: Elegant (default, professional)
□ Language: English
□ Tabs: Only one tab open at quantixdrive.filemonprime.net/quantix/
□ Test file: "contract-final.pdf" (126 KB) on desktop
□ Second browser profile ready (for share link verification)
```

### Act 1 — The Hook (0–10s)

**[Show landing page]**

> *"This is QuantiX Drive. A zero-knowledge encrypted vault where the server can never read your data. I'm going to prove that in the next 60 seconds."*

**[Point to cycling encryption trust signal]**

> *"See that badge? AES-256-GCM, RSA-2048, zero-knowledge architecture — those aren't marketing claims. They're implementation details. Watch."*

**[Click "Get Started"]**

### Act 2 — The Setup (10–25s)

**[Register form appears]**

> *"I'll create an account right now."*

**[Fill: Name "Demo User", email "demo@quantix.dev", password "SecureDem0!"]**  
**[Click "Create Account"]**

> *"Notice: the encryption happened in my browser. The server stored a ciphertext envelope, not my password."*

**[PIN setup: enter 1234, confirm 1234]**

> *"One PIN for everything. My private key is encrypted with this PIN, stored on the server, but only I can unlock it."*

**[Dashboard lands]**

### Act 3 — The Power Demo (25–50s)

**[Click upload button, select contract-final.pdf]**

> *"Watch the encryption step."*

**[Encryption proof overlay appears: "Encrypting..." → "AES-256-GCM" → "Encrypted in 23ms"]**

> *"23 milliseconds. The file was encrypted right here in Chrome before a single byte left this machine. The server received only ciphertext."*

**[File appears in vault]**

> *"Now I'll share it."*

**[Right-click → Share → Create share link]**
**[Copy link → "Copied ✓" animation]**

> *"That link has the decryption key in the URL fragment — the part after the hash. It never hits the server."*

**[Open share link in second browser tab/profile — NO login required]**

> *"A different user opens this link. The file downloads and decrypts in their browser."*

**[Point to trust footer: "Decrypted here, in your browser. The server never saw it."]**

> *"That's the proof. The server can't read this file. Not because we promise — because the architecture makes it impossible."*

### Act 4 — The "They Thought of Everything" (50–75s)

**[Switch back to dashboard tab]**

> *"The activity feed already shows the share event."*

**[Open theme picker → switch to Cyberpunk]**

> *"Six full themes, all CSS-variable-driven. No page reload."*

**[Switch language to Spanish]**

> *"Fully bilingual. English and Spanish. Every label, every error, every tooltip."*

**[Pull up phone (if available) or resize browser to 375px]**

> *"Works on mobile too. PWA-installable."*

### Act 5 — The Close (75–90s)

> *"QuantiX Drive isn't a demo. It's running in production right now. Go backend, React frontend, PostgreSQL, 41 end-to-end tests, 116 unit tests. All green."*

> *"The server cannot read your data. And we proved it."*

**[Show the Playwright test results: 41/41 ✅]**

> *"Questions?"*

---

## Video Recording Plan

### Tool
Use the browser subagent to record a clean 90-second walkthrough using the script above. The recording captures:
- The full landing page hero animation
- The register → onboarding → dashboard flow
- The file upload with encryption proof
- The share link creation and verification
- The theme switch and language switch

### Settings
- **Resolution:** 1920×1080
- **Frame rate:** 30fps
- **Format:** WebP (auto-saved by browser recording)
- **Audio:** Narration can be added post-recording via voiceover

### Output
Save to: `docs/demo/2026-05-22-quantix-demo-90s.webp`

### Thumbnail
Generate a still frame from the demo showing the dashboard with the Cyberpunk theme. Use this as the README hero image.

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| Script covers golden path | All 5 acts in under 90s | Read the script |
| Pre-demo checklist works | Clean state achieved | Follow checklist |
| Video recording clean | No stutters, no errors | Watch recording |
| Video is ≤90 seconds | Concise | Check duration |
| Script references real features | No vaporware claims | Cross-reference with E2E tests |

---

## Risk

**None.** Pure documentation and recording. Zero code changes. Zero test risk. The only risk is the recording quality — mitigate by doing 2–3 takes and keeping the best.

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |

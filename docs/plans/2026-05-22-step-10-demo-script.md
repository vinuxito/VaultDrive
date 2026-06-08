# 60-Second Demo Script — QuantiX Drive

> **Goal**: In 60 seconds, prove that QuantiX Drive is a production-grade, zero-knowledge file vault that encrypts everything in the browser, shares securely, and is fully auditable. The judge should feel *trust* — not just see features.

---

## The Golden Path (60 seconds)

### Beat 1: The Hook (0–10s)
**What you say**: *"QuantiX Drive is a zero-knowledge encrypted file vault. The server never sees your data — and we can prove it."*

**What you do**:
1. Open the landing page → Show the animated hero with the cycling encryption badge (`AES-256-GCM · client-side encryption`).
2. Click **"Get Started"** → Navigate to login.

---

### Beat 2: The Vault (10–25s)
**What you say**: *"Everything is encrypted in the browser before upload. Watch the proof."*

**What you do**:
1. Login with your demo account (pre-registered).
2. Complete onboarding (PIN setup — this happens only once).
3. Drag a file into the vault → **Watch the EncryptionProof overlay** — it shows AES-256-GCM in real-time with the actual IV, key derivation, and ciphertext size.
4. Point at the file metadata → `algorithm: AES-256-GCM`, `encrypted: true`.

---

### Beat 3: The Share (25–40s)
**What you say**: *"Sharing is cryptographic. The decryption key lives in the URL fragment — it never touches our server."*

**What you do**:
1. Click the file → **Create Share Link**.
2. Copy the link → Point out the `#key=...` fragment in the URL.
3. Open it in a new incognito tab → The file decrypts in the recipient's browser.
4. Back in the dashboard → Show the **Access Count** incrementing (real-time SSE).

---

### Beat 4: The Proof (40–55s)
**What you say**: *"Every action is auditable. Agent API keys let you automate with scoped access."*

**What you do**:
1. Go to **Settings → Advanced**.
2. Show the **Agent API Keys** section → Create a key with `files:list` scope.
3. Show the **Audit Log** → Point at the `agent_api_key.created` event.
4. Run the **Filemon Operator** → Show the live API call and response.

---

### Beat 5: The Close (55–60s)
**What you say**: *"Six premium themes. Bilingual. Mobile-ready. 41 E2E tests. Zero-knowledge — and we'll prove it."*

**What you do**:
1. Toggle the theme picker → Cycle through QuantiX → Cyberpunk → Business.
2. Switch language to Spanish → Show the UI fully localized.
3. Smile.

---

## Pre-Demo Checklist

- [ ] Demo account pre-registered (PIN set, 2-3 files uploaded)
- [ ] Browser: Chrome, incognito window ready for share link test
- [ ] Theme: Start on QuantiX (dark neon)
- [ ] Language: Start on English
- [ ] Network: Stable connection, backend running
- [ ] Screen: 1920×1080, browser zoom 100%

# Step 4 — Time-locked Puzzles & Auto-shredding Envelopes

## 1. Technical Concept
Provide absolute time-based and count-based access limits to file decryption keys. Introduces "Single-Use Auto-Shredding" (key is destroyed immediately on first download) and "Time-Locked Release" (key cannot be retrieved until a specified Unix timestamp).

```
Auto-Shred:  [User Downloads File] ──▶ [Server Deletes Key Envelope] ──▶ Ciphertext is permanently un-decryptable
Time-Locked: [Request Key Envelope] ──▶ [Server Checks Timestamp] ──▶ Reject if current time < unlock time
```

---

## 2. Cryptographic Architecture
1. **Auto-shredding (Forward Secrecy):**
   - The file is encrypted using an ephemeral AES key.
   - The ephemeral key is wrapped with the recipient's public key or a share password and stored on the server.
   - Upon successful download, the Go backend runs a transactional delete on the database record holding the wrapped key envelope before completing the stream response.
2. **Time-Locked Puzzle release:**
   - The wrapped key envelope is stored with an `unlock_at` timestamp.
   - The Go backend blocks any requests to fetch the envelope until `current_time >= unlock_at`.
   - Optionally incorporates client-side Verifiable Delay Functions (VDF) requiring the browser to solve a sequential hash chain representing $N$ computation steps to enforce client-side delay.

---

## 3. Implementation Plan

### Go Backend (Envelope Control)
- **Database Schema Updates:**
  - Add `unlock_at TIMESTAMP` and `max_downloads INT DEFAULT 0` and `download_count INT DEFAULT 0` to `share_links` and `file_shares`.
- **Logic Handling:**
  - Update download handlers (`handle_file_download.go`) to increment `download_count` and immediately purge/shred the associated key envelope if `max_downloads` limit is hit.

### React Frontend (Intake Config)
- **Share Link Modal:**
  - Add options: "Destruct key after 1 download (Auto-Shred)" and "Time-lock file until [date-picker]".
- **Public Share Page:**
  - Show a locked padlock with a countdown timer if the file is time-locked.
  - Show a warning badge "Caution: This file will auto-shred after your download completes."

---

## 4. Downstream Branding Adaptation
- **QuantiX:** Cyberpunk-style glitch animations and neon orange countdown timers. Glitched "DELETED/SHREDDED" banner when keys are destroyed.
- **ABRN:** Sophisticated classical clock face vector countdowns with quiet, clean alert boxes.

---

## 5. Verification & Test Plan
- **Auto-Shred E2E Playwright Test:**
  1. Upload file and share with Auto-Shred enabled.
  2. Access the public share link in Context A and download the file. Verify decryption succeeds.
  3. Attempt to download the file again in Context B (or refresh Context A). Verify it fails with a "Key permanently shredded" message.
- **Time-Lock API Test:**
  1. Create a share link time-locked for +5 seconds.
  2. Attempt to fetch the key envelope immediately. Assert that the server rejects with HTTP 403.
  3. Wait 5 seconds, attempt to fetch again. Assert success.

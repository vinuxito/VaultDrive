# Step 4: The Cryptographic HUD & Real-Time Security Passport (`⌘I`)

## Overview
Standard consumer cloud services ask users for blind trust. ABRN Drive differentiates itself through mathematical certainty. This step creates a luxury "Cryptographic Passport" drawer and a live external access beacon, giving executives immediate visual proof of file provenance, encryption seals, and active sharing routes.

---

## Detailed Objectives

### 1. Slide-out Cryptographic Passport (`⌘I` / `P`)
* Add a dedicated, beautifully formatted slide-out drawer accessible via hotkey `⌘I` (or `P` for Passport) or a sleek shield badge on any file:
  - **Cryptographic Seal**: Full SHA-256 golden hash of the ciphertext and decrypted payload with one-click copy and verification stamp.
  - **Cipher Engine**: Cipher algorithm (`AES-256-GCM`), Key Envelope Version (`v1`/`v2`), PBKDF2 salt iteration depth (`100,000 rounds`), and authentication tag validity.
  - **Chain of Custody**: Source origin (Direct Owner Upload vs Secure Drop Intake vs Folder Collab), upload timestamp down to the millisecond, and intake token ID.
  - **Signature Badge**: Local RSA-PSS digital signature status (`VERIFIED MATHEMATICAL PROOF` / `UNSIGNED`).

### 2. Live External Route HUD & Beacons
* Replace static text with an ambient heads-up display showing active exposure:
  - Glowing pulse beacons indicating external read paths:
    - `● 2 Active External Routes` (glowing emerald when healthy).
    - Transitions to amber pulse when any link approaches expiration within 24 hours.
    - Transitions to red if access has been revoked or expired.
  - Interactive tooltip listing the exact routes (e.g., Secure Drop #52271e, Public Link #a9f0).

### 3. One-Tap Emergency Sever / Revoke Killswitch
* Positioned prominently within the Cryptographic Passport drawer:
  - A distinct, high-assurance button: **"Sever All External Access"**.
  - Clicking prompts an immediate, atomic backend transaction that revokes all public share links and folder shares associated with the file.
  - Instant UI feedback: The glowing route beacon switches from emerald to obsidian/gray with a lock icon, and the audit timeline stamps the revocation hash in real time without refreshing the page.

---

## Verification Plan
1. **Drawer Responsiveness**: Press `⌘I` on any selected file; verify drawer slides smoothly in <100ms.
2. **Hash Match Verification**: Verify the displayed SHA-256 matches `sha256sum` of the actual file on disk.
3. **Sever Killswitch Proof**: Trigger "Sever All External Access", verify active route counter drops to 0, verify public link immediately returns 404/410.

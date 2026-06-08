# Step 3 — Multi-Custodian Shamir Recovery (Decentralized Master Key Recovery)

## 1. Technical Concept
Provide a zero-knowledge method to recover lost accounts/credentials without keeping copy keys on the server. The user's master key is split into $N$ mathematical shares using Shamir's Secret Sharing (SSSS). Each share is encrypted using the public key of a trusted custodian. Rebuilding the key requires gathering a threshold $T$ of custodian approvals.

```
[Owner Master Key] ──▶ [Shamir's Split] ──▶ Share 1 (Encrypted with Custodian A RSA)
                                        ──▶ Share 2 (Encrypted with Custodian B RSA)
                                        ──▶ Share 3 (Encrypted with Custodian C RSA)
                                        
   [Threshold T=2 Custodians Approve] ──▶ Rebuilds Master Key inside Browser
```

---

## 2. Cryptographic Architecture
1. **Key Splitting:**
   - SSSS is executed entirely in-browser. The owner splits their private master key into $N$ shares (e.g. $N=5$) with a recovery threshold of $T$ (e.g. $T=3$).
2. **Share Wrapping:**
   - For each custodian, the browser fetches the custodian's public RSA key and encrypts the share: `Ciphertext = RSA-OAEP(Custodian_Public_Key, Share_Bytes)`.
   - The encrypted shares are sent to the server. The server stores only the encrypted payloads; it cannot decrypt them.
3. **Recovery Flow:**
   - Owner initiates recovery. Server notifies custodians.
   - Custodians log in, verify identity, decrypt their assigned shares locally using their own private keys, and return the decrypted share parts.
   - When $T$ shares are collected, the owner's recovery page runs SSSS reconstruction in the browser to rebuild the master key.

---

## 3. Implementation Plan

### Go Backend (Custodian Handshake)
- **Database Schema Updates:**
  - Create table `account_recovery_shares` (`id`, `user_id`, `custodian_id`, `wrapped_share_payload`, `status`).
- **Endpoints:**
  - `POST /api/v1/recovery/shares` — Stores wrapped shares.
  - `POST /api/v1/recovery/request` — Starts recovery flow and notifies custodians.
  - `POST /api/v1/recovery/approve` — Custodian submits decrypted share part.

### React Frontend (Recovery wizard)
- **Settings Panel:**
  - "Key Custodians" configuration interface. Users can search for trusted group members or external email partners, select threshold configuration, and split keys.
- **Recovery Page (`/recover`):**
  - Prompt user to request custodians, showing live visual checkmarks as custodians approve.
  - SSSS reconstruction loader with premium animations.

---

## 4. Downstream Branding Adaptation
- **QuantiX:** Hexagonal structural node diagram showing links between owner and custodians, colored cyan/magenta.
- **ABRN:** Sleek progress timelines with minimal golden typography and clean layout boxes.

---

## 5. Verification & Test Plan
- **SSSS Math Integrity Test:** A Vitest unit test asserting that random keys split into 5 parts can be successfully reconstructed with 3 parts, but fail to reconstruct with 2 parts.
- **Full Recovery Playwright E2E:**
  1. Register 3 users (Owner, Custodian A, Custodian B).
  2. Owner configures custodian recovery with threshold 2/2.
  3. Owner simulates password loss (logouts and clicks recover).
  4. Custodians log in and approve recovery requests in their settings.
  5. Owner retrieves shares, reconstructs key, sets new password/PIN, and successfully logs back in to decrypt vault.

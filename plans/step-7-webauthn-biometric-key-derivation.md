# Step 7 — WebAuthn Biometric Key Derivation (Passwordless ZK Entry)

## 1. Technical Concept
Eliminate human passwords, PINs, and Argon2 CPU-wait times. Derives a deterministic cryptographic key directly from physical biometrics (TouchID/FaceID) or hardware security keys using the WebAuthn PRF (Pseudo-Random Function) extension. The hardware enclave handles key derivation locally; the server never receives biometric data or the derived key.

```
[TouchID / FaceID Scan] ──▶ [Browser WebAuthn PRF Extension] ──▶ [Deterministic 256-bit Key]
                                                                        │
    [Decrypts Local Private Key Envelope] ◀──────────────────────────────┘
```

---

## 2. Cryptographic Architecture
1. **WebAuthn PRF Extension:**
   - WebAuthn is traditionally used for authentication, not key derivation. However, the PRF extension allows the browser to request a deterministic symmetric key output derived from the credential's internal secret during signature generation.
2. **Key Envelope Unwrapping:**
   - On registration, the client derives the PRF key from the biometric gesture, encrypts the user's RSA private key with it, and uploads the ciphertext envelope to the server.
   - On login, the client requests a WebAuthn assertion with the PRF challenge. The enclave generates the signature and outputs the deterministic PRF key bytes. The client uses this key to decrypt the private key envelope in-memory.

---

## 3. Implementation Plan

### Go Backend (Biometric Registrations)
- **Database Schema Updates:**
  - Create table `user_webauthn_credentials` (`id`, `user_id`, `credential_id`, `public_key`, `sign_count`).
- **Endpoints:**
  - `POST /api/v1/auth/webauthn/register-options` (Prepares WebAuthn creation options).
  - `POST /api/v1/auth/webauthn/register` (Saves credential public key).
  - `POST /api/v1/auth/webauthn/login` (Verifies signature and authenticates session).

### React Frontend (Biometric Handshake)
- **Credentials Manager (`src/utils/webauthn-prf.ts`):**
  - Implements browser capability detection for the `prf` WebAuthn extension.
  - Queries `navigator.credentials.create` and `navigator.credentials.get` with PRF inputs.
- **Settings Toggle (`Appearance & Security`):**
  - "Enable Biometric Login" switch. Prompts WebAuthn registration, derives the key, and updates the private key envelope on the server.

---

## 4. Downstream Branding Adaptation
- **QuantiX:** Glowing holographic fingerprint scans and biometric authorization screens with neon cyan lines.
- **ABRN:** Understated clean security shields, minimal check marks, and corporate biometric integration copy.

---

## 5. Verification & Test Plan
- **PRF Feature Capability Check:** A Vitest unit test asserting that WebAuthn options correctly format the PRF extension arguments and handle unsupported browsers gracefully.
- **Biometric Login E2E Playwright Test:**
  1. Boot E2E test.
  2. Register user and navigate to Security Settings.
  3. Click "Enable Biometric Login". Mock the browser's authenticator (using Playwright's virtual authenticator API).
  4. Verify the biometric credential is registered and the private key envelope is re-encrypted.
  5. Log out, click "Log in with Biometrics". Verify successful login and vault decryption.

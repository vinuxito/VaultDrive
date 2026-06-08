# Operation Dinner Out — Master Plan Index

This index organizes the technical roadmap for **Operation Dinner Out**: 7 premium, zero-knowledge, and secure collaboration features designed to elevate **QuantiX Drive** and **ABRN Drive** from cloud drives to the absolute tier of client-side encrypted control planes.

## Philosophy Acknowledgment
Following the practical operating philosophy in [FILEMON_PHILOSOPHY_STANDALONE_AGENT_BRIEF.md](file:///lamp/www/ai_tools/FILEMON_PHILOSOPHY_STANDALONE_AGENT_BRIEF.md):
- **Clarity before action:** Detailed planning of browser-side cryptography boundaries and backend schemas before execution.
- **Evidence before claims:** Design of dedicated verification suites and automated tests for every step.
- **Build for the user:** Smooth, zero-friction luxury UI/UX adapting instantly to both dark neon (QuantiX) and corporate burgundy (ABRN) skins.
- **Stop when reality is clean:** Execution of step-by-step modular plan files, keeping main branches clean.

---

## 7 Sick As Fuck Features Roadmap

| Step | Plan File | Description | Target Layer |
| :--- | :--- | :--- | :--- |
| **1** | [step-1-dynamic-ephemeral-key-rooms.md](step-1-dynamic-ephemeral-key-rooms.md) | Real-time ZK collaboration, live document editing, and chat via Web Crypto ECDH key exchange & CRDTs. | Frontend + WS/SSE Relay |
| **2** | [step-2-offline-first-local-vault-sync.md](step-2-offline-first-local-vault-sync.md) | Offline vault browsing, queued sync queues, and conflict resolution logs via Service Workers & IndexedDB. | Frontend (Service Worker) |
| **3** | [step-3-multi-custodian-shamir-recovery.md](step-3-multi-custodian-shamir-recovery.md) | Decentralized master key recovery using Shamir's Secret Sharing split across multiple recipient RSA envelopes. | Browser Web Crypto |
| **4** | [step-4-time-locked-puzzles-auto-shred.md](step-4-time-locked-puzzles-auto-shred.md) | Cryptographic time-locked puzzle envelopes (Verifiable Delay Functions) and server-assisted key envelope auto-shredding. | Frontend WASM + Go API |
| **5** | [step-5-sandboxed-wasm-document-viewer.md](step-5-sandboxed-wasm-document-viewer.md) | Zero-leak PDF, image, and text viewing/signing inside a secure browser-side WASM container (no-download previews). | Frontend (WASM Sandbox) |
| **6** | [step-6-zk-proof-agent-computations.md](step-6-zk-proof-agent-computations.md) | Scoped AI agent computations inside local Web Workers producing zk-SNARK mathematical proofs without leaking raw file bytes. | Web Workers + circom/snarkjs |
| **7** | [step-7-webauthn-biometric-key-derivation.md](step-7-webauthn-biometric-key-derivation.md) | Complete passwordless/PIN-less entry by deriving symmetric master encryption keys directly via the WebAuthn PRF extension. | WebAuthn API + Hardware Enclaves |

---

## Strategic Principles
1. **Never Trust the Server:** The server stores ciphertext, metadata envelopes, and logs. It must never handle plaintext keys, file bytes, or cleartext names.
2. **Visual Coherence:** Fully theme-aware UI utilizing custom HSL properties. Seamless integration with mobile bottom sheets and gestural UX.
3. **Downstream Portability:** Parameterized branding variables to support instant propagation from QuantiX-Drive upstream to ABRN-Drive downstream overlay.

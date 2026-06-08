# Step 6 — zk-SNARK Agent Computations

## 1. Technical Concept
Allow external AI agents or third-party audits to verify assertions about encrypted file contents (e.g. "Does this document contain a valid signature?", "Is the file size under 1MB?") without downloading the raw file or revealing the plaintext. Computations are run in a local Web Worker which outputs a zero-knowledge cryptographic proof (zk-SNARK) that the server or agent can verify mathematically.

```
[Agent Query: Has Signature?] ──▶ [Local Web Worker] ──▶ [Decrypts & Computes SNARK Circuit] ──▶ [Proof Generated]
                                                                                                        │
    [Verifies Proof Mathematically] ◀─── [Sends ONLY Cryptographic Proof (Yes/No)] ◀────────────────────┘
```

---

## 2. Cryptographic Architecture
1. **Arithmetic Circuits:**
   - Establish zk-SNARK arithmetic circuits (compiled using `circom`) for common document verification constraints (e.g., regex pattern matches, hash verification).
2. **Proof Generation (snarkjs):**
   - The Web Worker pulls the encrypted file, decrypts it in-memory using the cached PIN key, and inputs the plaintext as private witness parameters into the compiled circuit.
   - The worker executes the prover (`snarkjs.groth16.fullProve`) to generate a `proof.json` and a set of `publicSignals.json` (containing only the assertion result, not the file contents).
3. **Verification:**
   - The proof is submitted to the Go backend, which runs verification. The backend stores the proof of validation, granting access or approval without ever seeing the file.

---

## 3. Implementation Plan

### Go Backend (ZK Validator)
- **API Endpoints:**
  - `POST /api/v1/agent/verify-proof` — Accepts a zk-SNARK proof and public signals, runs Groth16 verification, and saves the verified compliance record.

### React Frontend (Prover Sandbox)
- **Web Worker (`zk-prover.worker.ts`):**
  - Integrates `snarkjs` and the compiled circuit wasm/zkey files.
  - Generates proofs asynchronously.
- **Agent Sandbox UI (`AgentZKDashboard.tsx`):**
  - Settings dashboard allowing users to see ZK proof requests from connected agents.
  - Shows execution progress (witness generation, proving time) with luxury progress cards.

---

## 4. Downstream Branding Adaptation
- **QuantiX:** Glowing green circuit boards vectors, particle flow animations during proof generation.
- **ABRN:** Sophisticated mathematical check icons, clean gray and gold credentials badges.

---

## 5. Verification & Test Plan
- **ZK Circuit Unit Test:** A Vitest unit test asserting that the circom compiled witness generator outputs correct signals for matching inputs and rejects mismatched inputs.
- **Playwright Agent Flow E2E:**
  1. Boot E2E test.
  2. Create a document containing the string "APPROVED".
  3. Simulate an Agent ZK Request asking to prove that the document contains "APPROVED".
  4. Web worker runs, generates proof.
  5. Submit proof to backend. Verify backend logs `proof_verified: true` and that no raw file bytes were sent in the payload.

# Step 1 — Dynamic Ephemeral Key Rooms (Real-time ZK Collaboration & Chat)

## 1. Technical Concept
Real-time collaborative note editing and secure chat room messaging where all content is encrypted browser-side. The Go server acts strictly as an blind relay forwarding encrypted frames. Key exchange is performed dynamically in the browser when users enter the room.

```
[User A Browser] ──(Encrypted CRDT/Message)──▶ [Go Relay Server] ──▶ [User B Browser]
      │                                                ▲                  │
      └───────────[ECDH Secret Key Derivation]─────────┴──────────────────┘
```

---

## 2. Cryptographic Architecture
1. **Room Creation:**
   - Owner creates a room, generating a unique `RoomID` and a 256-bit symmetric `RoomKey` (stored in the URL hash fragment: `https://quantixdrive.filemonprime.net/quantix/room/123#<RoomKey>`).
2. **Key Exchange (DH/ECDH) for Multi-User Rooms:**
   - Users joining the room generate ephemeral ECDH key pairs (`secp256r1`).
   - Public keys are broadcasted via the relay.
   - Connected peers perform browser ECDH key agreements (`window.crypto.subtle.deriveKey`) to derive shared secrets, which encrypt/decrypt local messages and CRDT sync steps.
3. **Encryption Profile:**
   - Cipher: `AES-GCM-256`
   - Data Frames: JSON containing `{ iv: "...", ciphertext: "...", senderId: "..." }`.

---

## 3. Implementation Plan

### Go Backend (Relay Node)
- **Routes:**
  - `GET /api/v1/rooms/{id}/connect` (Upgrades to WebSocket or SSE event stream connection).
  - `POST /api/v1/rooms/{id}/broadcast` (Accepts encrypted payloads and broadcasts them to all other active connections).
- **State Management:**
  - Ephemeral memory structure (sync map of active rooms and connections) — no database storage of messages/contents to guarantee zero-trace ephemerality.

### React Frontend (Collaborative Shell)
- **Room Interface:**
  - Glassmorphic split-pane layout (left: encrypted live chat, right: encrypted collaborative markdown editor).
  - Uses a client-side CRDT engine (e.g. lightweight Yjs or custom delta-sync engine) to merge typing conflicts.
  - Every keystroke or chat message is serialized, encrypted with the derived room key, and broadcasted.
- **Visual Feedback:**
  - Avatars showing active peer list with glowing badges representing active cryptographic key agreements.

---

## 4. Downstream Branding Adaptation
- **QuantiX:** Neon cyan text cursors, magenta selection highlights, and neon ambient shadows in the editor.
- **ABRN:** Elegant muted burgundy text cursors, gold selections, and serif-based minimal interface.

---

## 5. Verification & Test Plan
- **Mock Peers Test:** A client unit test (`vitest`) mocking two client instances exchanging public keys, verifying correct browser ECDH secret derivation and successful decryption of synced document state.
- **Relay Smoke Test:** An E2E playwright test opening two browser contexts in parallel, entering the same room URL, typing in one screen, and asserting that the encrypted text is relaid and decrypts correctly on the second screen.

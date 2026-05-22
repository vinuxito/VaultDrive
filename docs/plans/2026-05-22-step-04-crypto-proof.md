# Step 4 — Live Crypto Proof: Show, Don't Tell

**Parent:** [Hackathon Index](./2026-05-22-hackathon-index.md)  
**Priority:** 🔴 Critical  
**Effort:** M (1 day)  
**Status:** 🔲 TODO

---

## Why This Is New (Not in v1)

The v1 plan said "tell judges about encryption." This step says **"prove it."**

Every cloud storage product claims encryption. The ones that win hackathons make it *visible*. When a judge watches a file get encrypted in real-time, sees the ciphertext, and then sees it decrypted only in the recipient's browser — that's not a feature. That's a *demonstration of architectural intent*.

This step transforms the upload and share flow into a **live cryptographic proof** that the server never sees plaintext.

---

## The Concept

During the file upload flow, show a brief "Encryption Theater" — a real-time visualization of what's happening cryptographically:

```
┌─────────────────────────────────────────────┐
│  🔐 Encrypting "contract.pdf"               │
│                                              │
│  Algorithm:  AES-256-GCM                     │
│  Key:        ████████████████ (256 bits)      │
│  IV:         ██████████ (96 bits)             │
│  Input:      147,892 bytes                    │
│  Output:     147,908 bytes (+16 byte tag)     │
│                                              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 87%       │
│                                              │
│  ⚡ Encrypted in 23ms                         │
│  Server will receive only ciphertext.         │
└─────────────────────────────────────────────┘
```

This isn't fake. Every value displayed is real — extracted from the actual WebCrypto API calls. We're just making the invisible visible.

---

## Current State (Verified)

**File:** `vaultdrive_client/src/pages/files.tsx` (upload handler)  
**Crypto:** `vaultdrive_client/src/utils/crypto.ts`

The current upload flow:
1. User selects file via `<input type="file">`
2. `crypto.subtle.generateKey()` creates an AES-256-GCM key
3. `crypto.subtle.encrypt()` encrypts the file in the browser
4. The ciphertext is uploaded to the server via `fetch()`
5. The server stores ciphertext + metadata (never plaintext)

All of this happens in <50ms for small files. The user sees nothing except the file appearing in the vault.

---

## Implementation Plan

### 4.1 — Encryption Event Emitter

**File:** `vaultdrive_client/src/utils/crypto.ts` (or new `crypto-events.ts`)

Wrap the existing encryption function to emit events at each stage:

```tsx
type CryptoEvent =
  | { type: "generating-key"; algorithm: string; keyLength: number }
  | { type: "encrypting"; inputSize: number }
  | { type: "encrypted"; outputSize: number; durationMs: number; ivLength: number }
  | { type: "uploading"; ciphertextSize: number }
  | { type: "complete" };

// In the upload flow:
onCryptoEvent?.({ type: "generating-key", algorithm: "AES-256-GCM", keyLength: 256 });
const key = await crypto.subtle.generateKey(...);

onCryptoEvent?.({ type: "encrypting", inputSize: file.size });
const start = performance.now();
const ciphertext = await crypto.subtle.encrypt(...);
const duration = performance.now() - start;

onCryptoEvent?.({ type: "encrypted", outputSize: ciphertext.byteLength, durationMs: duration, ivLength: 12 });
```

**Key design decision:** The event emitter is *optional*. The existing API contract doesn't change. If no listener is passed, encryption proceeds exactly as before. This ensures zero risk of breaking existing tests.

### 4.2 — Encryption Visualization Component

**File:** `vaultdrive_client/src/components/upload/EncryptionProof.tsx` (new)

A small, elegant overlay/inline component that renders during encryption:

```tsx
function EncryptionProof({ event }: { event: CryptoEvent | null }) {
  if (!event) return null;
  
  return (
    <div className="brand-glass-card p-4 font-mono text-xs space-y-1 animate-fadeIn">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-primary animate-pulse" />
        <span className="text-primary font-semibold">Encrypting</span>
      </div>
      
      {event.type === "generating-key" && (
        <div>Algorithm: {event.algorithm} ({event.keyLength} bits)</div>
      )}
      
      {event.type === "encrypted" && (
        <>
          <div>Input: {formatBytes(event.inputSize)}</div>
          <div>Output: {formatBytes(event.outputSize)} (+16 byte auth tag)</div>
          <div className="text-green-400">⚡ Encrypted in {event.durationMs.toFixed(0)}ms</div>
          <div className="text-muted-foreground">
            Server will receive only ciphertext.
          </div>
        </>
      )}
    </div>
  );
}
```

**Styling:** Uses `brand-glass-card` for consistency. Monospace font for the technical data. Green for the completion state. The component animates in with `fadeSlideUp` and auto-dismisses after 3 seconds.

### 4.3 — Wire Into Upload Flow

**File:** `vaultdrive_client/src/pages/files.tsx`

In the upload handler, pass the event callback to the crypto function and render `<EncryptionProof />`:

```tsx
const [cryptoEvent, setCryptoEvent] = useState<CryptoEvent | null>(null);

// In the upload function:
await encryptAndUpload(file, {
  onCryptoEvent: setCryptoEvent,
});

// In the render:
{cryptoEvent && <EncryptionProof event={cryptoEvent} />}
```

### 4.4 — Public Share Page Proof Badge

**File:** `vaultdrive_client/src/pages/PublicSharePage.tsx`

When a recipient opens a share link and the file is decrypted in their browser, show a similar proof badge:

```
🔓 Decrypted in your browser
   Algorithm: AES-256-GCM
   Key source: URL fragment (never sent to server)
   ⚡ Decrypted in 12ms
```

This closes the loop: the judge sees encryption on upload, then sees decryption on download, and understands the server was never in the loop.

### 4.5 — Tests

**Unit test:** Verify the `EncryptionProof` component renders correctly for each event type.  
**E2E consideration:** The Playwright tests should continue to pass without modification since the crypto events are visual-only and don't affect the upload API contract.

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| Encryption proof visible | Shows algorithm, size, duration | Upload a file, observe overlay |
| Values are real | Duration matches actual crypto time | Compare displayed ms vs Network timing |
| Auto-dismiss | Proof fades after 3 seconds | Wait and observe |
| Upload still works | File appears in vault | Upload + check vault |
| Decryption proof on share | Shows decryption details | Open share link, observe badge |
| Tests remain green | 41/41 E2E, 116/116 vitest | Run test suites |
| No performance regression | Upload speed unchanged | Time upload before/after |

---

## Risk

**Low.** The encryption logic is not modified — only instrumented with an optional event emitter. The visualization is a read-only display of real data. The existing API contract is unchanged.

**One caution:** The 300ms minimum display time (from Step 3) must coordinate with this step. If both are implemented, the "Encrypting..." label and the crypto proof should merge into one component. Don't show two separate overlays.

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |

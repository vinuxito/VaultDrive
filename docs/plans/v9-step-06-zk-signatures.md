# v9 — Step 6: ZK Document Signatures
> **Operation Go Live** | Step 6 of 7
> **Index**: [v9-go-live-index.md](./v9-go-live-index.md)
> **Estimated Time**: ~4 hours
> **Priority**: 🟡 Medium — Differentiator feature for enterprise and legal use cases

---

## Problem Statement

VaultDrive can already encrypt and share files. But it cannot **prove** that a specific user signed off on a specific file at a specific time. For legal, compliance, and enterprise workflows (contracts, approvals, NDAs), this is the difference between a storage tool and a document platform.

ZK Signatures = the user's **RSA private key** (which never leaves the browser) signs a SHA-256 hash of the file. The server stores only:
- The signature bytes
- The signer's user ID
- A timestamp
- The file ID

The server cannot forge signatures (it never has the private key). Anyone with the signer's public key can verify the signature is authentic. This is a **non-repudiable proof** that the signer saw this exact file.

---

## Architecture

```
Sign flow:
  1. Client fetches encrypted file blob from server
  2. Preview worker decrypts it (reuse Step 4's preview.worker)
  3. Client computes SHA-256 of the decrypted content
  4. Client signs the SHA-256 hash using the user's RSA private key (from PIN-derived keychain)
  5. Client sends { file_id, signature_hex, hash_hex } to POST /api/files/:id/signatures

Verify flow:
  1. Client fetches signatures list for a file from GET /api/files/:id/signatures
  2. For each signature, fetch the signer's public key from GET /api/users/:id/public-key
  3. Verify the signature against the file's current decrypted SHA-256 hash
  4. Display: ✅ Verified / ❌ Tampered / ⏳ Pending
```

---

## Database Migration

### NEW SQL: `sql/schema/019_file_signatures.sql`

```sql
CREATE TABLE IF NOT EXISTS file_signatures (
  id            SERIAL PRIMARY KEY,
  file_id       UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  signer_id     UUID NOT NULL REFERENCES users(id),
  signature_hex TEXT NOT NULL,
  hash_hex      TEXT NOT NULL,
  signed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(file_id, signer_id)   -- one signature per user per file version
);

CREATE INDEX idx_file_signatures_file_id ON file_signatures(file_id);
```

---

## Backend: New Endpoints

### In `handle_files.go` (or new `handle_signatures.go`)

```go
// POST /api/files/:id/signatures
// Expects JSON body: { "signature_hex": "...", "hash_hex": "..." }
func handleCreateSignature(w http.ResponseWriter, r *http.Request) {
  fileID := chi.URLParam(r, "id")
  userID := actorFromContext(r.Context()).UserID

  var body struct {
    SignatureHex string `json:"signature_hex"`
    HashHex      string `json:"hash_hex"`
  }
  if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
    writeError(w, http.StatusBadRequest, "invalid body")
    return
  }

  _, err := db.Exec(r.Context(),
    `INSERT INTO file_signatures (file_id, signer_id, signature_hex, hash_hex)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (file_id, signer_id) DO UPDATE
     SET signature_hex = $3, hash_hex = $4, signed_at = now()`,
    fileID, userID, body.SignatureHex, body.HashHex,
  )
  if err != nil {
    writeError(w, http.StatusInternalServerError, "db error")
    return
  }

  writeJSON(w, http.StatusCreated, map[string]string{"status": "signed"})
}

// GET /api/files/:id/signatures
func handleListSignatures(w http.ResponseWriter, r *http.Request) {
  fileID := chi.URLParam(r, "id")
  rows, err := db.Query(r.Context(),
    `SELECT s.id, s.signer_id, u.username, s.signature_hex, s.hash_hex, s.signed_at
     FROM file_signatures s
     JOIN users u ON u.id = s.signer_id
     WHERE s.file_id = $1
     ORDER BY s.signed_at DESC`, fileID,
  )
  // ... scan rows and writeJSON
}
```

Register in `main.go`:
```go
mux.Post("/api/files/{id}/signatures", handleCreateSignature)
mux.Get("/api/files/{id}/signatures", handleListSignatures)
```

---

## Frontend: `SignatureWidget`

### NEW: `vaultdrive_client/src/components/files/SignatureWidget.tsx`

```tsx
import { useState } from "react";
import useSWR, { mutate } from "swr";
import { CheckCircle2, XCircle, PenLine, Loader2, ShieldCheck } from "lucide-react";

interface Signature {
  id: string;
  signer_id: string;
  username: string;
  signature_hex: string;
  hash_hex: string;
  signed_at: string;
}

interface SignatureWidgetProps {
  fileId: string;
  filename: string;
  /** The already-decrypted file ArrayBuffer, used for SHA-256 computation */
  decryptedContent: ArrayBuffer | null;
  /** The user's RSA private key for signing */
  privateKey: CryptoKey | null;
  /** The user's RSA public key for verification */
  publicKey: CryptoKey | null;
}

async function hashBuffer(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signHash(hashHex: string, privateKey: CryptoKey): Promise<string> {
  const signature = await crypto.subtle.sign(
    { name: "RSA-PSS", saltLength: 32 },
    privateKey,
    new TextEncoder().encode(hashHex)
  );
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifySignature(
  signatureHex: string,
  hashHex: string,
  publicKey: CryptoKey
): Promise<boolean> {
  const sigBytes = new Uint8Array(signatureHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  return crypto.subtle.verify(
    { name: "RSA-PSS", saltLength: 32 },
    publicKey,
    sigBytes,
    new TextEncoder().encode(hashHex)
  );
}

export function SignatureWidget({
  fileId,
  filename,
  decryptedContent,
  privateKey,
  publicKey,
}: SignatureWidgetProps) {
  const { data: signatures, isLoading } = useSWR<Signature[]>(
    `/api/files/${fileId}/signatures`
  );
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedMap, setVerifiedMap] = useState<Record<string, boolean>>({});

  const handleSign = async () => {
    if (!decryptedContent || !privateKey) return;
    setSigning(true);
    setError(null);
    try {
      const hashHex = await hashBuffer(decryptedContent);
      const signatureHex = await signHash(hashHex, privateKey);
      await fetch(`/api/files/${fileId}/signatures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ signature_hex: signatureHex, hash_hex: hashHex }),
      });
      mutate(`/api/files/${fileId}/signatures`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSigning(false);
    }
  };

  const handleVerify = async (sig: Signature) => {
    if (!publicKey || !decryptedContent) return;
    const currentHash = await hashBuffer(decryptedContent);
    const valid = await verifySignature(sig.signature_hex, sig.hash_hex, publicKey);
    const hashMatch = currentHash === sig.hash_hex;
    setVerifiedMap((prev) => ({ ...prev, [sig.id]: valid && hashMatch }));
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Document Signatures</h3>
        {privateKey && (
          <button
            onClick={handleSign}
            disabled={signing || !decryptedContent}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {signing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PenLine className="h-3.5 w-3.5" />
            )}
            Sign Document
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {isLoading && (
        <div className="h-10 rounded-lg bg-muted animate-pulse" />
      )}

      {!isLoading && signatures?.length === 0 && (
        <p className="text-xs text-muted-foreground">No signatures yet.</p>
      )}

      {signatures?.map((sig) => (
        <div
          key={sig.id}
          className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"
        >
          {verifiedMap[sig.id] === true && (
            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          )}
          {verifiedMap[sig.id] === false && (
            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          )}
          {verifiedMap[sig.id] === undefined && (
            <ShieldCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{sig.username}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(sig.signed_at).toLocaleString()}
            </p>
          </div>
          {publicKey && decryptedContent && verifiedMap[sig.id] === undefined && (
            <button
              onClick={() => handleVerify(sig)}
              className="text-xs text-primary underline"
            >
              Verify
            </button>
          )}
          {verifiedMap[sig.id] === true && (
            <span className="text-xs text-green-500 font-medium">Authentic</span>
          )}
          {verifiedMap[sig.id] === false && (
            <span className="text-xs text-red-400 font-medium">⚠ Tampered</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

### MODIFY: `vaultdrive_client/src/pages/files.tsx`

Add a "Signatures" section to the file detail sidebar/modal, wiring `decryptedContent` and `privateKey` from the existing PIN/key state.

---

## Verification Checklist

- [ ] `go build ./...` green with new signature endpoints.
- [ ] `psql` → `\d file_signatures` shows the table was created.
- [ ] Upload a file → open file detail → "Sign Document" button visible.
- [ ] Click "Sign Document" → WebCrypto RSA-PSS sign runs → signature saved → appears in list.
- [ ] Click "Verify" on a signature → shows "✅ Authentic".
- [ ] Manually corrupt the `hash_hex` in DB → Verify → shows "⚠ Tampered".
- [ ] Two different users can each sign the same file — both signatures appear.

---

## Commit Message

```
feat(v9/step-6): add ZK RSA-PSS document signatures with server receipt and client verification
```

---

*← [v9-step-05-openapi.md](./v9-step-05-openapi.md) | Next → [v9-step-07-offline-vault.md](./v9-step-07-offline-vault.md)*

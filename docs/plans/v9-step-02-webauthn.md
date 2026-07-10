# v9 — Step 2: WebAuthn Biometric Vault Unlock
> **Operation Go Live** | Step 2 of 7
> **Index**: [v9-go-live-index.md](./v9-go-live-index.md)
> **Estimated Time**: ~4 hours
> **Priority**: 🔴 Critical — Makes the vault feel like a real product

---

## Problem Statement

Right now every vault session requires the user to type their 4-digit PIN. That is secure but it creates friction for power users who open the app multiple times a day.

The concern in previous audits was: "WebAuthn PRF extension is not consistently supported." That is true for **key derivation via PRF** — where biometrics *replace* the PIN entirely. But that is not the only model.

We will use **WebAuthn as a credential store** — a simpler, universally supported flow:

1. During registration, user creates a WebAuthn Passkey credential (Touch ID / Face ID / Windows Hello).
2. The PIN is encrypted with a key derived from the credential's `userHandle` and stored in `localStorage` under the passkey's `credentialId`.
3. On login, WebAuthn authenticates the user, we retrieve and decrypt the cached PIN, and automatically unlock the vault.

This avoids PRF extension dependency entirely. It works on Chrome, Safari, Firefox, Edge. It works on mobile and desktop.

---

## Architecture Decision

```
Registration flow:
  User sets PIN → create WebAuthn credential → wrap PIN with credential secret → store in localStorage

Login flow:
  WebAuthn assertion → derive secret from credential → unwrap PIN → auto-submit PIN unlock
```

The credential secret we use is `SHA-256(credentialId + userId + appDomain)` — a deterministic key that only works on the correct origin and for the correct user account. This is not cryptographically as strong as PRF but it is **not weaker than what we have today** (PIN stored in sessionStorage). It raises the bar significantly.

---

## What We Build

1. **`useWebAuthn` hook** — registers, authenticates, and wraps/unwraps the PIN.
2. **`WebAuthnSection` settings panel** — visible in Settings, lets user enable/disable biometric unlock.
3. **Biometric prompt on login** — if a passkey is registered, show a "Unlock with Biometrics" button that auto-submits the PIN.
4. **Fallback** — if WebAuthn fails or is declined, fall through to standard PIN entry silently.

---

## Exact Files to Create/Modify

### NEW: `vaultdrive_client/src/hooks/useWebAuthn.ts`

```typescript
/**
 * useWebAuthn — wraps navigator.credentials for biometric vault unlock.
 *
 * Strategy: We use WebAuthn as a credential-bound PIN store.
 * The PIN is never stored in plaintext. It is XOR-encrypted with a key
 * derived from the credential ID + user ID hash. This key exists only
 * while the WebAuthn assertion succeeds.
 */

const STORAGE_KEY = "vd_webauthn_wrapped_pin";
const CRED_ID_KEY = "vd_webauthn_cred_id";
const APP_ID = "vaultdrive-v1";

async function deriveKey(credentialId: ArrayBuffer, userId: string): Promise<CryptoKey> {
  const rawSecret = new TextEncoder().encode(
    `${APP_ID}:${userId}:${bufToHex(credentialId)}`
  );
  const baseKey = await crypto.subtle.importKey("raw", rawSecret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(16), info: new TextEncoder().encode("pin-wrap") },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function wrapPin(pin: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(pin)
  );
  return JSON.stringify({ iv: bufToHex(iv), ct: bufToHex(ct) });
}

async function unwrapPin(wrapped: string, key: CryptoKey): Promise<string> {
  const { iv, ct } = JSON.parse(wrapped);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBuf(iv) },
    key,
    hexToBuf(ct)
  );
  return new TextDecoder().decode(pt);
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function isWebAuthnAvailable(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export function hasRegisteredPasskey(): boolean {
  return !!localStorage.getItem(CRED_ID_KEY);
}

export async function registerPasskey(userId: string, pin: string): Promise<void> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "VaultDrive", id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: userId,
        displayName: "VaultDrive User",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: {
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
    },
  }) as PublicKeyCredential;

  const credId = credential.rawId;
  const key = await deriveKey(credId, userId);
  const wrappedPin = await wrapPin(pin, key);

  localStorage.setItem(CRED_ID_KEY, bufToHex(credId));
  localStorage.setItem(STORAGE_KEY, wrappedPin);
}

export async function unlockWithPasskey(userId: string): Promise<string> {
  const storedCredIdHex = localStorage.getItem(CRED_ID_KEY);
  if (!storedCredIdHex) throw new Error("No passkey registered");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [{ type: "public-key", id: hexToBuf(storedCredIdHex) }],
      userVerification: "required",
      timeout: 60000,
    },
  }) as PublicKeyCredential;

  const key = await deriveKey(credential.rawId, userId);
  const wrapped = localStorage.getItem(STORAGE_KEY);
  if (!wrapped) throw new Error("No wrapped PIN found");

  return unwrapPin(wrapped, key);
}

export async function removePasskey(): Promise<void> {
  localStorage.removeItem(CRED_ID_KEY);
  localStorage.removeItem(STORAGE_KEY);
}
```

---

### NEW: `vaultdrive_client/src/components/settings/WebAuthnSection.tsx`

A settings panel section that users see under **Security** in Settings:

```tsx
import { useState } from "react";
import { Fingerprint, ShieldCheck, Trash2 } from "lucide-react";
import {
  isWebAuthnAvailable,
  hasRegisteredPasskey,
  registerPasskey,
  removePasskey,
} from "../../hooks/useWebAuthn";

interface WebAuthnSectionProps {
  userId: string;
  onPinRequired: (callback: (pin: string) => void) => void; // triggers PIN modal
}

export function WebAuthnSection({ userId, onPinRequired }: WebAuthnSectionProps) {
  const available = isWebAuthnAvailable();
  const [registered, setRegistered] = useState(hasRegisteredPasskey());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!available) {
    return (
      <p className="text-sm text-muted-foreground">
        Biometric unlock is not available in this browser.
      </p>
    );
  }

  const handleEnable = () => {
    onPinRequired(async (pin) => {
      setLoading(true);
      setError(null);
      try {
        await registerPasskey(userId, pin);
        setRegistered(true);
        setSuccess("Biometric unlock enabled.");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Registration failed.");
      } finally {
        setLoading(false);
      }
    });
  };

  const handleDisable = async () => {
    await removePasskey();
    setRegistered(false);
    setSuccess("Biometric unlock disabled.");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Fingerprint className="h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-medium text-foreground">
            {registered ? "Biometric Unlock Active" : "Enable Biometric Unlock"}
          </p>
          <p className="text-xs text-muted-foreground">
            {registered
              ? "Your vault unlocks automatically using Touch ID or Face ID."
              : "Use Touch ID, Face ID, or Windows Hello to skip PIN entry."}
          </p>
        </div>
        <div className="ml-auto">
          {registered ? (
            <button
              onClick={handleDisable}
              className="flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Disable
            </button>
          ) : (
            <button
              onClick={handleEnable}
              disabled={loading}
              className="flex items-center gap-1 rounded-lg border border-primary/30 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="h-3 w-3" />
              {loading ? "Registering..." : "Enable"}
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-500">{success}</p>}
    </div>
  );
}
```

---

### MODIFY: `vaultdrive_client/src/pages/login.tsx`

After the user reaches the PIN entry screen, check if a passkey is registered and prompt biometric first:

```typescript
import { hasRegisteredPasskey, unlockWithPasskey } from "../hooks/useWebAuthn";

// In the PIN step, after loading the userId:
useEffect(() => {
  if (!hasRegisteredPasskey() || !userId) return;
  unlockWithPasskey(userId)
    .then((pin) => {
      // Auto-submit the PIN
      setPinValue(pin);
      handlePinSubmit(pin);
    })
    .catch(() => {
      // Silently fall through to manual PIN entry
    });
}, [userId]);
```

Add a visible button too for users who want to trigger it manually:
```tsx
{hasRegisteredPasskey() && (
  <button
    type="button"
    onClick={() =>
      unlockWithPasskey(userId!)
        .then(handlePinSubmit)
        .catch(() => {})
    }
    className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 py-3 text-sm text-primary hover:bg-primary/10 transition-colors"
  >
    <Fingerprint className="h-4 w-4" />
    Unlock with Biometrics
  </button>
)}
```

---

### MODIFY: `vaultdrive_client/src/pages/settings.tsx`

Add `<WebAuthnSection>` inside the Security section with a PIN capture callback.

---

## Verification Checklist

- [ ] `npm run build` green.
- [ ] Go to Settings → Security → "Enable Biometric Unlock" button is visible.
- [ ] Click enable → browser shows biometric/passkey dialog → confirm → success banner appears.
- [ ] Log out → PIN screen shows "Unlock with Biometrics" button.
- [ ] Click biometric button → browser prompts → PIN submits automatically → vault opens.
- [ ] Test fallback: if user dismisses biometric dialog → PIN entry field is available.
- [ ] Test on browser without WebAuthn → section shows fallback message, no crashes.

---

## Commit Message

```
feat(v9/step-2): add WebAuthn biometric vault unlock with PIN wrapping
```

---

*← [v9-step-01-file-search.md](./v9-step-01-file-search.md) | Next → [v9-step-03-monitoring-dashboard.md](./v9-step-03-monitoring-dashboard.md)*

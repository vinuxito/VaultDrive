# Credentials and recovery in ABRN Drive

Current implementation audit: 2026-09-14. This describes the supported stored formats; it does not promise that resetting an account decrypts every file.

| What the user is doing | Credential / key actually used | After account recovery |
|---|---|---|
| Signing in with a password | Account password; unlocks the encrypted account RSA private key | Use the new password, then enroll a new PIN |
| Signing in with a PIN | Account PIN; unlocks the PIN-encrypted copy of the same RSA private key | Re-enroll after reset; the prior PIN envelope is cleared |
| Opening an own upload with `credential_scheme=pin` | PIN used at upload, PBKDF2 plus per-file salt | Still needs the original file PIN; reset does not re-encrypt its bytes |
| Opening an own password-encrypted upload | Password used at upload, PBKDF2 plus per-file salt | Still needs the original file password |
| Opening a direct or group RSA share | Recipient's recovered RSA private key, normally unlocked by their current PIN | Supported when recovery reconstructs that same private key and the grant remains active |
| Opening a folder-wrapped file | Unlocked folder AES key and that file's wrapped key | Depends on retaining access to the folder key; a login alone is not proof |
| Opening a Secure Drop delivery | The PIN-wrapped Drop key / existing Drop manager recovery path | Earlier PIN-wrapped material can still need the earlier PIN |
| Opening a File Request delivery | Separate file password chosen by its sender | Account PIN/reset does not replace the sender password |
| Opening a public file/folder link | Full URL including its decryption fragment; optional link access password is separate | Ask its owner for a complete active link; do not enter or send an account PIN |

For earlier File Request records, the owner access-key field contains a base64 16-byte PBKDF2 salt. It is not a PIN or RSA envelope. The compatibility reader recognizes that exact encoding without changing stored ciphertext, keys, or database schema.

## Practical recovery check

1. Complete the existing custodian approval flow, reset the account password, sign in and enroll the new PIN.
2. Open a pre-existing account-shared file and check its contents. Account reset success alone does not prove file access.
3. For an earlier own upload, use its original file PIN/password when prompted. Do not share that credential with support.
4. If the original credential or required key material is lost, use your backup or ask the sender for another copy. The administrator cannot reconstruct an unavailable file credential.
5. Preserve originals while checking recovery. Do not delete files or rotate further credentials to experiment with access.

Authenticated decryption must succeed before a file key is reused in the session. Failed input returns to an editable prompt; successful browser download initiation does not prove the user saved or read the file.

## Custodian recovery request contract

Configured custodians are standing configuration only. They are not pending approvals. A recovery request creates one bounded, expiring attempt with a new verification code, per-custodian challenge, and single-use bearer capability. The browser receives the capability once and keeps it in session storage. Public status, reset, and cancel calls require `Authorization: Bearer <recovery capability>`; a username by itself cannot read approvals or reset an account.

Before approving, each custodian must contact the account owner outside ABRN Drive and compare the exact verification code. An approval is bound to that request, custodian, challenge, and stored share index. Public status exposes generic custodian labels and approved share material needed by the requesting browser; it does not expose custodian email addresses or configured shares from another attempt.

The API refuses an expired attempt as soon as its expiry is evaluated. Approved plaintext share parts are physically deleted when an expiry-processing request runs for that attempt, owner, or custodian. There is currently no periodic cleanup worker, so this is event-driven deletion rather than a guarantee that the row is erased at the exact 24-hour wall-clock boundary. Cancel and successful reset delete the attempt's approval rows immediately inside their database transaction. Replacing custodian configuration also cancels the active attempt and clears its approval material.

Successful recovery changes the password and v2 password envelope, clears the incompatible PIN envelope, consumes the attempt, records the audit event, and revokes all refresh tokens in the same transaction. Access JWTs already issued before recovery are not yet centrally revocable and can remain valid until their normal 30-minute expiry. This is an explicit residual security gate; users should not treat recovery completion as immediate revocation of every already-issued access token.

Password changes, PIN repair, login envelope migration, and recovery reset lock and re-read the current user row before mutation. Required key-envelope persistence and its audit event are part of the same transaction; a persistence failure fails the credential mutation rather than silently accepting a password/PIN change that loses key access.

When an administrator assigns a temporary login password, the forced-change screen can also accept the user's previous password solely to unlock the existing browser-side key envelope. The temporary password remains the current password sent to the account API; the previous envelope password is never included in that request. Before any password or PIN mutation is sent, the browser decrypts the newly generated wrapper, compares the exact private-key PEM, and imports the forced-change key. A failed verification leaves the server credential unchanged.

## Evidence and limits

See the [coverage ledger](reports/2026-09-14-ui-ux-coherence-coverage.md) and [implementation log](SESSION_MEMORY_2026-09-14-ui-ux-coherence-implementation.md) for exact fixture and private-backend results. Physical passkey/device acceptance and unassisted participant trials are separate gates. Historical universal-PIN language in older design documents is not a guarantee for password-derived or sender-password cohorts.

Implementation references: `vaultdrive_client/src/pages/files.tsx`, `src/pages/shared.tsx`, `src/utils/file-credential.ts`, `src/utils/file-request-credential.ts`, `src/utils/pin-enrollment.ts`, `src/pages/recover.tsx`, `handle_file_requests.go`, and `handle_drop.go`.

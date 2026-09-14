# Step 02 — Finish transfers and recover without losing work

[Roadmap index](index.md) · Priority 2 · Status: proposed · Complexity: M–L

**Category:** UX / architecture

## Why it matters now

The recent PIN/autofill repair fixed a real blocking flow. Fresh browser B07 now shows the next boundary: a valid public link receiving HTTP 503 ends in generic key advice without retry. The same distinction between credential failure, transport failure and terminal access denial must hold through owner downloads, previews, folder ZIPs and public uploads.

[Public-share download handling](../../../vaultdrive_client/src/pages/PublicSharePage.tsx#L164) initiates browser saving and reports done; the browser does not confirm a completed disk write. Separately, [backend limited-use handling](../../../handle_public_share_links.go#L269) increments access and may deactivate a link **before** `io.Copy`. It [ignores the copy result and then records `file.downloaded`](../../../handle_public_share_links.go#L295), so interrupted streaming can both consume a use and produce a misleading completion event. Retry and receipt design must address these distinct problems.

## What exactly should be done

1. Define a small shared transfer vocabulary and result contract: preparing/encrypting or decrypting, sending/fetching, server accepted, browser save initiated, failed, cancelled and access unavailable. Render the relevant stages; do not invent granular percentages when no reliable measurement exists.
2. Classify network/5xx/429, session expiry, wrong credential, missing fragment, revoked/expired/consumed access and invalid metadata separately. Offer a specific action: retry, wait until allowed, sign in while preserving safe intent, edit credential, request a full/new link, or report unavailable data. Missing-key advice appears only for a missing/invalid key.
3. Preserve the file-selection snapshot and the September wrong-PIN/autofill invariants. A failed credential must remain editable and must not poison the session cache. Transport failures must not falsely blame the PIN or clear unrelated successful work.
4. Keep per-file outcomes for batches and upload requests. Retry only confirmed failures; preserve accepted-file receipts. When server acceptance is ambiguous, reconcile with the existing server list/status before retrying. If that is insufficient, document the narrow idempotency change needed before introducing automatic retries. Decide whether a failed ZIP offers retry or an explicitly partial archive; never label an incomplete archive complete.
5. Document limited-use consumption as it actually works, then choose whether to retain “authorized fetch consumes a use” or introduce a reviewed delivery-reservation protocol. Do not promise completion-based consumption or blindly retry one-use links without implementing and testing that decision. Prefer the smaller truthful UX correction unless evidence warrants a protocol change.
6. Check the backend stream's byte count/error before recording completion; distinguish an attempted/interrupted transfer from completed server streaming. Once response streaming has started, do not append a JSON error to ciphertext. Keep access consumption governed by the separately chosen policy. Reuse existing receipts: state filename, successful/failed counts and next action; distinguish server acceptance from owner review and download initiation from verified saving. Remove cryptographic timing/details from the primary completion message; keep useful details available through Step 06.

## What existing work it builds on

- [BulkDownloadModal](../../../vaultdrive_client/src/components/vault/BulkDownloadModal.tsx#L171), [FilePreviewModal](../../../vaultdrive_client/src/components/vault/FilePreviewModal.tsx#L196), and [September download verification](../../reports/2026-09-14-download-pin-verification.md).
- [PublicSharePage](../../../vaultdrive_client/src/pages/PublicSharePage.tsx#L517), [PublicFolderSharePage](../../../vaultdrive_client/src/pages/PublicFolderSharePage.tsx), [FileRequestPage](../../../vaultdrive_client/src/pages/FileRequestPage.tsx), and [Drop upload](../../../vaultdrive_client/src/pages/drop-upload.tsx): progress, success/error states and receipts already exist, with uneven recovery.
- [Download/autofill E2E](../../../vaultdrive_client/e2e/download-autofill.spec.ts), [share lifecycle](../../../vaultdrive_client/e2e/share-link-lifecycle.spec.ts), [Drop full cycle](../../../vaultdrive_client/e2e/drop-full-cycle.spec.ts), and [public sender flows](../../../vaultdrive_client/e2e/public-sender-flows.spec.ts).

## What risks it avoids

Lost selections, duplicate accepted uploads, repeated credential prompts, accidental limit consumption, false “saved” claims and recipients blaming themselves for server failure. No resumable-upload platform or encryption-format migration is implied.

## Expected payoff

A failed attempt becomes understandable and recoverable. Users can distinguish “try again,” “ask the owner,” and “your file was accepted” without support interpretation.

## Definition of done

- [ ] Reproduce B07 with 503 and verify a localized retry action succeeds when service returns; missing-fragment, 403/404/410 and 429 fixtures show their own correct actions.
- [ ] Wrong PIN → correct PIN and browser autofill preserve selection and produce expected fixture bytes; cancellation/reopen and session expiry do not resurrect stale credentials.
- [ ] Mixed batches retain successes and retry only failures. Ambiguous upload acceptance is reconciled without creating duplicate fixture records. Failed folder ZIPs cannot display complete success.
- [ ] Test disconnect before bytes, midstream interruption and exhausted-use retry for the chosen limited-use contract. A failed/short stream does not record a completed `file.downloaded` event; completed server streaming is not labeled proof of a saved/read file. Concurrency tests enforce the configured access limit; changes require explicit backend regression coverage.
- [ ] Owner, direct/group recipient, public file/folder recipient, Drop sender and File Request sender finish their relevant fixture journey with accurate per-file outcomes.
- [ ] Browser save initiation is described accurately. Physical-device save/reopen and large-file checks are separately recorded; unsupported/unverified combinations are explicit.

## Builder boundaries and handoff

Separate UI error/retry changes from any backend consumption/idempotency commit. Step 01 supplies usable links; Step 03 supplies shared state presentation; Step 05 supplies credential explanations. Do not implement blanket automatic retry for writes or consumed links.

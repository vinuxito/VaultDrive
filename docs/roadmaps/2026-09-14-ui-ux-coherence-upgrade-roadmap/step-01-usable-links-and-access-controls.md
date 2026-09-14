# Step 01 — Make copied links usable and access controls dependable

[Roadmap index](index.md) · Priority 1 · Status: proposed · Complexity: M–L

**Category:** UX / security

## Why it matters now

Access Center promises a unified view of outbound access, but its [file/folder Copy and Open URLs](../../../vaultdrive_client/src/pages/access-center.tsx#L250) omit the client-side key fragment. The creation dialogs append that fragment. A user can follow the UI correctly and still send a link that cannot decrypt the file. This is a higher priority than adding controls or restyling the page.

Access state also needs care: [status mapping](../../../vaultdrive_client/src/pages/access-center.tsx#L39) defaults unknown values to Active, and Drop `used` is mapped to Revoked. The [share inventory response](../../../handle_shares.go#L13) does not expose a terminal reason or `max_downloads`; its status function treats inactive links as revoked. The UI cannot reliably distinguish manual revocation from limit consumption from that response alone. Treat unrecognized states/reasons as unknown rather than guessing a reassuring label.

## What exactly should be done

1. Trace Copy/Open for file shares, folder shares and Drop links from creation, row management and Access Center. Make the same action produce the same usable result for its format; include the fragment wherever decryption requires it. Preserve client-side file/folder key reconstruction.
2. Reuse the [folder owner recovery path](../../../vaultdrive_client/src/components/vault/FolderSharedLinksSection.tsx#L226). For old links, verify actual wrapped-key availability first. If a complete URL cannot be recovered, disable misleading Copy/Open and explain how the owner can recreate access; never fabricate a key or silently create another grant. Drop is a distinct case: [its existing recovery card](../../../vaultdrive_client/src/components/upload/UploadLinkCard.tsx#L55) sends a PIN and [the server unwraps the key](../../../handle_drop.go#L979). Document and review that boundary before reusing it; initially route unsupported cases to their existing owner manager instead of silently extending server-side recovery to other link types.
3. Await clipboard success before showing confirmation. On denial, provide an explicit manual-copy path after the same credential gate. “Link copied” means the complete usable link was written, not that a button was clicked.
4. Give outbound rows a consistent resource, type/direction, status, expiry, usage meaning and available actions. Define which states each response can actually distinguish: use “Closed” with an unavailable reason when inactive could mean revoked or consumed. If finer distinction is required, specify a narrow response extension from authoritative stored fields and test compatibility; do not invent historical reasons or mandate a schema migration. Explain that inbound “Shared with me” is a different relationship. Do not imply that Access Center currently inventories File Requests, user/group shares and agent scopes if its endpoints do not cover them; label its scope and link to existing managers.
5. Add or route to existing owner-authorized revoke controls, with resource-specific confirmation, pending/error feedback and a refreshed result/receipt. Keep revoke separate from deleting a stored file or removing a management record. Failed revocation must retain the last confirmed state and allow retry.

## What existing work it builds on

- [File-share creation](../../../vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx#L163) and [folder-share creation](../../../vaultdrive_client/src/components/vault/CreateFolderShareLinkModal.tsx#L251): full links already exist at creation.
- [FolderSharedLinksSection](../../../vaultdrive_client/src/components/vault/FolderSharedLinksSection.tsx) and its [tests](../../../vaultdrive_client/src/components/vault/FolderSharedLinksSection.test.tsx#L108): credential-gated recovery; a related masked-PIN copy test is currently skipped.
- [Share inventory](../../../handle_shares.go#L91), [public-share revoke](../../../handle_public_share_links.go#L336), and [Drop endpoints](../../../handle_drop.go#L745): existing server contracts, with different lifecycle semantics.
- Existing row actions, toasts, activity receipts, share-link lifecycle and group-sharing E2E specs. Step 03 owns shared load/error behavior; Step 04 owns shell/navigation changes.

## What risks it avoids

Broken recipient links, false clipboard confirmation, accidental new grants, presenting unavailable access data as safe, and weakening the encryption boundary for convenience. Revocation cannot recall previously downloaded copies; changing labels must not change authorization.

## Expected payoff

Owners can send working links and answer “what access remains?” without reconstructing the product's internal distinctions. Expected support reduction is qualitative until Step 07 measures it.

## Definition of done

- [ ] For supported file, folder and Drop fixtures, each enabled Copy/Open entry point yields a full link usable in a fresh unauthenticated browser; the recipient completes the corresponding download/upload with fixture-byte verification.
- [ ] Missing legacy recovery material produces a truthful unavailable/recreate action, not a fragmentless “success.” Cancelling or failing credential entry creates no new grant and exposes no key.
- [ ] Clipboard rejection shows failure/manual-copy feedback; success appears only after resolution. Newly introduced file/folder Copy/Open recovery keeps raw keys and PIN-based unwrapping in the browser; no new request/log/diagnostic field exposes them. Existing authentication and Drop-recovery PIN requests are explicitly distinguished, not falsely reported absent. Full bearer links and secrets never enter support diagnostics.
- [ ] Active, expired, closed and unknown fixtures use contract-correct labels/actions. Revoked and limit-consumed are distinguished only when the response supplies authoritative evidence; otherwise the closed reason is unavailable. Old response shapes remain usable, and source lookup failure never becomes an authoritative zero-grant statement.
- [ ] Authorized revoke succeeds and prevents subsequent access; unauthorized revoke fails. Network failure preserves state, and repeated attempts do not delete owner files. Existing public/file/folder/group access tests still pass.
- [ ] EN/ES labels, keyboard use, 390px phone controls and all six template states pass the shared checks in Step 07.

## Builder boundaries and handoff

Own Access Center action behavior and only the existing key-recovery boundaries needed for it. Do not add a general secret-storage service. Implement the broken-copy slice first. Handoff to Step 02 for limited-use transfer semantics and Step 06 for consequence explanations and receipts. Document unsupported historical link formats explicitly.

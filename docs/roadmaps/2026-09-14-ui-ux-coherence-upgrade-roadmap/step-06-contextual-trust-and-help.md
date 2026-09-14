# Step 06 — Explain trust and help at the point of action

[Roadmap index](index.md) · Priority 6 · Status: proposed · Complexity: M

**Category:** UX / observability

## Why it matters now

The product already exposes trust cards, timelines, receipts and Help. Yet a user can encounter “ciphertext,” “control plane,” “zero-knowledge proof,” or “shredded” without a clear explanation of what just happened or what remains possible. Source evidence is especially important where [public copy](../../../vaultdrive_client/src/locales/es/drive.json#L148) says a server key was deleted, while [the handler](../../../handle_public_share_links.go#L276) closes access by deactivating the link.

[ActivityReceiptDrawer](../../../vaultdrive_client/src/components/vault/ActivityReceiptDrawer.tsx#L88) already fetches resource-filtered audit events and has refresh/retry. [HelpCenter](../../../vaultdrive_client/src/pages/help/index.tsx#L21) already provides sections, with [role-aware navigation](../../../vaultdrive_client/src/pages/help/components/HelpSidebar.tsx#L20), but selects its section in local state rather than a shareable URL.

## What exactly should be done

1. Lead trust panels with the user's questions: who can access this, what kind of access, until when, what happened last, and what can I do now? Retain accurate encryption/technical details behind a secondary disclosure. Do not replace the existing trust/timeline implementation.
2. Create a bounded copy-to-contract table for sensitive claims: browser encryption, filename/metadata visibility, download initiation, received upload, viewed/accessed counts, expiry, revoke and single-use closure. Check each against the actual handler and evidence. Include the existing [server-side Drop key recovery](../../../handle_drop.go#L979) exception; do not describe it as browser-only or conceal it behind generic zero-knowledge copy. Document any security architecture follow-up separately. Remove unsupported absolutes and distinguish access termination from erasing owner or recipient copies.
3. Reuse receipts after share/revoke/delivery actions, with resource, actor scope, server time, actual outcome and next action. Label event history freshness; an empty or unavailable history must not be described as proof that nothing happened. Step 03 supplies failure/stale states.
4. Make Help sections linkable and reachable from the related error/setup/action. Keep owner and administrator guidance role-appropriate. Add short task-level answers for full-link copying, which PIN/password is needed, failed downloads, partial uploads and recovery limits using the contracts from Steps 01, 02 and 05.
5. Provide a small explicit support-details view or copy action only where it saves back-and-forth: app/build identifier if known, time, operation category, sanitized error/request identifier and whether the action was confirmed. Show users what will be copied. Do not collect diagnostics automatically or include filenames, emails, tokens, URL fragments or secrets by default.

## What existing work it builds on

- [File trust/preview surface](../../../vaultdrive_client/src/components/vault/FilePreviewModal.tsx), [AccessPanel](../../../vaultdrive_client/src/components/vault/AccessPanel.tsx), [activity receipt drawer](../../../vaultdrive_client/src/components/vault/ActivityReceiptDrawer.tsx), backend trust/timeline/audit routes in [main.go](../../../main.go#L375).
- Existing [File Request management](../../../vaultdrive_client/src/components/vault/FileRequestsSection.tsx), public delivery receipts and [Help Center](../../../vaultdrive_client/src/pages/help/index.tsx).
- [Receipt E2E](../../../vaultdrive_client/e2e/activity-receipt-drawer.spec.ts), public sender tests and EN/ES help resources. Step 04 fixes the shell and mobile Help reachability.

## What risks it avoids

False cryptographic promises, treating “accessed” as “read,” implying revoked downloads can be recalled, overwhelming users with implementation details and leaking sensitive data through support exports.

## Expected payoff

Trust becomes understandable evidence and a useful action. Users can explain what changed and resolve common issues without learning the storage/key architecture.

## Definition of done

- [ ] Every sensitive user-facing claim in the touched trust/share/receipt screens maps to a documented backend/client event; no claim confuses a revoked link with deletion of stored or previously downloaded files.
- [ ] Owner and recipient can identify resource, access scope, expiry, last known event and next action from the primary view. Advanced technical details remain available without dominating completion messages.
- [ ] Share/revoke/upload receipts match fixture events and refresh after changes. Empty, stale and failed history states are distinct; a missing event never becomes a fabricated success.
- [ ] Contextual Help links open the intended section, survive refresh/Back and retain selected language. Owner help does not expose admin-only controls; public failures have usable guidance without requiring login.
- [ ] Copied support details are previewable and exclude fixture emails, filenames, PINs, private keys, bearer tokens and URL fragments. Unknown build identity is labeled unknown.
- [ ] In Step 07's unassisted trial, participants can explain revocation's limits, whether an upload was received, and their next recovery action without the builder correcting the interface's meaning.

## Builder boundaries and handoff

Finish the underlying access/transfer semantics first. This step changes explanation, receipt consistency and contextual Help—not encryption, audit retention, a new analytics platform or a helpdesk integration.

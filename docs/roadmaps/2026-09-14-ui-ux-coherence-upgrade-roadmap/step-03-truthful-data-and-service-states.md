# Step 03 — Make loading, failure and synchronization states truthful

[Roadmap index](index.md) · Priority 3 · Status: proposed · Complexity: M

**Category:** UX / observability

## Why it matters now

Fresh B05 and B06 show unavailable security/count data presented as empty lists and zeros. A user may conclude that no external access remains or that files have disappeared. The app already has a suitable [DataState component](../../../vaultdrive_client/src/components/ui/data-state.tsx#L19); the work is to apply a consistent contract at actual data boundaries.

[StatusPanel](../../../vaultdrive_client/src/components/dashboard/StatusPanel.tsx#L22) treats a successful health response as ONLINE. [Health handling](../../../main.go#L631) can still return `status: ok` when database ping fails, whereas [readiness](../../../main.go#L694) checks dependencies/storage and can return 503. These signals should not become interchangeable assurances.

## What exactly should be done

1. Give independent sources independent states: loading, confirmed empty, populated, stale, failed and forbidden. Preserve the last confirmed data with a visible stale indicator when refreshing fails; first-load failure gets unavailable values and retry, never fabricated zeros.
2. Start with Access Center and dashboard statistics, then audit Files, Shared, Groups, requests and administrative lists. Separate “no results for this filter” from “no records yet” and “could not load.” Use existing DataState patterns without requiring a universal fetching-library migration.
3. Treat readiness, API reachability, browser offline status and live-event connection as different facts. Show users only operational consequences relevant to their task. Keep goroutines/memory and similar server metrics in an operator-oriented details surface. Avoid polling the expensive full stored-file readiness scan from every user page.
4. Extend the existing offline queue presentation with per-action status and a bounded retry/discard/reconciliation path for operations already supported. An offline delete is pending, not server-confirmed deletion. On reconnect, show success, conflict, denial or remaining work rather than only a transient SYNCING badge.
5. Make error feedback accessible, localized and persistent enough to act on. Route transitions need a named loading state. Retry must affect the failed source, preserve filters/selection and avoid duplicate writes. Redact request details before presenting an optional support identifier.

## What existing work it builds on

- [Access fetch lifecycle](../../../vaultdrive_client/src/pages/access-center.tsx#L70), [dashboard statistics](../../../vaultdrive_client/src/pages/dashboard.tsx#L94), [Files SWR fetch](../../../vaultdrive_client/src/pages/files.tsx#L212).
- [Dashboard offline/replay behavior](../../../vaultdrive_client/src/components/layout/dashboard-layout.tsx#L80) and [visible OFFLINE/SYNCING badges](../../../vaultdrive_client/src/components/layout/dashboard-layout.tsx#L352). Offline indication is **already implemented**.
- [Existing queued file operations](../../../vaultdrive_client/src/pages/files.tsx#L1363), [folder synchronization results](../../../vaultdrive_client/src/utils/folder-share-sync.ts#L249), DataState and the receipt drawer's existing Retry behavior.
- Backend health/readiness endpoints and the September service recovery. No reboot or database change is necessary for the first UI slice.

## What risks it avoids

False reassurance, false file loss, repeated blind refreshes, hidden unsynchronized changes and exposing internal metrics as a substitute for task status. Stale data must not silently authorize a destructive decision.

## Expected payoff

Users can tell whether there is nothing to show, something is still loading, or a service failed—and know the next safe action.

## Definition of done

- [ ] B05/B06 regression fixtures show explicit unavailable states and retry. An actual empty 200 response still produces the correct empty-state action.
- [ ] Partial Access Center failure leaves the successful source visible and marks only the failed scope unknown. Counts never imply complete coverage while a source is missing.
- [ ] Background refresh failure keeps prior values labeled stale with last-success time; recovery updates them without resetting filters or selections.
- [ ] Offline, reconnecting event stream, API 5xx, readiness failure and healthy conditions produce distinct, evidence-supported states. A disconnected feed never claims it is current solely because HTTP health is 200.
- [ ] A queued operation can be inspected; discard affects only an unexecuted local action. Reconnect success/conflict/401/403/5xx fixtures reconcile without duplicate mutation or a false completion message.
- [ ] Keyboard/screen-reader users encounter meaningful loading/error labels and can activate retry. EN/ES and six-template checks cover errors and pending states, not only populated screens.

## Builder boundaries and handoff

Own shared state rules and source adapters; coordinate Access Center edits with Step 01. Inspect existing offline operation support before promising retries. Full offline upload/synchronization, external monitoring procurement and infrastructure changes are outside this step.

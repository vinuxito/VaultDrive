# Step 05 — Guide first use, credentials and account recovery

[Roadmap index](index.md) · Priority 5 · Status: proposed · Complexity: M

**Category:** product / security

## Why it matters now

The original reported download problem made credential uncertainty visible. PIN prompting/caching was repaired; the next task is helping users understand *which credential belongs to which journey*. [PIN-sharing documentation](../../04_RSA_PIN_SHARING.md) intends a recipient's own PIN for supported account-based file access, but public sender-created passwords and legacy files are distinct cases.

[OnboardingWizard](../../../vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx#L33) already implements privacy → PIN → folder → ready. Do not build another onboarding tour. Improve its handoff into a successful task and the less certain recovery states.

## What exactly should be done

1. Create a credential/state inventory from actual metadata and auth flows: account login password, vault PIN, hardware passkey, sender-created File Request password, optional link access password and legacy file credential. Label the needed credential and its purpose at the point of use; never ask users to share their account PIN with someone else.
2. Reuse session-vault trust after verified decryption. If no prompt is necessary, the action should proceed with understandable feedback; do not demand a PIN on every click merely to show security. Invalid cached credentials must return to editable input without losing the original task.
3. Continue existing onboarding into one meaningful completion: first upload and a clear choice to share access or receive files. Reuse dashboard actions and current empty states; mark completion from actual saved/accepted resources, not a clicked checklist. Respect existing accounts and users who already have content.
4. Make recovery eligibility explicit without revealing whether arbitrary accounts exist. For prepared recovery sessions, distinguish waiting for approvals, sufficient approvals, ready to reset, reconstruction in progress, failed and complete. Show last checked state and a safe next action; do not invent custodian response times or a cancel API that does not exist.
5. After password reset, test and explain PIN enrollment/re-enrollment and access to existing files. If old wrapping/custodian material makes recovery impossible, provide the truthful limitation and available owner options. Preserve all existing crypto formats; no promise that administrators can recover lost decryption keys.
6. Handle passkey cancellation/unsupported devices and password/PIN rate limits with actionable localized fallback to the existing supported path. Preserve safe intended navigation across successful login without retaining credentials or secret fragments in telemetry.

## What existing work it builds on

- [Onboarding](../../../vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx), [PIN enrollment](../../../vaultdrive_client/src/utils/pin-enrollment.ts), [PIN trust](../../../vaultdrive_client/src/utils/pin-trust.ts) and session-vault context.
- [Login](../../../vaultdrive_client/src/pages/login.tsx), [recovery waiting/reset states](../../../vaultdrive_client/src/pages/recover.tsx#L384), [custodian settings](../../../vaultdrive_client/src/components/settings/CustodianRecoverySection.tsx).
- [Owner trust E2E](../../../vaultdrive_client/e2e/owner-trust-flow.spec.ts), existing recovery/auth tests and the [latest lint regressions](../../reports/2026-09-14-frontend-lint-verification.md), including biometric prompt lifecycle checks.

## What risks it avoids

Credential sharing, repeated PIN friction, false recovery guarantees, completed-looking setup that leaves existing files inaccessible, and new-user tours that interrupt established users. Hardware authentication remains a separately verified capability.

## Expected payoff

Users understand the prompt, complete first use, and can distinguish a recoverable error from unavailable key material without guessing or handing secrets to support.

## Definition of done

- [ ] A fresh owner completes PIN setup, first upload and one chosen share/collection action with fixture data; existing owners do not repeat setup unnecessarily.
- [ ] Own, direct-share, group-share, Drop-derived and legacy fixture downloads request the credential dictated by their supported format. Session reuse, wrong input, cancellation and retry preserve correct state and byte integrity.
- [ ] Public sender/recipient screens explain their own credential requirements without presenting account PIN entry where it does not apply.
- [ ] Recovery fixtures cover insufficient/approved/rejected or unavailable shares, network interruption, reconstruction failure and success. “Reconstructing” appears only during the actual operation; waiting never implies a guaranteed time to approval.
- [ ] After successful reset, the user follows the documented PIN path and decrypts a pre-existing fixture. Unsupported legacy/recovery cohorts are explicitly identified instead of receiving a blanket success claim.
- [ ] Passkey unavailable/cancelled and rate-limited login have an actionable fallback; physical authenticator acceptance is reported separately. EN/ES and phone keyboard checks pass.

## Builder boundaries and handoff

Own guidance and supported auth/setup state transitions. Use Step 04 language conventions and Step 02 retry behavior. Account enumeration, key-format compatibility and recovery authorization remain invariants; any required protocol change gets its own design/test review before implementation.

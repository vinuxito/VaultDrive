# Step 07 — Make coherent journeys a release requirement

[Roadmap index](index.md) · Priority 7, with baseline work starting immediately · Status: proposed · Complexity: M initially, then ongoing

**Category:** testing / developer experience

## Why it matters now

The [latest report](../../reports/2026-09-14-frontend-lint-verification.md) supplies strong technical evidence, while fresh browser reconnaissance still finds broken/misleading interactions. Test breadth and user completion answer different questions. Existing lifecycle suites must be extended at the observed gaps; neither another test framework nor a generic “fully certified” label is the answer.

Documentation also affects reliability: [README](../../../README.md) still includes sibling-project deployment commands and dated certification language. The actual ABRN installation is described in the **September recovery section** of [deploy/systemd/README](../../../deploy/systemd/README.md). Later legacy multi-service instructions in that file are not a safe ABRN-only default.

## What exactly should be done

1. Maintain a compact route/role/journey coverage ledger. For each capability distinguish implemented, source-reviewed, synthetic-browser tested, isolated-backend tested, physical-device tested and user-accepted. Attach evidence to a source revision/build, environment and date.
2. Turn B01–B07 into focused regression cases while implementing their owning steps. Reuse share/Drop/request/group/key/recovery/receipt tests and the six-template matrix. Resolve the [skipped folder-link PIN copy test](../../../vaultdrive_client/src/components/vault/FolderSharedLinksSection.test.tsx#L108) by proving its intended behavior; do not simply remove or silently unskip a failing test.
3. Add explicit frontend lint to [CI](../../../.github/workflows/ci.yml) without weakening rules. Preserve existing unit/type/build/backend and [trust E2E workflow](../../../.github/workflows/trust-proof-e2e.yml). Make failures and skipped/manual gates visible in the release report rather than implying all jobs ran.
4. Separate fast fixture UI checks from mutation-bearing integration tests. Confirm actual E2E configuration, test DB/upload directory and build output before execution. Build privately: this deployment serves `vaultdrive_client/dist`, and `npm run test:e2e` includes a build. Never point write-bearing suites at customer data to obtain a green badge.
5. Run a small unassisted trial with at least five representative participants spanning owner, recipient and sender roles, using synthetic documents. Baseline then repeat the same tasks: upload; send/use a complete link; receive files; find/revoke access; recover an injected failure. Record completion, wrong turns, assistance and understanding, not invented conversion metrics. A proposed gate is at least four of five completing each assigned core task without help and **no misunderstanding of critical access/recovery consequences**; this is a small-sample acceptance target, not statistical proof.
6. Canonicalize the ABRN runbook and evidence index. Clearly separate upstream branding history from `/abrn/`, `abrndrive.service`, ABRN source/output paths, private staging, rollback and public verification. Link root/frontend READMEs to current results; mark older counts/certification claims historical. Keep per-step repo session notes and verification reports with commands, exit codes, unknowns and follow-up ownership.

## What existing work it builds on

- [Playwright configuration](../../../vaultdrive_client/playwright.config.ts), [E2E inventory](../../../vaultdrive_client/e2e), [theme matrix](../../../vaultdrive_client/e2e/theme-visibility.spec.ts), current Vitest and Go tests.
- [Trust proof harness documentation](../../15_TRUST_PROOF_HARNESS.md), September reports/session records and existing CI workflows. The older harness documentation lists only its original coverage; current specs already include broader lifecycle flows.
- Existing ABRN service recovery and privately staged frontend publication evidence. Reboot survival, hardware passkeys and current complete mutation-suite acceptance remain separate gates.

## What risks it avoids

Shipping a pretty but unusable flow, retesting only happy paths, accidental live-build/database mutations, stale claims, deployment in the wrong project, and a “clean tree” obtained by discarding another task's work.

## Expected payoff

Builder agents can execute and release bounded improvements with reproducible evidence. The user can see precisely what is verified and what still needs acceptance.

## Definition of done

- [ ] Ledger covers all 21 current route patterns and the owner/public-recipient/public-sender/group-recipient/admin contexts. Route visibility does not substitute for authorization or completed-flow testing.
- [ ] Existing suites plus focused regressions prove complete-link copy, typed retries, truthful failures, navigation/ESC/localization, credential recovery and receipt semantics. Lint has zero errors/warnings under unchanged rules; typecheck, relevant units/backend tests and staged build pass. Skips and unrun gates are explicit.
- [ ] Six templates × EN/ES receive critical-state visual coverage; desktop/phone keyboard/touch paths and relevant physical-device saves/passkeys are recorded separately. Failures link to an owning step rather than disappearing from the matrix.
- [ ] Unassisted trials record per-task raw outcomes and the proposed threshold, including any failures. No “usable without help” declaration precedes this evidence.
- [ ] ABRN-only build/deploy/rollback instructions point to verified ABRN paths/service and never require a sibling-project change. Instructions are validated with safe inspection/private staging, not by restarting production for a docs test.
- [ ] Each delivered slice records exact revision, commands, exit codes, scope and remaining unknowns; README links resolve. Application release evidence identifies the served build or labels identity unavailable.
- [ ] Only owned changes are committed and pushed on `main`; unrelated work is preserved. Documentation-only changes trigger no service restart or frontend publication.

## Builder boundaries and handoff

Start the evidence ledger before implementation and extend it alongside every step. Do not block a narrow verified repair on unrelated broad QA, but do not label the entire roadmap complete while required flow/manual gates remain. Stop when the acceptance evidence supports the claim being made.

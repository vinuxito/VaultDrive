---
name: por-mis-huevos-override
description: Guide an explicit human override when a workflow is blocked by incomplete, stale, or conflicting evidence. Use whenever a user asks to proceed anyway, override a blocker, accept responsibility, or add a “Por mis huevos” action—especially in accounting, approvals, or other consequential workflows. Preserve uncertainty, bound the authorization to one action and record, and leave an attributable audit trail. Never use this skill to bypass security, legal, consent, tenant, or transaction-integrity controls.
---

# Por mis huevos: explicit human override with preserved uncertainty

## Purpose

Help an authorized person proceed through a specific evidence blocker without making the system claim it proved something it did not prove.

Keep these statements distinct:

- **Verified:** the system has sufficient evidence for the claim.
- **Human-authorized:** the system could not verify the claim, and an authorized person chose a specific action anyway.

A human decision changes what the system may do. It does not turn missing evidence into proof.

## Decide whether an override is allowed

Use this workflow only when all of the following are true:

1. The blocker is known and can be explained in plain language.
2. The exact affected record and proposed action are identifiable.
3. The action is technically possible and within the operator’s authority.
4. The likely consequences and reversibility are understood well enough to explain.
5. The action does not violate a hard legal, security, consent, tenant-isolation, or system-integrity rule.

Do not offer an override for authentication or authorization failures, another tenant’s data, missing mandatory consent, cryptographic-integrity failures, suspected database corruption, or an unknown transaction outcome. If the consequence or target cannot be described, first gather evidence; do not proceed under this skill.

## Prepare the decision

Before asking for authorization, state:

- **Known:** the facts supported by current evidence.
- **Unknown or conflicting:** what the system cannot establish.
- **Blocker:** why the ordinary workflow stopped.
- **Action:** the exact change that would happen, on which record and scope.
- **Consequences:** the plausible effect and whether it can be reversed.
- **Decision owner:** the authenticated person whose identity will be recorded.

Keep the original blocker visible next to the action. Do not replace “insufficient evidence” with “approved.” If the proposed action needs a new classification, amount, destination, or other judgment, collect that decision explicitly; do not infer it from the override request.

For accounting, prefer authorizing an already generated and balanced entry whose identity and current inputs can be fingerprinted. Do not invent line allocations or amounts. An override for one journal does not authorize adjacent journals, tax exports, finality, or unrelated actions.

## Ask for explicit authorization

Use a separate, clearly worded action such as **“Por mis huevos — autorizar y continuar”** or **“Proceed under my responsibility.”** The confirmation must name the action and repeat the unresolved uncertainty. Avoid a generic “Approve” control.

Require:

- an authenticated operator identity;
- an explicit confirmation distinct from the ordinary action;
- a meaningful reason or justification;
- the blocker and affected record to be bound to the authorization;
- the previous state and requested action to be retained for audit.

A typed phrase such as `POR MIS HUEVOS` is optional. Do not use it as a substitute for authorization checks or a clear explanation. A canceled confirmation must have no side effects.

## Record and execute

Create an append-only audit event before or atomically with the authorized operation. Record, at minimum:

```text
override_type: POR_MIS_HUEVOS
operator:
timestamp:
workflow:
affected_record:
blocker:
known_facts:
unknown_facts:
reason:
action_authorized:
previous_state:
resulting_state:
reversible:
evidence_refs:
```

Bind the event to the exact record and current source/input fingerprint. If relevant source facts or the proposed entry changes before execution, invalidate the authorization and ask the human to review the new state. Do not silently broaden, reuse, or transfer an authorization.

Execute only the named operation. Keep unrelated blockers and all ordinary invariants active. Use the system’s canonical write path and transaction boundaries. Prefer an idempotent, explicitly authorized retry for a known safe operation; never blindly retry when the commit outcome is unknown.

## Show the result honestly

After execution, keep a durable, visually distinct state such as:

> **Human override applied**  
> Source evidence remains incomplete.  
> Authorized by: [operator] · [timestamp]  
> Reason: [reason]

Keep the original blocker accessible, and provide an audit-trail view. Never give an overridden record the same green verified state as a fully evidenced result. Preserve uncertainty in exports, downstream proofs, and status summaries wherever those surfaces are available.

Report only what the system verified after the action: what committed, what did not, the resulting record/revision, and any remaining blockers. Say “human-authorized,” not “verified” or “the system approved.”

## Recover when execution fails

The authorization record and original blocker survive a failed operation. State whether the write committed, rolled back, or remains unknown. If the transaction result is unknown, stop and inspect durable state before offering a retry. Retry only when the exact authorization is still current and the operation is safely idempotent; otherwise require a fresh human decision.

Do not report success until durable state confirms the operation. Do not erase or rewrite the audit event when the source later changes; record a separate resolution or superseding event.

## ABRN-Drive (VaultDrive) Override Matrix

When applying `por-mis-huevos-override` in `/lamp/www/ABRN-Drive`:

| Workflow / Surface | Allowed with `POR_MIS_HUEVOS` Override & Audit Trail | NEVER Allowed (Hard Security / Integrity Stop) |
|---|---|---|
| **Local Document Triage (`files.tsx`, `document-triage.ts`)** | Proceeding with upload when CFDI XML attributes (`Rfc`, `Total`, `UUID`) are missing/unparseable or keeping user's custom filename over `suggestedFilename`. | Pretending an unverified XML is SAT-validated (`✓ VIGENTE SAT`). |
| **Outbound Share Links (`CreateShareLinkModal.tsx`, `/access-center`)** | Creating an extended-duration or un-passworded share link when the owner explicitly acknowledges the exposure warning. | Putting the raw AES-256 file key in server query params instead of the `#fragment`, or sharing another user's unauthorized file. |
| **Secure Drop Intake (`/drop/:token`, `/access-center`)** | Accepting an inbound drop submission with unknown MIME signature after explicit owner acknowledgment. | Bypassing AES-256-GCM authentication tag verification or accepting corrupted ciphertext. |
| **Account & Key Recovery (`Shamir`, `/settings`)** | Custodian-attested emergency recovery action with full operator/timestamp/reason audit record. | Bypassing threshold share mathematics or forging a custodian signature. |

## Acceptance check

Before calling an override workflow complete, verify that:

- the original blocker and uncertainty remain visible;
- only the named record and action were authorized;
- identity, time, reason, prior state, action, and result are durable;
- the authorization is append-only and bound to current inputs;
- cancellation has no side effect;
- verified and overridden states look different;
- failure or unknown commit state cannot appear as success;
- a separate operation still requires separate authorization.

If any check fails, describe the remaining gap and keep the workflow blocked.

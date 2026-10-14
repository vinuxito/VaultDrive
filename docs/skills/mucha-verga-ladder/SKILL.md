---
name: mucha-verga-ladder
description: >-
  Assess and improve bounded autonomy in software components, agents, workflows,
  and team operating arrangements. Use when asked about agency, delegation,
  micromanagement, system-level contribution, coordination cost, or the Mucha Verga
  Ladder. Distinguish local action, verified outcomes, reliable cooperation, and
  reusable system leverage. Require scoped evidence, preserve authority, expose
  uncertainty, and propose the smallest justified upgrade. Never grade human worth
  or treat a capability assessment as permission to execute.
metadata:
  version: "1.0.0"
  display-name: "The Mucha Verga Ladder"
  subtitle: "Simple Steps for Systems"
  origin: "Phoenix / Filemón"
  default-mode: "observe-only"
---

# 🪜 The Mucha Verga Ladder
## Simple Steps for Systems

> **Do not merely ask how much a component can do. Ask whether its autonomy helps
> the larger system work better—and who pays for that autonomy.**

## 1. Preserve the four rungs

| Rung | Original formulation | Barrio formulation |
|---|---|---|
| 1 · Agency | Can act locally. | Puede moverle. |
| 2 · High agency | Can solve locally. | Sí resuelve. |
| 3 · Mucha verga | Solves reliably while respecting the larger system. | Resuelve sin chingar al resto. |
| 4 · No te mames | Helps the whole system become more capable without requiring more central control. | Hace que todos resuelvan mejor. |

This is a **Filemón operational heuristic**, not an established scientific scale,
psychological diagnosis, or numerical measure of intelligence. Apply it to a named
capability in a named operating context. Do not rank a person's dignity, health,
resilience, or worth. Biological and organizational analogies can inspire questions;
they are not evidence that cells, people, and software have identical agency.

Rung 4 means less need for routine micromanagement at comparable workload, not less
accountability, no central services, or permission to remove necessary approvals.
A well-scoped Rung 2 tool may be exactly the right design. Higher is not always better.

## 2. What invoking this skill does

It provides an assessment and improvement method. It does not install a scheduler,
create workers, enable tools, grant permissions, freeze production, or enforce a budget.
Default to authorized observation. Discover the real runtime and its boundaries.
A request for analysis is not permission to change code, deploy, send messages,
transfer funds, stamp or cancel invoices, rewrite records, or install dependencies.

Keep these separate:

- **Capability:** what the component demonstrably accomplishes in scope.
- **Authority:** what this actor is currently permitted to do to this resource.
- **Assurance:** how much relevant, current evidence supports the claim.
- **Deployment decision:** what the responsible owner permits next.

The assessment itself always authorizes **no execution**. A separate host-enforced
instruction may authorize a bounded action later. A rung never becomes a credential.

## 3. When to use—and when not to

Use for an agent that appears busy but does not finish, a module that burdens every
consumer, a proposed shared service, delegation design, cross-app reuse, or a claim
that a workflow is now autonomous. Use before and after an improvement to compare
its full-system effect.

Do not use it to decorate a trivial edit with a maturity audit. Do not require every
component to reach Rung 4. Do not infer laziness from a safe refusal or low capability
from missing permission. Do not describe people or teams as disease, cancer, defective
cells, or expendable parts. Do not punish necessary escalation.

## 4. Choose a bounded mode

**Brief:** one capability, one outcome, one boundary, available evidence, next question.
No JSON required. Useful for daydreams and small design discussions.

**Assess:** inspect authorized sources; produce gates, scope, evidence, current rung
or `undetermined`, blockers, and the smallest next improvement. No mutation by default.

**Design:** propose a target behavior and its tests. Mark all claimed implementation
as unproven. A proposed architecture earns no demonstrated rung.

**Improve:** only after explicit authorization, make the smallest bounded change,
run approved checks, preserve failures, and hand back observed results. Production,
external actions, commits, and pushes retain their own permission requirements.

Stop when the agreed question is answered, the budget is reached, the next action
requires ungranted authority, or evidence is inadequate. Checkpoint rather than
manufacturing more work.

## 5. Run the assessment

### A. Name the component and the larger system

Identify the capability, version, host, owner, consumers, tenant/resource boundary,
time window, dependencies, and user outcome. Name what must remain true elsewhere.
If you cannot name the larger system or the outcome, do not award a rung.

### B. Inspect current reality

Read available code, tests, reports, source adapters, logs, and host policy. State what
you actually inspected. A screenshot supports a visible state, not authorization,
byte integrity, working controls, mobile behavior, or reliable recovery by itself.
Do not treat an agent's completion report as independent execution evidence.

### C. Define the evidence plan before chasing a score

Select representative happy paths, relevant exceptions, integration checks, and a
bounded observation window. Agree success criteria and tolerances with the owner.
Record all attempts and denominator choices. Mark not-run, blocked, and inapplicable
subtests explicitly. Do not invent sample sufficiency or reliability percentages.

### D. Establish actual authority and containment

Check the real controls for current actor, resource, tenant, operation, and time.
Name resource budgets, stop/cancel mechanisms, ownership rules, side effects, and
recovery. A policy text is an instruction; an enforcement mechanism is a separate fact.
Unauthorized access cannot become acceptable because the output is useful.

### E. Evaluate the cumulative rung gates

Use [the rubric](assets/rubric.json) and [gate guidance](references/03-evidence-and-gates.md).
Each gate is `pass`, `fail`, or `unknown`. A pass needs current, inspected evidence
and an explicit reason. An unknown is not a failure and is not a pass. Rungs are
cumulative: all gates up through a rung must pass for that scope.

Rung 1: mission/scope, authorized local action, bounded execution, observable result.
Rung 2: verified outcome, exception handling, useful handoff, bounded progress.
Rung 3: preserved invariants, repeatable reliability, containment/recovery, truthful status.
Rung 4: reused capability, consumer benefit, coordination economics, maintainable transfer.

If no complete rung is supported, report `undetermined`, not “Level 0 person.” Retain
partial strengths and failed gates instead of flattening the system into one label.
A separate blocking risk can forbid promotion regardless of apparent capability.

### F. Inspect externalities and dependencies

Who retries, repairs, waits, reviews, pays, and answers incidents? Check neighboring
queues, resource consumption, permission boundaries, support burden, and transferred
manual work. More tool calls, commits, models, tokens, or workers are not outcomes.
Do not improve one metric by suppressing errors, hiding rejected cases, or shifting
work to another human.

### G. Earn the fourth rung specifically

Show a second genuinely distinct consuming context, not a second tab or renamed copy.
Compare equivalent work and report useful outcomes plus routine central steering,
mandatory review, recovery effort, support, and maintenance. Normalize workload, but
also show absolute budgets. Preserve mandatory controls. Include adoption and exit costs.
If comparison or reuse is only planned, report Rung 4 as a target, not a result.

### H. Recommend the smallest justified change

Find the first limiting gate and ask what minimal change would produce discriminating
evidence. It might be a clearer contract, a truthful status, a missing test, a receipt,
a resource cap, or deletion of unnecessary automation—not a new agent. Specify owner,
bounds, acceptance, rollback, and residual risk before implementation.

### I. Verify and hand back

Test the real host-to-outcome journey when authorized; include desktop/mobile where
humans use those surfaces. Separate code/test success from deployment and live acceptance.
Keep failed attempts and classify application, test, fixture, environment, and authority
failures. Do not clear an incident because a rerun became green for another reason.

Return: scope; demonstrated rung and evidence limits; gate results; system costs;
blockers; smallest next action; who can authorize it; exact evidence references.
For a full assessment, use [the template](templates/ASSESSMENT.md) and optionally the
[JSON contract](schemas/assessment.schema.json). Do not output hidden chain of thought.

## 6. Non-negotiable operating rules

**Local success is not whole-system success.** A payment preparer that silently consumes
another tenant's data is not a reliable cooperative subsystem.

**Autonomy includes stopping.** A bounded refusal, checkpoint, or evidence-rich escalation
can be the correct outcome. Penalize needless micromanagement, not protective review.

**A clever fix is not reliability.** Use repeated relevant checks and honest coverage.

**Reuse is not copy-paste proliferation.** Separate a stable core from host-owned
adapters. A shared failure domain needs explicit containment and versioning.

**A diagram is not an integration test.** Registered adapters are not accepted journeys.

**A positive metric is not permission.** Do not self-promote, expand access, remove human
approval, or change budgets on the strength of this assessment.

**Pressure is not a testing method.** Threats, humiliation, exhaustion, and “prove your
worth” language are not evidence of better engineering. Define acceptance instead.

**No reward for endless activity.** Finish, stop, or hand off. Rest is not a software
failure, and human value is not measured by throughput.

## 7. Compose rather than compete

Discover existing skills; do not pretend they are installed. `relate-with-confidence`
assesses candidate links. This skill assesses how the component using those links
operates within its larger system. CSI investigates contradictions; WAIT FASTER plans
bounded independent work; health reports describe readiness; Filemón Office supplies
in-place evidence inspection; Brenda's dock pattern can keep safe actions reachable.
None of those is authority to act. See [composition](references/10-composition.md).

## 8. Load detail only when needed

| Need | Reference |
|---|---|
| Definitions, scope, limits | [Model](references/01-model.md) |
| Investigation sequence | [Workflow](references/02-assessment-workflow.md) |
| Gate meanings and falsifiers | [Evidence and gates](references/03-evidence-and-gates.md) |
| Delegation and enforceable boundaries | [Authority](references/04-boundaries-and-delegation.md) |
| Rung 4 measurements and tradeoffs | [Economics](references/05-measurement-and-economics.md) |
| Retries, cancellation, recovery | [Failure](references/06-failure-and-recovery.md) |
| Shared core and host contracts | [Adapters](references/07-host-adapters.md) |
| Human-facing desktop/mobile acceptance | [Experience](references/08-mobile-and-desktop.md) |
| Incremental upgrades and rollout | [Promotion](references/09-upgrades-and-rollout.md) |
| Other Filemón skills | [Composition](references/10-composition.md) |
| QuantiX, NanoRed, Evinux, Office, OCR, PIPC, clipboard, teams | [Playbooks](references/11-domain-playbooks.md) |
| Cases that defeat naive scoring | [Counterexamples](references/12-counterexamples.md) |

Start with [Quickstart](QUICKSTART.md). Install [manually](INSTALL.md).
Use [Mission](templates/MISSION.md), [Delegation](templates/DELEGATION.md),
[Upgrade plan](templates/UPGRADE_PLAN.md), [Handoff](templates/HANDOFF.md),
[Review](templates/REVIEW.md), and [Host adapter](templates/HOST_ADAPTER.md).
See [synthetic examples](examples/README.md), [acceptance scenarios](tests/ACCEPTANCE.md),
[policy template](templates/policy.example.json), [policy schema](schemas/policy.schema.json),
[checker](tools/validate.py), [Sources](SOURCES.md), and [Verification](VERIFICATION.md).

## 9. ABRN-Drive (VaultDrive) Subsystem Rung Map

When applying the Mucha Verga Ladder inside `/lamp/www/ABRN-Drive`:

| Subsystem | Location | Target Rung | Key Containment & Invariant Gate |
|---|---|---|---|
| **El Cerebro Ciego (`VaultSearchIndex`)** | `vaultdrive_client/src/utils/vault-search-index.ts` | **Rung 4 · No te mames** | Shared across `VaultOmnibar` (`/`), inline `/files` filter, and `useFileSearch` (`⌘K`); `<1.5ms` latency on 550 docs; preserves enrichments on `syncDocuments()`; immediately zeroized on `scrub()` when vault locks. |
| **Local Document Triage** | `vaultdrive_client/src/utils/document-triage.ts` | **Rung 3 · Mucha verga** | Reads first 64KB in browser RAM (`triageFileObject`), extracts CFDI 4.0 RFC/Total/UUID and `#tags` with zero server roundtrips; never mutates filenames unless user clicks `Auto-nombrar`. |
| **Streaming Decrypt Engine** | `vaultdrive_client/src/utils/streaming-decrypt.ts` | **Rung 3 · Mucha verga** | Zero-allocation `TransformStream` + `extractSnippetForIndexing` bounded at 64KB so 1GB videos never OOM browser tabs. |
| **Scoped Agent API Keys** | `docs/agent-api.md`, `/api/agent/*` | **Rung 3 · Mucha verga** | Strictly bounded by folder/capability scope, expiration, rate limits, and append-only audit trail. |
| **Offline Rescue Ledger** | IndexedDB `rescue-ledger` | **Rung 3 · Mucha verga** | Survives network drops without losing user state or double-submitting mutations on reconnect. |

## Final test

> **Can it act? Can it finish? Can it finish without harming the rest? Can it help
> others finish better without making the center babysit everything?**

Then ask the fifth question: **What evidence would make us admit we are wrong?**

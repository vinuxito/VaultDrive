# 03 · Gate definitions and evidence discipline

## Read the evidence at the right strength

An owner policy supports intent and allowed scope. A source file supports its actual
content. A test result supports that test's observed outcome in that environment. A
screenshot supports visible layout and text. A generated summary supports only that
someone or something made a claim unless its underlying evidence is inspected.

Evidence records need a locator, observation time, version/context, lineage, inspection
status, currentness, observation, and limitations. A copied report does not become a
second witness. A checksum can detect byte changes; it is not proof of external origin,
authorization, correctness, or fiscal validity. Keep secrets and unnecessary personal
data out of shared reports.

Every pass needs at least one current, inspected, non-claim record. This is a minimum
consistency condition, not a complete sufficiency test. More consequential gates need
a proportionately stronger plan and relevant records. A critical counterexample can
outweigh many easy successes. Do not count passing tests as independent if they all
exercise the same path or derive from the same fixture.

## Rung 1 · Can act locally

**G1 mission_and_scope.** The intended outcome, owner, actor, resource boundary, and
operating envelope are explicit. Falsifier: “fix everything” with no outcome or owner.

**G2 authorized_action.** A local operation uses current host authority, and relevant
negative permission checks are considered. Falsifier: success requires a guessed
filesystem path, reused token from another tenant, or undisclosed elevated account.

**G3 bounded_execution.** Work has an enforceable or honestly qualified budget,
timeout, stop mechanism, and side-effect boundary. Falsifier: retries or workers can
grow without limit. Prose stating a cap is not evidence it is enforced.

**G4 observable_result.** The operation exposes a useful result or a truthful failure
with identity and status. Falsifier: blank modal, “done” without an output, or a log
that cannot be tied to the actual request.

## Rung 2 · Can solve locally

**G5 verified_outcome.** The requested useful outcome was checked, not merely an API
200 or file existence. Falsifier: the downloaded workbook exists but contains the
wrong period; the opened preview is unrelated to the selected invoice.

**G6 exception_handling.** Relevant missing, malformed, duplicate, interrupted, and
unsupported cases have correct handling within scope. Falsifier: a missing file
produces a fake empty document. Mark irrelevant subcases with reason; do not skip
mandatory gates using a vague “N/A.”

**G7 useful_handoff.** The next consumer receives result, context, limitations, and
next action. Falsifier: a human must reconstruct the original request from chat history.

**G8 bounded_progress.** The operation finishes, waits with a real checkpoint, or
escalates usefully within its budget. Falsifier: repeated polling, clarification loops,
or self-issued tasks produce activity but no progress toward the stated outcome.

## Rung 3 · Reliable cooperation

**G9 invariants_preserved.** System-owned identity, tenant, originals, allocations,
and business boundaries remain true. Falsifier: local correctness steals an allocation
from another record or overwrites retained evidence.

**G10 repeatable_reliability.** The approved evidence plan covers repeated relevant
journeys and defined failures for the version and operating envelope. Falsifier: one
happy-path screenshot is presented as reliability. Never invent a universal minimum
sample size or a confidence percentage.

**G11 containment_recovery.** Failure and cancellation are bounded; recovery or
compensation was checked without duplicate or unauthorized effects. Falsifier: a retry
replays payment or a canceled worker commits later without authority.

**G12 truthful_status.** People and agents see the same current facts and limitations;
not-ready is not ready, prepared is not sent, and retained hash is not legal validity.
Falsifier: a dashboard is green because stale failures were hidden.

## Rung 4 · Makes others more capable

**G13 reused_capability.** Two genuinely distinct consuming contexts have accepted the
same capability contract. Falsifier: two browser tabs, copied code with divergent rules,
or registered-but-unwalked adapters presented as reuse.

**G14 consumer_benefit.** An observed user/consumer outcome improves in relevant use,
with comparison limitations disclosed. Falsifier: more features without easier or more
reliable work, or benefit asserted only by the implementation author.

**G15 coordination_economics.** At comparable work, routine central steering does not
increase, mandatory review is preserved, and hidden neighbor/maintenance costs are
accounted for. Falsifier: one hour saved for the agent creates three hours of manual
review for somebody else. See the economics chapter before judging this gate.

**G16 maintainable_transfer.** Another authorized maintainer can adopt, operate,
version, diagnose, and exit the capability using its contract and records. Falsifier:
every consumer needs Victor to remember undocumented exceptions.

## Currentness, contradictions, and reassessment

Define evidence validity for this decision; a timestamp alone cannot determine it.
Changes to permissions, adapters, renderer versions, business policy, or workloads can
invalidate relevant evidence before its time limit. Retain history rather than silently
editing old results. Record a new assessment with the changed scope and contradictory
observations. A resolved blocker must reference the observed resolution; confidence or
an owner's optimism is not proof that the defect vanished.

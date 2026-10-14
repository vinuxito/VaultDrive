# 06 · Competence includes what happens when it breaks

## Design the failure vocabulary

Distinguish pending, accepted, running, complete, partial, canceled, unknown outcome,
blocked by policy, source unavailable, and failed. Keep these consistent between UI,
logs, and agent-facing APIs. A timeout describes lack of a timely response; it does
not by itself prove the operation never happened.

## Retries need semantics

For an operation with effects, decide how duplicates are recognized, how intent is
preserved, and how a caller checks an uncertain outcome. AWS's idempotency guidance
explains why retries otherwise risk duplicate side effects [S4]. Within the host's
actual design, test repeated requests, late responses, and reused identifiers with
conflicting intent. Do not promise magical exactly-once execution.

A bounded retry has a reason, retryable failure class, total attempt/time budget,
and a way to stop. Do not make retries recursive across every layer until an outage
becomes a request storm. Honor backpressure and upstream limits. When work cannot
safely continue, checkpoint and hand off the uncertainty.

## Reversibility must be specific

Reverting a code commit does not unsend an email, undo a bank transfer, erase an external
side effect, or restore overwritten source evidence. For each proposed action, state
whether it is reversible, compensable, or irreversible. Name the authorized mechanism,
who owns it, how it was tested, and what remains after it runs.

For retained documents, preserve originals. A working copy is a distinct artifact with
its own lineage and permissions. Do not use the existence of an original hash to excuse
changes elsewhere in the business record.

## Cancellation and stale workers

A real stop needs enforcement: cancel token, queue state, lease expiry, process control,
or a host-equivalent boundary. Test what happens if cancellation arrives during a
long computation and immediately before commit. Report requested versus acknowledged
cancellation. A canceled worker must not reacquire permission implicitly.

If a supervisor dies, another process should not assume ownership blindly. Reconcile
the checkpoint and actual effects before continuing. Use approved recovery procedures;
this skill does not provide a production lock manager.

## Failure isolation

Name what else can fail when the component fails. A shared reader that blocks every app
on one bad file has poor containment even if its successful rendering is beautiful.
Limit parse/render resources; isolate malformed inputs; and keep a useful fallback for
the originating task. Do not silently send private data to another service as fallback.

## Evidence of recovery

Preserve the pre-failure state, injected or observed failure, stop signal, recovery
steps, final state, and duplicate-effect check. Separate test-harness mistakes from
application defects. If the harness clicked the wrong record, correct the test and
retain both records; do not announce an app repair that never occurred.

An incident is not a laboratory. During active harm, use the existing incident owner
and already-authorized containment first, while preserving reasonable evidence. A
perfect assessment must not delay stopping a harmful write or isolating compromised
access. Avoid unrelated refactors until the incident is understood.

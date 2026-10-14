# 09 · Move one justified step, not four imaginary ones

## Find the first constraining gate

From Rung 1 to 2, the missing piece is often outcome verification or a complete handoff.
From 2 to 3, it may be current authorization, repeatable checks, containment, or truthful
status under failure. From 3 to 4, it is often a second consumer, reduced micromanagement,
and maintainability—not another model.

Do not infer the intervention solely from the rung. Inspect the specific failed or
unknown gate. Unknown evidence may require a test rather than code. A failed interface
may need simplification, not abstraction. A reliable component may need no upgrade.

## Write the change contract

State the problem, evidence, smallest candidate intervention, owner, permitted files
or services, prohibited changes, resource/time budget, expected outcomes, acceptance
checks, rollback/compensation, and stop conditions. Compare at least one simpler
alternative. Keep authority for implementation distinct from the assessment request.

Repository operations follow actual instructions. A request to build a local artifact
does not authorize a commit. A commit does not authorize a push. A push does not
prove deployment. Deployment does not prove users can complete the workflow.

## A staged path

Design first when meaning is unclear. Inspect current behavior next. Run local fixtures
for relevant failure cases. Walk a controlled host environment. Pilot one real authorized
consumer and then a genuinely distinct second context. Expand only after the owner
reviews evidence, costs, and remaining unknowns. Do not use a synthetic top-rung example
as evidence that your real product reached the same rung.

Shadow observation is useful when it cannot create duplicate effects or privacy leaks.
Label its results as shadow outputs and keep them from becoming accepted business
records. An evaluator must not silently execute the operation it is trying to assess.

## Promotion is a decision, not an automatic reward

The assessment reports the highest scope-supported rung and the evidence basis.
The responsible owner decides whether a release, delegation expansion, or adoption
should occur. Open blockers, unacceptable tradeoffs, or missing relevant evidence can
keep the decision on hold. The checker never overrides this.

A promotion receipt identifies previous and new contract versions, evidence window,
reviewer, accepted scope, safeguards, rollout limits, and review date/triggers. Permission
is still enforced on each real operation. A “Rung 4” label is not a permanent access token.

## Reassessment and downgrade

Reassess when source/host policy changes, a new tenant or file family is added, workload
shifts, a dependency updates, or a counterexample appears. Retain the earlier assessment
as history; publish a new scoped conclusion. Do not defend a title against evidence.
An honest downgrade protects users and creates a more useful next test.

## Stop conditions are part of success

Stop when the defined outcome is delivered, the marginal value of more work is lower
than its cost, the budget expires, authority is missing, or continued work threatens
invariants. A checkpoint with a precise next action is often better than an overnight
cascade of speculative repairs. Do not turn “high agency” into compulsory overwork.

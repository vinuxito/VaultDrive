# 02 · From “does it have agency?” to a useful answer

## Start by bounding the question

Ask what decision the assessment supports. Choosing a shared reader, investigating a
stuck worker, and deciding whether to delegate a payment-preparation workflow require
different evidence. Name the owner and users who experience the result. Record explicit
exclusions so adjacent projects do not quietly enter scope.

Inventory the actual tools and access. If code is unavailable, assess the supplied
artifacts and state the limitation. Do not claim repository archaeology because a
screenshot contains terminal output. If a live test would read private client data,
confirm the approved tenant and permitted observation path first.

## Establish a baseline that can be challenged

Record the current build, task definition, workload, representative cases, failure
cases, manual interventions, and recurring support requests. Choose meaningful
checks before looking at the most flattering examples. Include all evaluated attempts;
explain exclusions such as invalid fixtures instead of silently dropping failures.

A baseline need not be elaborate. For a small preview component, it might be ten
selected journeys with recorded criteria and explicit limited confidence. For a
money-moving pipeline, a short visual walkthrough is nowhere near an adequate basis.
Do not impose one universal count. Let the owner define an evidence plan proportionate
to the consequence, and state when that plan itself is inadequate.

## Walk the dependency chain

Trace request → current authority → source → local operation → outcome → downstream
consumer → user-visible receipt. Inspect what happens on cancellation, missing source,
expired authority, duplicate request, timeout, and retry. Stop at the real trust boundary.
A model's assertion that it can recover is a claim; an observed recovery is evidence.

For each stage ask who owns the state and what acknowledgement means. “Request accepted,”
“job complete,” “document prepared,” “message sent,” and “recipient received it” are distinct.
A local successful call must not be relabeled as a business outcome without proof.

## Apply gates without gaming them

Complete all sixteen gate entries, marking unknowns honestly. Only the cumulative
prefix earns a rung. Record higher-level strengths separately if lower gates are not
yet satisfied. An open blocking risk prevents a ready-for-review deployment recommendation.
A system with an urgent boundary failure needs containment, not a cosmetic rung upgrade.

Human judgement is required to decide whether evidence is relevant and adequate. The
bundled checker only tests internal consistency of the declared assessment. It cannot
look behind a path string or verify that an event actually occurred.

## Compare interventions, not rhetoric

Before changing anything, write the specific hypothesis: “If the reader owns return
context, callers will need fewer recovery instructions.” Name expected observations and
counterexamples. A change can fail even when the developer likes the UI more.

Select the smallest authorized intervention and a way to undo it. Keep unrelated work
out of the same change where practical. After testing, distinguish the application's
behavior from problems in fixtures or automation. Preserve the original failure and
explain any correction to the test itself.

## Finish with a bounded handoff

Return a short executive answer, supported gate table, relevant cost comparison, open
risks, next action, and owner. Attach exact evidence references and coverage limitations.
Do not force the user to read every trace to find whether the result is ready.

A good unresolved result is: “Two permitted data sources disagree; no promotion decision
is supported. Owner X must define precedence. Other safe read-only journeys can continue.”
A bad result is: “Everything looks good; probably deploy.”

End the run at the promised boundary. Invoking the ladder is not a reason to continue
through the night, create a fourth agent, consume unexpected credits, or expand the
system just because another improvement can be imagined.

# 05 · What does the whole system gain?

## Do not replace judgement with a vanity score

The ladder has ordinal rungs, not a numerical intelligence measurement. Do not invent
“97% agency.” Describe outcome quality, permitted independence, failure behavior,
coordination needs, and evidence coverage separately. A complex task can appropriately
need more review than a simple one; raw review count is not a meaningful comparison.

Rung 4 is a demanding claim. It says others became more capable without needing more
routine central steering. Record both workload-normalized figures and absolute costs.
A smaller rate can still hide an unaffordable total at increased volume.

## Keep a cost ledger

At minimum consider central routine steering, mandatory approvals, user handling,
rework, neighbor waiting/support, recovery/incident effort, compute or service expense,
adoption, documentation, maintenance, and exit/migration. These are different units;
do not add minutes, dollars, and errors into a magic scalar without an explicit model.
Report material tradeoffs rather than averaging away a serious harm.

Google's SRE guidance explicitly warns against automation that shifts toil to other
teams and recommends evaluating the broader workflow [S3]. Here the ladder turns that
principle into a proposed gate, not a universal published benchmark.

## Useful measures

Use completed, accepted outcomes as the denominator, not launched tasks. Record how
failed, canceled, partial, and blocked cases are handled. Two useful descriptive ratios:

```text
routine central steering per completion = routine steering minutes / accepted outcomes
rework share = outcomes requiring correction / outcomes evaluated
```

Also report numerator and denominator, workload mix, window, observation method,
excluded cases, and uncertainty. A zero denominator means undefined, not zero cost.
Mandatory review minutes must remain a separate line. Never improve the first ratio
by relabeling routine babysitting as mandatory approval or moving it to a neighbor.

## Synthetic worked comparison

Suppose an old reader completes 40 comparable inspections with 80 minutes of routine
central steering. A shared reader completes 40 with 30 minutes. The rate falls from
2.00 to 0.75 minutes per completed inspection. Suppose mandatory approvals remain 20
minutes in both; recovery drops from 12 to 8; a second host adopts it with an explicit
one-time setup cost and acceptable ongoing support.

That supports a promising comparison, not a universal causal claim. Check whether the
files became easier, a person changed, workload was cherry-picked, or the new reader
silently excluded difficult sources. Record onboarding and maintenance rather than
pretending they cost nothing. Without those checks, award at most the demonstrated
lower scope and mark Rung 4 unproven.

If steering instead rises from 2.00 to 3.00 minutes, the fourth gate cannot pass merely
because the UI looks better. The feature may still be worthwhile for another reason;
record that tradeoff without mislabeling it as this particular kind of system leverage.

## Define the pilot before it runs

Name the baseline and candidate versions, matched tasks, users, environments, duration,
primary outcome, guardrails, and stop conditions. Choose an owner-approved acceptable
change rather than a universal threshold. Include a genuinely distinct second consumer.
For novel tasks without a comparable baseline, collect one or report the proposed
benefit as a hypothesis.

## Guard against Goodhart-style behavior

Do not treat fewer questions as better when unanswered questions become hidden risk.
Do not reward throughput achieved by dropping records. Do not reward a low incident
count if failures stopped being logged. Ask affected users and maintainers whether the
new behavior actually reduced their work, and preserve conflicting reports.

## Diminishing returns and the stop decision

An upgrade has an implementation cost and creates obligations. A reliable Rung 2 utility
can be the correct endpoint. Favor a shared core only when reuse, consistency, or support
benefits justify its blast radius. An assessment should be able to conclude: “Keep it
small. The proposed fourth-rung upgrade would cost more than the problem it removes.”

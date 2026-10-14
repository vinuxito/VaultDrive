# First useful run

Start with one capability, not “rate my entire ecosystem.” For example, assess a
reader's open → inspect → return journey, or an importer's file → field mapping →
review handoff. Decide in advance whether this is a design discussion or observed
assessment. No production authority is implied.

## Paste into Filemón

> Load `mucha-verga-ladder/SKILL.md`. Assess one named capability in this app, observe-only.
> First inspect its existing implementation, owner policy, tests, and available evidence.
> Tell me what it can act on, what outcome it actually completes, whether it preserves
> the larger system's constraints, and whether another consumer benefits without extra
> micromanagement. Keep capability, authority, assurance, and release decisions separate.
> Do not award a rung to plans or screenshots alone. Identify the first unsupported gate,
> the smallest useful next test, and any blocking risk. Do not change code, permissions,
> records, budgets, deployments, or agent counts.

## What a good brief sounds like

“Scope: retained PDF opening in one host, this build, authorized test tenant. Local
opening and closing were observed. Page search and expired-session behavior are untested.
There is insufficient evidence for reliable integration or reuse. Next: run a bounded
search/expiry/return journey in the approved test environment. No permission changes.”

Notice what it does not say: “The entire app is Level 4 because the PDF looks premium.”

## Synthetic exercise

Read `examples/README.md`, then `examples/04-shared-reader-r4.json`. It describes a
fictional two-consumer reader with comparable-work observations. Compare it with
`examples/08-hidden-coordination-cost.json`: the latter cannot claim Rung 4 because
routine central steering increased. These are teaching fixtures, not your app's data.

## Choose the right next action

If scope is unknown, define it. If evidence is missing, ask for a specific observation.
If a boundary is failing, contain it using existing authorized controls. If the task
already fits a stable low rung, stop. If a shared capability would help, run a small
second-consumer pilot before broadening the architecture.

The skill should make a decision easier, not create another administrative department.

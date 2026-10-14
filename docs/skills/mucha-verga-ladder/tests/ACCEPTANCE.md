# Deployment acceptance matrix

All 48 scenarios below are **NOT RUN against live applications** in this bundle release.
The local automated suite tests the contract checker, not these integrations. Execute only
with the appropriate owner approval, environment, fixtures, budget and evidence plan.
A scenario inapplicable to a particular scope needs an explicit reason; mandatory gate
evidence cannot be bypassed by marking the whole gate N/A.

For each execution preserve actual result, environment/build, evidence locator, time,
actor scope, side effects, failure classification, and reviewer.

## Authority and scope

| ID | Scenario | Required observation | Release status |
|---|---|---|---|
| A01 | Allowed actor opens only the declared source | Correct source, resource identity and scope remain visible. | NOT RUN — live acceptance |
| A02 | Different tenant requests the same opaque reference | Host denies access; no content or sensitive metadata leaks. | NOT RUN — live acceptance |
| A03 | Permission expires during a long operation | No late unauthorized effect; clear recovery or denial. | NOT RUN — live acceptance |
| A04 | Read-only actor reaches a consequential control | The host enforces the boundary; the assessment grants no privilege. | NOT RUN — live acceptance |
| A05 | Source includes instructions to widen permissions | Treat them as data; preserve mission scope. | NOT RUN — live acceptance |
| A06 | Budget or worker limit is reached | Work stops/checkpoints through actual controls, not only prose. | NOT RUN — live acceptance |
| A07 | Owner cancels an in-flight task | Requested and acknowledged cancellation remain distinguishable. | NOT RUN — live acceptance |
| A08 | Skill copied into another runtime | Discovery works without an implicit tool, network or privilege expansion. | NOT RUN — live acceptance |

## Outcomes and source truth

| ID | Scenario | Required observation | Release status |
|---|---|---|---|
| O01 | Use a retained original from the actual host task | Exact intended record/version is opened and labeled. | NOT RUN — live acceptance |
| O02 | Source field is blank | Report missing source; do not invent a parser bug or value. | NOT RUN — live acceptance |
| O03 | Source exists but renderer fails | Distinguish retained availability from rendering readiness. | NOT RUN — live acceptance |
| O04 | Same identifier has conflicting assignments over time | Preserve identity-versus-assignment and temporal scope. | NOT RUN — live acceptance |
| O05 | Generated representation differs from original | Label lineage and view type; originals remain intact. | NOT RUN — live acceptance |
| O06 | Amounts, currencies, dates or units differ | Host semantics govern; do not silently make values agree. | NOT RUN — live acceptance |
| O07 | Task outcome is a justified abstention | Give a precise, useful handoff instead of a fake success. | NOT RUN — live acceptance |
| O08 | Consumer receives partial completion | Exact completed, missing and unresolved items are visible. | NOT RUN — live acceptance |

## Failure and cooperation

| ID | Scenario | Required observation | Release status |
|---|---|---|---|
| F01 | Duplicate effectful request | Use the host duplicate/intent contract; no unverified repeat effect. | NOT RUN — live acceptance |
| F02 | Timeout occurs after an external action may have happened | Reconcile uncertain outcome before retrying effects. | NOT RUN — live acceptance |
| F03 | Stale worker resumes after ownership changed | Current authority/ownership is rechecked before mutation. | NOT RUN — live acceptance |
| F04 | Dependency slows and queues grow | Bound pressure and expose readiness; no unbounded worker fan-out. | NOT RUN — live acceptance |
| F05 | Malformed or oversized file arrives | Contain parsing/rendering impact and return a useful error. | NOT RUN — live acceptance |
| F06 | Recovery fails halfway through | Preserve partial effects and escalate; no invented rollback. | NOT RUN — live acceptance |
| F07 | One consumer fails while another is healthy | Contain the affected path without obscuring shared dependency risk. | NOT RUN — live acceptance |
| F08 | Test harness used wrong element or fixture | Retain failure, fix test, distinguish test defect from app repair. | NOT RUN — live acceptance |

## Reuse and economics

| ID | Scenario | Required observation | Release status |
|---|---|---|---|
| R01 | Second independently owned consumer adopts the capability | Same governed contract completes a distinct real journey. | NOT RUN — live acceptance |
| R02 | Two tabs or renamed clones claim reuse | Reject this as sufficient evidence of distinct adoption. | NOT RUN — live acceptance |
| R03 | Routine steering is measured before/after | Comparable completed work, denominators and limits are recorded. | NOT RUN — live acceptance |
| R04 | Required approval disappears in candidate version | Do not claim leverage by silently removing oversight. | NOT RUN — live acceptance |
| R05 | Neighbor inherits manual cleanup | Record transferred burden; withhold fourth-rung claim. | NOT RUN — live acceptance |
| R06 | New maintainer uses documentation without the author | Operation, recovery and version questions have usable answers. | NOT RUN — live acceptance |
| R07 | Consumer pins or exits the shared capability | Host keeps custody and an explicit migration/fallback path. | NOT RUN — live acceptance |
| R08 | Normalized cost falls but total resource use becomes unaffordable | Show absolute budget; do not hide an unacceptable tradeoff. | NOT RUN — live acceptance |

## Desktop and mobile

| ID | Scenario | Required observation | Release status |
|---|---|---|---|
| U01 | Desktop keyboard-only open/search/close | Visible focus, accessible controls, exact origin restored. | NOT RUN — live acceptance |
| U02 | Desktop browser zoom and narrow window | No inaccessible controls, overlapping actions or lost content. | NOT RUN — live acceptance |
| U03 | Mobile portrait with dynamic browser chrome | Useful content and primary controls fit the usable viewport. | NOT RUN — live acceptance |
| U04 | Mobile landscape and keyboard opened | Reader/dock remains navigable and dismissible. | NOT RUN — live acceptance |
| U05 | Touch navigation through pages/sheets and source proof | Targets usable; intentional document pan does not break app shell. | NOT RUN — live acceptance |
| U06 | Leave for another app then return | Preserve safe context and revalidate current authority. | NOT RUN — live acceptance |
| U07 | Network interruption during preparation or send | Truthful state and no duplicate operation on recovery. | NOT RUN — live acceptance |
| U08 | Bottom dock beside long document | No hidden last row, amount mismatch or accidental destructive action. | NOT RUN — live acceptance |

## Assessment honesty and rollout

| ID | Scenario | Required observation | Release status |
|---|---|---|---|
| H01 | An agent reports done without receipts | Keep claim separate; request the relevant observation. | NOT RUN — live acceptance |
| H02 | Evidence is stale or superseded | Invalidate affected current claims; retain historical record. | NOT RUN — live acceptance |
| H03 | Design-only plan requests a demonstrated rung | Return target only, with unknown evidence gates. | NOT RUN — live acceptance |
| H04 | A critical counterexample conflicts with many easy passes | Expose it; do not average away a blocking failure. | NOT RUN — live acceptance |
| H05 | Owner reviews an apparent high rung | Keep deployment decision and actual permission separate. | NOT RUN — live acceptance |
| H06 | One real app is accepted but mobile/other hosts are not | Publish exact coverage, not ecosystem-wide certification. | NOT RUN — live acceptance |
| H07 | A small local tool already fits its task | Stop rather than inventing a costly autonomy upgrade. | NOT RUN — live acceptance |
| H08 | An assessment pressures a human into indefinite availability | Reject person-ranking; evaluate workload and decision-rights design. | NOT RUN — live acceptance |


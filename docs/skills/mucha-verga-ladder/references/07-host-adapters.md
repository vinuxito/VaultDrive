# 07 · One reusable method, host-owned meaning

## Core versus adapter

The ladder's core owns the assessment vocabulary, cumulative gates, evidence discipline,
comparison questions, and reporting format. A host adapter supplies domain-specific
outcomes, authority, invariant definitions, source locators, approved test fixtures,
operating budgets, and escalation owners. Do not make the generic skill guess fiscal
rules, current SIM ownership, clinical meaning, or accounting treatment.

This is a design contract. No runtime adapter is installed by this bundle. The
`templates/HOST_ADAPTER.md` worksheet supports an implementation discussion without
pretending a prose interface already exists.

## Minimum adapter responsibilities

Identify a capability and version; describe permitted actor/resource scope; expose
representative input and output identities; state source provenance and freshness;
name consumer contracts; supply read-only observation methods; enumerate actual effects;
and link to authorized recovery and review paths. Surface missing data as missing.

Identity must be specific. A file path supplied by a browser is not host authorization.
A similar filename is not lineage. An exact identifier may establish one relation while
saying nothing about another: the same SIM identity does not prove current assignment,
and the same retained XML bytes do not establish a current government status.

## Authority remains local to the source owner

The host enforces access on the requested operation and resource [S2]. It owns
credentials, tenant boundaries, policy decisions, and audit retention. The assessment
consumes permitted observations. Agents and human UI should see consistent identities
and status, although their allowed operations can differ.

Do not solve integration friction by widening every token's privileges or exposing
raw paths. A new adapter must not become an alternate path around existing protections.
Test denied and stale access as well as successful opening.

## Interface versioning and adoption

Specify supported contract versions, backwards-compatible fields, migration strategy,
and behavior when a consumer asks for an unsupported feature. No fallback should
silently change originals, purpose, privacy boundary, or business meaning.

The second consumer test is important. It exposes assumptions that a first host hides:
session mechanics, file custody, return navigation, errors, tenant identity, and different
workloads. A shared core can remain physically copied for practical deployment reasons,
but then version ownership, update propagation, and drift detection need evidence.
“Shared” describes a governed capability contract, not just identical folder names.

## Composition evidence

A consumer receipt should say which host and actor requested what, which source/version
was authorized, what result was presented, which limitations remained, and where control
returned. Do not require a giant audit payload in every UI; preserve accessible records
and show the human the meaningful summary.

Two integrations can both use the same reader yet have different maturity profiles.
Report host-specific coverage. A fully exercised PDF adapter does not certify another
app's import flow or mobile experience. Registered, implemented, tested locally,
walked in staging, and accepted in live use are separate states.

## Exit is part of reuse

Document how a host can stop using the capability, recover its own records, pin a
known-good version, and continue with a safe fallback. No “universal” subsystem should
hold an application's source data hostage. The goal is less bespoke work for everyone,
not a new central dependency only one person can understand.

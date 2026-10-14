# Origin, sources, and what they do not prove

## Primary basis: this conversation

Phoenix proposed that a larger system can become capable because its parts act and
solve locally while coordinating with the whole. The resulting four-rung formulation
and barrio labels are preserved in `SKILL.md`. The name **The Mucha Verga Ladder —
Simple Steps for Systems** is the requested product identity.

The gates, schemas, metrics, examples, tests, and installation structure in this
bundle are **new implementation/design choices** that operationalize that idea. They
are not claims that a published scientific scale already exists. Application examples
are hypothetical and do not certify the screenshots, repositories, or production apps.
Biological comparisons remain analogies, not empirical evidence for the skill.

Existing mounted Filemón skill materials were inspected for conventions: manual setup,
scoped observation, authority/evidence separation, bounded execution, and honest
verification. No prior bundle is silently installed, copied wholesale, or presumed
available in a future agent runtime.

## External primary sources consulted

**S1 · Agent Skills specification.** Supports YAML-frontmatter `SKILL.md`, matching
folder/name, referenced resources, and progressive disclosure. It does not guarantee
that any particular runtime discovers this folder or follows its instructions.

https://agentskills.io/specification

**S2 · OWASP Authorization Cheat Sheet.** Supports denying by default and enforcing
permissions on each relevant request. The host must implement these controls; a skill
or assessment cannot supply runtime authorization by itself.

https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

**S3 · Google SRE Workbook, Eliminating Toil.** Supports considering whole-workflow
automation costs, human fallback, safeguards, and avoiding shifted toil. It does not
establish the ladder's ordinal levels or a universal target for your applications.

https://sre.google/workbook/eliminating-toil/

**S4 · Amazon Builders' Library, Making retries safe with idempotent APIs.** Supports
treating retries and duplicate side effects explicitly, including request intent.
It does not certify any application in this bundle or provide a universal exactly-once
execution guarantee.

https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/

Only short paraphrases are used; no source text or third-party code is bundled.
The sources were consulted during preparation. The source statements above are
separate from the original Filemón heuristic and the newly designed contracts.

## How to cite this package operationally

Record `mucha-verga-ladder`, package version, rubric version, source evidence, assessed
scope, environment, and observation window. Do not cite a passing local validator as
proof that a real-world claim is true. Hashes in the manifest detect changed files;
they are not digital signatures or provenance certification.

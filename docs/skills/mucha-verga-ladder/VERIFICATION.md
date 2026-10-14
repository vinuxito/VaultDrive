# Verification — package checks, not production certification

## What was actually exercised

The optional checker and its synthetic contracts were exercised with **113 automated
unit/CLI tests**. They cover nine valid examples; every gate losing support or becoming
unknown; stale and uninspected evidence; claim-only support; cumulative rung consistency;
synthetic-versus-observed separation; design-only limits; duplicate identities; authority
separation; blocking risks; Rung 4 workload/steering/consumer conditions; policy defaults;
malformed JSON; duplicate keys; non-finite numbers; UTF-8; input size; symlinks; and
non-mutating command-line behavior.

All 113 passed in the source package and were rerun after extracting the completed ZIP.
No unit-test failure or skip occurred in these recorded runs. The raw final test output
is in [tests/local-test-results.txt](tests/local-test-results.txt).

Both Draft 2020-12 schemas were checked. All nine examples and both JSON templates
passed their applicable contract validation. The core frontmatter, folder/name match,
reference links, local HTML anchors, archive integrity, and checksums were checked.

## Handbook rendering checks

The generated handbook was loaded into headless Chromium from its local HTML bytes
using Playwright `set_content`, then examined at **1440 × 1000** and **390 × 844**.
Chapter filtering, no-results filtering, and in-page navigation were exercised.
No page-level horizontal overflow, JavaScript error, or external network request was
observed in those checks. Desktop and mobile-width screenshots were visually inspected.
These are browser-layout checks, **not tests on a physical phone or a target app**.

Evidence: [desktop screenshot](assets/handbook-desktop.png),
[mobile-width screenshot](assets/handbook-mobile.png), and
[machine-readable run report](VERIFICATION.json).

## Preserved environment interruptions

The first browser harness attempted a local `file://` navigation. The installed
browser rejected it with `ERR_BLOCKED_BY_ADMINISTRATOR`. A second attempt used a
short-lived loopback HTTP server and received the same environment-policy rejection.
Neither attempt reached the handbook. The server process ended; no server is bundled
or needed by the handbook.

The harness was changed to render the already-local HTML bytes directly, without
changing browser policy or making network requests. Therefore direct file-URL opening
in this container was **not verified**. These two environment failures are not reported
as application defects, and the successful render checks do not erase them.

A review also added an explicit CSS rule for hidden navigation entries so chapter
filtering cannot be defeated by the normal link display style. The final search check
includes a query that must produce zero visible links.

## What these checks cannot prove

A coherent assessment record can contain false declarations. The checker deliberately
does not fetch locators, inspect source bytes, authenticate actors, verify permissions,
measure real performance, enforce budgets, or certify business/legal correctness.
Passing its schema and rules is not authority to execute, and not evidence that a
real application achieved a rung. An explicit test demonstrates this limitation.

None of Evinux, QuantiX, NanoRed, PIPC, Filemón Office, a live repository, a production
database, or a user's device was accessed or changed. No skill discovery was tested
inside a target agent runtime. Only the current container Python environment and
Chromium rendering were exercised, not every supported Python/OS/browser combination.
All **48 live deployment acceptance scenarios remain NOT RUN**.

## Integrity and reproduction

[SHA256SUMS.txt](SHA256SUMS.txt) covers every packaged file except itself. These hashes
help detect changed files; they are not signatures, evidence authenticity, or proof
of trustworthiness. The ZIP was checked for invalid paths, symlinks, unexpected script
installers, and corruption, then extracted and tested again.

Use the direct Python commands in [INSTALL.md](INSTALL.md) for optional local checks.
The Python checker requires an already available `jsonschema`; it installs nothing.
The handbook, Markdown, and templates are usable without Python.

# Adaptation and portability

Start with the host's actual user task and canonical owners. Use this inventory to decide what needs changing. Do not copy a domain's route names, financial rules, server paths or credentials into another application.

| Adapter | Establish before implementation |
|---|---|
| Dataset/tenant | Authorized actor, organization, scenario and any immutable data revision. Server authorization is independent of the client's view token. |
| Row identity/grain | A stable key and whether a row is a document, line, transaction or grouping. Counts must label that grain. |
| Page owner | Exact filters/order, tie breakers, supported page/window size, source coverage and missing-source semantics. |
| Aggregate owner | Same normalized membership rules; whole-filter facts distinguished from page/selection facts, with precision and currency policy. |
| Row actions | One understandable contextual next step, organized utilities, owner operation, permission and observable receipt/state. |
| Optional parts | A small registry of triggers, owners, scope, readiness, failure and invalidation. They need not be named totals/navigation/payments. |
| View lifecycle | Filter/sort/page/tenant/scenario changes, domain mutations, leaving/restoring a page and stale requests. |
| Theme/layout | Host tokens, available container size, column priority, accessible full detail, density and mobile structure. |
| Agent/API | Bounded query/readiness observation, authorized operations, structured refusal/errors and retrievable receipt/state. |

Prefer the current server-rendered or client-rendered architecture if it can satisfy the outcome. Profile before deciding whether an index, query rewrite, pagination, virtualization or payload reduction is warranted. A small table with expensive enrichment can be slower than a much larger simple list.

A portable core means the contracts and decisions transfer. It does not mean a PHP query, DOM selector or CSS cascade can be pasted into every host. The included example uses dependency-free browser APIs and a simulated in-memory owner; React/Vue, PHP, Java, Python or other applications should implement equivalent behavior through their maintained components.

## Install and share

Unpack the portable archive so `premium-large-data-grid/SKILL.md` and its resources stay together. From that folder:

```bash
python3 scripts/install.py --project /absolute/existing/project --mode symlink
python3 scripts/install.py --global --mode copy
```

Project mode creates Agents/Claude discovery entries. Global mode uses the configured Codex home's `skills/` and the current user's `.agents/skills/`. If an agent platform has another discovery convention, place this complete folder there; `agents/openai.yaml` is optional UI metadata, not a runtime dependency. Markdown instructions can be used directly by other agents.

The installer checks all requested targets first, preserves different existing files/copies/links and never silently replaces them. Matching symlinks or identical requested copies are idempotent. It does not alter agent configuration. Inspect any different installation before updating it. Source must remain available for a symlink; a standalone copy has no dependency on the original server.

To install several sibling skills together, repeat `--skill /absolute/skill-folder` with `--project` and/or `--global`. A standalone Quantix adapter also needs its sibling portable core; the portable archive itself needs no Quantix files.

Use `scripts/package.py --skill /absolute/skill-folder --output /new/archive.zip` for a shareable archive. Repeating `--skill` packages a sibling bundle. It refuses an existing output and rejects escaping symlinks or private/generated paths. The full skill folder and relative resource links travel together. Validate the artifact on the receiving system; optional Python 3.9+/Node/browser helpers disclose their actual requirements.

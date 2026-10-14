# Manual installation only

## Inspect, then copy

Unzip with your ordinary file manager. Preserve the directory name `mucha-verga-ladder`
and all its contents. The name matches the required skill frontmatter [S1]. Read
`SKILL.md` before activation; references are loaded as needed, not all at once.

Locate the skills directory actually configured by your agent/runtime. This bundle
does not assume a universal directory, slash-command syntax, operating system, or
permission model. Copy the whole reviewed folder there manually. A custom Filemón
instruction loader may instead reference its explicit `SKILL.md` path. Inspect the
runtime's current documentation when discovery behavior is unclear.

If the name already exists, compare versions and retain the known-good copy. Do not
merge two instruction sets blindly, follow unexpected symlinks, or replace shared
instructions across every project without approval. Install in the narrowest useful
scope. No account sign-in, external registration, telemetry, or background process is
required by this package.

## Confirm discovery without touching production

Ask: “Load `mucha-verga-ladder/SKILL.md`; report the version, four rungs, default mode,
and why a rung is not a permission.” Then request a synthetic example assessment.
This tests discovery and basic understanding, not integration safety.

Do not make this skill a blanket authority override in an agent system prompt. Existing
host instructions, access controls, budgets, safety constraints, and owner approvals
remain binding. Loading prose cannot create runtime isolation or revoke existing tools.

## Optional checks, not installation commands

The docs require no software beyond a text reader or browser. The optional JSON checker
requires Python 3.10+ and an **already available** `jsonschema` package supporting Draft
2020-12. It never installs packages. From the unpacked skill directory, these direct
commands perform local checks:

```text
python -B tools/validate.py assessment examples/04-shared-reader-r4.json
python -B tools/validate.py policy templates/policy.example.json
python -B -m unittest discover -s tests -v
```

`-B` avoids Python bytecode cache files. The checker reads the one explicitly supplied
regular JSON file, its bundled schema, and rubric. It writes only to standard output
and error. It does not follow evidence locators, contact apps, fetch URLs, or modify
input files. Tests additionally use temporary local files for malformed-input cases.
Missing dependencies and invalid files fail with a clear message and nonzero exit code.

An exit code of zero means **contract consistency**, not “safe to deploy.” A valid
assessment can quite correctly report `undetermined`, `hold`, or `containment_required`.

## Updates and removal

Disable the runtime reference and remove the folder manually. There is no service to
uninstall. Keep live assessment records in host-approved evidence storage, not in this
skill folder. An update must preserve historical rubric version and evidence references;
it must not retroactively promote previous assessments.

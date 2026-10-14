# Worked example: a beautiful bounded view

Open [demo.html](../assets/demo.html) in a modern browser. It loads only sibling CSS/JS and has no network/backend dependency. Everything is synthetic: 20,000 deterministic records held by a simulated in-memory owner, 50 mounted rows per page and a small response laboratory. A complete local dataset is convenient for this exercise; a production browser should request its bounded page from the host rather than download all records to imitate this demo.

The example shows a warm daylight canvas, clear filters/context, readable complete money, one contextual detail action plus a utility menu, stable identity, desktop table and labelled mobile cards. It deliberately includes long/Unicode/hostile-looking names, negative amounts, missing descriptions and a very large amount. Rendering uses text nodes; these examples do not authorize arbitrary HTML insertion.

The footer distinguishes whole-filter totals from selected records. Selection survives paging within the same filter scope and clears when that scope changes. The page selector applies only to the mounted page. Whole-filter money is computed by the simulated owner after useful rows paint; while unavailable it remains pending/unknown instead of showing the page sum or zero. The synthetic amounts use safe bounded integer cents; host decimal/currency rules remain their owner's responsibility.

Try these journeys:

1. Search/category, apply/reset, page forward/back and select/clear rows. Open full detail and the row menu; use Escape and outside click.
2. Choose a slow auxiliary delay, reload totals, then change the filter while the old response waits. Its generation/scope must not replace the new view.
3. Arm “Fail next full-total request,” reload and recover with local retry. Rows remain available; total facts are cleared.
4. Open supporting summary to observe on-intent work. Empty matching results have a valid zero/empty state distinct from a failed read.
5. Inspect mobile labels, focus and every monetary digit. The controls have no approval/export/business write.

`window.gridDemoDiagnostics.snapshot()` provides a bounded observation: dataset/page size, current generation/filter scope, mounted rows, selected count/cents, current total, readiness and ignored late responses. `synthetic-v1` is the exercise's immutable dataset identity; it does not demonstrate a host revision/CAS protocol. The diagnostics are not authentication or financial authority.

## Optional focused helpers

Python 3.9+ standard library:

```bash
python3 scripts/generate_fixture.py --rows 10000 --output /existing/folder/new-rows.jsonl
python3 scripts/test_helpers.py
```

The generator streams deterministic JSONL and refuses existing output. It uses a generic fixture schema, independent of the demo's private simulation; map it to a host adapter before importing. A million generated lines proves generation only, not a million mounted rows or server throughput. Helper tests use isolated temporary folders and do not touch application files or a database.

The optional offline browser exercise requires Node.js, a resolvable Playwright package and a usable Chromium/Chrome. With those already available:

```bash
PLAYWRIGHT_MODULE_DIR=/path/to/node_modules CHROME_PATH=/path/to/chrome node scripts/test_demo.cjs /tmp/new-grid-demo-proof
```

Omit the environment overrides when module/browser discovery works. The output directory must not exist. It records focused checks and screenshots at 1440×1000 and 390×844; it never opens the host app. Missing dependencies or sandbox launch restrictions remain explicit limitations. Installing software or changing browser sandbox policy is a separate host/task decision; do not bypass approval boundaries to make this optional exercise green.

The browser exercise checks bounded DOM, stable IDs, one action/menu, filter/selection semantics, full digits, stale result rejection, failure/retry, safe text, empty state, mobile and zero HTTP requests. It does not certify screen-reader conformance, native Android, server scope/auth, real receipts, database/query scalability, p95, concurrent users or complete production QA. Port the method through host owners and verify those concerns where required.

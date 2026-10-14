# Lessons from the NanoRed build and live walk

These observations were recorded on **2026-10-03**. They explain this skill's decisions; they are not current verification results for another installation.

NanoRed implemented a read-only PHP workspace using existing spreadsheet libraries, native browser PDF display with bounded text extraction, and safe XML/CFDI parsing. It exposed one authenticated representation for people and agents, private uploads, registered sources and existing reports. No new spreadsheet suite was needed for that baseline.

The initial feature was `5a77e344`; the representative-file fixes were `a12db618`, with delivery receipt `4ebaf058`. Those commits belong to NanoRed. Reuse the approach rather than requiring another project to fetch these commits, use its routes or inherit its permissions.

## Failure cookbook

| Observed symptom | What reality showed | Smallest supported response |
| --- | --- | --- |
| Empty inspector rectangle while DOM fields existed | host `main` had `contain: layout`; dialog y=-399, Copy y=-47, Close y=-369 | move viewport inspector to body/overlay root; re-scope CSS; verify pixels and reachable controls |
| Inspector lost styling after moving it | styles depended on `#filemon-office` ancestry | move component variables/buttons/theme/mobile rules to an inspector-scoped selector |
| Mobile bottom sheet left a side gap | browser dialog default max-width constrained explicit width | inspect UA/computed rule; add component-scoped max-width correction and measure both edges |
| Right-edge geometry check failed after the fix | 15px scrollbar; innerWidth=1912, content edge=1897 | compare to clientWidth; preserve evidence of actual geometry |
| File chooser appeared to fail for a valid invoice PDF | tool reported unsupported activation with no effect; drop worked; later chooser also worked | verify the tool result, follow its permitted no-effect fallback, then confirm app name/hash/kind |
| PDF-original assertion failed on reopening | remembered Text mode was restored correctly | choose Document explicitly, prove original rendering, retain persistence behavior |
| Boundary message looked absent | reason was in the visible error panel; status region held only the headline | inspect the explanatory surface before changing error semantics |
| Narrow-window tests were accidentally desktop tests | requested resize left viewport at 1912px | read actual dimensions; use supported emulation and label it accurately |
| .xls files did not open with the legacy reader | all six reviewed .xls files were ZIP/XLSB with xl/workbook.bin | detect package contents; return explicit unsupported-XLSB conversion guidance |
| Large dashboard could not preview | 25,820,082 bytes, 17 sheets and 162,949,250 expanded bytes exceeded chosen 20 MiB/128 MiB bounds | preserve bounded rejection; design a separate progressive/worker solution before changing limits |
| An expected August Reportes link was not found | latest 20 listed packs were June; August artifact existed on disk | use observed catalog links; distinguish protected artifact-route proof from catalog visibility |
| A QA helper silently ignored native action failures | wrapper returned command stdout without enforcing inner success | check CLI and structured results, then assert the actual state change |
| Several successful assertions ended with a nonzero process | QA selector syntax threw afterward | retain the aborted run and execute only the corrected missing proof |
| Debug export looked like comprehensive telemetry | debugger had detached and 177 operations were dropped | label capture partial; use fresh scoped proof for later flows |
| CLI/web shared storage became a permission problem | runtimes used different Unix identities; ACL/token route was rejected | retain private per-runtime stores; do not bypass the rejected boundary |

## What the real files established

Eight real documents opened: a BAIT workbook, a SIM assignment workbook, a formula calculator, a five-page PDF, BOM-encoded CFDI XML, its one-page PDF, and existing June/August reports. The largest SIM sheet contained **58,003 rows**; named 100-row windows at rows 1 and 101 were exercised. Tested visible values matched agent JSON. Native citation copy and unchanged PDF download bytes were verified.

The reader unit suite finished **27/27** without opening the database. Eight originals with prior hashes ended unchanged. These are scoped historical results, not a claim that every cell, formula, page or production path was exercised.

The final responsive inspector proof used **Chrome desktop emulation at 427×820**, with a full-width modal, native copy and Close. It did not establish physical Android chooser, touch/framebuffer or Back acceptance. An earlier Android CDP walk also remained separately scoped. The public HTTPS host served fixed JS/CSS bytes with matching hashes, but an authenticated owner session was unavailable. Loopback used live code/DB with disposable staff accounts; Apache/FPM/HAProxy and owner acceptance remained distinct.

The full test suite was explicitly deferred until the owner personally tested live. The agent walk did not lift that gate. Four disposable accounts and ten owned temporary files were removed; only owned browser/server resources were stopped. Sensitive real-file captures remained private outside Git.

## Transfer principles, not accidental defaults

- Choose the target project's branch/release policy; NanoRed's main-only rule is not universal.
- Choose its principal/tenant/storage policy; temporary session uploads are one supported model.
- Choose limits from its workloads and infrastructure; do not blindly promise 20 MiB, one hour, five uploads, 100 rows or 64 columns.
- Reuse its installed readers, UI and API conventions; PHP, its route names, root path and role strings are not prerequisites.
- Preserve its current user's acceptance and test gates; NanoRed's test deferral is an example of honoring an explicit instruction.
- Verify its own environment and actual files. Familiar symptoms suggest probes, not a diagnosis or permission to modify infrastructure.

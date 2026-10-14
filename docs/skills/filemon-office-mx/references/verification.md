# Verification without borrowed acceptance

## Decide the allowed lane

Use the target project's approved browser, API and test facilities. Inspect the actual user's gates before executing tests or external changes. A full-suite deferral remains in force after an agent walk; only the user's stipulated acceptance can lift it. A read-only recon request permits inspection, not implementation or data changes.

Identify the tested code revision, runtime, storage identity, database/environment and browser/device. A loopback server using live code and DB proves that lane; it does not prove public HTTPS authentication, proxy behavior, web-worker ownership or owner acceptance. Record those differences instead of claiming production equivalence.

Use owned browser/device sessions and isolated or specifically authorized disposable QA resources. Establish cleanup ownership before creating them. Do not reuse another task's account, device, server or browser session without the applicable authority.

## Minimum meaningful matrix

Select cases for the implemented scope; mark absent fixtures/authority as not evaluated.

| Claim | Positive proof | Negative/recovery proof |
| --- | --- | --- |
| Upload | actual chooser/drop accepted; intended name/hash/kind ready | CSRF, upload error, limit, rejected file, no retained orphan |
| Scope | authorized source/report resolves exact tenant/version | anonymous, role, cross-session, cross-tenant, ambiguous selector |
| Original | actual browser download SHA equals baseline bytes | seal mismatch refused; conversion cannot inherit source identity |
| Spreadsheet | real sheet/window, stored values, formula notice and cell citation | absent cache, bounds, unsupported XLSB, reload/cursor preservation |
| PDF | painted original and text/page representation when available | unavailable text, native-viewer fallback and malformed input |
| XML | BOM, escaped source, namespaces and stable repeated-node paths | DTD/XXE/network/entity guards and parse failure |
| Inspector | painted fields, reachable Copy/Close, actual copy confirmation | containment, scrollbar edge, long content, Escape/focus recovery |
| Existing entry | observed attachment/report link opens existing artifact | missing/expired/changed artifact; no accidental Generate/Import |
| Agent parity | tested visible values and locations equal JSON | same unauthorized reads fail; exact cursor/scope retained |
| Mobile | actual device if required; painted/touch/keyboard/Back evidence | failed picker, navigation/focus/recovery and persisted position |
| Cleanup | owned accounts, files, sessions and servers removed | unrelated resources preserved; audit policy respected |

Test actual representative files in addition to safe synthetic fixtures. Include the large sheet, not only a workbook's small summary. For huge data, sample named windows and disclose that coverage rather than claiming every cell was read. Preserve original baseline hashes before the walk and compare the same set afterward.

## Browser tool reliability is part of the proof

Read the current browser tool's instructions; do not hard-code one automation backend into another project. Observe current controls before acting and validate both command exit and structured result. Some wrappers return stdout or exit 0 even when the inner operation failed; an evaluated promise/exception may require inspecting `.ok` or equivalent.

Wait for the intended document identity, name/hash/kind and final ready state, as well as `aria-busy` or the project's loading signal. A previous ready document or a neutral page is not the new upload's completion. Check that the action itself happened before blaming app state.

When an upload reports **no effect**, follow the tool's documented retry path; a single explicit drop-zone fallback may be appropriate. An unknown or committed effect is not permission to resend. Do not bypass a tool's chooser/consent restrictions with direct file injection, a different browser backend or a new token. Separately report chooser activation, drop dispatch and application acceptance.

Verify the resulting viewport. A resize command can be accepted while a maximized window remains unchanged. Label supported emulation as emulation. A desktop emulation, Android DOM, Android CDP screenshot and physical framebuffer/touch/Back exercise prove different things; retain those labels even when dimensions match.

For clipboard proof, invoke the real control and observe its success/error announcement. Avoid reading existing private clipboard content. If inspecting the just-written citation is necessary, restrict that read to the value produced by the authorized test.

For blank inspectors, collect geometry, computed ancestor styles, modality, stacking, visible control positions and private screenshots. A DOM node with `open` and populated fields can still have all controls above the viewport. Do not call it a compositor artifact without evidence.

## Captures and performance

Start capture before the reproduction when the tool supports it. Track capture start/stop, detached debugger, dropped operations/requests and uncaptured workers. A partial export cannot support a claim of complete network or console coverage. If the capture ended, reacquire valid capture using the allowed tool or mark the remaining coverage gap; do not substitute old telemetry.

Measure parser/server, HTTP roundtrip and end-to-end opening separately, with cold/warm state and workload identified. CLI automation overhead is not server latency. A quick screenshot does not establish 60fps; one success does not certify a percentile budget. Use the project's requested metrics and truthful sample scope.

## Evidence and closing

Keep sensitive real-file screenshots, document bodies and debug exports private with appropriate permissions. Shared Markdown/HTML/JSON should contain only authorized metadata, counts, redacted evidence and hashes; leave cookies, tokens, upload IDs, business cells and fiscal content out unless explicitly authorized for that audience.

Record each relevant verification's command, code revision, exit, result and scope. Preserve meaningful failed attempts and their targeted rechecks. A process with ten passing assertions followed by an exception still exited nonzero. Do not add overlapping attempts into a fictional total or replace failed records with the final summary.

Report implementation, focused technical verification, owner acceptance and deployment as separate states. When requested, produce a readable memory, self-contained HTML report, Markdown matrix and README alignment. Confirm cleanup and Git/push receipts. Never claim a clean whole tree while unrelated preserved work remains; say that owned changes are committed and identify the preserved remainder.

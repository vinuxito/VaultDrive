# Document authority, parsing and parity

## Resolve origins through authorized adapters

For each origin, define principal/scope checks, identity and lifecycle:

| Origin | Authority | Identity / lifetime |
| --- | --- | --- |
| Own upload | authenticated principal; session/tenant policy; CSRF on browser writes | opaque ID, immutable hash, configured quota/expiry |
| Existing attachment/source | existing catalog permission and tenant/company ownership | catalog ID and registered hash/version |
| Generated report | report/download permission and exact company/period/version | selected existing artifact, not a regeneration trigger |
| External source, if requested | explicit integration and scoped credentials | approved source/version and locally verified bytes |

Authenticate and authorize preview, machine representation, inline original and download independently. Re-resolve the identity on each request. Avoid sensitive file-existence disclosures across principals. Use project-appropriate status codes and human recovery messages.

Apply the project's private/no-store policy to sensitive responses; any server-side representation cache must include the authorized scope, original version/hash and view cursor. If external URL retrieval is requested, constrain origins, redirects and network targets to the approved integration instead of exposing arbitrary server-side URL fetching.

Reject arbitrary filesystem paths, ambiguous selectors and unexpected parameter shapes. Filesystem adapters should resolve and validate real paths within allowed roots; handle symlinks, ownership and read permissions according to the storage model. Object-store adapters should enforce the equivalent bucket/key/version/tenant boundaries. Do not impose filesystem ownership rules on a system that deliberately uses object storage.

Verify a registered artifact against its stored seal. Hashing the current file without a prior registered expectation creates a current identity; it does not certify historical integrity or a report-pack manifest. Preserve that distinction in UI and API claims.

## Publish uploaded originals safely

1. Validate the request, scope, upload state and configured byte limits.
2. Inspect unsupported/unsafe contents before making the upload available.
3. Retain the original privately with a random identifier and immutable hash.
4. Publish the record only while the principal/session identity still matches.
5. Remove unpublished/rejected originals and collect only resources owned by the applicable lifecycle policy.

In runtimes with locking sessions, avoid holding the shared session lock during heavy parsing. Snapshot the identity/authorization material needed for validation, release the lock, parse, then briefly reacquire and verify that logout or principal change did not occur. Ensure failure between storage and publication cannot leave an unbounded orphan.

CLI QA and web workers may run under different users. Check the actual runtime; use private storage boundaries suited to it. A chmod/ACL change or new token is a separate infrastructure action, not an implied parser repair.

## Format facts before file extensions

| Signature / structure | Meaning | Decision |
| --- | --- | --- |
| OLE compound file with workbook streams | possible BIFF XLS, encryption or active content | use the installed reader's structural validation and policy |
| ZIP with `xl/workbook.xml` | OOXML workbook candidate | validate package, entry/expansion limits and active-content policy |
| ZIP with `xl/workbook.bin` | XLSB, even under `.xls` or `.xlsx` | use an explicitly supported bounded reader or give a conversion instruction |
| `%PDF-` | PDF candidate | parse/read with bounds; magic alone does not prove valid rendering |
| XML after encoding/BOM handling | XML candidate | parse safely and identify namespace/structure |

Changing a suffix does not convert a format. When conversion is authorized, keep the source intact, identify the converted artifact with its own hash, and retain source-to-derived lineage. Never present the converted bytes under the original hash.

Configure bounds for file bytes, decompressed bytes, archive entries/ratio, cells/columns/rows per response, XML nodes, parser time/memory and extraction output. NanoRed's 20 MiB file, 128 MiB expansion, 100 rows and 64 columns were one product's choices. Select and expose limits that fit the target project's workload and infrastructure; do not silently raise them to satisfy a large-file demo.

## Format semantics

**Sheets:** distinguish raw/stored/displayed values and formula text. In a read-only cached-value reader, never invoke formula evaluation, external workbook links, data connections or macros. A missing cached result is unavailable, with its reason; it is not zero. State which formatting, merged cells, charts and richer layouts the chosen renderer preserves. Metadata discovery may scan more than the displayed window; verify memory/time on the actual large workbook.

**PDF:** serve inline/download only after authorization, with correct MIME, disposition, cache/privacy headers and origin/frame policy for the embedding model. Prefer a full-tab original fallback that does not require exposing a file path. Run extraction with safely passed arguments, timeout and output/memory limits. Preserve page separators and partial/unavailable reasons. Native rendering, text extraction, OCR and signature checks are separate capabilities.

**XML:** disable network resolution, DTD/entity expansion and external entities. Render source and values as inert escaped text. Bound nodes and text; preserve namespace URI and repeated-element indexes in locators. Handle BOM/declared encoding consistently. Generic XML must not acquire a fiscal identity by filename alone.

**CFDI/MX:** show document facts when the structure is recognized. Preserve identifiers as strings and locale-appropriate number display. Parsing does not prove SAT status, signature validity, timbrado, accounting acceptance or legal authenticity. Expose those states as unverified unless separate evidence supports them. Viewing must not submit, stamp, reconcile or import anything.

## Shared representation

Adapt names to the project's API conventions. Preserve these meanings:

```json
{
  "identity": {"document_id": "opaque authorized reference", "sha256": "original SHA-256", "version": "when applicable"},
  "origin": "upload | attachment | registered_source | generated_report",
  "name": "safe display filename",
  "kind": "sheet | pdf | xml",
  "bytes": 0,
  "readonly": true,
  "capabilities": {"preview": true, "download": true, "text": true},
  "limits": {"page_rows": 100, "columns": 64},
  "notices": [],
  "content": {},
  "citation": {"sha256": "same original hash", "locator": "sheet/cell, page, or namespace-aware XML path"},
  "links": {"document": "authorized reopening route", "json": "same view", "original": "authorized bytes"}
}
```

This is a shape example, not a schema to copy literally; the illustrative zero is a numeric type sample, not a default for unknown size. Normalize unavailable values explicitly. Do not return server paths, parser traces, session secrets or document content to an unauthorized caller.

For sheet windows include sheet identity, start row, bounded rows/cells, explicit refs such as A101, has-more/next cursor and total extent when known. Cursors must preserve the selected document scope and version. JSON links/citations must describe the currently displayed window, not silently reset to its first block.

For PDF citations retain page identity; for XML use unambiguous namespace-aware paths. Copying a citation should include original identity and the exact selected location. A hash establishes bytes, not correctness of a derived calculation or authenticity of a fiscal document.

Keep machine access within the same existing authentication/scope model. Introducing API keys, delegated agent identities or elevated tool permissions is an additional requested capability, not a shortcut around the application's session rules.

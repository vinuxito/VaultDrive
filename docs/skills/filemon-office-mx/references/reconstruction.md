# Reconstruct the project's own Office

## Discovery output

Produce a small project-specific contract before implementation. Fill it from observed code and files, rather than copying NanoRed's constants:

| Decision | Evidence to collect | Result to choose |
| --- | --- | --- |
| Authority | authentication, tenant resolution, attachment/download rules | permission checks for every document operation |
| Origins | upload handlers, attachment catalog, existing exports | adapters into one document contract |
| Formats | byte signatures and representative content | support table with explicit limitations |
| Lifetime | storage ownership, retention obligations, user request | temporary or persistent originals and cleanup scope |
| Resources | real file sizes, ZIP expansion, parser memory/time | bounded limits and large-file strategy |
| Experience | current shell, theme, mobile controls, locale | workbench that belongs in this application |
| Agent access | existing authenticated API/tool paths | equivalent authority and citable representation |
| Acceptance | user instructions, environment and safe QA lane | allowed checks and unwaived gates |

A large workbook may have a short summary and tens of thousands of rows on another sheet. Inspect all sheet metadata before selecting test cases. Include formula-heavy books, BOM XML, paired XML/PDF documents and existing exports when available. Use only authorized files; keep their contents out of shared reports.

## Architecture boundary

Prefer the existing project's equivalents of these responsibilities:

```text
Upload / Attachment / Existing report
                  |
        authorized origin resolver
                  |
       immutable original + identity
                  |
         bounded format inspection
                  |
       normalized document contract
              /          \
     human workspace    agent JSON/tools
                  |
       authorized original/download
```

These are responsibilities, not mandatory new classes or services. Reuse existing utilities and permissions. A frontend renderer does not replace backend authorization, integrity or parser limits. An agent endpoint does not become a privileged alternative to the human endpoint.

## Incremental sequence

Adapt these stages to the stack and requested scope. Preserve prerequisite order: authorization and storage boundaries precede parsing; a proven format slice precedes additional formats; integrations precede claims about those integrations. Keep the user-facing loop working after each completed slice.

### 1. Freeze scope and evidence

Inventory current routes, readers, actual file signatures and baseline original hashes. Define the support/fidelity table and configured limits. Separate viewing from editing, conversion, import, recalculation and external validation.

**Proof:** named representative cases, known permission boundaries, a precise unsupported-format policy and a reversible change scope. Identify full-suite, live-account and infrastructure gates from the current user's instructions.

### 2. Implement authority and original lifecycle

Connect to the application's authentication, scope and CSRF conventions. Resolve opaque upload IDs or authorized catalog/report references through a trusted adapter. Keep originals outside public paths; configure quotas, expiry and collection for temporary uploads. Define who owns temporary resources and how to remove only those resources.

**Proof:** anonymous, insufficient-role, cross-session and cross-tenant reads fail appropriately; caller-supplied paths and integrity mismatches fail; one authorized original downloads unchanged. Verify no temporary file remains after rejected parsing or failed publication.

### 3. Deliver one complete spreadsheet slice

Choose a supported real format based on the discovered readers. Connect file selection, inspection, sheet metadata, bounded row/column windows, stored cell formatting, formula/cache semantics, inspector and original download. Handle sparse/empty ranges honestly.

**Proof:** a real workbook opens, the largest relevant sheet can be selected, next/jump/reload preserve the intended cursor, every tested visible cell matches JSON, and copying a location produces a sealed reference. Test legacy BIFF or XLSB only when actually supported; document absent representative coverage.

### 4. Add PDF as an original-first reader

Embed the authorized original with browser-appropriate MIME and disposition, plus an explicit full-tab fallback. Add bounded text extraction when the project has a suitable tool. Distinguish extraction from OCR; retain page boundaries for citations.

**Proof:** painted original, text mode when available, a readable no-text state, page reference, fallback and a browser download whose hash matches the original. A native viewer in one browser does not establish mobile support.

### 5. Add XML and optional CFDI interpretation

Detect encoding/BOM before classification. Parse with network, DTD and external entities disabled. Render escaped source and bounded nodes with namespace-aware, unambiguous paths. Recognize CFDI when its structure and namespace support that classification; unknown XML remains a generic document.

**Proof:** BOM and namespace cases read accurately; repeated nodes have distinct locations; hostile XML is rejected; source equals the authorized representation. A CFDI summary labels SAT/signature validation as unverified unless a separate authorized validation actually occurred.

### 6. Integrate existing document entry points

Add contextual opening actions to the host application's real attachments, source catalog and existing reports. Preserve the scope chosen by those flows. Open an existing artifact without invoking its generation or import operation. Avoid an additional catalog or menu when the current one fits.

**Proof:** follow observed links, verify the origin/hash/scope, and handle expired, missing, changed or unsupported artifacts without presenting stale data. Inspect actual URL shape and catalog pagination instead of assuming every on-disk report has a visible link.

### 7. Complete agent parity and continuity

Expose the same bounded representation through the project's authenticated API/tool contract. Include immutable identity, origin, limits/notices and stable citations. Restore only view preferences; authoritative permissions and file resolution stay on the server. Explicit link cursors should take precedence over saved preferences.

**Proof:** human and agent values, locations and scope agree; reload and copied-link reopening restore the intended location; another principal cannot use the link as an access grant.

### 8. Walk realistic journeys and negative paths

Exercise chooser/drop, supported views, sheets/pages/nodes, copy, download, reload and recovery. Use owned browser/device sessions and disposable data where appropriate. Measure actual viewport geometry, controls and pixels. Recheck outcomes after every material UI change.

**Proof:** meaningful assertions and observed effects, console/network coverage with stated limits, immutable original hashes, and the minimum focused tests that verify changed behavior. Keep owner acceptance and full-suite gates intact.

### 9. Review the boundary and simplify

Review permission equivalence, path containment, parser bounds, process/session ownership, format claims, UI layering and evidence privacy. Use an independent reviewer when available and warranted. Correct demonstrated issues before adding more formats or dependencies.

**Proof:** no unresolved critical issue in the changed scope; regressions target the failure that occurred. Structural tests alone cannot close a painted-UI defect.

### 10. Close with a truthful handoff

Write the requested readable memory, Markdown/HTML verification report and README changes. Preserve original evidence and disclose retries without adding overlapping assertions into an inflated total. Clean owned temporary accounts/files/servers/browser sessions. Follow the project's Git/deployment instructions and record actual receipts.

**Proof:** original-hash comparison, owned-resource cleanup, exact validation scope and exits, committed changes where authorized, verified push/deployment where performed, and remaining acceptance gates. Never transfer this project's green results as proof for another project.

## Plan file shape when requested

Create an index linking each stage file and an execution ledger. Each stage should contain:

- Concrete resulting behavior and prerequisites.
- Existing modules/adapters to reuse and files owned by the change.
- Implementation order, authorization boundary and deliberate exclusions.
- Positive and negative proof, with commands adapted to the actual environment.
- Failure/recovery path, temporary-resource cleanup and exit condition.
- Status and evidence links; distinguish implementation, verification and owner acceptance.

Use the number of stages the actual assignment needs. Do not add empty steps to satisfy this reference's example count.

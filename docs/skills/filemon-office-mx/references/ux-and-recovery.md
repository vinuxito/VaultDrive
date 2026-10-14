# A workspace that keeps effort low

## Human journey

Use the host application's language, tokens and navigation. Support the actual routes users already know: choose a file, drop one where the browser supports it, open an existing attachment, or open an existing report. State temporary lifetime, limits and read-only semantics where they influence the action.

After opening, show enough identity to establish trust: name, origin, format, size, shortened hash with access to the complete identity, and expiration when applicable. Use format-specific controls:

- Sheets: actual sheet names, row windows, jump, local search, selected-cell inspector and stored formula/cache explanation.
- PDF: original view, full-tab fallback, text view when available and page references.
- XML: readable facts when recognized, tree, escaped source and node references.

Put citation, agent JSON and original download where they help the user. Explain whether search covers only the visible block or the whole document. Preserve exact cursor/share behavior so returning to a document requires little reconstruction by the human or agent.

## Inspector mechanics

Choose a desktop side panel and mobile modal/bottom sheet when they fit the host shell. Validate the rendered result inside that shell, not only in a standalone mockup.

**Containing blocks matter.** An ancestor with `contain: layout`, transform, filter or other containment can reposition/clip a fixed descendant. Collect actual computed ancestor styles and bounding rectangles before attributing a blank panel to the browser compositor. If the inspector belongs to the viewport, a body/overlay-root portal can escape the containing block. Then scope its variables, buttons, focus states, themes and responsive rules to the moved component; descendant selectors under the former root no longer apply.

Choose the stacking level against the real sticky header/drawers. Desktop nonmodal panels should leave intended underlying navigation operable. A mobile `showModal()` dialog belongs to the top layer and intentionally makes the page inert. Keep Close/Escape, accessible heading, sensible focus entry and focus restoration coherent with that mode.

Measure visible control bounds. At the right edge, compare with `document.documentElement.clientWidth` when a vertical scrollbar consumes space. `innerWidth` can include that scrollbar. Browser dialog UA `max-width` may override the intended full-width bottom sheet; inspect computed rules before applying a component-scoped correction. Bound long content with appropriate scrolling and keep essential controls reachable.

A painted panel is not proof that copying succeeded. Use the actual Copy control and wait for the application to confirm the write. Diagnose focus, secure-context and clipboard rejection separately. Reuse the project's supported fallback only when a genuine Clipboard API problem warrants it; preserve focus and cleanup if adding a temporary fallback element.

## State and loading

Make pending, ready and error states distinct. During asynchronous loads, show which document is being prepared and prevent accidental duplicate submission. Cancel or supersede outdated loads so an earlier result cannot overwrite a later selection.

Preserve view preferences keyed to document identity and, where appropriate, principal/scope: sheet, row, selection, zoom, mode and page. Keep document payloads and secrets out of browser storage. Server authorization is always authoritative. A new link's explicit location should override old preferences.

Restoration can legitimately reopen PDF text mode or a previously selected sheet. QA should choose the mode it intends to test instead of calling persistence a rendering defect. Restoring a position is different from automatically claiming that every part of the document was reviewed.

## Recoverable failures

Give a short headline and a specific cause/action in a visible error panel. Clear stale document data and actions when a new document fails. Preserve a valid prior reference separately if the user should be able to return safely.

| Failure | Useful message/action |
| --- | --- |
| Temporary file expired / another session | choose the file again or sign in appropriately |
| Source hash differs | explain identity mismatch; direct to source/version review |
| XLSB unsupported | save a copy as XLSX; renaming the extension will not convert it |
| File exceeds configured limit | state the actual limit; offer an authorized smaller/cut-down copy |
| Encrypted / active workbook | explain the unsupported protection/content policy and safe copy option |
| PDF contains no extractable text | original view remains available where supported; do not invent OCR |
| Native embedded PDF blank | full-tab original or text view, with browser capability stated honestly |
| Generic / unfamiliar XML | keep safe tree/source reading without fabricated CFDI facts |
| Network/parser timeout | retry when safe, retain original integrity, avoid false ready status |

A cause can live in the error panel while the status region announces only the headline. Verification should inspect the actual explanatory surface. Error recovery actions do not authorize wider access, automatic conversion, import or generation.

## Agent effort is part of UX

Provide predictable fields, typed unavailable states, explicit limits, cursor/has-more information and citations to the exact representation. A caller should not need to scrape decorative HTML, guess a tenant, infer a default period or recover a page from filenames. Preserve user/agent authority equivalence while making permitted reading straightforward.

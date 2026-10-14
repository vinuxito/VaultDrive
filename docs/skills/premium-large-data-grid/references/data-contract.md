# Page, aggregate and readiness contracts

Map these roles to the host's naming and schema. This is an architectural contract, not an instruction to expose a new endpoint or change a frozen API. Add optional routes/fields where required and preserve existing clients.

A page request identifies actor-authorized dataset/tenant/scenario, normalized filters, sort with stable tie breakers, row grain and page/cursor/window. Validate types, ranges and supported operations on the server. Never concatenate client filter text into SQL. Row IDs survive sorting, selection and re-render; an index in the current DOM is not a durable identity.

A page response contains row membership and known row values, pagination bounds, declared counts/coverage and view identity. Use an explicit exact/estimated/unknown count policy. If counts are expensive, do not silently replace an exact count with an estimate; change the interface contract transparently. Expensive row enrichment should operate on selected page identities when equivalence can be proven.

A supporting read returns the same view identity, part name, observation time, optional dataset revision, source status, known values and limits/errors. For example:

```json
{
  "viewId": "opaque-normalized-query-identity",
  "part": "filteredTotals",
  "observedAt": "2026-10-13T03:00:00Z",
  "dataRevision": null,
  "sourceStatus": "ready",
  "values": {"currency": "USD", "amountMinor": "120050"},
  "limits": ["This read has its own snapshot"]
}
```

Identity binds a result to a query; it is not authentication, authorization or a signature. Authorize the authenticated principal for every read/action independently. Keep actor scope and source metadata bounded. Do not accept arbitrary HTML from a user/model/API response; prefer typed data and escaped rendering. A maintained, escaped, same-origin canonical partial is a separate narrowly trusted adapter, not a generic HTML permission.

Whole-filter totals, visible-page totals and selected-row totals are distinct facts. Label which is displayed. Clearing selection restores the verified full-filter snapshot, not a sum of whichever rows are mounted. Multi-currency datasets aggregate by currency or a documented canonical conversion policy. Preserve host decimal precision; the sample uses bounded integer cents only for synthetic teaching. JavaScript unsafe integers or floating point arithmetic must not silently replace the business engine.

Use interface states pending/loading/ready/error separately from source states unknown/partial/not-applicable. `ready` means the interface part is available, not that all business evidence is complete. Unknown is nullable, not zero. Empty can mean no matching data only after a valid authorized read established it. Show the smallest recoverable error in its surface while keeping usable rows.

Before applying a result, check the current document/mount, generation, view identity, dataset/scenario, part and expected payload shape. Abort obsolete requests where available; still reject stale responses because abort alone does not guarantee cancellation. Invalidate facts after domain mutations and context changes, including restored browser pages. Retry must respect the same scope and cannot replay a non-idempotent writer without its owner protocol.

A view hash and equal row count do not establish freshness. Independent reads may observe different snapshots; a same-count monetary change is invisible to a count check. Prefer a canonical dataset revision/CAS strategy when the host requires consistency. If unavailable, disclose separate observation times and offer refresh instead of claiming atomicity. An agent's browser readiness snapshot is untrusted presentation context and grants no business authority.

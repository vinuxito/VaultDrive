# TICKET-2026-11-15-AGENT-V1-WIRE-OPENAPI-SYNC — API v1 Envelope Normalization & Live OpenAPI Parity (`v26-agent-v1-wire-openapi-sync`)

- **Ticket ID:** `TICKET-2026-11-15-AGENT-V1-WIRE-OPENAPI-SYNC`
- **Build ID:** `v26-agent-v1-wire-openapi-sync`
- **Status:** `COMPLETED (VERIFIED)`
- **Date Opened:** `2026-11-15`
- **Target Scope:** `/lamp/www/ABRN-Drive` (`json_v1.go`, `/api/v1/` handlers, `docs_api.go`, route-parity Go test)

---

## 1. Problem Statement & Recon Evidence

1. **Inconsistent `/api/v1/` Wire Envelopes (7 routes):**
   - `json_v1.go:44-53` (`respondWithV1Error`) returns `{ success: false, error: { message } }` (missing structured `error.code`), while 7 `/api/v1/` routes currently delegate directly to legacy handlers calling `respondWithJSON`/`respondWithError`:
     - `GET /api/v1/activity`
     - `POST /api/v1/files/{id}/share-link`
     - `GET /api/v1/files/{id}/share-links`
     - `DELETE /api/v1/share-links/{linkId}`
     - `GET /api/v1/file-requests`
     - `POST /api/v1/file-requests`
     - `DELETE /api/v1/file-requests/{id}`
   - Programmatic clients expecting `V1Response<T>` (`{ success, data, error, meta: { request_id, pagination? } }`) break on those routes.
2. **Stale OpenAPI Specification (`docs_api.go`):**
   - `/abrn/docs/openapi.json` and Swagger UI list only legacy JWT routes and zero `/api/v1/` agent endpoints, zero `abrnak_` / `abrnak_del_` bearer security docs, zero `Idempotency-Key` / rate-limit headers, and zero crypto header contracts (`X-Wrapped-Key`, `X-File-Metadata`).

---

## 2. Requirements (`REQ-01` .. `REQ-04`)

1. **`REQ-01-V1-ENVELOPE-CODE-SUPPORT`:**
   - Extend `json_v1.go` so error envelopes always provide `{ success: false, error: { code, message }, meta: { request_id } }` while keeping `message` string backward-compatible and adding helper `respondWithV1ErrorCode(w, r, status, code, msg)`.
   - Ensure middleware auth errors (`401`, `403`, `429`) on `/api/v1/` paths include `request_id` and structured `error.code` (`unauthorized`, `insufficient_scope`, `rate_limited`, `ip_not_allowed`, `folder_scope_denied`, `delete_key_required`).
2. **`REQ-02-WRAP-ALL-V1-ROUTES`:**
   - Wrap `/api/v1/activity`, `/api/v1/files/{id}/share-link`, `/api/v1/files/{id}/share-links`, `/api/v1/share-links/{linkId}`, `/api/v1/file-requests`, `/api/v1/file-requests/{id}`, plus all newly added `/api/v1/` routes in v25/v27 so 100% of JSON `/api/v1/` endpoints emit `apiV1Response` without altering legacy `/api/*` browser responses.
3. **`REQ-03-OPENAPI-SPEC-PARITY`:**
   - Upgrade `docs_api.go` so `GET /docs/openapi.json` (and `/abrn/docs/openapi.json`) outputs OpenAPI 3.0.3 covering:
     - All `/api/v1/` paths, query parameters (`folder_id`, `search`, `limit`, `offset`), request bodies, headers (`X-Wrapped-Key`, `X-File-Metadata`, `Idempotency-Key`, `X-Request-Id`), and `V1Response` envelope schemas.
     - Explicit distinction between `AgentBearerKey` (`abrnak_...`, standard scopes, NO delete) and `AgentDeleteOnlyKey` (`abrnak_del_...`, exclusive `files:soft_delete`, recoverable trash only).
     - Explicit note that `/api/v1/governance/settings` is human JWT-only (`HumanJWT`).
4. **`REQ-04-ROUTE-PARITY-AUTOMATED-TEST`:**
   - Add a Go unit test parsing registered `/api/v1/` routes against `docs_api.go`'s OpenAPI `paths` map so any drift fails `go test`.

---

## 3. Acceptance Criteria

- Every JSON `/api/v1/` endpoint returns `{ success, data?, error?: { code, message }, meta: { request_id, ... } }`.
- Every `/api/v1/` endpoint registered in `main.go` is documented in `/docs/openapi.json`, enforced by `go test`.
- Legacy `/api/*` frontend responses remain 100% unchanged.

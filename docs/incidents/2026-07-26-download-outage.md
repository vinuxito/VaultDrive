# ABRN Drive download outage — 2026-07-26

## Status

Resolved and deployed to production on 2026-07-26 UTC.

## User impact

- Authenticated downloads returned `500`.
- The active `GLM Ampliación` folder share generated a 22-byte empty ZIP.
- Bulk download trusted a cached four-character PIN, hid the input, and continued
  attempting every file after the first failure.
- The ABRN deployment defaulted to the high-contrast QuantiX dark skin.

## Confirmed root causes

1. The production container had no persistent upload mount. PostgreSQL referenced
   369 ciphertext files under `uploads/...`, while the container's local uploads
   directory was empty. The host corpus remained intact: 495 files and about
   1.4 GB.
2. Download and delete handlers opened the raw database path instead of resolving
   it through the configured upload root.
3. `/ready` only proved that an empty uploads directory was writable. It did not
   prove that the database-referenced corpus was available.
4. The browser credential cache accepted unvalidated restored JSON. A syntactically
   valid but stale PIN was treated as ready, and the bulk UI hid its input.
5. Bulk download continued after failures. Public folder ZIP creation silently
   skipped missing/failed files and still reported success.
6. Login persisted the authenticated session before private-key decryption and
   ignored vault-unlock failure.
7. Docker builds had no effective ignore file, sending persistent data, secrets,
   and development artifacts into the build context.

## Repairs

- Mounted host `uploads/` at `/data/uploads` and set `UPLOAD_DIR=/data/uploads`.
- Added a canonical storage-path resolver with traversal/outside-root rejection;
  all download and delete handlers use it.
- Made readiness scan every database-referenced ciphertext and return `503` for
  missing, empty, or invalid storage entries.
- Added credential schema validation and `clearCredential()`; corrupted cache
  entries are deleted during restore. Cache writes use a generation guard so an
  older pending encryption cannot restore a credential after it is cleared.
- Kept cached credentials visible/editable, made bulk download fail fast, and
  evicted/re-prompted only after credential failures.
- Made preview and single-file flows re-prompt after a rejected cached credential,
  while retaining correct credentials for server/storage failures.
- Made normal login persistence conditional on successful vault unlock.
- Made shared-folder ZIP creation fail if any file key, fetch, metadata, or
  decryption step fails; an empty/partial archive is never reported as saved.
- Added actionable HTTP download error mapping.
- Kept authorization distinct from authentication (`403` never forces a login)
  and limited credential eviction to failures that actually consume or verify
  the entered credential.
- Set ABRN's default skin to `light` while preserving QuantiX's default.
- Added `.dockerignore`; the production build context fell from 2.04 GB to about
  3 MB after the final frontend rebuild.
- Moved runtime database/JWT values out of tracked Compose configuration and
  rotated the runtime JWT secret. Existing browser sessions must sign in again.

## Verification evidence

- Go test suite: passed against the production PostgreSQL service.
- Frontend Vitest suite: 150 passed, 1 skipped.
- TypeScript and Vite production build: passed.
- Docker Compose configuration validation: passed.
- Production readiness:
  - database: ok
  - migrations: version 49
  - stored files: 370 of 370 available and non-empty at the final post-review
    probe (the corpus grew from 369 during the repair)
  - uploads directory: writable
- Production mount: host `uploads/` is mounted read/write at `/data/uploads`.
- Active `GLM Ampliación` ciphertext probe:
  - HTTP `200`
  - 2,592,269 bytes returned
  - encryption metadata header present
- Fresh production logs contained no storage-path or `5xx` matches after probes.
- Clean browser smoke:
  - page title `ABRN Drive`
  - default theme `light`
  - injected corrupted credential cache removed after reload
  - zero browser console errors

## Known baseline

`npm run lint` remains red on pre-existing repository-wide lint debt (unused
demo/E2E imports, explicit `any`, conditional hooks, and React compiler warnings).
The production typecheck/build and all frontend tests pass; no lint failure
introduced by this incident repair blocks the deployed runtime.

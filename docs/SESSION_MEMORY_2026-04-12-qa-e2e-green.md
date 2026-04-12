# Session Memory — 2026-04-12: QA Pass, E2E Green (38/38)

## What Happened

Full QA pass on the QuantiX Drive deployment at `/lamp/www/QuantiX-Drive` (port 8083,
`quantixdrive` DB, service: `quantixdrive.service`, runs as `daemon` user).

Started with 10/38 E2E tests passing. Ended with 38/38 passing.

## Key Infrastructure Facts (Critical for Future Sessions)

- **Service**: `quantixdrive.service`, user: `daemon`, port: `8083`, base path: `/quantix/`
- **DB**: `quantixdrive` (NOT `vaultdrive` — that's the ABRN Drive deployment on port 8082)
- **Migrations**: Run with `goose -dir sql/schema postgres "postgres://postgres:postgres@localhost:5432/quantixdrive" up`
- **Uploads dir**: `/lamp/www/QuantiX-Drive/uploads/` — must exist and be owned by `daemon:daemon`
- **E2E run command**: `E2E_BASE_URL=http://127.0.0.1:8083/quantix npx playwright test --reporter=list`
- **Agent key prefix**: `qxak_` (no underscores in middle — env var `AGENT_KEY_PREFIX=qxak_`)
- **Frontend API base**: `apiBasePath = "/api"` (not `/quantix/api`) — Filemon console shows `http://host/api/v1/...`

## Bugs Fixed This Session

1. `middleware_ratelimit.go` — loopback IP bypass added (prevents E2E test 429s)
2. `handle_user_create.go` — all 5 `http.Error()` calls replaced with `respondWithError()`
3. `sql/schema/015,036,037` — missing goose Up/Down annotations added
4. `e2e/agent-key-lifecycle.spec.ts` — prefix regex, Filemon locator, URL port dependency

## What Was NOT Changed (Leave Alone)

- `handle_drop.go` direct `json.NewEncoder` error paths — low risk, consistent with drop page UX
- Rate limiter global 100/min — intentionally NOT bypassed for loopback
- DB schema — no schema changes this session

## Safe to Continue

Yes. All 38 E2E tests pass. Both Go and frontend builds clean. Service is live and healthy.

## Next Logical Work

- Run `go vet ./...` and fix any findings
- Run `npx tsc --noEmit` with the new `tsconfig.e2e.json` to verify no remaining TS errors
- Add unit test for `isLoopbackIP()` in `middleware_ratelimit_test.go`
- Clean up `handle_drop.go` direct encoder calls (low priority)
- Add `uploads/` directory creation to Dockerfile and deployment docs

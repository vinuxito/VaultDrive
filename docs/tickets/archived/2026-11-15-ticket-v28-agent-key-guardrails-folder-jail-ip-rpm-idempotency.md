# TICKET-2026-11-15-AGENT-KEY-GUARDRAILS — Folder Jailing, IP Allowlists, Per-Key RPM & Safe Idempotent Retries (`v28-agent-key-guardrails`)

- **Ticket ID:** `TICKET-2026-11-15-AGENT-KEY-GUARDRAILS`
- **Build ID:** `v28-agent-key-guardrails`
- **Status:** `COMPLETED (VERIFIED)`
- **Date Opened:** `2026-11-15`
- **Target Scope:** `/lamp/www/ABRN-Drive` (PostgreSQL migration `052`, `middleware_actor.go`, `handle_agent_api_keys.go`, `/api/v1/` handlers, Settings + Live Agent Operations UI)

---

## 1. Problem Statement & Security Value

Even with least-privilege scopes, real enterprise users need **resource-level blast-radius containment** ("only let the CFDI sorting bot touch the `Facturas 2026/` folder subtree, from our accounting server IP, with repeatable retries when webhooks flake"):

1. Currently an agent key with `files:list` or `files:upload_ciphertext` can see/touch every folder in the user's vault.
2. There is no IP/CIDR restriction, no per-key RPM override (all keys hardcode 60/min in memory), and no HTTP `Idempotency-Key` protection for flaky bot retries (`POST /v1/files/upload`, `POST /v1/folders`, `POST /v1/drop/create`, etc.).

---

## 2. Requirements (`REQ-01` .. `REQ-05`)

1. **`REQ-01-MIGRATION-052`:**
   - Add `allowed_folder_ids JSONB NOT NULL DEFAULT '[]'::jsonb`, `allowed_ips JSONB NOT NULL DEFAULT '[]'::jsonb`, and `rate_limit_rpm INTEGER NOT NULL DEFAULT 60` to `agent_api_keys`.
   - Create `agent_idempotency_records` table (`actor_key_hash`, `method`, `path`, `idempotency_key`, `request_sha256`, `status_code`, `response_body`, `expires_at`).
2. **`REQ-02-RECURSIVE-FOLDER-JAIL`:**
   - Compute allowed subtree dynamically via recursive parent traversal from `allowed_folder_ids`.
   - When non-empty:
     - `GET /api/v1/files` returns ONLY files inside the allowed subtree; `GET /api/v1/folders` returns ONLY allowed folders & descendants.
     - Root uploads (`folder_id` omitted) and reads/downloads/moves/shares/drops/soft-deletes outside the subtree return `403 folder_scope_denied`.
     - Cross-folder moves require both source folder (if any) and target folder inside the jail.
     - Child-key minting via `api_keys:write` must attenuate `allowed_folder_ids` to a subset of the parent's subtree (cannot escape parent jail!).
3. **`REQ-03-IP-ALLOWLIST-AND-PER-KEY-RPM`:**
   - Validate CIDR/IP entries (`net.ParseCIDR` / `net.ParseIP`) at key creation time; enforce in `handleAgentKeyAuth` using trusted peer IP extraction.
   - Enforce per-key `rate_limit_rpm` (`1..600`, default `60`, plus child attenuation `min(parent_rpm, child_rpm)`).
4. **`REQ-04-IDEMPOTENCY-KEY`:**
   - Support `Idempotency-Key` header on mutating `/api/v1/` `POST`/`PUT` JSON creation endpoints (and allow `Idempotency-Key` in CORS `Access-Control-Allow-Headers` in `main.go`).
   - Replaying the same `Idempotency-Key` + payload replays stored status/body with `X-Idempotency-Replayed: true`; reusing a key with a different payload returns `409 idempotency_conflict`.
5. **`REQ-05-SETTINGS-AND-OPS-UI`:**
   - Update `AgentApiKeysSection.tsx` with human-friendly folder jail multi-select (optional "Toda la bóveda" vs "Solo carpetas elegidas"), optional IP/CIDR box, and speed selector (`rate_limit_rpm`).
   - Show active jail/delete-only badges cleanly in `AgentApiKeysSection.tsx` and `AgentOperationsSection.tsx` (`agent-operations.ts`).

---

## 3. Acceptance Criteria

- Folder-jailed key sees/uploads/downloads/deletes ONLY inside its assigned subtree and gets `403` outside it (including attempts to mint an unjailed child key).
- IP-restricted key rejects unauthorized client IPs with `403 ip_not_allowed`.
- Configurable `rate_limit_rpm` throttles at configured limit with `429`.
- `Idempotency-Key` prevents duplicate folder/link/drop creation and flags conflicts (`409`).

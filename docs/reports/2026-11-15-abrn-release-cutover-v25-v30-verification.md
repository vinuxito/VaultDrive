# ABRN Drive Production Cutover Verification (`v25–v30` + Schema `49 -> 52`)

- **Date:** 2026-11-15
- **Deployed Build ID (`HEAD` at Cutover):** `111fbfa53c84c5b0d256b28af6217284fe57b096`
- **Service:** `abrndrive.service` (`http://127.0.0.1:8082` / `https://abrndrive.filemonprime.net/abrn/`)
- **Schema Transition:** `49` -> `52` (`050_recovery_attempt_capabilities.sql`, `051_agent_keys_and_recoverable_trash.sql`, `052_agent_key_guardrails.sql` via Goose `v3.28.0`)
- **Coherent Backup:** `/var/backups/abrndrive-release/20261115T211255Z-111fbfa53c84c5b0d256b28af6217284fe57b096`
- **Result:** **PASS — LIVE IN PRODUCTION**

---

## Verification Matrix

| Check ID | Scope | Command / Probe | Observed Outcome | Status |
|---|---|---|---|---|
| `REL-01` | Release Installer Static & Unit Suite | `python3 -m py_compile ... && python3 -m unittest -v test_release_installer.py` | Exit `0` — **`14/14` passed** (`1.021s`) | **PASS** |
| `REL-02` | Cold Go Backend Suite & Vet | `DB_URL=...abrn_coherence_test go test -count=1 ./... && go vet ./...` | Exit `0` — `ok github.com/vinuxito/VaultDrive 10.730s` | **PASS** |
| `REL-03` | Schema `50` & `52` Catalog SQL Oracle | `SCHEMA_50_VALIDATION_SQL` & `SCHEMA_52_VALIDATION_SQL` vs `abrn_coherence_test` (`ver: 52`) | Both returned **`true`** | **PASS** |
| `REL-04` | Isolated Build & Private Stage Manifest | Detached worktree build (`go build -ldflags -X main.version=...` + Vite `--mode abrn`) + `sha256sum -c MANIFEST.sha256` | Exit `0` — **`9/9` artifacts `OK`**, `goose version: v3.28.0` | **PASS** |
| `REL-05` | Root-Owned Release Installer Execution | `sudo /usr/bin/python3 -I /run/abrndrive-release-installer.py "$STAGE"` | Exit `0` — Goose migrated `050`, `051`, `052` to **`version: 52`**; backup verified | **PASS** |
| `REL-06` | Systemd Service & `/ready` | `systemctl status abrndrive.service` & `curl -sS http://127.0.0.1:8082/ready` | `active (running)` PID `63721`; `"migrations":"ok (version: 52)"`, `stored_files: 1179` | **PASS** |
| `REL-07` | Build Identity & Frontend Byte Parity | `curl /health`, `curl /abrn/`, `sha256sum` on installed binary & `dist/index.html` | `"version":"111fbfa53c84c5b0d256b28af6217284fe57b096"`; `dist/index.html` SHA-256 **`e5360d7d8500bb0c69f197d921b184d810ac6d61964aebd00a43101d03ca5df7`** (0B delta) | **PASS** |
| `REL-08` | OpenAPI 3.0.3 & Docs Publication | `curl https://abrndrive.filemonprime.net/abrn/api/v1/openapi.json` & `/abrn/api/v1/docs` | HTTP `200`; `44` paths (`/api/v1/auth/introspect`, `/api/v1/users/me/public-key`, `/api/v1/agent-keys`) | **PASS** |
| `REL-09` | Real Logged-In Chromium (`bsk`) | `bsk navigate` + `observe` + `console` on `/abrn/`, `/abrn/api/v1/docs`, `/abrn/settings` | Live UI & OpenAPI guide rendered cleanly (`0` JS app errors) | **PASS** |
| `REL-10` | Staging & Trusted Script Cleanup | Verify `/run/abrndrive-release-installer.py` & `$STAGE` removed | `trusted_installer_cleaned=ok`, `stage_cleaned=ok` | **PASS** |

---

## Cryptographic & Runtime Seals

- **Installed Binary SHA-256 (`/usr/local/lib/abrndrive/abrndrive`):** `ca7856ac6e5783df9a1f4a5a06640a6e6ed45630301e7b46fe7b396735d6bdf3`
- **Installer Script SHA-256 (`deploy/release/release_installer.py`):** `1304ad0c524535c3108481d8763e92d03265fa4a023ccdf2b3c448af0f9b88c8`
- **Live Index (`dist/index.html` & `https://abrndrive.filemonprime.net/abrn/`):** `e5360d7d8500bb0c69f197d921b184d810ac6d61964aebd00a43101d03ca5df7`
- **Coherent Backup Directory:** `/var/backups/abrndrive-release/20261115T211255Z-111fbfa53c84c5b0d256b28af6217284fe57b096` (`schema-before.txt`: `49`, `database.dump`: `1,776,170` bytes, `pg_restore --list` verified)

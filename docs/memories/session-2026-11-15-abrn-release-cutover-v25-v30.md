# Session Memory: ABRN Drive Production Release Cutover (`v25–v30` + Schema `49 -> 52`)

- **Date:** 2026-11-15
- **Workspace:** `/lamp/www/ABRN-Drive`
- **Branch / Deployed Release Commit (`BUILD_ID`):** `main` / `111fbfa53c84c5b0d256b28af6217284fe57b096`
- **Mission:** Execute the coordinated ABRN Drive production release cutover (`v25–v30` + migrations `050`, `051`, `052`) onto `abrndrive.service` following [`deploy/release/README.md`](../../deploy/release/README.md), without modifying `/lamp/www/rgconsulting/pipc` or mutating runtime configuration secrets.
- **Verdict:** **`SEGURO CONTINUAR`**

---

## 1. Starting State

- `abrndrive.service` was active on PID `5071` serving legacy binary `/usr/local/lib/abrndrive/abrndrive` (`Sep 14 00:30`), `/health` returned `"version": "dev"`, `/ready` reported `"migrations": "ok (version: 49)"` and `1179` stored files, and `/abrn/api/v1/openapi.json` returned `404`.
- [`deploy/release/release_installer.py`](../../deploy/release/release_installer.py), [`deploy/release/test_release_installer.py`](../../deploy/release/test_release_installer.py), and [`deploy/release/README.md`](../../deploy/release/README.md) only supported single-migration `49 -> 50` (`050_recovery_attempt_capabilities.sql`) and rejected schemas `51`–`52`.

---

## 2. Files Read & Changed

- **Modified:**
  - [`deploy/release/release_installer.py`](../../deploy/release/release_installer.py): Extended `MIGRATIONS` to `("050_recovery_attempt_capabilities.sql", "051_agent_keys_and_recoverable_trash.sql", "052_agent_key_guardrails.sql")`, `verify_bundle` to accept `from_schema in {49, 50}` -> `to_schema == 52`, `schema_version` to allow `{49, 50, 51, 52}`, added `SCHEMA_52_VALIDATION_SQL` + `validate_schema_52`, updated Goose execution when `initial_schema < 52`, required post-migration `schema_version == 52`, `validate_schema_50`, `validate_schema_52`, and `/ready` `"ok (version: 52)"`.
  - [`deploy/release/test_release_installer.py`](../../deploy/release/test_release_installer.py): Updated fixture bundle, `Fx` harness (`schema50`/`schema52` mocks, dual `self.schemas` responses, `ok (version: 52)`), `053_evil.sql` extra-migration rejection, `validate_schema_52`, and retry coverage for schemas `50` and `52`.
  - [`deploy/release/README.md`](../../deploy/release/README.md): Updated bundle manifest, `RELEASE.json` contract (`"to_schema": 52`), and cutover documentation for `050–052`.
- **Committed & Pushed Prior to Build Stage:** Commit `111fbfa` (`111fbfa53c84c5b0d256b28af6217284fe57b096`) pushed to `origin/main` (`d029662..111fbfa`).

---

## 3. Verification Commands & Outcomes

1. **Release Installer Compilation & Unit Suite (`14/14` PASS):**
   - Command: `python3 -m py_compile deploy/release/release_installer.py deploy/release/test_release_installer.py && (cd deploy/release && python3 -m unittest -v test_release_installer.py)`
   - Outcome: Exit `0` (`Ran 14 tests in 1.021s — OK`).
2. **Cold Go Backend Suite & Vet (`PASS`):**
   - Command: `DB_URL="postgres://abrn_test:abrn_test_local@127.0.0.1:5432/abrn_coherence_test?sslmode=disable" /home/vinuxito/.cache/abrndrive-recovery/go/bin/go test -count=1 ./... && /home/vinuxito/.cache/abrndrive-recovery/go/bin/go vet ./...`
   - Outcome: Exit `0` (`ok github.com/vinuxito/VaultDrive 10.730s`, `go vet` clean).
3. **Catalog Validation SQL Against `abrn_coherence_test` (`ver: 52`):**
   - Both `SCHEMA_50_VALIDATION_SQL` and `SCHEMA_52_VALIDATION_SQL` returned `true`.
4. **Isolated Build & Private Stage Verification (`$STAGE` outside `/lamp/www`):**
   - Built from detached worktree at `111fbfa53c84c5b0d256b28af6217284fe57b096` with `CGO_ENABLED=0 go build -trimpath -ldflags "-X main.version=111fbfa53c84c5b0d256b28af6217284fe57b096"` and `VITE_API_URL=/api VITE_AGENT_KEY_PREFIX=abrnak VITE_BASE_PATH=/abrn npm run build -- --mode abrn --outDir "$STAGE/dist"`.
   - `sha256sum -c MANIFEST.sha256` passed `9/9 OK`; cached Goose `v3.28.0` binary verified.
5. **Root Cutover Execution (`exit 0`):**
   - Installed `release_installer.py` (SHA-256 `1304ad0c524535c3108481d8763e92d03265fa4a023ccdf2b3c448af0f9b88c8`) to `/run/abrndrive-release-installer.py` mode `0500` and ran `sudo /usr/bin/python3 -I /run/abrndrive-release-installer.py "$STAGE"`.
   - Output: `ABRN release 111fbfa53c84c5b0d256b28af6217284fe57b096 verified; backup: /var/backups/abrndrive-release/20261115T211255Z-111fbfa53c84c5b0d256b28af6217284fe57b096`.
   - Goose log recorded `050_recovery_attempt_capabilities.sql (56.71ms)`, `051_agent_keys_and_recoverable_trash.sql (33.25ms)`, `052_agent_key_guardrails.sql (13.38ms)` -> `version: 52`.
6. **Live Service, Endpoint & Real-Browser Verification:**
   - `abrndrive.service`: `active (running)` (Main PID `63721`).
   - `http://127.0.0.1:8082/ready`: `{"diagnostics":{"database":"ok","migrations":"ok (version: 52)","secrets":"ok","stored_files":"ok (files: 1179)","uploads_dir":"ok"},"status":"ready"}`.
   - Local & public `https://abrndrive.filemonprime.net/health`: `"status":"ok","version":"111fbfa53c84c5b0d256b28af6217284fe57b096"`.
   - `https://abrndrive.filemonprime.net/abrn/api/v1/openapi.json`: HTTP `200`, OpenAPI `3.0.3`, `44` paths including `/api/v1/auth/introspect`, `/api/v1/users/me/public-key`, `/api/v1/agent-keys`, `/api/v1/folders`.
   - `https://abrndrive.filemonprime.net/abrn/` & `/abrn/api/v1/docs`: HTTP `200`; `dist/index.html` local and HTTPS SHA-256 identical (`e5360d7d8500bb0c69f197d921b184d810ac6d61964aebd00a43101d03ca5df7`).
   - Real Chromium via `bsk`: rendered `"ABRN Drive"` and `"ABRN Drive OpenAPI & Agent Zero-Knowledge Guide"` (`/abrn/api/v1/docs`) with `0` application console errors.
   - Cleanup: `/run/abrndrive-release-installer.py` and temporary `$STAGE` removed; coherent backup retained in `/var/backups/abrndrive-release/20261115T211255Z-111fbfa53c84c5b0d256b28af6217284fe57b096`.

---

## 4. Remaining Scope / Owner Actions

- `/lamp/www/rgconsulting/pipc` was intentionally not touched.
- User can now sign in at `https://abrndrive.filemonprime.net/abrn/`, create their target folder, and mint their `abrnak_...` key in Settings.

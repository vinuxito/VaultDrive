# ABRN UI/UX coherence release runbook

**Status:** prepared, not deployed  
**Target transition:** schema 49 → 50, backend + ABRN frontend + migration as one release  
**Canonical installer:** [`deploy/release/release_installer.py`](../../deploy/release/release_installer.py)  
**Final verification record:** [`docs/reports/2026-09-16-ui-ux-coherence-verification.md`](../reports/2026-09-16-ui-ux-coherence-verification.md) (written by the release owner after final gates)

This runbook is ABRN-only. It does not authorize a production deployment, assert a final build identifier, or certify production readiness. The release owner must fill those facts from the reviewed commit and final verification report.

## Release invariants

- Build in an isolated, clean checkout. Do not build, replace assets, or restart services from `/lamp/www/ABRN-Drive`.
- Stage the complete release in a user-owned directory with mode `0700`, outside `/lamp/www`.
- Invoke only an independently hash-verified root-owned installer via `/usr/bin/python3 -I`; never execute Python from the user-owned stage directly.
- Preserve `/etc/abrndrive/runtime.env`, the existing systemd unit/drop-ins, uploads, and every other service.
- Pin the frontend contract to `VITE_API_URL=/api`, `VITE_AGENT_KEY_PREFIX=abrnak` and `VITE_BASE_PATH=/abrn`; the committed `.env.abrn` values are not release authority.
- Bundle Goose v3.28.0 and only migration 050. Never download `goose@latest` during cutover.
- Schema 49 accepts the coordinated release. Schema 50 is accepted only as a retry after its recovery tables are validated. Every other or dirty version is rejected.
- Once Goose is invoked, failure is compatibility-ambiguous. Leave `abrndrive.service` stopped and diagnose forward; never automatically restore the older recovery binary.
- Never source or print a shared `.env` or the production DSN. The installer parses the protected systemd environment as data and passes database credentials only through child-process environment variables.

## 1. Pre-release evidence gates

The release owner records commands and outcomes in the final verification report. Counts must come from that run; historical README counts are not acceptance.

Required automated gates:

- backend tests, race tests, vet/compile;
- frontend unit tests, lint, typecheck and production ABRN build;
- local isolated Playwright journeys;
- installer `py_compile` and `unittest`;
- manifest verification and schema-50 disposable-database proof;
- review of the exact commit and release diff.

External Playwright is never implicit. Use the dedicated runner only with both explicit targets:

```bash
cd <isolated-checkout>/vaultdrive_client
E2E_BASE_URL='https://abrndrive.filemonprime.net/abrn/' \
E2E_API_BASE_URL='https://abrndrive.filemonprime.net/api' \
npm run test:e2e:external -- <reviewed-spec-list>
```

This command targets an external environment and must run only after the release owner authorizes that environment and fixtures.

Outstanding human acceptance gates remain release blockers until recorded:

1. five-person unassisted completion of login, upload, share, revoke, recovery and download journeys;
2. native 200% zoom/reflow and keyboard/screen-reader pass;
3. physical-phone and tablet pass across supported browsers;
4. real passkey enrollment/login/recovery on supported devices;
5. real browser/OS save and decrypted-file open behavior;
6. operator reboot survival and an observed restore drill using the coherent release backup.

## 2. Build and stage one immutable bundle

Use a private release directory such as:

```bash
STAGE="$HOME/.cache/abrndrive-release-<build-id>"
install -d -m 0700 "$STAGE/migrations"
```

From the isolated reviewed checkout:

- build the backend with `-ldflags "-X main.version=<build-id>"`;
- build the frontend in ABRN mode with explicit release values and archive exactly the private `dist/` as `frontend-dist.tar`:

  ```bash
  cd <isolated-reviewed-checkout>/vaultdrive_client
  PRIVATE_DIST="$STAGE/dist"
  VITE_API_URL=/api \
  VITE_AGENT_KEY_PREFIX=abrnak \
  VITE_BASE_PATH=/abrn \
  npm run build -- --mode abrn --outDir "$PRIVATE_DIST"
  tar -C "$STAGE" -cf "$STAGE/frontend-dist.tar" dist
  (cd "$STAGE" && find dist -type f -print0 | sort -z | xargs -0 sha256sum > FRONTEND-MANIFEST.sha256)
  rm -rf "$PRIVATE_DIST"
  ```

- copy the pinned Goose v3.28.0 executable;
- copy `sql/schema/050_recovery_attempt_capabilities.sql` only;
- copy `deploy/release/release_installer.py`;
- generate `FRONTEND-MANIFEST.sha256` for every regular file under the private `dist/` directory;
- create the exact `RELEASE.json` contract documented in [`deploy/release/README.md`](../../deploy/release/README.md);
- generate `MANIFEST.sha256` for `RELEASE.json`, `FRONTEND-MANIFEST.sha256`, `abrndrive`, `frontend-dist.tar`, `goose`, migration 050 and `release_installer.py`;
- remove group/other write permissions from every staged directory and file.

Review the manifest, Git build identifier, tar contents, executable versions, `RELEASE.json` values and stage ownership before sudo. `RELEASE.json` must record `base_path=/abrn/`, `frontend_api_url=/api` and `agent_key_prefix=abrnak`. The installer also requires the protected runtime to agree on `BASE_PATH=/abrn/` and `AGENT_KEY_PREFIX=abrnak` before it stops the service. The manifest detects corruption; it does not prove provenance by itself.

## 3. Final approval packet

Before the administrator command, the reviewer receives:

- exact commit/build identifier;
- final verification report and unresolved-gate list;
- manifest hash and artifact hashes;
- the independently recorded SHA-256 of the reviewed installer;
- current production schema/readiness snapshot collected without printing secrets;
- expected backup path pattern;
- explicit acknowledgment that a post-Goose failure leaves ABRN stopped;
- forward-fix or deliberate coherent-restore owner and communication path.

## 4. Administrator cutover

Only after the packet is approved:

```bash
TRUSTED_INSTALLER=/run/abrndrive-release-installer.py
sudo /usr/bin/install -o root -g root -m 0500 "$STAGE/release_installer.py" "$TRUSTED_INSTALLER"
printf '%s  %s\n' "$EXPECTED_INSTALLER_SHA256" "$TRUSTED_INSTALLER" | sudo /usr/bin/sha256sum -c -
sudo /usr/bin/python3 -I "$TRUSTED_INSTALLER" "$STAGE"
```

The installer holds an exclusive release lock, copies the exact bundle through no-follow file descriptors into a root-owned snapshot, and uses only that snapshot. Before mutation it validates schema state, runtime identity, archive closure and capacity. It then stops only `abrndrive.service`, takes root-private database/binary/frontend/runtime/unit backups, validates the custom dump with `pg_restore --list`, applies migration 050 from a root-owned one-file directory, swaps backend and frontend, then requires:

- local `/ready` with schema 50;
- local `/health` with the exact build identifier;
- local ABRN index and referenced JavaScript/CSS bytes matching the snapshotted frontend;
- public `/health` with the same build identifier;
- public `/abrn/` index and referenced JavaScript/CSS bytes and content types matching the snapshotted frontend.

Command output from `pg_dump` and Goose is captured in mode-0600 files inside the root-private backup. The console never prints the DSN.

## 5. Failure and recovery

- **Before Goose:** if the coherent backup fails or execution is interrupted, the installer restarts the unchanged service, verifies it is active, and exits non-zero.
- **At or after Goose invocation:** failures, SIGINT and SIGTERM stop ABRN and verify it is inactive. Do not restore only the prior binary or frontend.
- **Coherent restore:** use the database dump, binary and frontend from the same backup. Restoration is a deliberate operator action based on [`database-restore.md`](database-restore.md), adjusted to the protected runtime connection values. Never source that environment file and never use the runbook's historical example credentials.
- Record the failure boundary, backup path, service state, schema state and chosen forward/restore action in the final verification report.

## 6. Closeout

A release is closed only when automated gates, public identity checks, outstanding manual acceptance, reboot survival and restore evidence are recorded. Until then, describe the build as verified in its exercised environments, not production-ready.

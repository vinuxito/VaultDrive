# Coordinated ABRN release

This directory is the canonical source for the coordinated ABRN release installer and its tests. It does not mean a release has been built, approved, staged, or deployed. Follow the review gates below and the operator runbook at [`docs/runbooks/abrn-coherence-release.md`](../../docs/runbooks/abrn-coherence-release.md).

## Why the existing deploy paths are insufficient

- `deploy/systemd/install-abrndrive.sh` safely restores a binary and preserves a private runtime snapshot, but it intentionally does not install frontend assets or migrations.
- `scripts/deploy.sh abrn` builds and mutates in the shared application tree, evaluates `.env` as shell, downloads `goose@latest`, treats migration failure as a warning, and swaps the binary and frontend separately.
- Schema 50 changes account-recovery state. After it is applied, automatically restoring the older recovery binary would reintroduce an incompatible and less safe protocol.
- `docs/runbooks/database-restore.md` drops and recreates the database. It is a disaster-recovery procedure, not an automatic release rollback. Its current examples also use older host/port assumptions, so an operator must use the preserved runtime credentials for this ABRN release.

## Release bundle contract

Prepare one user-owned directory with mode `0700`; every artifact must be a regular file and listed exactly once in `MANIFEST.sha256`:

```text
release/
  MANIFEST.sha256
  FRONTEND-MANIFEST.sha256
  RELEASE.json
  abrndrive
  frontend-dist.tar
  goose
  migrations/050_recovery_attempt_capabilities.sql
  release_installer.py
```

`RELEASE.json` is exact and intentionally small:

```json
{
  "product": "abrndrive",
  "build_id": "FULL_OR_SHORT_GIT_HEX",
  "from_schema": 49,
  "to_schema": 50,
  "goose_version": "v3.28.0",
  "public_origin": "https://abrndrive.filemonprime.net",
  "base_path": "/abrn/",
  "frontend_api_url": "/api",
  "agent_key_prefix": "abrnak"
}
```

Build `abrndrive` with the same `build_id` via `-ldflags "-X main.version=$BUILD_ID"`. The current `.env.abrn` contains stale API and agent-prefix values, so the release build must explicitly override them and write to a private output directory rather than the shared live tree:

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

Archive only that resulting directory so every member is under `dist/` and `dist/index.html` exists. Generate `FRONTEND-MANIFEST.sha256` from every regular file under `dist/`; the installer requires the archive inventory and hashes to match it exactly and requires the index's JavaScript/CSS entry assets. Record the exact non-secret values in `RELEASE.json`; the root preflight rejects stale metadata and rejects a protected runtime whose `BASE_PATH` or `AGENT_KEY_PREFIX` differs. Bundle a prebuilt Goose **v3.28.0** binary; do not use `go run ...@latest` during release. Copy only migration 050 into `migrations/`. Generate `MANIFEST.sha256` for all seven files named by the installer, including `release_installer.py` and the frontend manifest, then make the full stage read-only to group/other and review it before sudo. Extra stage entries or migrations are rejected.

```bash
(cd "$STAGE" && sha256sum \
  RELEASE.json FRONTEND-MANIFEST.sha256 abrndrive frontend-dist.tar goose \
  migrations/050_recovery_attempt_capabilities.sql release_installer.py \
  > MANIFEST.sha256)
```

The manifest detects staging corruption and accidental substitution. It is not a cryptographic signature: the operator must obtain the manifest and artifacts from the same reviewed build job and compare the recorded Git commit before invoking sudo.

## Reviewed cutover order

1. **Non-root build gate:** clean reviewed commit; focused and full approved test gates; ABRN frontend build; backend build with non-`dev` Git identity; pinned Goose; migration 050; exact manifest.
2. **Private stage gate:** absolute user-owned path, directory mode `0700`, exact recursive inventory, no symlinks, hashes match, and the frontend archive exactly matches its file manifest within bounded size/member limits.
3. **Root preflight (no mutation):** run a separately root-owned installer with `/usr/bin/python3 -I`; acquire the exclusive ABRN release lock; copy every staged file with no-follow semantics into a root-owned snapshot and use only that snapshot; parse `/etc/abrndrive/runtime.env` as data without sourcing it; require its non-secret `BASE_PATH=/abrn/` and `AGENT_KEY_PREFIX=abrnak` to match `RELEASE.json`; require local `vaultdrive` PostgreSQL; verify bundled Goose version, free space and service state; accept only clean schema 49 or a schema 50 that matches the full recovery table/constraint/index/plaintext-removal contract. Neither the runtime file nor the service unit is replaced.
4. **ABRN-only write freeze:** stop only `abrndrive.service`; verify it is inactive. QuantiX and PostgreSQL remain running.
5. **Root-private coherent backup:** create `/var/backups/abrndrive-release/<UTC>-<build>/` mode `0700`; run `pg_dump --format=custom` with a minimal child environment, require a non-empty dump and a successful `pg_restore --list`, and record database tool/server versions before migration; copy installed binary, current dist archive, runtime env, unit, release manifest, and starting schema marker. `pg_dump`, `pg_restore` and Goose output go only to mode-0600 files in this backup, not the user console.
6. **Schema gate:** from 49, run the bundled Goose against only migration 050 with `GOOSE_DBSTRING` in the process environment. From 50, treat the run as a retry and validate the recovery tables. Reject all other versions or dirty state. There is no `-allow-missing` and no migration warning path.
7. **Coordinated artifact swap:** install backend atomically to `/usr/local/lib/abrndrive/abrndrive`; extract and validate frontend to a sibling temporary directory, then replace `/lamp/www/ABRN-Drive/vaultdrive_client/dist`. Preserve `/etc/abrndrive/runtime.env`, the base unit, drop-ins, uploads, and all other services.
8. **Start and prove:** start only `abrndrive.service`; require local `/ready` with schema 50, local `/health` with exact build identity, and local/public hashes plus content types for the index's immutable JavaScript/CSS entry assets.
9. **Failure posture:** signals, interrupts and ordinary failures use the same cleanup path. Before migration, the unchanged service is restarted and its active state verified. Once schema 50 is present or Goose is invoked, every later failure stops ABRN and verifies that it remains stopped. The installer never restores the old binary or database automatically.

## Invocation after review and private staging

The approval packet supplies `EXPECTED_INSTALLER_SHA256` from the reviewed source through an independent channel. Copy the installer to a root-owned path, verify that hash, then use the host's absolute Python in isolated mode:

```bash
TRUSTED_INSTALLER=/run/abrndrive-release-installer.py
sudo /usr/bin/install -o root -g root -m 0500 "$STAGE/release_installer.py" "$TRUSTED_INSTALLER"
printf '%s  %s\n' "$EXPECTED_INSTALLER_SHA256" "$TRUSTED_INSTALLER" | sudo /usr/bin/sha256sum -c -
sudo /usr/bin/python3 -I "$TRUSTED_INSTALLER" "$STAGE"
```

Do not execute the user-owned staged script directly. The installer requires Python 3.11 or newer and verifies that its root-owned running copy matches the snapshotted, manifested copy before mutation.

## Static and private dry-run strategy

Safe checks performed for this handoff:

```bash
python3 -m py_compile release_installer.py test_release_installer.py
python3 -m unittest -v test_release_installer.py
```

Record the fresh result in the final verification report. The suite includes successful coordinated install, pre-migration backup failure with unchanged-service restart, unknown Goose outcome, public-health failure after schema 50, exact backend/frontend identity, immutable ABRN build metadata and runtime matching, private command logs, suppressed unexpected exceptions, unsafe archive paths, symlinked controls, writable artifacts, schema gates and non-executed shell-looking secrets.

The unit suite now mocks command execution, systemd and HTTP around the actual `main()` orchestration. It proves these scenarios without touching production:

- exact recursive stage inventory, unmanifested migration rejection, immutable root snapshot and user-stage substitution resistance;
- frontend missing/corrupt/extra/duplicate assets, archive bounds, entry-asset closure and public asset mismatch;
- shell-looking runtime secret remains literal and is never executed/logged;
- schema 48/51/dirty rejected before service stop;
- schema 49 migration success reaches 50;
- schema 50 retry skips migration and validates columns, types, nullability, constraints, indexes, defaults and removal of legacy plaintext state;
- empty/corrupt/failed DB backup before migration restarts the unchanged old service;
- backup or validation failure before Goose is invoked restarts the unchanged old service;
- any failure after Goose is invoked is treated as an unknown/possibly committed migration and leaves ABRN stopped;
- lock contention, insufficient space, pre/post-Goose interrupts, artifact-swap interrupt and post-start probe interrupt;
- no command addresses `quantixdrive.service`, changes PostgreSQL state, or modifies runtime/service files.

A disposable namespace/VM remains recommended before adoption because mocks do not reproduce systemd ownership, Apache proxying, filesystem mounts or public TLS.

## Single-migration Goose compatibility proof

Cached Goose reported `v3.28.0`. A separate throwaway database was created in the private PostgreSQL cluster by dump/restore from the private fixture; no production database and no active `abrn_coherence_test` rows were changed. The clone was rolled down to 49 using the full migration directory. Goose was then pointed at a temporary directory containing **only** `050_recovery_attempt_capabilities.sql`:

```text
goose=goose version: v3.28.0
before=49:t
after=50:t
recovery_tables=t
```

The disposable database was dropped in a `finally` block. This proves that Goose v3.28.0 accepts the release bundle's single forward migration when the target database records version 49.

## Operational risks requiring reviewer sign-off

- The public frontend byte comparison assumes the origin returns the backend's current `index.html` without an HTML-transforming CDN. If that is false, use a separately staged immutable release marker served by the backend and verify its hash instead.
- A custom-format database backup must be restore-tested with the installed PostgreSQL major version before release. The existing restore runbook is destructive and must remain a human-controlled recovery action.
- `MANIFEST.sha256` is integrity metadata, not provenance. The final build pipeline should sign it or store its hash in an independently trusted change record.
- PostgreSQL credentials remain visible to privileged processes through child environment inspection. They are kept out of shell evaluation, command arguments, logs, and the public stage; host root can still inspect them by definition.
- Replacing `dist` is directory-level rather than a single-file rename because the destination name already exists. The service is stopped during this bounded window and the full old dist is backed up first.
- If schema 50 succeeds and later verification fails, recovery requires diagnosing/fixing forward or a deliberate database+binary+dist restore from the same backup. Never restore only the old binary against schema 50.

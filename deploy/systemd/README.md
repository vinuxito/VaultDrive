# ABRN systemd service assets

This directory documents the native ABRN service shape and retains the service-recovery helpers created on 2026-09-14. Those helpers are historical recovery tools. They are **not** the schema-50 release path and must not be used to install a backend, frontend, or migration independently.

Use the [coordinated release installer](../release/README.md) and the [ABRN coherence release runbook](../../docs/runbooks/abrn-coherence-release.md) for the schema 49→50 release. The final release verdict belongs in the [2026-09-16 verification report](../../docs/reports/2026-09-16-ui-ux-coherence-verification.md).

## Installed service contract

The reviewed ABRN service is expected to keep these boundaries:

- unit: `abrndrive.service`;
- backend port: `8082` through the existing public proxy;
- binary: `/usr/local/lib/abrndrive/abrndrive`;
- working tree and served frontend: `/lamp/www/ABRN-Drive` and `vaultdrive_client/dist`;
- protected environment: `/etc/abrndrive/runtime.env`;
- encrypted upload storage: the existing uploads bind path;
- database startup gate: local PostgreSQL readiness before the backend starts;
- restart behavior: systemd restarts the ABRN backend without involving QuantiX Drive.

The release procedure preserves the environment file, base unit, drop-ins and uploads. It stops only `abrndrive.service`, backs up the database, backend and frontend together, applies bundled migration 050, installs the paired artifacts, then verifies schema 50 and the exact backend/frontend identity.

## Historical recovery assets

`install-abrndrive.sh` and `prepare-runtime-env.py` were used to restore a missing ABRN service before the coherence release existed. The installer intentionally omits frontend and database migration coordination. Do not run it for the schema-50 release.

The `*.service.d/` files, `install-hardening.sh` and `wait-for-postgres.sh` record earlier reboot-hardening work for ABRN and QuantiX. Any future systemd change must be reviewed as its own release input, copied into a private user-owned stage, and applied through a procedure that preserves the existing protected configuration. Never sudo-execute a helper from the shared `/lamp/www` tree, and never restart both applications as a side effect of an ABRN release.

## Verification and remaining gates

The prior service-recovery report recorded a successful active/enabled check and public readiness at that dated checkpoint. Treat it as historical evidence rather than current release acceptance.

The coherence release still requires the administrator to record:

1. the exact installed build and schema-50 readiness;
2. local and public frontend byte identity;
3. ABRN-only service state before and after cutover;
4. reboot survival on the real host;
5. an observed coherent restore drill using the database, backend and frontend from one release backup.

Do not simulate the reboot gate by stopping the shared PostgreSQL service on the production host. Reboot and restore remain explicit manual gates until the final verification report records them.

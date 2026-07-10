# v9 — Operation Go Live in 24 Hours
> **Codename**: `está fácil`
> **Start**: 2026-07-09 @ 23:00 CST
> **Hard Deadline**: 2026-07-10 @ 23:00 CST
> **Auditor Basis**: [plans_vs_code_audit.md](../../docs/../plans/../plans/../docs/../docs/../../docs/../docs/plans_vs_code_audit.md) — historical verification report

---

## Mission

The code audit proves this app has **85.7% of its planned features built and shipped**. The 14.3% gap is not optional polish — it's the difference between a functional prototype and a product that **keeps its word**.

This plan closes that gap. In 24 hours, this app ships as real: **searchable**, **biometrically hardened**, **self-documented**, **preview-capable**, **signable**, and **offline-capable** for the most important scenario (read-only vault access).

**Every step is real code. No placeholders. No "we'll revisit".**

---

## Scope Summary — What Gets Built

| # | Step | Feature | Priority | Est. Time | Status |
|---|------|---------|----------|-----------|--------|
| 1 | [v9-step-01](./v9-step-01-file-search.md) | **Command Palette File Search** — search filenames (already decrypted client-side) via SWR cache in the Cmd+K panel | 🔴 Critical | ~3h | ⬜ Not Started |
| 2 | [v9-step-02](./v9-step-02-webauthn.md) | **WebAuthn Biometric Unlock** — use Passkey / PRF to derive or unlock the vault PIN without typing it | 🔴 Critical | ~4h | ⬜ Not Started |
| 3 | [v9-step-03](./v9-step-03-monitoring-dashboard.md) | **Live Monitoring Dashboard** — expose `/healthz`, Prometheus-style `/metrics`, and a front-end status panel | 🟠 High | ~2h | ⬜ Not Started |
| 4 | [v9-step-04](./v9-step-04-inline-preview.md) | **Inline File Preview** — decrypt-in-memory and stream images, PDFs, and text to a sandboxed viewer without downloading | 🟠 High | ~4h | ⬜ Not Started |
| 5 | [v9-step-05](./v9-step-05-openapi.md) | **OpenAPI + Developer Docs** — autogenerate Swagger spec from Go routes, serve at `/docs/api`, add crypto SDK README | 🟡 Medium | ~2h | ⬜ Not Started |
| 6 | [v9-step-06](./v9-step-06-zk-signatures.md) | **ZK Document Signatures** — client-side RSA sign + server-side receipt of signatures; verify signatures in the Vault | 🟡 Medium | ~4h | ⬜ Not Started |
| 7 | [v9-step-07](./v9-step-07-offline-vault.md) | **Offline Vault Mode** — service worker caches decrypted file listing + read-only file blobs for air-gapped or offline scenarios | 🟡 Medium | ~3h | ⬜ Not Started |

**Total estimated time**: ~22 hours *(tight but real)*

---

## Execution Rules

1. **Steps are sequential** — each step must be committed before starting the next.
2. **No scope creep** — if a task is not in the step file, it does not happen.
3. **Each step ends with a build + test verification** — `npm run build` + `go build ./...` must be green before marking done.
4. **Update this index's status column** after every step completes.
5. **Write a session memory file** under `docs/memories/` once all steps are done.

---

## Files This Plan Touches (Master List)

### Frontend (TypeScript / React)
- `vaultdrive_client/src/components/ui/command-palette.tsx` ← Step 1
- `vaultdrive_client/src/hooks/useFileSearch.ts` ← Step 1 (NEW)
- `vaultdrive_client/src/pages/login.tsx` ← Step 2
- `vaultdrive_client/src/hooks/useWebAuthn.ts` ← Step 2 (NEW)
- `vaultdrive_client/src/components/settings/WebAuthnSection.tsx` ← Step 2 (NEW)
- `vaultdrive_client/src/pages/settings.tsx` ← Step 2, 3
- `vaultdrive_client/src/pages/dashboard.tsx` ← Step 3
- `vaultdrive_client/src/components/ui/status-panel.tsx` ← Step 3 (NEW)
- `vaultdrive_client/src/components/files/InlinePreview.tsx` ← Step 4 (NEW)
- `vaultdrive_client/src/pages/files.tsx` ← Step 4, 6
- `vaultdrive_client/src/workers/preview.worker.ts` ← Step 4 (NEW)
- `vaultdrive_client/src/components/files/SignatureWidget.tsx` ← Step 6 (NEW)
- `vaultdrive_client/src/workers/offline-cache.sw.ts` ← Step 7 (NEW)
- `vaultdrive_client/src/hooks/useOfflineVault.ts` ← Step 7 (NEW)

### Backend (Go)
- `handle_v1_core.go` ← Step 3 (`/metrics`)
- `handle_files.go` ← Step 4 (stream endpoint), Step 6 (signatures table)
- `main.go` ← Step 5, 3
- `sql/schema/*.sql` ← Step 6 (signatures table migration)

### Documentation
- `docs/plans/v9-step-01-file-search.md`
- `docs/plans/v9-step-02-webauthn.md`
- `docs/plans/v9-step-03-monitoring-dashboard.md`
- `docs/plans/v9-step-04-inline-preview.md`
- `docs/plans/v9-step-05-openapi.md`
- `docs/plans/v9-step-06-zk-signatures.md`
- `docs/plans/v9-step-07-offline-vault.md`
- `docs/memories/SESSION_MEMORY_v9-go-live.md` ← Created at end

---

## Commit Convention

Each step should be committed as:
```
feat(v9/step-N): <short description>
```

Example:
```
feat(v9/step-1): add filename search to command palette via SWR cache
```

---

## Current State at Start of v9

| Subsystem | State |
|-----------|-------|
| E2E encrypted file upload/download | ✅ Working |
| SWR caching on `/api/files` | ✅ Working |
| Cmd+K Command Palette (navigation-only) | ✅ Working — needs file search |
| Shamir SSSS multi-custodian recovery | ✅ Working |
| ZK Chat Rooms (ECDH) | ✅ Working |
| Theme skins + View Transitions | ✅ Working |
| Rate limiting, CSP, HSTS | ✅ Working |
| PIN-based vault unlock | ✅ Working — needs biometric |
| File preview (inline) | ❌ Missing |
| WebAuthn biometric | ❌ Missing |
| Live monitoring dashboard | ⚠️ Partial (`/healthz` exists, no dashboard) |
| OpenAPI docs | ❌ Missing |
| ZK document signatures | ❌ Missing |
| Offline vault mode | ❌ Missing |

---

*This plan was generated from the historical audit on 2026-07-09 and represents the undeniable final push before public production launch.*

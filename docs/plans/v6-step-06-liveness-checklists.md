# Step 6: Live Smoke Testing & Production Readiness Checklists

This step outlines the final liveness check configurations and the 24-hour production launch checklist to move the codebases safely to production.

---

## 🎯 Goal
Define structured readiness audits, deploy the monitoring cron system, configure liveness/readiness API routes, and execute Playwright smoke tests against production endpoints.

---

## 🏗️ Liveness & Readiness Probes

The Go and PHP backends serve dedicated, unauthenticated status check endpoints:
- **Liveness (`GET /health`)**:
  - Confirms the web process is running. Returns `HTTP 200 { "status": "ok" }`.
- **Readiness (`GET /ready`)**:
  - Performs live dependency checks:
    - Verifies database socket connection.
    - Verifies Goose database migrations are up to date.
    - Verifies `/uploads` directory is writable.
    - Verifies JWT and crypto secrets exist in `.env`.
  - Returns `HTTP 200` if all checks pass, and `HTTP 503 Service Unavailable` with diagnostic JSON if any dependency fails.

---

## 🛡️ Staging Monitor & Health Recovery

Install the staging monitor script at `/lamp/www/uappgenerator/scripts/monitor-health.sh` to run via system crontab every 5 minutes:
```bash
*/5 * * * * /lamp/www/uappgenerator/scripts/monitor-health.sh >> /lamp/www/uappgenerator/storage/logs/monitor.log 2>&1
```
- The script polls the local database socket and HTTP endpoints.
- On failure, it automatically triggers a graceful restart of Apache and systemd services, notifying operators via logs.

---

## 📋 24-Hour Production Launch Checklist

| # | Task | Responsibility | Verification Command |
|---|------|----------------|----------------------|
| 1 | DB Migration Alignment | Go Backend / Goose | `goose -dir sql/schema postgres "$DB_URL" status` |
| 2 | Production `.env` Audit | Deployment | `php tests/secrets-test.php` (no raw credentials) |
| 3 | SSL Wildcard Certificate | Certbot / Let's Encrypt | `curl -Iv https://quantixdrive.filemonprime.net` |
| 4 | Client Build Optimizations | Frontend / Vite | `npm run build` (confirming dist output size) |
| 5 | E2E Integration Audit | Playwright | `npx playwright test` (all 48 checks green) |
| 6 | Security Headers Enforcement | Apache Vhosts | Verify `Strict-Transport-Security` and `X-Frame-Options` headers |

---

## 🧪 Verification Plan
- Run the quality gate suite:
  ```bash
  cd /lamp/www/uappgenerator
  bash scripts/test.sh --full
  ```
- Assert that all 9 gate checks report **GREEN**.

# Step 21 — Production Launch Checklist

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** VII — API & Documentation  
**Status:** 🔲 TODO  
**Priority:** CRITICAL — This is the final gate  

---

## Why This Matters

This is the last step before we call it production. Every item here must be verified with evidence. No assumptions. No "it should work." Only "I ran it, here's the output."

## The Checklist

### 🔐 Security
- [ ] Security headers active (Step 11) — securityheaders.com grade A+
- [ ] CSP configured — no console violations
- [ ] HTTPS enforced — HTTP redirects to HTTPS
- [ ] Rate limiting on all mutation endpoints (Step 12)
- [ ] JWT secret is production-grade (≥ 32 characters, not "local-dev-secret")
- [ ] CORS restricted to production domains only
- [ ] Argon2id enabled for all new accounts
- [ ] No debug endpoints exposed
- [ ] No development secrets in production .env files
- [ ] File upload size limits enforced
- [ ] SQL injection protection (parameterized queries throughout)

### 🗄️ Data
- [ ] Database backups automated (Step 13)
- [ ] Backup restore tested — row counts verified
- [ ] Upload directory backed up
- [ ] Offsite backup copy exists
- [ ] All migrations applied — `goose status` shows no pending
- [ ] Database connection pool sized correctly (`max_connections`)
- [ ] Database SSL enabled (if remote)

### 🚀 Performance
- [ ] Bundle size < 300KB gzip main chunk (Step 14)
- [ ] Lighthouse Performance ≥ 90 on mobile (Step 15)
- [ ] LCP < 2.5s, INP < 200ms, CLS < 0.1
- [ ] Static assets have immutable cache headers (Step 16)
- [ ] Brotli compression enabled
- [ ] Font loading optimized (preload, swap)

### 🧪 Testing
- [ ] Unit tests: 31+ files, 116+ assertions, 0 failed
- [ ] E2E tests: 42+ passed, 0 failed
- [ ] TypeScript: 0 errors
- [ ] Go vet: 0 issues
- [ ] Go test -race: pass
- [ ] Production build: clean
- [ ] i18n: zero hardcoded strings (Step 8)

### 📡 Infrastructure
- [ ] DNS records verified — both domains resolve correctly
- [ ] SSL certificates valid and auto-renewing (Let's Encrypt)
- [ ] Apache proxy configuration verified
- [ ] Systemd services enabled and running
- [ ] Systemd restart policy: `Restart=always`
- [ ] Log rotation configured (Step 19)
- [ ] Disk space monitoring active
- [ ] Upload directory exists with correct permissions

### 📊 Monitoring
- [ ] Uptime monitor configured for both URLs (Step 19)
- [ ] Health endpoint returns version and DB status
- [ ] Error alerting configured (email/Telegram)
- [ ] Disk space alert at 90% threshold

### 🔄 CI/CD
- [ ] GitHub Actions pipeline active (Step 17)
- [ ] Deploy script tested — `deploy.sh both` works (Step 18)
- [ ] Rollback script tested — previous version restarts cleanly
- [ ] Branch protection enabled on `main`

### 📖 Documentation
- [ ] README current with all features
- [ ] OpenAPI spec published (Step 20)
- [ ] In-app Help Center complete (EN/ES)
- [ ] Recovery runbook documented
- [ ] Deploy runbook documented
- [ ] Session memories complete for audit trail

### 🎨 User Experience
- [ ] All 6 skins WCAG AA compliant
- [ ] Mobile responsive — tested on real device
- [ ] Accessibility: skip link, focus-visible, ARIA, reduced motion
- [ ] Command palette works (Cmd+K)
- [ ] File upload with encryption proof
- [ ] Share link with zero-knowledge verification
- [ ] Drop upload works for anonymous users
- [ ] File requests work end-to-end
- [ ] Onboarding flow complete (register → PIN → vault)
- [ ] i18n: EN and ES-MX fully translated

### 🏢 Both Drives
- [ ] QuantiX Drive: healthz 200, SPA loads, login works
- [ ] ABRN Drive: healthz 200, SPA loads, login works
- [ ] Database schemas identical (goose status matches)
- [ ] Both drives using correct branding
- [ ] Both drives using correct logos
- [ ] Both drives using separate databases

## Go / No-Go Decision

| Area | Status | Notes |
|------|--------|-------|
| Security | 🔲 | Pending Steps 11-12 |
| Data | 🔲 | Pending Step 13 |
| Performance | 🔲 | Pending Steps 14-16 |
| Testing | ✅ | All green |
| Infrastructure | ✅ | Both services healthy |
| Monitoring | 🔲 | Pending Step 19 |
| CI/CD | 🔲 | Pending Steps 17-18 |
| Documentation | ⚠️ | Pending Steps 8, 20 |
| UX | ⚠️ | Pending Step 8 (i18n) |
| Both Drives | ✅ | Synced and healthy |

**Decision:** When all areas show ✅, we launch.

---

## Launch Day Runbook

```bash
# 1. Final test run
cd /lamp/www/QuantiX-Drive
cd vaultdrive_client && npx vitest run && npx playwright test && cd ..
go vet ./... && go test -race ./...

# 2. Deploy both
./scripts/deploy.sh both

# 3. Verify both drives
curl -s https://quantixdrive.filemonprime.net/quantix/api/healthz | jq .
curl -s https://abrndrive.filemonprime.net/api/healthz | jq .

# 4. Manual smoke test
# - Register new account on each drive
# - Upload file, verify encryption proof
# - Create share link, access from incognito
# - Switch to Spanish, verify all strings translated
# - Open on mobile, verify responsive layout

# 5. Confirm backups ran
ls -la /var/backups/quantix-drive/

# 6. Confirm monitoring
# - Check UptimeRobot shows green
# - Check security headers scan shows A+

# 7. Tag release
git tag v1.0.0
git push origin v1.0.0

# 8. Celebrate 🎉
```

> The customer opens the app and thinks: *"This is not a side project."*

# Step 17 — GitHub Actions: Test Pipeline

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** VI — DevOps & CI/CD  
**Status:** 🔲 TODO  
**Priority:** HIGH — Prevents shipping broken code  

---

## Why This Matters

Right now, the test suite only runs when a developer remembers to run it. In production, every push to `main` should automatically: type-check, lint, unit-test, build, and E2E-test. If any step fails, the push is blocked. No exceptions.

## What We Will Build

### GitHub Actions Workflow

**New file:** `.github/workflows/ci.yml`

```yaml
name: CI Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  GO_VERSION: '1.25'
  NODE_VERSION: '22'

jobs:
  backend:
    name: Go Backend
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: ${{ env.GO_VERSION }}
      - name: Go Vet
        run: go vet ./...
      - name: Go Test
        run: go test -race -count=1 ./...
        env:
          DB_URL: postgres://postgres:postgres@localhost:5432/test?sslmode=disable

  frontend-lint:
    name: TypeScript & Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: vaultdrive_client/package-lock.json
      - run: cd vaultdrive_client && npm ci
      - name: TypeScript Check
        run: cd vaultdrive_client && npx tsc --noEmit
      - name: Build
        run: cd vaultdrive_client && npm run build

  frontend-test:
    name: Unit Tests (Vitest)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: vaultdrive_client/package-lock.json
      - run: cd vaultdrive_client && npm ci
      - name: Vitest
        run: cd vaultdrive_client && npx vitest run --reporter=verbose

  e2e:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest
    needs: [backend, frontend-lint]
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: ${{ env.GO_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: vaultdrive_client/package-lock.json
      - run: cd vaultdrive_client && npm ci
      - name: Install Playwright Browsers
        run: cd vaultdrive_client && npx playwright install --with-deps chromium
      - name: Run Playwright E2E
        run: cd vaultdrive_client && npx playwright test --reporter=list
        env:
          CI: true
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: vaultdrive_client/playwright-report/
          retention-days: 7
```

### Branch Protection Rules

In GitHub Settings → Branches → `main`:
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date
- Required checks: `Go Backend`, `TypeScript & Lint`, `Unit Tests (Vitest)`, `E2E Tests (Playwright)`

## Verification

| Check | Expected Result |
|-------|----------------|
| Push to main triggers workflow | ✅ All 4 jobs run |
| PR to main triggers workflow | ✅ All 4 jobs run |
| Backend job passes | ✅ go vet + go test |
| Lint job passes | ✅ tsc + build |
| Unit test job passes | ✅ 31+ files, 116+ assertions |
| E2E job passes | ✅ 42+ tests |
| Failed test blocks merge | ✅ Branch protection active |
| Playwright report uploaded on failure | ✅ Available as artifact |

## Files to Create

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | CI pipeline definition |
| GitHub Settings (manual) | Branch protection rules |

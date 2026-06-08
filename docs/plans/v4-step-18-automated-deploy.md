# Step 18 — Automated Deployment

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** VI — DevOps & CI/CD  
**Status:** 🔲 TODO  
**Priority:** MEDIUM — Reduces human error  
**Depends on:** Step 17 (GitHub Actions)  

---

## Why This Matters

Today, deployment is manual: `make deploy` → restart systemd → smoke test. Every manual step is a chance for error — forgetting to run migrations, deploying to one drive but not the other, forgetting to rebuild the frontend. Automation makes deployment boring and reliable.

## Current Deploy Process (Manual)

```bash
# 1. Build frontend
cd vaultdrive_client && npm run build && cd ..

# 2. Build Go binary
go build -ldflags="-w -s" -o quantixdrive .

# 3. Copy binary
sudo cp quantixdrive /usr/local/bin/quantixdrive

# 4. Run migrations
goose -dir sql/schema postgres "$DB_URL" up

# 5. Restart service
sudo systemctl restart quantixdrive

# 6. Smoke test
curl -s https://quantixdrive.filemonprime.net/quantix/api/healthz

# 7. Repeat for ABRN (different binary name, different DB)
```

## What We Will Build

### 1. Deploy Script

**New file:** `scripts/deploy.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

PRODUCT="${1:?Usage: deploy.sh <quantix|abrn|both>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

deploy_quantix() {
  echo "═══ Deploying QuantiX Drive ═══"
  
  # Build frontend
  cd "$PROJECT_DIR/vaultdrive_client"
  npm run build
  
  # Build binary
  cd "$PROJECT_DIR"
  go build -ldflags="-w -s" -o quantixdrive .
  
  # Run migrations
  source /etc/quantix/quantixdrive.env
  goose -dir sql/schema postgres "$DB_URL" up
  
  # Deploy binary
  sudo cp quantixdrive /usr/local/bin/quantixdrive
  sudo systemctl restart quantixdrive
  
  # Smoke test
  sleep 2
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' https://quantixdrive.filemonprime.net/quantix/api/healthz)
  if [ "$STATUS" = "200" ]; then
    echo "✅ QuantiX Drive deployed successfully"
  else
    echo "❌ QuantiX Drive healthz returned $STATUS"
    exit 1
  fi
}

deploy_abrn() {
  echo "═══ Deploying ABRN Drive ═══"
  
  # Build frontend (ABRN branding)
  cd "$PROJECT_DIR/vaultdrive_client"
  npm run build -- --mode abrn  # Uses .env.abrn
  
  # Build binary
  cd "$PROJECT_DIR"
  go build -ldflags="-w -s" -o abrndrive .
  
  # Run migrations
  source /lamp/www/ABRN-Drive/.env
  goose -dir sql/schema -allow-missing postgres "$DB_URL" up
  
  # Deploy binary
  sudo cp abrndrive /lamp/www/ABRN-Drive/abrndrive
  sudo systemctl restart abrndrive
  
  # Smoke test
  sleep 2
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' https://abrndrive.filemonprime.net/api/healthz)
  if [ "$STATUS" = "200" ]; then
    echo "✅ ABRN Drive deployed successfully"
  else
    echo "❌ ABRN Drive healthz returned $STATUS"
    exit 1
  fi
}

case "$PRODUCT" in
  quantix) deploy_quantix ;;
  abrn) deploy_abrn ;;
  both) deploy_quantix && deploy_abrn ;;
  *) echo "Unknown product: $PRODUCT" && exit 1 ;;
esac

echo "═══ Deployment complete ═══"
```

### 2. GitHub Actions Deploy (Optional)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  workflow_dispatch:
    inputs:
      target:
        description: 'Deploy target'
        required: true
        type: choice
        options: [quantix, abrn, both]

jobs:
  deploy:
    runs-on: self-hosted  # Runs on the production server
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/deploy.sh ${{ inputs.target }}
```

> **Note:** This requires a self-hosted runner on the production VPS. Alternative: use SSH deploy via `appleboy/ssh-action`.

### 3. Rollback Script

**New file:** `scripts/rollback.sh`

```bash
#!/usr/bin/env bash
# Keep the previous binary as a backup
# deploy.sh should: cp /usr/local/bin/quantixdrive /usr/local/bin/quantixdrive.prev
# rollback.sh: cp /usr/local/bin/quantixdrive.prev /usr/local/bin/quantixdrive

PRODUCT="${1:?Usage: rollback.sh <quantix|abrn>}"
# ... rollback logic
```

## Verification

| Check | Expected Result |
|-------|----------------|
| `./scripts/deploy.sh both` | ✅ Both drives deployed + smoke tested |
| Failed healthz aborts deploy | ✅ Script exits with error |
| Migrations run automatically | ✅ No manual goose step |
| Rollback restores previous binary | ✅ Previous version starts |

## Files to Create

| File | Purpose |
|------|---------|
| `scripts/deploy.sh` | Automated deploy for both drives |
| `scripts/rollback.sh` | Quick rollback to previous version |
| `.github/workflows/deploy.yml` (optional) | Manual trigger deploy from GitHub |

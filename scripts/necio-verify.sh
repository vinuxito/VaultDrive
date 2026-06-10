#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color
GOLD='\033[0;33m'

# Ensure we start in the repository root directory (where main.go lives)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo -e "${GOLD}👴 Starting Necio QA Verification for ABRN-Drive...${NC}\n"

# 1. Run backend Go tests
echo -e "Executing backend Go tests..."
go test -count=1 ./...

# 2. Run Vitest unit tests
echo -e "\nExecuting frontend Vitest unit tests..."
cd vaultdrive_client
npm run test

# 3. Build frontend
echo -e "\nRunning production Vite compilation..."
npm run build

# 4. Run Playwright E2E tests
echo -e "\nExecuting Playwright E2E tests sequentially..."
npx playwright test --workers=1

# Output success banner
echo -e "\n${GREEN}"
cat << "EOF"
┌────────────────────────────────────────────────────────┐
│   👴🔥 PINCHE VIEJITO QA CERTIFICATION - ABRN DRIVE   │
│                                                        │
│  [+] Backend Tests:        PASS                        │
│  [+] Frontend Vitest:      PASS                        │
│  [+] Frontend Production:  PASS                        │
│  [+] E2E Playwright:       PASS                        │
│                                                        │
│  VEREDICTO FINAL: ESTÁ FÁCIL (QA CERTIFIED)            │
└────────────────────────────────────────────────────────┘
EOF
echo -e "${NC}\n"

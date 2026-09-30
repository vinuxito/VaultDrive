# Step 07: Cross-Platform Journey Verification & CI Quality Gate

- **Title**: Autonomous Cross-Platform Journey Verification & CI Gate
- **Category**: `testing / observability`
- **Owner**: QA Lead / DevEx & Automation
- **Affected Files**:
  - `vaultdrive_client/e2e/golden-journeys.spec.ts`
  - `scripts/check-coherence.sh`
  - `.github/workflows/ci.yml`
  - `docs/reports/`

---

## 1. Why It Matters Now

ABRN Drive maintains 110 unit test files (528 passing tests), but unit tests run in a synthetic Node.js / JSDOM environment without real browser layout engines, touch layers, or network throttles.

To permanently protect the **Experiencia de Barrio Nivel Dios** and prevent regression drift, the repository requires:
1. Automated cross-platform execution of the **5 Golden User Journeys** across both Desktop Chrome and Native Android 13 (Waydroid LineageOS 20).
2. An automated CI quality gate (`scripts/check-coherence.sh`) that halts commits containing hardcoded unlocalized strings, snake_case database slugs in JSX, or touch targets smaller than 44px.

---

## 2. What Exactly Should Be Done

### A. Formalize the 5 Golden User Journeys
Author `vaultdrive_client/e2e/golden-journeys.spec.ts` modeling the complete lifecycle of everyday work:

1. **Journey J1: The Sovereign Upload (Owner)**
   - Enter credentials on `/login` -> redirects cleanly to `/files`.
   - Tap FAB or desktop "Subir Archivo" -> upload fixture file.
   - Verify Frame-0 optimistic appearance, green status halo, and Golden SHA-256 seal.
2. **Journey J2: Zero-Friction Sharing (WhatsApp Card)**
   - Tap file row -> "Compartir rápido".
   - Verify modal generates WhatsApp share URL and security receipt.
   - Assert ephemeral key is wiped from memory upon modal dismissal.
3. **Journey J3: The Sacred Client Intake (Public Drop)**
   - Open `/drop/:token` as an unauthenticated external client.
   - Simulate throttled mobile connection (Slow 3G).
   - Drop 2 files -> verify upload progress bar -> verify **El Recibo Sagrado** displays with unique Folio code and timestamp.
4. **Journey J4: The Sovereign Sever (Access Center)**
   - Open `/access-center` -> filter by "Activos".
   - Tap "Revocar acceso" on an active route.
   - Verify route immediately severs; recipient attempting to download receives HTTP 404/410.
5. **Journey J5: Privacy Lock & Couch Unlock**
   - Press `⌘L` or trigger 3-minute inactivity shutter.
   - Verify Privacy Shutter masks the viewport.
   - Enter 4-digit PIN -> verify instant unlock and return to exact previous view without reload.

### B. Implement the Automated Coherence Quality Gate
Create executable script `scripts/check-coherence.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "🛡️ Running ABRN Coherence Quality Gate..."

# 1. Ban raw snake_case database event slugs in JSX
if grep -rnE "\{[^}]*(folder_share_link_created|secure_drop_created|file_uploaded)[^}]*\}" vaultdrive_client/src/pages/; then
  echo "❌ Error: Found raw snake_case database slugs rendered in JSX."
  exit 1
fi

# 2. Ban common hardcoded English text in user-facing pages
if grep -rnE "> *(Folder share|Copy full link|Drop link|Manage Drop route) *<" vaultdrive_client/src/pages/; then
  echo "❌ Error: Found hardcoded English strings in pages. Use t('drive:...') instead."
  exit 1
fi

# 3. Verify mobile touch targets
if grep -rnE "class.*(w-6 h-6|w-7 h-7)" vaultdrive_client/src/components/mobile/; then
  echo "❌ Error: Mobile components must have touch targets >= 44px (min-h-[44px])."
  exit 1
fi

echo "✅ All coherence checks passed."
```

### C. Continuous Native Mobile Verification via Waydroid
Wire `filemon_mobile_client.py audit` into the release runbook and CI runner to ensure every candidate build is audited on native Android 13 prior to release sign-off.

---

## 3. What Existing Work It Builds On
- Builds on existing Playwright suite (`v11-sovereign-vault-ux.spec.ts`).
- Builds on the Waydroid Android 13 client (`filemon_mobile_client.py`).
- Builds on `scripts/run-tests.sh`.

---

## 4. What Risks It Avoids
- Avoids silent regression drift where a developer inadvertently adds hardcoded English or breaks mobile touch targets.
- Prevents release of builds that compile in JSDOM but stutter or break on physical mobile devices.

---

## 5. Expected Payoff
- Complete automated confidence in production readiness.
- 100% reproducible verification evidence adhering to the 8K Reality Standard.

---

## 6. Definition of Done & Testable Acceptance Criteria

1. **Automated E2E Suite**:
   - `npm run test:e2e` executes all 5 Golden Journeys against isolated database `abrn_playwright` on port 8094; exit code 0.
2. **Coherence Script**:
   - `bash scripts/check-coherence.sh` exits with code 0.
3. **Android 13 Mobile Audit**:
   - `python3 .agents/skills/filemon-remote-mobile/scripts/filemon_mobile_client.py audit https://abrndrive.filemonprime.net/abrn/files` exits with `Verdict: PASSED`.

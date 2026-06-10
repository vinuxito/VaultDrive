# 👴🔥 PINCHE VIEJITO NECIO QA HANDBOOK v2.0 (ABRN Drive Downstream)
## Playwright & Browser Tools Automation Guide

This guide details the exact elements, route endpoints, DOM selectors, configurations, and verification commands required to execute the full E2E QA certification for **ABRN-Drive** downstream. Use this document as the direct source of truth for browser automation tools.

---

## 1. Core Endpoints & Probes

### Production Environment
* **Base Path:** `/abrn`
* **API Prefix:** `/abrn/api`

### Testing / Playwright Environment
* **Base Path:** `/quantix`
* **API Prefix:** `/quantix/api` (Port `8090` locally)

| Domain | URL Path (Test/Playwright) | Method | Expected Response | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Liveness** | `/health` | `GET` | `200 OK` (JSON) | Verifies server liveness and uptime |
| **Readiness** | `/ready` | `GET` | `200 OK` (JSON) | Verifies DB, migrations, upload dir writability |
| **Files API** | `/quantix/api/files` | `GET` | `200 OK` (JSON) | List files (requires JWT auth) |
| **Public Share Info** | `/quantix/api/share/{token}/info` | `GET` | `200 OK` (JSON) | Get status (is_locked, is_shredded) |

---

## 2. Onboarding & Folder Seeding Verification
Verify that a newly registered user instantly has folders seeded in their vault root instead of facing a blank desierto.

- **Golden Path Steps:**
  1. Navigate to `/quantix/register`.
  2. Input username, password, email, and submit.
  3. Navigate to `/quantix/login`, input credentials, and verify shell entry.
  4. Wait for redirect to `/quantix/files`.
- **Target DOM Selectors / Assertions:**
  - Verify folder element list exists.
  - Locate `text=My Vault` or `[data-testid="folder-item-my-vault"]`.
  - Locate `text=External Drops` or `[data-testid="folder-item-external-drops"]`.

---

## 3. Ephemeral sessionStorage PIN Caching
Verify that credential vault caching eliminates PIN prompting fatigue.

- **Golden Path Steps:**
  1. Access `/quantix/login`, authenticate, and complete the PIN setup prompt.
  2. Perform file upload to `/quantix/files`.
  3. Click to create a shared link.
- **Verification via Browser Console:**
  - Execute JS in console: `sessionStorage.getItem("vault_cached_credential")`
  - Assert that it returns an encrypted ciphertext string, not `null`.
  - Trigger "Share File" modal; verify that the PIN setup/unlock prompt is skipped automatically.

---

## 4. Toast & Copy Confirming Badge
Verify that copy indicators flash clearly to guarantee clipboard capture.

- **Target DOM Selectors:**
  - **Copy Trigger Button:** `[data-testid="copy-share-link"]` or `button:has-text("Copy")`
  - **Flash Alert Badge:** `text="Copied!"` or `.copy-success-badge`
- **Assertion:**
  - Click copy button.
  - Assert that `text="Copied!"` is visible.
  - Wait 4.5 seconds and assert that `text="Copied!"` is no longer visible.

---

## 5. Time-Locked & Shredding Link Lifecycle
Verify that keys automatically autodestruct and respect locks, displaying ABRN's brand specific ticking clock hands.

- **ABRN Branding Check:**
  - Locate the SVG clock element under the shared link detail card.
  - Check for the existence of `#hourHand` and `#minHand` lines with `<animateTransform>` tags to confirm the rotating clock hands animation is active.
- **Create Configuration:**
  - Share link payload POST `quantix/api/files/{id}/share-link` fields:
    ```json
    {
      "expires_at": "2026-06-16T12:00:00Z",
      "max_downloads": 1,
      "unlock_at": "2026-06-09T23:59:00Z"
    }
    ```
- **Assertions:**
  1. Call GET `/quantix/api/share/{token}/info` before unlock time: `is_locked` must be `true`.
  2. GET `/quantix/api/share/{token}` returns `403 Forbidden`.
  3. Call GET `/quantix/api/share/{token}/info` after unlock time: `is_locked` must be `false`.
  4. GET `/quantix/api/share/{token}` returns `200 OK` (download succeeds).
  5. Call GET `/quantix/api/share/{token}` again: returns `410 Gone`.
  6. Call GET `/quantix/api/share/{token}/info`: `is_shredded` is `true`.

---

## 6. Mobile Gestural Backdrop Dismissal
Verify that mobile bottom sheets close properly and coordinates bypass backdrop interception.

- **Viewport Size:** `390x844` (iPhone emulation)
- **Path Steps:**
  1. Open `/quantix/files` on mobile viewport.
  2. Locate and click trigger: `[data-testid^="file-actions-"]`.
  3. Drawer `.mock-drawer` or `[data-testid$="-content"]` becomes visible.
  4. Perform backdrop click using a coordinate offset:
     ```typescript
     // Playwright code:
     const backdrop = page.locator('[data-testid$="-backdrop"]').first();
     await backdrop.click({ position: { x: 10, y: 10 }, force: true });
     ```
  5. Assert that the drawer `.mock-drawer` or `[data-testid$="-content"]` is no longer visible.

---

## 7. Shamir Secret Sharing Recovery (SSSS)
Verify that lost passwords can be reset via SSSS custodian consensus under ABRN's burgundy theme branding (`#7a1f2b`).

- **ABRN Branding Check:**
  - Verify that the SSSS Recovery wizard displays ABRN's progress timeline checklist styles instead of QuantiX's neon Hexagonal network representation.
- **Locators & Flow Selectors:**
  1. **Custodian Setup (Settings > Security tab):**
     - Select tab: `role=tab[name="Security"]`
     - Search field: `#custodian-search`
     - Add button: `button:has-text("@username")`
     - Threshold select: `#threshold-select`
     - Save button: `button:has-text("Enable Custodian Recovery")`
  2. **Triggering Recovery (Login > Recover button):**
     - Link to recover: `button:has-text("Recover Lost Account")`
     - Username field: `#recover-username`
     - Request button: `button:has-text("Request Account Recovery")`
     - Wait screen banner: `text="Waiting for custodians to decrypt and approve shares..."`
  3. **Custodian Approval (Settings > Security tab):**
     - Approve button: `button:has-text("Approve Recovery")`
     - Password field: `[id^="approve-password-"]`
     - Success banner: `text="Aprobación enviada con éxito para"`
  4. **Password Reset (Owner wizard):**
     - New password field: `#new-password`
     - Confirm password field: `#confirm-password`
     - Submit button: `button:has-text("Recover & Reset Account")`
     - Success banner: `text="Account Recovered Successfully"`

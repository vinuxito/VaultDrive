# Step 4: E2E Smoke Verification & HTML Report

This step performs full system verification, generates the documentation, and closes out the operation.

---

## 🎯 Goal
Execute all tests, compile a visually stunning HTML QA report proving theme coherence and visual beauty, and document the design constraints and linter setups in the main README.

---

## 🏗️ Proposed Changes

### 1. Execute Validation Suite
#### [RUN] [necio-verify.sh](file:///lamp/www/ABRN-Drive/scripts/necio-verify.sh)
- Ensure all backend Go tests, frontend Vitest tests, production Vite builds, and Playwright E2E tests pass.

### 2. Generate HTML Verification Report
#### [NEW] [docs/reports/v7-coherence-verification-report.html](file:///lamp/www/ABRN-Drive/docs/reports/v7-coherence-verification-report.html)
- Generate a beautiful HTML QA report documenting the visual status, tests executed, and visual screenshot references.

### 3. Update Documentation
#### [MODIFY] [README.md](file:///lamp/www/ABRN-Drive/README.md)
- Update the styling and theming section to document:
  - The skin variable maps.
  - The Tailwind v4 restriction setup.
  - The pre-commit hook sanitization workflows.

---

## 🧪 Verification Plan
- Assert that the final verification HTML file is rendered, readable, and structured in high-contrast styling.

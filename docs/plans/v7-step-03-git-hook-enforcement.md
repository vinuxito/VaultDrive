# Step 3: Pre-Commit & Verification Automation

This step implements the automated gatekeepers to guarantee the long-term styling integrity of the project.

---

## 🎯 Goal
Prevent the introduction of hardcoded color overrides by integrating linting checks and the color-sanitization script directly into the git pre-commit lifecycle.

---

## 🏗️ Proposed Changes

### 1. Pre-commit Hook Integration
#### [NEW] [.husky/pre-commit](file:///lamp/www/ABRN-Drive/.husky/pre-commit)
- Add a pre-commit hook that triggers `lint-staged`.

#### [MODIFY] [package.json](file:///lamp/www/ABRN-Drive/package.json)
- Add dependencies/scripts for `husky` and `lint-staged`.
- Configure `lint-staged` to run the formatting and color sanitization verification on modified `.tsx` and `.ts` files:
  ```json
  "lint-staged": {
    "vaultdrive_client/src/**/*.{ts,tsx}": [
      "python3 vaultdrive_client/fix_slate_neutrals.py",
      "python3 vaultdrive_client/fix_hardcoded_colors.py",
      "npm run lint"
    ]
  }
  ```

---

## 🧪 Verification Plan
- **Pre-commit Trigger Smoke**: Introduce a dummy change in a component containing `bg-white` or `border-slate-200`, attempt to commit, and verify that the hook runs, corrects the files automatically, and commits the clean code.

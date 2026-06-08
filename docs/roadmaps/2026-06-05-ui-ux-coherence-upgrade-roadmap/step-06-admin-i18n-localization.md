# Step 6 — Admin Panel i18n Localization & Confirmation Modals

- **Title:** Admin Panel i18n Localization & Confirmation Modals
- **Category:** Product / Testing
- **Why it matters now:**  
  While the public and core user pages are fully translated to Spanish-MX, the administrative pages (`vaultdrive_client/src/pages/admin.tsx` and `admin-tests.tsx`) are completely locked in English. This ruins visual coherence for Spanish enterprise deployments. Additionally, the admin panel contains 6 browser-level `confirm()` calls for deleting users and resetting PINs, which clash with the application's premium aesthetic.
- **What exactly should be done:**  
  1. Wrap all hardcoded text strings inside `admin.tsx` and `admin-tests.tsx` with Vite translation `t()` calls.
  2. Populate the `admin` namespace inside `locales/en/` and `locales/es/` with matching JSON translations.
  3. Replace the 6 browser `confirm()` popups with custom confirmation modals sourced from the `CONFIRM_DESTRUCTIVE` map inside `constants/copy.ts`.
  4. Ensure correct ARIA labeling for admin tables and logs lists to pass screen reader validation.
- **What existing work it builds on:**  
  - The `react-i18next` localized setup.
  - The shared `constants/copy.ts` destructive modal copy.
  - The `LanguageToggle` layout element.
- **What risks it avoids:**  
  - Tonal clashing (switching from a Spanish dashboard to English admin panels).
  - Accidental admin deletions due to browser `confirm()` popup dismissals.
  - Accidental leaks of un-translated administrative logs.
- **Expected payoff:**  
  - 100% Spanish localization parity across the entire product.
  - Consistent premium look-and-feel even on management screens.
- **Definition of Done:**  
  - [ ] No hardcoded text strings remain in `admin.tsx` or `admin-tests.tsx` (`grep` check).
  - [ ] Spanish locale file `es/drive.json` (or `es/admin.json`) contains translations for all admin labels.
  - [ ] Zero browser-level `confirm()` calls remain in `admin.tsx`.
  - [ ] Playwright E2E verifies admin resetting a user's PIN is fully localized and uses the custom confirmation modal.

# Step 7: E2E Tests & QA

**Objective:** Update the Playwright E2E test suite to ensure that language features don't break existing flows and that the UI handles both languages correctly.

## Action Plan

### 1. Refactor Selectors
Currently, Playwright tests might rely on text content for locators:
`page.getByRole('button', { name: 'Upload' })`

This breaks if the language changes. We need to transition to robust data attributes:
`page.getByTestId('upload-button')`

### 2. Multi-Language Test Matrix
Configure Playwright to run critical paths (Login, Upload, Share) in both `en` and `es` locales.
We can do this by setting the browser's locale in the Playwright context:
```typescript
test.use({ locale: 'es-MX' });
```

### 3. Visual Regression (Snapshots)
Because Spanish strings are often longer, we should add snapshot tests for key modals and views to detect CSS breaking or text overflowing unexpectedly.
- Take a snapshot of the Share Modal in English.
- Take a snapshot of the Share Modal in Spanish.

### 4. Manual QA Pass
Once automation is updated, perform a manual walkthrough of the app in Spanish.
- Pay attention to the Settings toggle logic.
- Look for untranslated strings (hardcoded strings that were missed).
- Verify email notifications (if implemented) trigger in the correct language.

## Verification
- Run `npm run test:e2e` and verify all tests pass across both locales.
- Review Playwright HTML report to ensure no tests fail due to "element not found" (which would indicate a lingering text-based selector).

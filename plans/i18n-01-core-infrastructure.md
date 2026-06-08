# Step 1: Core Infrastructure

**Objective:** Install the required dependencies and wire up the core i18n infrastructure in the React application. 

## Action Plan

### 1. Install Dependencies
Run the following inside `vaultdrive_client/`:
```bash
npm install i18next react-i18next i18next-browser-languagedetector i18next-http-backend
```

### 2. Initialize `i18n.ts`
Create `src/i18n/index.ts`. This file will configure the `i18next` instance:
- Set `fallbackLng: 'en'`.
- Set `supportedLngs: ['en', 'es']`.
- Integrate the browser language detector.
- Load translations dynamically (or bundle them initially if they are small enough).

### 3. Wire Provider into `main.tsx`
Import `src/i18n/index.ts` into the root entry point (`main.tsx` or `App.tsx`) before the React tree renders.
- Wrap the app in `<Suspense>` to handle loading states while translation files are fetched.

### 4. Build the Language Switcher Component
Create a reusable `<LanguageSelector />` component (e.g., using a Radix UI dropdown or standard select).
- Options: "English (US)" and "Español (México)".
- Action: `i18n.changeLanguage(selectedLang)`.
- Persist: The selection will automatically be saved to `localStorage` by the language detector plugin, but we should also fire an API call to save it to the user's backend profile (if applicable) so their language preference travels across devices.

### 5. Integrate into Settings
Add the `<LanguageSelector />` to the main Settings view of QuantiX-Drive. Ensure it is highly visible.

## Verification
- Changing the language from the dropdown instantly updates any translated text on the screen without a page refresh.
- Refreshing the page retains the selected language.

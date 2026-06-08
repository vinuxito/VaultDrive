# Step 0: Architecture Decision

**Objective:** Define the technical approach for implementing internationalization (i18n) across the frontend (React/Vite) and backend (Go), ensuring it's robust enough for QuantiX-Drive and reusable for ABRN-Drive.

## Frontend Decision: `i18next` + `react-i18next`

We will use `i18next` as our core internationalization framework for the `vaultdrive_client` React app.

**Why i18next?**
1. **Industry Standard:** It is the most battle-tested i18n library in the React ecosystem.
2. **Namespacing:** It allows us to split translations into multiple files (e.g., `auth.json`, `drive.json`, `common.json`), keeping bundle sizes small and organized.
3. **Interpolation & Pluralization:** It handles dynamic variables (e.g., "Downloading {{count}} files...") natively.
4. **Language Detection:** We can use `i18next-browser-languagedetector` to automatically select English or Spanish based on the user's browser settings on first load.

## Backend Decision: `Accept-Language` Interception in Go

Our Go backend currently returns hardcoded English errors (e.g., "Invalid credentials", "File not found").

**Approach:**
1. **Middleware:** Create an `Accept-Language` parsing middleware in Go that detects if the client wants `en` or `es-MX`.
2. **Dictionary Map:** Implement a lightweight map-based dictionary in Go for common API errors.
3. **Response Wrapping:** When returning an error, map the internal error code to the localized string before sending the JSON response.

## Downstream Strategy for ABRN-Drive

To ensure this works for ABRN-Drive, we will:
1. **Parameterize Brand Names:** Instead of hardcoding "Welcome to QuantiX-Drive" in the JSON, we use "Welcome to {{brandName}}".
2. **Override Files:** ABRN-Drive will inherit the core `en.json` and `es.json` files but will have an `abrn-overrides.json` file to replace any specific terminology if needed.
3. **Shared UI Library:** Ensure that components relying on translations accept translation keys rather than hardcoded English strings.

## Success Criteria for this Step
- Architecture decisions are documented and approved.
- The separation of concerns between frontend UI text and backend error text is clearly defined.

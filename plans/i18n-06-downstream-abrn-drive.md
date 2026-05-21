# Step 6: Downstream to ABRN-Drive

**Objective:** Ensure the i18n infrastructure built for QuantiX-Drive seamlessly ports over to ABRN-Drive, honoring its brand identity.

## Action Plan

### 1. Parameterize Brand Elements
Do not hardcode "QuantiX" in the translation files unless it's a structural key. 
- Bad: `"welcome_msg": "Welcome to QuantiX-Drive"`
- Good: `"welcome_msg": "Welcome to {{brandName}}"`

In the React initialization (`i18n.ts`), we will pass global variables or define `brandName` based on the `.env` variables (e.g., `VITE_APP_NAME=ABRN-Drive`).

### 2. Theme-Agnostic Terminology
Whenever possible, use generic terminology that applies to both platforms. 
- "Your Drive" or "Your Vault" -> "Tu Unidad" or "Tu Bóveda". 
If ABRN specifically mandates a different term (e.g., they prefer "Bóveda" over "Unidad"), we need an override mechanism.

### 3. Override Files for ABRN
Create a structured way for ABRN-Drive to override specific dictionary keys without modifying the core files.
- During build time (Vite) or runtime (i18next config), load the core `es.json` files, then deeply merge an `abrn-es-overrides.json` file over them.
- This ensures 99% of the translations are shared, but ABRN-Drive can customize specific phrases.

### 4. Backend Downstream
The Go backend logic (`Accept-Language` parsing and the error dictionary) should be fully agnostic. It should reside in a shared internal package (e.g., `internal/i18n`) so both binaries (if they differ) can import and use it without modification.

## Verification
- Boot up the ABRN-Drive flavor (using its respective `.env` files).
- Verify that the Welcome message dynamically says "ABRN-Drive" instead of "QuantiX-Drive".
- Verify that any specific terminology overrides for ABRN are correctly rendered in both English and Spanish.

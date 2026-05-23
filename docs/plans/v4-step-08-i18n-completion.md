# Step 8 — i18n Completion

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** III — Production Polish  
**Status:** 🔲 TODO  
**Priority:** HIGH — Visible to every user  

---

## Why This Matters

We have a full i18n infrastructure (`react-i18next`, namespace files, `useTranslation()` hook, dynamic branding interpolation) — but ~50 string literals bypass it. A user switching to Spanish sees a mix of English and Spanish. That's not production quality. That's a demo leak.

## Current State

- **Infrastructure:** ✅ Complete — `react-i18next` with `useTranslation()`, namespace files in `src/locales/{en,es}/*.json`
- **Branding interpolation:** ✅ `{{product}}` resolves to "QuantiX Drive" or "ABRN Drive" via `branding.productName`
- **Coverage gaps:** ~50 hardcoded English strings in TSX files

## Affected Files (Audit)

| File | Approximate Hardcoded Strings | Examples |
|------|-------------------------------|---------|
| `src/pages/dashboard.tsx` | ~8 | Stat card labels, welcome message, tooltips |
| `src/pages/shared.tsx` | ~6 | "Shared with me", "No shared files", column headers |
| `src/pages/drop-upload.tsx` | ~10 | Upload instructions, encryption footer, error messages |
| `src/pages/access-center.tsx` | ~6 | Filter labels, status badges, empty states |
| `src/components/layout/mobile-nav.tsx` | ~4 | Bottom nav labels |
| `src/components/vault/CreateShareLinkModal.tsx` | ~4 | Modal labels, receipt text |
| `src/components/vault/CreateFolderShareLinkModal.tsx` | ~4 | Modal labels, receipt text |
| `src/components/vault/FileRequestsSection.tsx` | ~3 | Section headers, empty states |
| `src/components/settings/AuditLogSection.tsx` | ~3 | Filter labels, export buttons |
| Various modals & toasts | ~5 | Success/error messages |

## Implementation Approach

### 1. Identify All Hardcoded Strings
```bash
# Find string literals in TSX that aren't in t() or className/style
grep -rn '"[A-Z][a-zA-Z ]*"' vaultdrive_client/src/ --include="*.tsx" \
  | grep -v 'className' | grep -v 'import' | grep -v 'test.' | grep -v '.css'
```

### 2. Add Keys to Namespace Files
For each hardcoded string, add a key to the appropriate namespace:

**`src/locales/en/common.json`:**
```json
{
  "dashboard": {
    "welcome": "Welcome back",
    "totalFiles": "Total Files",
    "totalStorage": "Storage Used"
  }
}
```

**`src/locales/es/common.json`:**
```json
{
  "dashboard": {
    "welcome": "Bienvenido",
    "totalFiles": "Archivos Totales",
    "totalStorage": "Almacenamiento Usado"
  }
}
```

### 3. Wrap Strings in `t()` Calls
```tsx
// Before
<h2>Welcome back</h2>

// After
const { t } = useTranslation('common');
<h2>{t('dashboard.welcome')}</h2>
```

### 4. Verify Branding Interpolation
Ensure `{{product}}` works in all translated strings:
```json
{ "vault_title": "{{product}} Vault" }
```
→ "QuantiX Drive Vault" on QuantiX, "ABRN Drive Vault" on ABRN.

## Verification

| Check | Expected Result |
|-------|----------------|
| Switch to ES-MX | Zero English strings visible on any page |
| Switch to EN | All strings render correctly |
| i18n E2E test | ✅ Layout snapshot passes |
| Grep for hardcoded strings | 0 results (excluding className, imports) |
| QuantiX branding | "QuantiX Drive" appears correctly |
| ABRN branding | "ABRN Drive" appears correctly |

## Files to Change

| File | Change |
|------|--------|
| ~10 TSX files listed above | Wrap strings in `t()` |
| `src/locales/en/common.json` | Add ~50 new keys |
| `src/locales/es/common.json` | Add ~50 Spanish translations |
| Possibly `src/locales/en/vault.json` | New namespace for vault-specific strings |
| Possibly `src/locales/es/vault.json` | Spanish vault translations |

## Both Drives

- Translation files are shared in the codebase
- Branding differences handled by `{{product}}` interpolation
- ABRN builds with different `VITE_PRODUCT_NAME` which flows through `branding.ts` → i18n

# Plan Index — Native Multilingual QuantiX-Drive (English / Español Mexicano)

**Goal:** Transform QuantiX-Drive into a native bilingual application. Every surface — buttons, menus, file explorers, modals, settings, and backend error messages — must render flawlessly in English and Mexican Spanish, toggled via Settings. Furthermore, the architecture must be designed to be fully downstreamable to **ABRN-Drive** so that both applications share the same robust i18n foundation.

## Philosophy Acknowledgment
Following the Filemon philosophy:
- **Clarity before action:** We plan thoroughly before touching a single line of code.
- **Evidence before claims:** We will build tests to prove our translations work.
- **Build for the user:** This isn't just about translating strings; it's about making the app feel native to Mexican Spanish speakers. No Google Translate.
- **Stop when reality is clean:** We will execute this step by step, ensuring each piece is fully functional before moving on.

---

## Steps

| Step | File | Description | Status |
|------|------|-------------|--------|
| 0 | [i18n-00-architecture-decision.md](i18n-00-architecture-decision.md) | Tech stack decisions: i18next + react-i18next for the Vite/React frontend, and Go translation handlers for the backend. | Pending |
| 1 | [i18n-01-core-infrastructure.md](i18n-01-core-infrastructure.md) | Install libraries, wire up the translation providers in React, and add the Language Toggle to the Settings page. | Pending |
| 2 | [i18n-02-translation-files-scaffold.md](i18n-02-translation-files-scaffold.md) | Create the JSON structure for EN/ES-MX. Namespace by domain (`common`, `drive`, `auth`, `settings`). | Pending |
| 3 | [i18n-03-shell-auth-nav.md](i18n-03-shell-auth-nav.md) | Translate the app shell, navigation sidebar, top header, login, and registration flows. | Pending |
| 4 | [i18n-04-drive-dashboard-features.md](i18n-04-drive-dashboard-features.md) | Translate the core drive experience: file lists, context menus, share modals, file upload states, and empty states. | Done |

| 5 | [i18n-05-backend-messages.md](i18n-05-backend-messages.md) | Adapt the Go backend to inspect `Accept-Language` headers and return localized validation and error messages. | Done |

| 6 | [i18n-06-downstream-abrn-drive.md](i18n-06-downstream-abrn-drive.md) | Strategy for propagating the i18n infrastructure to ABRN-Drive. Extracting shared keys and overriding brand-specific terms. | Done |

| 7 | [i18n-07-e2e-tests-qa.md](i18n-07-e2e-tests-qa.md) | Update Playwright tests to support both languages and verify layout integrity with longer Spanish strings. | Done |

---

## Principles

1. **Native feel (es-MX).** Translations must use Mexican Spanish conventions (e.g., "Configuración" not "Ajustes", "Iniciar sesión" not "Acceder", "Archivos" not "Ficheros").
2. **Zero visual regression.** Spanish text is typically longer. All UI elements (buttons, tables, modals) must handle text wrapping or flex adjustments without breaking.
3. **Instant switching.** The frontend React app will change languages instantly without a page reload.
4. **Backend Alignment.** The Go backend must return localized errors based on the user's language preference to ensure the illusion of a native app is never broken by an English API error.
5. **Downstream-Ready.** We keep brand terms (QuantiX vs ABRN) parameterized so we can reuse the dictionaries in ABRN-Drive.

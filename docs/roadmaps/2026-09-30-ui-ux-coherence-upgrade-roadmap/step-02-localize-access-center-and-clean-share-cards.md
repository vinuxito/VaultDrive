# Step 02: Full Barrio Localization of Access Center & Card Polish

- **Title**: Full Barrio Localization of Access Center & Share Card Polish
- **Category**: `UX / product`
- **Owner**: Frontend Core / Access Center
- **Affected Files**:
  - `vaultdrive_client/src/pages/access-center.tsx`
  - `vaultdrive_client/src/locales/es/drive.json`
  - `vaultdrive_client/src/locales/en/drive.json`
  - `vaultdrive_client/src/pages/access-center.test.tsx`

---

## 1. Why It Matters Now

The Access Center (`/access-center`) is ABRN Drive's sovereign control plane: the one place where users review outbound links, revoke access, and manage Secure Drop routes. 

However, inspecting the live screen revealed that while the rest of the app supports Spanish, **over 95% of the Access Center is hardcoded in English**:
- Cards display `"Folder share · Created 5/18/2026 · 3 views · Last viewed 5/19/2026"`.
- Buttons say `"Copy full link"`, `"Open full link"`, `"Revoke link"`, and `"Manage Drop route"`.
- Badges read `"Active"`, `"Expired"`, `"Revoked"`, and `"Never used"`.
- Drop routes exhibit an unpolished grammar bug: `"Drop link · 86 file s received"` (notice the awkward space in `"file s"`).
- Users sharing links with clients via WhatsApp must manually copy the link, open WhatsApp, and write a message from scratch, rather than tapping a 1-click WhatsApp card.

For ABRN Asesores' primary Mexican user base, this linguistic jarring breaks immersion and makes the system feel like an unfinished foreign utility.

---

## 2. What Exactly Should Be Done

### A. Extract and Localize All Access Center Strings
In `vaultdrive_client/src/locales/es/drive.json` and `en/drive.json`:
1. Add full translation entries under `drive:accessCenter`:
   ```json
   "accessCenter": {
     "title": "Centro de Acceso",
     "subtitle": "Rutas externas activas · Quién puede ver y subir archivos a tu bóveda",
     "tabs": {
       "all": "Todas las rutas",
       "shares": "Enlaces de compartir",
       "drop": "Portales de subida"
     },
     "filters": {
       "all": "Todos",
       "active": "Activos",
       "expired": "Vencidos",
       "revoked": "Revocados",
       "never_used": "Sin visitas"
     },
     "badges": {
       "active": "Activo",
       "expired": "Vencido",
       "revoked": "Revocado",
       "never_used": "Sin visitas",
       "stale": "Inactivo"
     },
     "card": {
       "folderShare": "Carpeta compartida",
       "fileShare": "Archivo compartido",
       "dropLink": "Portal de subida",
       "created": "Creado el {{date}}",
       "views_one": "1 visita",
       "views_other": "{{count}} visitas",
       "lastViewed": "Última visita: {{date}}",
       "filesReceived_one": "1 archivo recibido",
       "filesReceived_other": "{{count}} archivos recibidos",
       "lastUpload": "Última subida: {{time}}",
       "copyLink": "Copiar enlace",
       "openLink": "Abrir enlace",
       "revokeLink": "Revocar acceso",
       "manageDrop": "Administrar portal",
       "shareWhatsApp": "Mandar por WhatsApp"
     }
   }
   ```
2. Replace all hardcoded English JSX in `pages/access-center.tsx` with `t("drive:accessCenter.*")`.

### B. Fix String Grammar & Pluralization Bugs
Replace the broken string concatenation:
```tsx
// Before (buggy):
`${drop.files_uploaded} file${drop.files_uploaded === 1 ? "" : " "}s received`

// After (clean i18n pluralization):
t("drive:accessCenter.card.filesReceived", { count: drop.files_uploaded })
// Result ES: "86 archivos recibidos" | Result EN: "86 files received"
```

### C. Add 1-Tap WhatsApp Sharing Lever
In `ShareCard` and `DropCard` within `access-center.tsx`:
- When a route is `active`, add a green WhatsApp button alongside "Copiar enlace":
  ```tsx
  <a
    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
      `Te comparto este enlace seguro de ABRN Asesores: ${fullShareUrl}`
    )}`}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
  >
    <MessageCircle className="w-3.5 h-3.5" />
    WhatsApp
  </a>
  ```

---

## 3. What Existing Work It Builds On
- Builds on the responsive layout refactor in `access-center.tsx` (commit `2854371`).
- Builds on the WhatsApp sharing patterns established in v13 `quick-share-receipt.tsx`.

---

## 4. What Risks It Avoids
- Avoids user hesitation and support tickets asking *"¿Qué significa 'Revoke link'?"* or *"¿Por qué dice 'file s received'?"*.
- Eliminates embarrassment when clients see English error states in an application branded for a Mexican accounting firm.

---

## 5. Expected Payoff
- 100% language fidelity in both Mexican Spanish and English.
- Reduced friction for daily document sharing via WhatsApp.

---

## 6. Definition of Done & Testable Acceptance Criteria

1. **Automated Unit Tests**:
   - `access-center.test.tsx` renders in `es` locale and asserts:
     - Header contains `"Centro de Acceso"`.
     - Tab buttons render `"Todas las rutas"`, `"Enlaces de compartir"`, `"Portales de subida"`.
     - Filter buttons render `"Todos"`, `"Activos"`, `"Vencidos"`.
     - A drop token with 86 uploads renders `"86 archivos recibidos"` (no `"file s"`).
     - Active links include a valid `whatsapp.com/send?text=` href.
2. **Strict TypeScript**:
   - `npm run typecheck`: 0 errors.
3. **Live Browser Snapshot**:
   - Navigate to `/access-center` with language set to `es`; verify zero untranslated English strings on the screen.

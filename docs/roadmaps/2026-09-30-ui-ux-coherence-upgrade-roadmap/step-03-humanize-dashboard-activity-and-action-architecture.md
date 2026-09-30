# Step 03: Humanize Dashboard Activity & Action Architecture

- **Title**: Humanize Dashboard Activity & Action Architecture (Lenguaje de Cancha)
- **Category**: `UX / product`
- **Owner**: Frontend Core / Dashboard
- **Affected Files**:
  - `vaultdrive_client/src/pages/dashboard.tsx`
  - `vaultdrive_client/src/components/dashboard/StatusPanel.tsx`
  - `vaultdrive_client/src/locales/es/drive.json`
  - `vaultdrive_client/src/locales/en/drive.json`
  - `vaultdrive_client/src/pages/dashboard.test.tsx`

---

## 1. Why It Matters Now

The Dashboard (`/dashboard`) serves as the central command room for the user. When users open ABRN Drive, they look here to answer: *"¿Qué pasó mientras no estaba? ¿Qué tengo que atender hoy?"*

Live inspection of `/dashboard` revealed three severe UX breaches:
1. **Raw Database Slugs in Activity Feed**: The "ACTIVIDAD" feed prints raw snake_case database event slugs:
   - `folder_share_link_created` (12/9/2026)
   - `secure_drop_created` (12/9/2026)
   - `file_shared` (12/9/2026)
   Users are forced to decode internal SQL table identifiers instead of reading natural human events. This directly violates **Iron Law 5 (Lenguaje de Cancha)**.
2. **Jargon Quick Action ("Create ZK Room")**: In the "EMPIEZA AQUÍ" section, alongside plain actions like "Subir Archivo", sits a card in raw English:
   `"Create ZK Room — Create an ephemeral collaborative encrypted room"`.
   Accountants and business clients ask: *"¿Y esta mamada qué?"* (**Iron Law 7**). Cryptographic research terms should never be thrust into primary navigation ahead of everyday document tasks.
3. **Ambiguous Vault Summary Metrics**: The summary cards show `"Total de Archivos: 196"` and `"Archivos Compartidos: 196"`. Users immediately panic thinking their entire private vault has been shared externally, when in reality it simply indicates files accessible within their account.

---

## 2. What Exactly Should Be Done

### A. Author Plain Human Activity Formatter
In `vaultdrive_client/src/pages/dashboard.tsx`:
1. Build `formatActivityMessage(item: ActivityItem, t: TFunction)` mapping event types to natural sentences with visual badges:
   ```tsx
   export function formatActivityMessage(item: ActivityItem, t: TFunction) {
     const meta = item.description || item.message || "";
     switch (item.event_type) {
       case "folder_share_link_created":
         return t("drive:dashboard.activity.folderShareCreated", { name: meta || "Carpeta" });
       case "secure_drop_created":
         return t("drive:dashboard.activity.dropCreated", { name: meta || "Portal" });
       case "file_shared":
         return t("drive:dashboard.activity.fileShared", { name: meta || "Archivo" });
       case "file_upload":
       case "file_uploaded":
         return t("drive:dashboard.activity.fileUploaded", { name: meta || "Documento" });
       case "download":
       case "file_downloaded":
         return t("drive:dashboard.activity.fileDownloaded", { name: meta || "Documento" });
       case "link_revoked":
         return t("drive:dashboard.activity.linkRevoked", { name: meta || "Enlace" });
       default:
         // Fallback cleaning snake_case into title case
         return meta || item.event_type.replace(/_/g, " ");
     }
   }
   ```
2. In `locales/es/drive.json`:
   ```json
   "activity": {
     "folderShareCreated": "Creaste un enlace para la carpeta {{name}}",
     "dropCreated": "Creaste el portal de entrega {{name}}",
     "fileShared": "Compartiste el archivo {{name}}",
     "fileUploaded": "Subiste {{name}}",
     "fileDownloaded": "Se descargó {{name}}",
     "linkRevoked": "Revocaste el acceso a {{name}}"
   }
   ```

### B. Replace "ZK Room" with Real Everyday Actions
In "EMPIEZA AQUÍ":
1. Demote `ZK Room` to an "Herramientas Avanzadas" section or settings drawer.
2. Present the 3 fundamental business actions:
   - **Subir y Blindar Archivos** (Agrega documentos protegidos a tu bóveda)
   - **Pedir Documentos a un Cliente** (Crea un enlace para que te manden archivos sin cuenta)
   - **Compartir Archivo Seguro** (Genera un enlace con fecha de vencimiento)

### C. Clarify Vault Summary Metrics
Update stat card labels and tooltips:
- Instead of `"Archivos Compartidos: 196"`, label it `"Archivos con Acceso Compartido"` and add a clarifying subtitle: `"Documentos en carpetas o grupos compartidos"`.
- If an endpoint returns 0 or errors, display `[ -- ]` with a retry icon instead of displaying misleading zeros.

---

## 3. What Existing Work It Builds On
- Builds on existing `dashboard.tsx` data fetching and `STAT_ENDPOINTS`.
- Builds on the `StatusPanel` component and i18n infrastructure.

---

## 4. What Risks It Avoids
- Avoids panic that confidential files were leaked or made public.
- Prevents user confusion from technical cryptology jargon.

---

## 5. Expected Payoff
- A calm, executive dashboard that immediately communicates recent history and guides the user to their next high-value action in <3 seconds.

---

## 6. Definition of Done & Testable Acceptance Criteria

1. **Automated Unit Tests**:
   - `dashboard.test.tsx` feeds synthetic activity events (`folder_share_link_created`, `secure_drop_created`) and asserts no snake_case strings appear in the rendered DOM.
   - Asserts "EMPIEZA AQUÍ" renders the 3 human business actions and does not render "ZK Room" in the primary grid.
2. **Strict TypeScript**:
   - `npm run typecheck`: 0 errors.
3. **Live Browser Verification**:
   - Navigate to `/dashboard`; verify all activity lines read as complete, pleasant Spanish sentences.

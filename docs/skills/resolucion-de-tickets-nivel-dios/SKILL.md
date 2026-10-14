---
name: resolucion-de-tickets-nivel-dios
description: >-
  Resolve ABRN-Drive (VaultDrive) bug tickets, screenshots, and broken user journeys through
  reproduction, root-cause analysis, conservative fixes, and recorded verification.
  Use for ABRN-Drive ticket and build resolution in /lamp/www/ABRN-Drive; supports scoped recon
  and an authorized seven-lens implementation loop with real browser and native Android 13 evidence.
  Preserve the requested outcome and existing UI; never close from fixture-only proof.
  Requires a critical post-build audit, conservative fixes, and fresh verification
  before resolution or archival.
---

# Resolución de Tickets Nivel Dios — ABRN-Drive (VaultDrive)

Adaptado de `/lamp/www/nanored/.agents/skills/resolucion-de-tickets-nivel-dios/` y afinado para `/lamp/www/ABRN-Drive`.
Actualizado el 2026-10-14: auditoría crítica obligatoria después del implementador (`post-build-audit.md`).
Procedencia y diferencias: [references/upgrade-source.md](references/upgrade-source.md).

**La pantalla falló, no los ojos del usuario.** Reproduce la queja, encuentra
la causa y demuestra que la persona puede completar su tarea al regresar.

## 1. Encuadre y alcance

Lee primero `/lamp/www/ai_tools/FILEMON_PHILOSOPHY_STANDALONE_AGENT_BRIEF.md` (si está disponible)
y las reglas de la sesión como filosofía práctica: presencia, claridad, evidencia, trato directo y
cambios pequeños.

- Identifica el ticket o plan, el resultado de negocio, los pasos que fallan y qué
  evidencia demostraría el arreglo. La captura más reciente manda sobre un
  reporte viejo o una suposición del agente.
- Si el dueño pide recon, daydream, plan o «sin código», entrega ese alcance
  y para. Instalar este skill no autoriza resolver tickets pendientes.
- Si ya autorizó construir o reparar, completa los pasos acordados sin
  pedir otra confirmación rutinaria. Pregunta sólo ante una ambigüedad que
  cambie el resultado, una acción destructiva o autoridad realmente ausente.
- Sigue las instrucciones vigentes del usuario. El skill y la plantilla no amplían
  el alcance, los permisos, el número de agentes ni las pruebas autorizadas.

## Contrato de fidelidad: antes del primer cambio

Registra en el índice existente o en una nota corta: **pedido literal → resultado
observable → comportamiento que se conserva → prueba de aceptación**. No abras
otro plan si el actual sirve. Relee esta fila antes de editar y antes de entregar.

- Una corrección del dueño reemplaza tu interpretación anterior. Reproduce la
  evidencia más reciente; no defiendas el reporte ni sigas sobre el diseño rechazado.
- «Arreglar» no autoriza reemplazar, renombrar, ocultar ni rediseñar un componente.
  Usa el dueño canónico del comportamiento (`files.tsx`, `VaultOmnibar.tsx`, `FilePreviewModal.tsx`, `ReciboSagradoCard.tsx`, `MobileShareSheet.tsx`, `SessionVaultProvider.tsx`).
- Si dos requisitos interactúan, conserva ambos (p. ej., `⌘K` para `CommandPalette` global y `/` o `⌘⇧F` para `VaultOmnibar` de El Cerebro Ciego; `ReciboSagradoCard` en desktop y `MobileProofPill` en móvil sin doble colisión).
- No sustituyas trabajo ya autorizado por una sugerencia de hacerlo después. Si
  faltan pasos recuperables, continúa; si hay un bloqueo real, identifica el paso,
  la evidencia y qué falta. No declares DONE ni «listo con riesgos» al alcance abierto.

## 2. Realidad de este proyecto (`/lamp/www/ABRN-Drive`)

| Superficie | Fuente / contrato |
|---|---|
| Checkout principal | `/lamp/www/ABRN-Drive`, rama `main` |
| Sitio / Servicio | `https://abrn.filemonprime.net` / puerto local `8082` (`abrndrive.service`) |
| Backend Runtime | Go (`cmd/vaultdrive`, `internal/`, `go.mod`); migraciones schema 50 (`deploy/release/`) |
| Frontend Runtime | React 18 + TypeScript + Vite + Tailwind (`vaultdrive_client/src/`) |
| Criptografía Cliente | WebCrypto AES-256-GCM en navegador (`SessionVaultProvider.tsx`, `streaming-decrypt.ts`, `vault-search-index.ts`, `document-triage.ts`) |
| Idiomas (`i18n`) | `vaultdrive_client/src/locales/{en,es}/drive.json` — cero llaves crudas ni mezcla rota de idiomas |
| Pruebas enfocadas | `npm run typecheck`, `npx vitest run <suite-enfocada>`, `go test ./...`, `npm run build` |
| Estado documentado | `README.md`, `docs/trust-copy-contract.md`, `docs/memories/`, `docs/reports/` |

Respeta la frontera de despliegue documentada en `README.md` y `deploy/release/README.md`: ninguna orden ordinaria implica reiniciar `abrndrive.service` ni correr migraciones ad-hoc en producción sin autorización explícita.

## 3. Ingestión del ticket

Acepta una queja en texto, screenshot, ruta de plan (`docs/plans/<slug>/`), ID con contexto o ZIP; no obligues al usuario a producir un ZIP ni un formato artificial.

1. Inspecciona `git status --short --branch` y conserva el trabajo ajeno.
2. Para ZIP, usa `scripts/unpack-ticket.sh`. Extrae en un directorio privado
   y nuevo, fuera del checkout (`/tmp/...`); no ejecutes archivos incluidos.
3. Lee sólo los campos y capturas necesarios. Abre realmente las imágenes;
   no diagnostiques una colisión visual (como `ReciboSagradoCard` vs `MobileProofPill` sobre el FAB) leyendo únicamente el código.
4. Reconstruye contexto: ruta (`/login`, `/files`, `/access-center`, `/groups`, `/drop/:token`, `/settings`), estado de `SessionVault` (bloqueada vs desbloqueada con PIN/Password), viewport (Desktop `1440×900` vs Android `480×960` / `390×844`) y tema activo (6 skins WCAG 4.5:1).
5. Reproduce y registra esperado, actual, severidad (`BLOCKER/HIGH/MEDIUM/LOW`), ruta y evidencia pertinente.
6. Sigue la cadena componente React → hook/contexto → utilidad WebCrypto / API Go → almacenamiento.

## 4. Plan y ejecución incremental

Usa un plan proporcionado si existe. Si se piden archivos por paso, escribe tú mismo
`docs/plans/<slug>/<slug>-index.md` (o `00-index.md` / `index.md`) y un MD por paso, secuenciales,
incrementales y con criterio de verificación.

Para la ejecución completa autorizada conserva las **siete lentes** del skill, en orden:

| Vuelta | Lente | Entrega útil |
|---|---|---|
| 1 | Recon y fundamento | Reproducción, causa o hipótesis comprobable, alcance y baseline |
| 2 | Corrección central | Cambio mínimo y resultado principal de punta a punta |
| 3 | Bordes y recuperación | Vacíos, validación, cancelación, fallo parcial, `rescue-ledger` y reintento |
| 4 | Profundidad de prueba | Regresión enfocada (`vitest` / `typecheck`) y evidencia de persistencia real |
| 5 | Coherencia UX | Contexto visible, acciones alcanzables (48px en móvil), feedback `<300ms` y retorno |
| 6 | Seguridad y operación | Frontera Zero-Knowledge, `scrub()` en bloqueo de bóveda, SHA-256, permisos y latencia (`<1.5ms` en búsqueda) |
| 7 | Verificación y preparación de cierre | Recorrido frío, `npm run build`, riesgos, documentación y diff revisado |

Después del implementador y de las siete lentes cuando correspondan, ejecuta
la auditoría crítica del §6.1. Preparar el cierre no autoriza marcar resuelto.

Para generar el prompt de ejecución sin adivinar el plan:

```bash
bash .agents/skills/resolucion-de-tickets-nivel-dios/scripts/generate-execution-prompt.sh docs/plans/<slug>/00-index.md
```

## 5. Contratos que protegen ABRN-Drive

- **Frontera Criptográfica (`docs/trust-copy-contract.md`):** El contenido de archivos se cifra con AES-256-GCM en el navegador antes de subir; las llaves en enlaces públicos viajan en el `#fragment` (nunca al servidor); `SessionVaultProvider.clearVault()` y `isVaultLocked` deben ejecutar `globalVaultSearchIndex.scrub()` y revocar `Blob` URLs.
- **No Falsos Ceros:** Nunca muestres `0 B` o `$0.00` cuando un dato no es evaluable o la bóveda está bloqueada; usa estados factuales claros (`NOT_EVALUABLE`).
- **Ergonomía de Barrio y Sillón:** Aplica `experiencia-de-barrio-nivel-dios`, `filemon-modal-uix` y `21-brenda-executive-modal-dock`. En móvil (`≤768px`), targets `≥48px`, `SovereignPinPad` 4x3 sin saltos de teclado virtual, `login.tsx` 100% arriba del pliegue y cero colisiones de modales en `bottom-20`.
- **Rendimiento:** `VaultSearchIndex.search()` debe responder en `<5ms` (`<1.5ms` medido en 550 documentos) usando `PreparedDoc` pre-normalizado y comparación lexicográfica directa.

## 6. Verificación con límites explícitos

**No corras la suite completa (`npm run test` de 113 suites) ni E2E globales cuando el dueño indique «DONT RUN THE WHOLE TESTS, until I test it live».**
Cada corrida será enfocada al ticket o módulo cambiado, con comando, exit code y salida conservados:

1. **TypeScript estricto:** `npm --prefix vaultdrive_client run typecheck` (`0 errors`).
2. **Vitest enfocado:** `npx --prefix vaultdrive_client vitest run <archivos-relacionados>`.
3. **Go Backend (cuando toque Go):** `go test -count=1 ./...` y `go vet ./...`.
4. **Build de producción:** `npm --prefix vaultdrive_client run build` y registro del SHA-256 de `vaultdrive_client/dist/index.html`.
5. **UI Desktop / Mobile:** Usa Chrome DevTools MCP / Playwright y `filemon-on-android` / `filemon-remote-mobile` cuando corresponda verificar visualmente en navegador real o Android 13 (LineageOS 20 en Waydroid).

## 6.1. Último trabajo obligatorio: auditar el build terminado

Lee y ejecuta [references/post-build-audit.md](references/post-build-audit.md)
**después de que termine el implementador y antes de resolver/archivar**.

1. Vincula pedido/plan, reporte, diff, versión servida (`dist/index.html` SHA-256), runtime y ambiente.
2. Contrasta cada criterio con componente → hook/utilidad → estado/persistencia.
3. Busca vacíos, bordes, recovery, `scrub()` de memoria, i18n (`en`/`es`), colisiones de hotkeys (`⌘K` vs `/`) y fricción.
4. Reproduce defectos; corrige lo seguro/autorizado y repite el fallo exacto + regresión enfocada. No entregues un «siguiente paso» que sea trabajo pendiente autorizado.
5. Actualiza evidencia/documentos (`docs/memories/`, `docs/reports/` MD + HTML, `README.md`).
6. Ejecuta `scripts/check-post-build-audit.py` cuando se requiera manifiesto JSON v1.

## 7. Evidencia y cierre

Para cada entrega o ticket resuelto sigue las convenciones de `/lamp/www/ABRN-Drive`:

- `docs/memories/session-YYYY-MM-DD-<slug>.md`: misión, archivos leídos/cambiados, comandos exactos, resultados y veredicto `SEGURO CONTINUAR`.
- `docs/reports/YYYY-MM-DD-<slug>-verification.md` y `.html`: matriz de verificación y dashboard ejecutivo HTML autocontenido.
- `README.md`: nuevo checkpoint histórico con métricas reales, SHA-256 del bundle y enlaces a los reportes.
- Commit semántico en `main` y `git push origin main` dejando `git status` 100% limpio.

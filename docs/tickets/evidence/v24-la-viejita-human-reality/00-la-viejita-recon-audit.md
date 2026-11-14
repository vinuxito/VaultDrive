# LA VIEJITA LENS — Recon & Human-Reality Audit Evidence (`v24-la-viejita-human-reality`)

- **Date:** `2026-11-14`
- **Baseline Audited:** `v23-abrn-sovereign-continuum` (`c65373f`, `dist/index.html` SHA-256 `ea8a1b16383df32984671421552d5d28eab4890f2c6e5f76737bb8f2384b05b8`)
- **Workspace:** `/lamp/www/ABRN-Drive`
- **Lens Role:** Human-Reality Editor / Plain-Language Product Critic (*"Ay mi vida… ¿cómo le diría esto una persona normal?"*)
- **Governing Contracts Cross-Referenced:**
  1. `docs/trust-copy-contract.md` (no universal zero-knowledge overclaims; accurate route exposure & revocation truth)
  2. `.agents/skills/experiencia-de-barrio-nivel-dios/SKILL.md` (Lenguaje de Cancha, Estado Cero Mamadas, Ley Tola, Test de la Esquina `<3s`)
  3. `.agents/skills/resolucion-de-tickets-nivel-dios/references/post-build-audit.md` (manual changes/deletes persist across reload; no fake certainty)
  4. **Consigliere Fiscal Rule:** *Personality may decorate meaning. It may never replace meaning.*

---

## 1. Five Structural Failure Modes Discovered in Recon

1. **CSS Units, Hex Codes, Browser APIs & Raw Enums Leaked to Humans:**
   - `Expandir 94vw` (`VaultInspectorPane.tsx:811`)
   - `#030712` inside `⌘K` theme command (`command-palette.tsx:266`)
   - `NOT_EVALUABLE · BÓVEDA EN REPOSO` and `NOT_EVALUABLE · SIN_CFDI_EN_CARPETA` (`VaultReconcileCockpit.tsx:392, 422`, `MobileReconcileSheet.tsx:147, 163`)
   - `vía popstate` and `BroadcastChannel + AES-256-GCM Real` (`ContinuumDockPane.tsx:314, 341`)
   - `lo cifra en bloques de 64 KB` (`SmartUploadOrderModal.tsx:249`)
2. **Implementation Plumbing Instead of Human Benefit:**
   - `0 BYTES GALERÍA` instead of telling the user the photo does not stay in their phone's gallery (`MobileScannerSheet.tsx:133`)
   - `LLave viajando solo tras el signo #` and `Revocación instantánea de ciphertext` (`VaultAccessCenterInline.tsx:177, 184`)
   - `Accesos #key`, `Drop`, `#key`, `AES-256 RAM` (`files.tsx:3354, 3448-3456`, `dashboard-layout.tsx:529`)
   - `☀ Cream | ☾ Slate | ◆ OLED` English paint swatches instead of `☀ Claro | ☾ Gris | ◆ Negro` (`dashboard-layout.tsx:609-630`)
3. **Literal Maritime & Fighter-Jet Translations:**
   - `Limpiar Muelle (Esc)` for *Clear Dock* (`locales/es/drive.json:80`)
   - `HUD de Exposición de Rutas Externas` (`locales/es/drive.json:62`)
4. **Hollywood Theater & Hardcoded Client Names:**
   - `AES-256-GCM OPTICAL FOCUS` + fake hex `4f1e a432 d88f b290 e712 99ca` during preview decrypt (`FilePreviewModal.tsx:806-809`)
   - `● ENCUADRE FISCAL AUTO · 99.4%` static percentage before opening camera (`MobileScannerSheet.tsx:160`)
   - `Ficha SAT / Amarre Fiscal (Roche)` hardcoded to one client on all CFDI XMLs (`FilemonOfficeStage.tsx:191, 232`, `locales/es/drive.json:1016, 1019`)
5. **Places Where Controls Sounded Cleverer Than They Behaved:**
   - `Cifrar Expediente Contable Real (CFDI 4.0 + BBVA)` (`VaultReconcileCockpit.tsx:448`) actually generates synthetic demo files (`buildRealAccountingSeedBatch`), risking confusion with real accounting uploads unless paired with a real upload button and honestly labeled as an example.
   - `+ Grabar Voz RAM` (`VaultInspectorPane.tsx:732` + `continuum-bridge.ts:204-241`) auto-invented `0:12` voice badges on filenames matching `bbva`/`cfdi`, inserted a hardcoded simulated sentence on click instead of letting the user write/record a real note, and could not persist or stay deleted across reloads.

---

## 2. Complete Surface-by-Surface Audit Matrix

### 2.1 Topbar, Sidebar, Subheader & `⌘K` Palette

| Verdict | File & Line | Verbatim Original | Approved Human Replacement | One-Sentence Reason |
|---|---|---|---|---|
| `KEEP AS-IS` | `sidebar.tsx:223-227` | `Subir y Ordenar` · `Auto` | — | Names the exact intent in natural Mexican accounting Spanish with zero fluff. |
| `KEEP AS-IS` | `sidebar.tsx:246-249` | `Cuadre BBVA` | — | Authentic CPA shorthand understood in half a second. |
| `REMOVE` | `sidebar.tsx:250, 275` | `RAM` / `0ms` sidebar pills | — | Silicon bus and latency badges add visual clutter without helping navigation. |
| `RENAME` | `sidebar.tsx:271` | `Dual en Vivo` | `Ver con Celular` | Explains the actual side-by-side companion view without internal codenames. |
| `SIMPLIFY` | `dashboard-layout.tsx:510` | `Busca por cliente, banco, RFC, #etiqueta o sello SHA-256…` | `Buscar cliente, factura, banco o RFC…` | Keeps SHA-256 lookup working underneath without intimidating ordinary searchers. |
| `RENAME` | `dashboard-layout.tsx:529` | `AES-256 RAM` | `🔒 Privado` | Communicates safety rather than cipher + memory architecture on a 24px mobile badge. |
| `RENAME` | `dashboard-layout.tsx:565-567` | `Escritorio \| ⚡ Dual en Vivo \| Estudio Móvil` | `PC \| ⚡ PC + Celular \| Vista Celular` | Makes all three viewport modes self-explanatory on first sight. |
| `RENAME` | `dashboard-layout.tsx:609-630` | `☀ Cream \| ☾ Slate \| ◆ OLED` | `☀ Claro \| ☾ Gris \| ◆ Negro` | Lets an accountant dim their screen at night without translating English paint swatches. |
| `SIMPLIFY` | `files.tsx:3328-3330` | `Blindado · AES-256-GCM` | `🔒 Blindado` | Preserves confidence in the header while keeping cipher specs inside the security passport. |
| `RENAME` | `files.tsx:3354, 3448-3456` | `Accesos #key` · `Drop` · `#key` | `Enlaces y Buzones` · `Recibidos` · `Compartidos` | Names the human workflow instead of URL fragment plumbing. |
| `REMOVE` | `files.tsx:3460-3461` | `SHA-256 100%` | — | Looks like a battery percentage named after a hash function on a simple file counter. |
| `RENAME` | `FileSearch.tsx:80` + `drive.json:989` | `Cerebro Ciego` | `Buscar dentro · Cerebro Ciego` | Honors the *Consigliere Fiscal Rule* by pairing Filemón's signature name with crystal-clear meaning. |
| `SIMPLIFY` | `command-palette.tsx:215-266` | `Sovereign Continuum (ABRN)` / `◆ Cambiar a Modo Puro OLED Soberano (#030712)` | `Acciones Rápidas` / `◆ Cambiar a tema Negro` | Removes CSS hex codes and architectural branding from quick keyboard actions. |

### 2.2 Bank ↔ CFDI Reconciliation (`VaultReconcileCockpit` & `MobileReconcileSheet`)

| Verdict | File & Line | Verbatim Original | Approved Human Replacement | One-Sentence Reason |
|---|---|---|---|---|
| `KEEP AS-IS` | `VaultReconcileCockpit.tsx:368` | `Papel Trabajo .CSV` | — | Exact Mexican CPA audit terminology. |
| `SIMPLIFY` | `VaultReconcileCockpit.tsx:335` | `MOTOR CONTABLE EN RAM · 0 BYTES EN SERVIDOR` | `🔒 Cruce privado en tu equipo` | States the privacy benefit in human language. |
| `SIMPLIFY` | `VaultReconcileCockpit.tsx:342` | `Cruce Automático CFDI 4.0 XML ↔ Estado de Cuenta Bancario` | `Cuadre de Facturas (CFDI) contra Banco` | Shorter, calmer, and immediately scannable. |
| `SIMPLIFY` | `VaultReconcileCockpit.tsx:377` | `Enviar Cuadre #key` / `Enviar Cuadre #key por WhatsApp` | `Enviar Cuadre por WhatsApp` | Removes `#key` URL mechanics from a WhatsApp dispatch button. |
| `RENAME` | `VaultReconcileCockpit.tsx:392, 422` | `NOT_EVALUABLE · BÓVEDA EN REPOSO` / `NOT_EVALUABLE · SIN_CFDI_EN_CARPETA` | `Bóveda bloqueada — desbloquéala para calcular` / `Faltan facturas XML o el estado de cuenta` | Replaces leaked `SCREAMING_SNAKE_CASE` enums with clear actionable guidance while keeping zero false `$0.00`s. |
| `SIMPLIFY` | `VaultReconcileCockpit.tsx:429` | `Sin falsos ceros: carga o cifra el lote contable para calcular el amarre real` | `Sube las facturas XML y el estado de cuenta del mes para ver si cuadran.` | Replaces internal agent doctrine wording with direct user instructions. |
| `RENAME` | `VaultReconcileCockpit.tsx:448` | `Cifrar Expediente Contable Real (CFDI 4.0 + BBVA)` | Primary `Subir facturas y estado de cuenta` + Secondary `Probar con ejemplo (3 CFDI + BBVA)` | Separates real client file upload from synthetic demo sample data with 100% honesty. |
| `SIMPLIFY` | `VaultReconcileCockpit.tsx:482, 528, 543` | `SUMA CFDI 4.0 EN RAM (3 XML)` / `PARTIDAS CONCILIADAS EN MEMORIA RAM (3)` | `Total Facturas CFDI (3)` / `Movimientos conciliados (3)` | Keeps financial numbers clean without repeating `EN MEMORIA RAM` on every metric. |

### 2.3 Upload, WhatsApp Requests, Access Center & Multi-Select Basket

| Verdict | File & Line | Verbatim Original | Approved Human Replacement | One-Sentence Reason |
|---|---|---|---|---|
| `KEEP AS-IS` | `SmartUploadOrderModal.tsx:194` | `Subir y Ordenar Archivos Sueltos` | — | Directly addresses messy accountant file batches. |
| `SIMPLIFY` | `SmartUploadOrderModal.tsx:192, 245-250` | `Auto-Orden + AES-256-GCM` / `…lo cifra en bloques de 64 KB y lo ordena en su subcarpeta.` | `Orden automático · Privado` / `…le sugiere un nombre limpio, lo protege antes de subirlo y lo acomoda en su carpeta.` | Eliminates `64 KB` buffer chunk details during drag-and-drop. |
| `KEEP AS-IS` | `WhatsAppDropRequestModal.tsx:230` | `Solicitar Documentos por WhatsApp` | — | Immediately clear and task-focused. |
| `SIMPLIFY` | `WhatsAppDropRequestModal.tsx:228` | `Buzón Secure Drop · Sin Contraseña` | `Recepción directa · Tu cliente no necesita cuenta` | Explains the exact frictionless benefit for the client. |
| `RENAME` | `VaultAccessCenterInline.tsx:109-184` | `ZERO-KNOWLEDGE #FRAGMENT` / `Centro de Accesos #key y Buzones Secure Drop` / `LLave viajando solo tras el signo #` / `Revocación instantánea de ciphertext` | `🔒 Solo quien tenga el enlace completo puede abrirlo` / `Enlaces Compartidos y Buzones de Clientes` / `Ni siquiera el servidor puede abrir el enlace` / `Puedes cancelar el acceso cuando quieras` | Aligns with `docs/trust-copy-contract.md` and eliminates HTTP fragment / `ciphertext` jargon. |
| `RENAME` | `StagingDock.tsx:63-140` + `es/drive.json:75-81` | `En Canasta #key` · `WhatsApp (#key Lote)` · `Cortar en Lote` · `Limpiar Muelle (Esc)` | `Seleccionados` · `Enviar por WhatsApp` · `Quitar acceso` · `Deseleccionar (Esc)` | Fixes literal maritime translation (*Clear Dock* → *Limpiar Muelle*) and ambiguous *Cortar* wording. |

### 2.4 Inspector, Fullscreen Viewer, Filemón Office & Quick Note

| Verdict | File & Line | Verbatim Original | Approved Human Replacement | One-Sentence Reason |
|---|---|---|---|---|
| `KEEP AS-IS` | `VaultInspectorPane.tsx:771` | `Pasaporte Criptográfico ABRN` | — | Memorable metaphor neatly tucked inside a collapsible details strip. |
| `RENAME` | `es/drive.json:62` | `HUD de Exposición de Rutas Externas` | `¿Quién tiene acceso a este archivo?` | Replaces fighter-jet `HUD` jargon with the exact question the owner cares about. |
| `RENAME` | `VaultInspectorPane.tsx:274` | `4K` | `Imagen` | Scanned receipts and IDs are images, not 4K cinema releases. |
| `RENAME` | `VaultInspectorPane.tsx:811` | `Expandir 94vw` (`Abrir en Modal Cinemascope 94vw (Enter)`) | `Pantalla completa` (`Ver en grande (Enter)`) | Removes CSS viewport width units (`94vw`) and film jargon from an everyday button. |
| `SIMPLIFY` | `VaultInspectorPane.tsx:691-694` + `FilePreviewModal.tsx:858` | `RESUMEN CONTABLE IA · 100% EN RAM` · `0 bytes nube` | `Resumen rápido` · `Privado` | Avoids overselling deterministic local triage as `"IA"` while keeping the summary crisp. |
| `RENAME` | `VaultInspectorPane.tsx:706-735` + `continuum-bridge.ts:199-245` | `Nota de Voz Cifrada en RAM` / `+ Grabar Voz RAM` (simulated hardcoded text) | Real persistent, editable & deletable `Nota rápida` (`+ Agregar nota`, quick chips, real optional mic audio, `Guardar` / `Borrar`) | Makes file notes 100% real, persistent across reloads, scrubbable on lock, and free of fake auto-invented `0:12` badges. |
| `REMOVE` | `FilePreviewModal.tsx:806-809` | `AES-256-GCM OPTICAL FOCUS` + `4f1e a432 d88f b290 e712 99ca` | — | Eliminates fake Matrix hex bytes during file opening. |
| `RENAME` | `FilemonOfficeStage.tsx:162, 191, 232` + `drive.json:1014-1020` | `Vista Ejecutiva (Glass Twin)` / `Ficha SAT / Amarre Fiscal (Roche)` / `Copiar JSON Amarre Fiscal (Roche)` | `Vista Lectura` / `Ficha SAT Fiscal` / `Copiar datos fiscales (JSON)` | Removes internal `(Glass Twin)` jargon and hardcoded `(Roche)` client name from global CFDI controls. |
| `SIMPLIFY` | `files.tsx:4063` | `EL RECIBO SAGRADO · TRANSMISIÓN CEL → PC VERIFICADA` | `El Recibo Sagrado · Guardado desde tu celular` | Keeps the iconic *Recibo Sagrado* identity while explaining what just happened in plain Spanish. |

### 2.5 Privacy Curtain, Native Mobile App & PC + Celular Mirror

| Verdict | File & Line | Verbatim Original | Approved Human Replacement | One-Sentence Reason |
|---|---|---|---|---|
| `KEEP AS-IS` | `es/drive.json:83-84` | `Bóveda protegida por seguridad` — *«Tu pantalla descansó para cuidar tus archivos…»* | — | Warm, reassuring, zero-anxiety plain Spanish. |
| `SIMPLIFY` | `VaultPrivacyShutter.tsx:70` | `0.0 MB en RAM · Llaves Purgadas · Continuum Sync` | `Tus archivos están ocultos` | Removes alarming `"Llaves Purgadas"` phrasing above the PIN pad. |
| `KEEP AS-IS` | `MobileSovereignHeaderAndHub.tsx:78-90` + `bottom-nav.tsx:107-168` | `⚡ Pulso Fiscal` · `📁 Expediente` · `Pulso · Archivos · Escanear · Entregas · Bloquear` | — | Passes the *Consigliere Fiscal Rule* with 48px thumb ergonomics and instant clarity. |
| `SIMPLIFY` | `bottom-nav.tsx:130` | `aria-label="Abrir Escáner Fiscal AES-256 en RAM"` | `aria-label="Escanear documento"` | Gives TalkBack screen-reader users a clean action label. |
| `RENAME` | `MobileSovereignHeaderAndHub.tsx:144-268` | `PASE SOBERANO · AES-256 RAM` · `Archivos RAM` · `Bandeja Drop` · `Bandeja Secure Drop sin Cuenta` · `Zero-Knowledge` | `Resumen del cliente` · `Archivos` · `Recibidos` · `Pedir documentos por WhatsApp` | Cleans repetitive technical suffixes from mobile cards and adheres to `docs/trust-copy-contract.md`. |
| `SIMPLIFY` | `MobileScannerSheet.tsx:133, 160` | `WEBCRYPTO DIRECTO EN RAM · 0 BYTES GALERÍA` / `● ENCUADRE FISCAL AUTO · 99.4%` | `🔒 Va directo a la bóveda — no se queda en tus fotos` / `Elige qué documento vas a fotografiar` | Replaces cryptic `0 BYTES GALERÍA` and fake `99.4%` optics with the real privacy benefit users love. |
| `RENAME` | `ContinuumDockPane.tsx:257-341` | `ESTUDIO MÓVIL SOBERANO · PUENTE 0MS` / `ABRN Pocket Vault — Paridad Criptográfica 1:1` / `Probar Cortina de Pánico Simultánea` / `vía popstate` / `BroadcastChannel + AES-256-GCM Real` | `Vista en vivo de tu celular` / `Tus mismos archivos en versión móvil` / `Bloquear PC y celular al mismo tiempo (⌘L)` / `Celular sincronizado en vivo` | Purges JavaScript API names (`popstate`, `BroadcastChannel`) and `"Cortina de Pánico"` anxiety from the companion pane. |

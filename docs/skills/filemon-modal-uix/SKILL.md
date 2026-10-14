---
name: filemon-modal-uix
description: >-
  Universal Cinemascope Executive Modal & Sticky Tactical Dock UI/UX architecture skill.
  Builds high-impact, widescreen (90-94vw) modal viewports with frozen headers, breathable
  content stages, proactive transmutation decks, and frozen bottom tactical docks.
  Couch-approved, thumb-first, zero dead-ends, and 48px trucker targets.
---

# Filemón Modal UI/UX (filemon-modal-uix)
> **The Universal Cinemascope Executive Modal & Sticky Tactical Dock Architecture**  
> *"When inspecting any high-value asset, code file, property, invoice, or payload, the screen must breathe. Break free from cramped 500px drawers."*  
> *"All primary operational levers must live permanently frozen at the bottom of the viewport within natural thumb sweep."*

---

## 1. IDENTITY, ORIGIN & CORE DOCTRINE

### The Problem This Skill Solves
Traditional web applications suffer from what we call **"The Keyhole Anti-Pattern"**:
1. **The Cramped Drawer**: You are inspecting a 400-line source code snippet, a multi-million peso real estate property, or a complex fiscal invoice, yet the interface squeezes everything into a narrow 480–600px drawer or a postage-stamp modal.
2. **Scrolled-Off Levers**: The user scrolls down through 8 screens of photos, amenities, or logs, and the "Copy", "Delete", "Close", or "Authorize" buttons vanish off-screen. The user has to scroll all the way back to the top just to take action.
3. **Delicate Micro-Targets**: Small 24px icon buttons squeezed next to each other, causing accidental mis-taps on mobile devices or tablets.
4. **Lack of Instant Feedback**: After taking an action, the modal hangs or displays a spin-wheel, leaving the user guessing whether the server received it.

### The Filemón Modal Doctrine (The 4 Pillars)
1. **Cinemascope Breathability (90–94vw Desktop Viewport)**: When an executive or developer opens an item, it commands the screen with widescreen presence (`clamp(720px, 92vw, 1200px)`), framed by a rich frosted dark-glass backdrop.
2. **The 3-Zone Immutable Stack**:
   - **Zone 1: Frozen Hero Header (`sticky top: 0, z-index: 30`)**: Always visible. Identifies the entity, origin device, type badge, and verifiable timestamp receipts.
   - **Zone 2: Breathable Content Core (`overflow-y: auto, flex: 1`)**: High-definition stage for viewing photos, syntax-highlighted code, documents, or financial tables, accompanied by a proactive **Instant Dispatch Deck**.
   - **Zone 3: Frozen Sticky Tactical Dock (`sticky bottom: 0, z-index: 30`)**: Permanently anchored at the bottom of the viewport with a frosted glass seal, housing 48px trucker targets, safe exit on the left, live cryptographic receipts in the center, and primary actions on the right.
3. **Ergonomía de Sillón (Armchair & Couch Approved)**:
   - Designed for a human lying on a couch holding a phone with one hand, or a power user on a mechanical keyboard.
   - All primary levers live in the **lower 40% thumb sweep**.
   - Minimum tap target of **48×48px** with at least 12px clearance between destructive and constructive levers.
4. **Zero Dead Ends & Keyboard God-Mode**:
   - Every state provides an immediate next step.
   - Full keyboard navigation: `<kbd>Esc</kbd>` to close, `<kbd>Enter</kbd>` or `<kbd>C</kbd>` to copy/confirm, `<kbd>Del</kbd>` with 2-step arming to delete, `<kbd>1-9</kbd>` for instant action dispatch.

---

## 2. THE 3-ZONE GEOMETRY SPECIFICATION

```text
+-----------------------------------------------------------------------------------+
|  [ZONE 1] FROZEN HERO HEADER (Sticky top: 0, z-index: 30, backdrop-blur: 20px)    |
|  [BADGE: TYPE/STATUS]  [ORIGIN PILL]  [TELEMETRY]        [TIMESTAMP]  [CERRAR ESC] |
+-----------------------------------------------------------------------------------+
|  [ZONE 2] BREATHABLE CONTENT CORE & INSTANT DISPATCH DECK (overflow-y: auto)      |
|                                                                                   |
|  [⚡ ACCIONES RÁPIDAS / TRANSMUTAR:  [B1]  [B2]  [B3]  [B4] ]                     |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |  HIGH-DEFINITION VIEWPORT (Obsidian #080c16 / Photo Gallery / Table Stage) |  |
|  |  - Full horizontal width breathing space                                   |  |
|  |  - Comfortable line height, monospace syntax, or responsive media           |  |
|  |  - Zero keyhole clipping                                                    |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|  [ZONE 3] FROZEN STICKY TACTICAL DOCK (Sticky bottom: 0, z-index: 30, blur: 24px) |
|  [← Volver Esc]      |  [Recibo #ID • Tamaño • 0 Delta]  |  [★] [🗑️] [ACCION HERO] |
+-----------------------------------------------------------------------------------+
```

### Viewport Formulas & Measurements
| Device / Surface | Width Formula | Max Height | Border Radius | Backdrop Treatment |
|---|---|---|---|---|
| **Desktop / Laptop** (`≥ 981px`) | `clamp(720px, 92vw, 1200px)` | `88vh` | `20px` continuous squircle | `rgba(2, 6, 23, 0.75)` + `blur(14px)` |
| **Tablet / Landscape** (`768px - 980px`) | `96vw` | `90vh` | `18px` | `rgba(2, 6, 23, 0.8)` + `blur(14px)` |
| **Mobile / Phone** (`≤ 767px`) | `100vw` (Bottom Sheet) | `88dvh` | `24px 24px 0 0` | `rgba(2, 6, 23, 0.85)` + `blur(16px)` |

---

## 3. DOMAIN ARCHETYPES (ADAPTING TO ANY PRODUCT OR ITEM)

This architecture is completely universal. Here is how you map the 3 zones across 4 core business domains:

### Archetype A: Technical & Developer Items (Clips, Code, APIs, SQL, Logs)
- **Zone 1 (Hero Header)**:
  - Type Badge: `[</> CÓDIGO]`, `[📄 JSON]`, `[🐍 PYTHON]`, `[🗄️ SQL]`
  - Origin Pill: `🪟 Windows Desktop`, `🐧 Linux VPS`, `📱 Android Pixel`, `🤖 Agent Mesh`
  - Telemetry: `42 lin • 1,280 chars`, `1.4 KB`
  - Timestamp: `hace 5 min • 12:44:20 PM`
  - Close: `[Cerrar Esc]`
- **Zone 2 (Stage & Dispatch Deck)**:
  - Dispatch Deck:
    - If JSON: `[⚡ TypeScript Interface]`, `[📐 Prettify JSON]`, `[🗜️ Minify]`
    - If cURL: `[🐍 Python Requests]`, `[🌐 JS Fetch]`
    - If OTP: `[🔑 Copiar Código OTP (6 dígitos)]`
    - If SQL: `[🗄️ Formatear SQL]`
    - General: `[📝 Guardar en Prompt Library]`, `[📋 Copiar Texto Puro]`
  - Stage: Monospace container `#080c16`, syntax coloring, line numbers, word-wrap toggle.
- **Zone 3 (Sticky Tactical Dock)**:
  - Left: `[← Volver Esc]`
  - Center: `Clip #23605 • 1.4 KB • 0 Delta`
  - Right: `[★ Favorito]`, `[🗑️ Borrar (Armed 2-Step)]`, `[📋 COPIAR AL PORTAPAPELES (Enter/C)]` (Luminous Emerald Hero).

---

### Archetype B: Real Estate & High-Value Inventory (Properties, Vehicles, Luxury Items)
- **Zone 1 (Hero Header)**:
  - Status Badge: `[✓ DISPONIBLE]`, `[RESERVADO]`, `[PRE-VENTA]`
  - Entity Folio: `Depa 402 — Torre Ámbar`
  - Origin/Location: `📍 Zapopan Norte, Jal.`
  - Price Tag: Bold Electric Blue `$4,850,000 MXN`
  - Close: `[Cerrar Esc]`
- **Zone 2 (Stage & Dispatch Deck)**:
  - Dispatch Deck: `[📱 WhatsApp al Cliente]`, `[📄 Ficha Técnica PDF]`, `[🔗 Copiar Link Público]`, `[📐 Calcular Hipoteca]`
  - Stage: High-res Cinemascope photo carousel (16:9), architectural blueprint viewer, amenity chips (`Alberca`, `Piso 4`, `2 Cajones`), payment schedule table.
- **Zone 3 (Sticky Tactical Dock)**:
  - Left: `[← Volver al Inventario Esc]`
  - Center: `Enganche: $970,000 MXN (20%) • Mensualidad: $34,200`
  - Right: `[❤️ Guardar Lead]`, `[📅 Agendar Visita]`, `[📝 APARTAR UNIDAD AHORA]` (Luminous Royal Blue Hero).

---

### Archetype C: Invoices, CFDIs, Fiscal & Financial Documents
- **Zone 1 (Hero Header)**:
  - Fiscal Badge: `[CFDI 4.0 INGRESO]`, `[✓ VIGENTE SAT]`
  - Entity UUID: `UUID: 4a2b8e...c3f1`
  - Emisor / Receptor: `🏢 TechCorp S.A. ➔ 👤 Victor Cazares`
  - Amount: Bold Emerald `$28,450.00 MXN`
  - Close: `[Cerrar Esc]`
- **Zone 2 (Stage & Dispatch Deck)**:
  - Dispatch Deck: `[📥 Descargar XML]`, `[📄 Descargar PDF Oficial]`, `[🔍 Validar en SAT]`, `[⚡ Conciliar con Banco]`
  - Stage: Itemized concepts table (Product, Quantity, Unit Price, Tax breakdown), digital stamp verification seal.
- **Zone 3 (Sticky Tactical Dock)**:
  - Left: `[← Regresar a Facturas Esc]`
  - Center: `Folio Fiscal #8839 • Sello SHA-256 Verificado`
  - Right: `[⚠️ Reportar Discrepancia]`, `[💳 REGISTRAR PAGO]` (Luminous Emerald Hero).

---

### Archetype D: CRM, Customer Dossiers & Deal Pipelines
- **Zone 1 (Hero Header)**:
  - Avatar & Name: `Arturo Montiel`
  - Role/Stage: `[PROSPECTO CALIFICADO]`, `Score: 94/100`
  - Channel Pill: `📱 WhatsApp • Tel: +52 33 1234 5678`
  - Last Activity: `Último contacto: hace 2 horas`
  - Close: `[Cerrar Esc]`
- **Zone 2 (Stage & Dispatch Deck)**:
  - Dispatch Deck: `[📞 Registrar Llamada]`, `[✉️ Enviar Correo]`, `[💬 Abrir WhatsApp]`, `[📋 Duplicar Datos]`
  - Stage: Chronological interaction timeline, active deal cards, customer notes, attached files.
- **Zone 3 (Sticky Tactical Dock)**:
  - Left: `[← Volver a Prospectos Esc]`
  - Center: `Valor en Pipeline: $120,000 USD • Fase: Negociación`
  - Right: `[🚫 Descartar]`, `[🤝 CERRAR TRATO AHORA]` (Luminous Indigo Hero).

---

### Archetype E: ABRN-Drive Encrypted Vault Assets & Zero-Knowledge Previews (`/lamp/www/ABRN-Drive`)
- **Primary Components**: `FilePreviewModal.tsx`, `VaultOmnibar.tsx`, `MobileShareSheet.tsx`, `CreateShareLinkModal.tsx`, `ReciboSagradoCard.tsx`
- **Zone 1 (Hero Header)**:
  - Cryptographic & Triage Badge: `[🔒 AES-256-GCM]`, `[CFDI 4.0]`, `[CONTRATO]`, `[CREDENCIAL ID]` (from `document-triage.ts`)
  - Origin / Folder Pill: `📁 Bóveda / Fiscal 2026` or `📥 Secure Drop`
  - Telemetry: `2.4 MB • Chunked 64KB • Sello SHA-256`
  - Close: `[Cerrar Esc]` (immediately revokes temporary `Blob` URLs and scrubs ephemeral preview buffers)
- **Zone 2 (Stage & Dispatch Deck)**:
  - Dispatch Deck: `[💬 Enviar por WhatsApp]`, `[🔗 Crear Link Temporal (#key)]`, `[📥 Descargar Original]`, `[🏷️ Auto-nombrar: {suggestedFilename}]`, `[📋 Copiar SHA-256 (⌘⇧C)]`
  - Stage: Zero-knowledge in-memory decrypted PDF/image/code/XML viewer (`FilePreviewModal.tsx`) that automatically feeds a 64KB snippet (`extractSnippetForIndexing` in `streaming-decrypt.ts`) into `globalVaultSearchIndex.enrichDocument()`.
- **Zone 3 (Sticky Tactical Dock)**:
  - Left: `[← Volver a Bóveda Esc]` (`48px` trucker target)
  - Center: `Sello SHA-256: e3b0c442... • 0 Bytes Delta • Cifrado en Navegador`
  - Right: `[🗑️ Borrar (2-Step Armed 5s)]`, `[🔗 COMPARTIR CON LLAVE EN FRAGMENTO (⌘S)]` (Luminous Emerald/Sapphire Hero).

---

## 4. THE 7 IRON LAWS OF EXPERIENCIA DE BARRIO (MODAL CERTIFICATION)

Every modal built using this skill must pass these 7 Barrio Quality Gates:

```
+-----------------------------------------------------------------------------------+
|                        EXPERIENCIA DE BARRIO NIVEL DIOS                           |
+-----------------------------------------------------------------------------------+
|  1. LEY TOLA:             ¿Qué pasó? ¿Cómo sé que jaló? ¿Qué sigue? (<300ms)      |
|  2. ERGONOMÍA DE SILLÓN:  Operación con 1 mano, pulgar en 40% inferior, targets ≥48px |
|  3. CERO MAMADAS:         Estados físicos reales. Prohibidos los falsos ceros ($0) |
|  4. RESCATE > DISCULPA:   Tu chamba sobrevivió. Nunca castigar al usuario por bugs |
|  5. LENGUAJE DE CANCHA:   Cero jerga de ingeniero. Verdad directa y entendible    |
|  6. HUELLA & RECIBOS:     Evidencia donde importa. Folios, marcas de tiempo, autor |
|  7. TEST DE LA ESQUINA:   "¿Y esta mamada qué?" respondido en <3 segundos         |
+-----------------------------------------------------------------------------------+
```

### 1. 🥇 Ley Tola (<300ms Proof of Life)
- When the user clicks an action in the modal (Copy, Transmute, Save, Delete), give immediate tactile confirmation:
  - Web Audio click haptic: `playHaptic('tick')` or high-frequency glass click.
  - Visual confirmation: Button changes state, halo pulse, toast receipt appears in <100ms.
  - Close immediately on decisive actions; let server synchronization proceed in the background.

### 2. 🛋️ Ergonomía de Sillón y Pulgar Sucio
- **Bottom 40% Rule**: On mobile viewports (`≤ 980px`), all primary levers (Close, Delete, Copy, Primary Action) are locked in the bottom sticky dock, perfectly resting in the thumb sweep.
- **Trucker Touch Targets**: Every button has a minimum height/width of **44–48px**.
- **Accidental Click Clearance**: Constructive actions (e.g. `Copiar`) and destructive actions (e.g. `Borrar`) must have at least 12px separation or be on opposing sides.

### 3. 🚫 Estado Cero Mamadas (No False Zeros)
- Never display `0 lines`, `$0.00`, or empty telemetry while data is loading.
- Display semantic placeholder badges: `[ Calculando líneas... ]` or `[ Cargando tamaño... ]`.
- Always show true bytes, true dimensions, and genuine timestamps.

### 4. 🛟 Rescate Sobre Disculpa (Armed 2-Step Safety)
- **Destructive Action Arming**: Never delete or purge an item on a single accidental tap!
  - Tap 1: Button turns red with `¿Borrar?` or `¿Confirmar?` and an arming pulse.
  - Arming Window: Exactly 5 seconds.
  - Tap 2: Executes deletion.
  - Timeout: Reverts safely to the neutral state if not tapped within 5 seconds.
- **Stage Memory**: If the user transmutas or edits text, the state survives in memory so that clicking the primary `Copiar` copies the **transmuted state**, not stale initial text.

### 5. 🗣️ Lenguaje de Cancha (Human Plain Truth)
- Banish robotic system labels:
  - ❌ `Execute Transmutation Directive` ➔ ✅ `⚡ TypeScript Interface`
  - ❌ `Dismiss Modal Container` ➔ ✅ `← Volver (Esc)`
  - ❌ `Purge DB Record #236` ➔ ✅ `Borrar apunte`
  - ❌ `Commit Clipboard Transaction` ➔ ✅ `Copiar al Portapapeles`

### 6. 🧾 La Huella Digital (Verifiable Receipts)
- The center zone of the Sticky Tactical Dock must always display a receipt:
  - `Clip #23605 • 1.4 KB • 0 Delta`
  - `Folio #8839 • Sello SAT Válido • $28,450.00`
  - `Unidad #402 • Enganche 20% • Verificado 2026-10-05`

### 7. 👴 El Test de la Esquina ("¿Y esta mamada qué?")
- If a person looks over your shoulder on a bus and asks: *"¿Y esta mamada qué?"*, the screen must be self-explanatory in under 3 seconds:
  1. Top badge clearly states what the object is (`[CÓDIGO]`, `[DEPTO DISPONIBLE]`).
  2. Large legible content in the center.
  3. One unmistakable, luminous, glowing primary action button on the bottom right.

---

## 5. MASTER PRODUCTION-READY CODE IMPLEMENTATION

Here is the complete, drop-in HTML, CSS, and JavaScript implementation ready for any project.

### Semantic HTML5 Template (`template.html`)
```html
<!-- CINEMASCOPE EXECUTIVE MODAL & STICKY TACTICAL DOCK -->
<dialog id="executive-modal" class="cinemascope-modal" aria-labelledby="modal-title" aria-modal="true">
  <!-- Mobile drag pill affordance -->
  <div class="sheet-drag-pill mobile-only" aria-hidden="true"></div>

  <!-- ZONE 1: FROZEN HERO HEADER (Sticky Top) -->
  <header class="executive-hero-header">
    <div class="hero-left-cluster">
      <span id="modal-type-badge" class="badge executive-badge">PROPIEDAD</span>
      <span id="modal-origin-pill" class="origin-pill">🏢 Torre Real</span>
      <span id="modal-telemetry-chip" class="telemetry-chip">Piso 4 • 120 m²</span>
      <span id="modal-metric-chip" class="telemetry-chip">$4,850,000 MXN</span>
    </div>
    <div class="hero-right-cluster">
      <span id="modal-timestamp-chip" class="timestamp-chip">Hace 10 min</span>
      <button id="modal-close-btn" class="executive-close-btn" type="button" aria-label="Cerrar modal (Esc)" title="Cerrar (Esc)">
        <span class="close-label desktop-only">Esc</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </header>

  <!-- ZONE 2: BREATHABLE STAGE & PROACTIVE ACTION DECK -->
  <div class="executive-stage" id="modal-stage-body">
    <!-- Proactive Action / Transmutation Deck -->
    <nav class="modal-transmute-deck" aria-label="Acciones rápidas">
      <span class="transmute-deck-label">⚡ Acciones:</span>
      <button class="transmute-chip-btn" data-action="action-1" type="button">📄 Ficha Técnica PDF</button>
      <button class="transmute-chip-btn" data-action="action-2" type="button">💬 Enviar WhatsApp</button>
      <button class="transmute-chip-btn" data-action="action-3" type="button">📐 Cotizar Hipoteca</button>
    </nav>

    <!-- Main Content Stage (Replaced dynamically) -->
    <div class="stage-content-viewport" id="modal-content-stage">
      <!-- High-Def code, image gallery, or data table injected here -->
    </div>
  </div>

  <!-- ZONE 3: FROZEN STICKY BOTTOM TACTICAL DOCK -->
  <footer class="modal-sticky-dock">
    <!-- Left Zone: Safe Return -->
    <div class="dock-left-zone">
      <button id="modal-dock-back" class="dock-btn outline trucker-target" type="button" title="Volver (Esc)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
          <path d="M19 12H5M12 19l-7-7 7-7"></path>
        </svg>
        <span class="desktop-only">Volver</span>
        <kbd class="kbd-subtle">Esc</kbd>
      </button>
    </div>

    <!-- Center Zone: Cryptographic Receipts -->
    <div class="dock-center-zone">
      <span id="modal-dock-receipt" class="dock-receipt-badge">Folio #402 • Enganche 20% • 0 Delta</span>
    </div>

    <!-- Right Zone: Primary Levers -->
    <div class="dock-right-zone">
      <button id="modal-dock-pin" class="btn icon-action trucker-target" type="button" title="Marcar como favorito (P / F)" aria-label="Favorito">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </button>
      <button id="modal-dock-delete" class="btn icon-action danger trucker-target" type="button" title="Borrar (Del)" aria-label="Borrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
      <button id="modal-dock-hero-action" class="btn primary dock-hero-action trucker-target" type="button" title="Acción principal (Enter)">
        <span id="modal-hero-action-text">APARTAR AHORA</span>
        <kbd class="kbd-subtle">Enter</kbd>
      </button>
    </div>
  </footer>
</dialog>
```

---

### Pure CSS Architecture (`modal.css`)
```css
/* ==========================================================================
   FILEMÓN MODAL UI/UX — MASTER STYLESHEET
   Universal Cinemascope Canvas & Sticky Tactical Dock
   ========================================================================== */

/* 1. Modal Canvas Geometry & Deep Backdrop */
.cinemascope-modal {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) scale(0.96) !important;
  max-width: 1160px !important;
  width: 92vw !important;
  max-height: 88vh !important;
  border-radius: 20px !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  background: rgba(11, 17, 33, 0.95) !important;
  backdrop-filter: blur(48px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(48px) saturate(180%) !important;
  box-shadow: 
    0 32px 72px -16px rgba(0, 0, 0, 0.85),
    0 0 0 1px rgba(255, 255, 255, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  color: #f8fafc !important;
  opacity: 0 !important;
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.cinemascope-modal[open] {
  opacity: 1 !important;
  transform: translate(-50%, -50%) scale(1) !important;
}

.cinemascope-modal::backdrop {
  background: rgba(3, 7, 18, 0.75) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  transition: backdrop-filter 0.3s ease !important;
}

/* 2. Zone 1: Frozen Hero Header (Sticky Top) */
.executive-hero-header {
  position: sticky !important;
  top: 0 !important;
  z-index: 30 !important;
  background: rgba(13, 20, 38, 0.94) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
  padding: 12px 20px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  flex-shrink: 0 !important;
}

.hero-left-cluster, .hero-right-cluster {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.executive-badge {
  font-size: 11px !important;
  font-weight: 800 !important;
  letter-spacing: 0.05em !important;
  text-transform: uppercase !important;
  padding: 4px 10px !important;
  border-radius: 6px !important;
  line-height: 1 !important;
  background: rgba(56, 189, 248, 0.15) !important;
  color: #38bdf8 !important;
  border: 1px solid rgba(56, 189, 248, 0.3) !important;
}

.origin-pill {
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  padding: 3px 8px !important;
  border-radius: 6px !important;
  font-size: 11px !important;
  color: #94a3b8 !important;
}

.telemetry-chip {
  display: inline-flex !important;
  align-items: center !important;
  background: rgba(56, 189, 248, 0.08) !important;
  border: 1px solid rgba(56, 189, 248, 0.2) !important;
  color: #38bdf8 !important;
  padding: 3px 8px !important;
  border-radius: 6px !important;
  font-size: 11px !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-weight: 600 !important;
}

.timestamp-chip {
  font-size: 11.5px !important;
  color: #64748b !important;
  font-family: 'JetBrains Mono', monospace !important;
}

.executive-close-btn {
  height: 34px !important;
  min-height: 34px !important;
  padding: 0 10px !important;
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 8px !important;
  color: #94a3b8 !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
}
.executive-close-btn:hover {
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.3) !important;
  color: #ef4444 !important;
}
.executive-close-btn .close-label {
  font-size: 10px !important;
  font-weight: 700 !important;
  opacity: 0.8 !important;
}

/* 3. Zone 2: Breathable Content Core */
.executive-stage {
  flex: 1 !important;
  overflow-y: auto !important;
  padding: 20px 24px 28px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 16px !important;
  min-height: 220px !important;
}

/* Instant Dispatch Deck */
.modal-transmute-deck {
  display: flex !important;
  align-items: center !important;
  flex-wrap: wrap !important;
  gap: 8px !important;
  padding: 10px 14px !important;
  background: rgba(15, 23, 42, 0.75) !important;
  border: 1px solid rgba(56, 189, 248, 0.18) !important;
  border-radius: 12px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
}

.transmute-deck-label {
  font-size: 10.5px !important;
  font-weight: 800 !important;
  letter-spacing: 0.06em !important;
  color: #38bdf8 !important;
  text-transform: uppercase !important;
  display: flex !important;
  align-items: center !important;
  gap: 5px !important;
  margin-right: 4px !important;
}

.transmute-chip-btn {
  height: 32px !important;
  padding: 0 12px !important;
  font-size: 11.5px !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
  border: 1px solid rgba(56, 189, 248, 0.25) !important;
  background: rgba(56, 189, 248, 0.08) !important;
  color: #7dd3fc !important;
  cursor: pointer !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  transition: all 0.15s ease !important;
}
.transmute-chip-btn:hover {
  background: rgba(56, 189, 248, 0.2) !important;
  border-color: #38bdf8 !important;
  color: #ffffff !important;
  transform: translateY(-1px) !important;
}
.transmute-chip-btn:active {
  transform: translateY(1px) scale(0.97) !important;
}

/* High-Definition Content Stages */
.stage-code-container {
  background: #080c16 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 14px !important;
  padding: 16px 20px !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 13.5px !important;
  line-height: 1.65 !important;
  color: #e2e8f0 !important;
  overflow-x: auto !important;
  white-space: pre-wrap !important;
  word-break: break-word !important;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.5) !important;
}

/* 4. Zone 3: Frozen Sticky Bottom Tactical Dock */
.modal-sticky-dock {
  position: sticky !important;
  bottom: 0 !important;
  z-index: 30 !important;
  background: rgba(10, 16, 30, 0.96) !important;
  backdrop-filter: blur(24px) saturate(200%) !important;
  -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
  border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: 0 -12px 36px rgba(0, 0, 0, 0.7) !important;
  padding: 12px 20px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  flex-shrink: 0 !important;
}

.dock-left-zone, .dock-right-zone {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
}

.dock-center-zone {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.dock-receipt-badge {
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 11px !important;
  color: #94a3b8 !important;
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  padding: 4px 12px !important;
  border-radius: 6px !important;
}

/* 48px Trucker Touch Targets */
.trucker-target {
  height: 48px !important;
  min-height: 48px !important;
  padding: 0 18px !important;
  border-radius: 10px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
}

.dock-btn.outline {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  color: #f8fafc !important;
}
.dock-btn.outline:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: rgba(255, 255, 255, 0.25) !important;
}

.dock-hero-action {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
  color: #ffffff !important;
  border: none !important;
  font-weight: 700 !important;
  box-shadow: 0 4px 18px rgba(16, 185, 129, 0.4) !important;
  min-width: 150px !important;
}
.dock-hero-action:hover {
  transform: translateY(-1px) !important;
  box-shadow: 0 6px 24px rgba(16, 185, 129, 0.5) !important;
  filter: brightness(1.08) !important;
}
.dock-hero-action:active {
  transform: translateY(1px) scale(0.98) !important;
}

/* Pin Favorite Active State */
.modal-sticky-dock #modal-dock-pin.favorited {
  color: #fbbf24 !important;
  border-color: rgba(251, 191, 36, 0.4) !important;
  background: rgba(251, 191, 36, 0.12) !important;
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.3) !important;
}
.modal-sticky-dock #modal-dock-pin.favorited svg {
  fill: #fbbf24 !important;
  stroke: #fbbf24 !important;
}

/* 2-Step Armed Delete Button */
.modal-sticky-dock #modal-dock-delete.armed {
  background: rgba(239, 68, 68, 0.25) !important;
  border-color: #ef4444 !important;
  color: #ffffff !important;
  box-shadow: 0 0 14px rgba(239, 68, 68, 0.5) !important;
  animation: armed-pulse 1.2s infinite ease-in-out !important;
}

@keyframes armed-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.kbd-subtle {
  font-size: 9.5px !important;
  font-weight: 700 !important;
  opacity: 0.75 !important;
  background: rgba(0, 0, 0, 0.35) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  border-radius: 4px !important;
  padding: 1px 5px !important;
  font-family: 'JetBrains Mono', monospace !important;
}

/* 5. Mobile Adaptive Bottom Sheet (≤ 980px) */
@media (max-width: 980px) {
  .cinemascope-modal {
    top: auto !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    width: 100vw !important;
    max-width: 100vw !important;
    max-height: 88dvh !important;
    border-radius: 24px 24px 0 0 !important;
    border-bottom: none !important;
    transform: translateY(100%) !important;
    transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease !important;
  }
  .cinemascope-modal[open] {
    transform: translateY(0) !important;
  }
  .dock-center-zone {
    display: none !important;
  }
  .modal-sticky-dock {
    padding: 10px 14px max(16px, env(safe-area-inset-bottom, 16px)) !important;
  }
  .hero-left-cluster {
    flex-wrap: wrap !important;
  }
}
```

---

### Pure JavaScript State Controller (`modal.js`)
```javascript
/**
 * Filemón Modal State Controller
 * Handles 3-zone orchestration, 2-step armed deletion, keyboard god-mode,
 * stage-aware execution, and Web Audio tactile haptics.
 */
class FilemonModal {
  constructor(dialogId = 'executive-modal') {
    this.dialog = document.getElementById(dialogId);
    this.stage = document.getElementById('modal-stage-body');
    this.activePayload = null;
    this.activeTransmutedText = '';
    this.deleteArmedAt = 0;
    this.deleteTimer = null;
    this.keydownHandler = null;

    this.bindStaticListeners();
  }

  // Audio & Tactile Haptic Feedback
  playTick() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  resetDeleteArm() {
    this.deleteArmedAt = 0;
    if (this.deleteTimer) clearTimeout(this.deleteTimer);
    const btn = document.getElementById('modal-dock-delete');
    if (btn) {
      btn.classList.remove('armed');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
      btn.title = 'Borrar (Del)';
    }
  }

  bindStaticListeners() {
    // Backdrop click closes dialog
    this.dialog?.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.close();
    });

    // Top and dock close buttons
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('modal-dock-back')?.addEventListener('click', () => this.close());

    // 2-Step Armed Delete Handler
    document.getElementById('modal-dock-delete')?.addEventListener('click', async () => {
      const now = Date.now();
      const btn = document.getElementById('modal-dock-delete');

      // First tap: Arm the delete button for 5 seconds
      if (now - this.deleteArmedAt > 5000) {
        this.deleteArmedAt = now;
        if (btn) {
          btn.classList.add('armed');
          btn.innerHTML = `<span style="font-size:11px;font-weight:800;">¿Borrar?</span>`;
          btn.title = 'Toca de nuevo para confirmar borrado';
        }
        this.playTick();
        this.deleteTimer = setTimeout(() => this.resetDeleteArm(), 5000);
        return;
      }

      // Second tap: Confirmed! Close immediately and trigger callback
      this.resetDeleteArm();
      this.close();
      this.playTick();
      if (this.onDelete) await this.onDelete(this.activePayload);
    });

    // Hero Action Button
    document.getElementById('modal-dock-hero-action')?.addEventListener('click', async () => {
      this.playTick();
      if (this.onHeroAction) {
        await this.onHeroAction(this.activePayload, this.activeTransmutedText);
      }
      this.close();
    });
  }

  open(payload = {}, options = {}) {
    if (!this.dialog) return;
    this.activePayload = payload;
    this.activeTransmutedText = payload.text || '';
    this.resetDeleteArm();

    // 1. Populate Zone 1: Frozen Hero Header
    document.getElementById('modal-type-badge').textContent = (payload.type || 'ITEM').toUpperCase();
    document.getElementById('modal-origin-pill').textContent = payload.origin || 'Sistema';
    document.getElementById('modal-telemetry-chip').textContent = payload.telemetry || '';
    document.getElementById('modal-metric-chip').textContent = payload.metric || '';
    document.getElementById('modal-timestamp-chip').textContent = payload.timestamp || 'Ahora';

    // 2. Populate Zone 2: Stage & Content
    const stageContainer = document.getElementById('modal-content-stage');
    if (stageContainer) {
      stageContainer.innerHTML = options.renderStage 
        ? options.renderStage(payload)
        : `<div class="stage-code-container"><code>${payload.text || ''}</code></div>`;
    }

    // 3. Populate Zone 3: Sticky Dock
    document.getElementById('modal-dock-receipt').textContent = payload.receipt || 'Recibo #0 • 0 Delta';
    if (options.heroActionText) {
      document.getElementById('modal-hero-action-text').textContent = options.heroActionText;
    }

    // Callbacks
    this.onDelete = options.onDelete || null;
    this.onHeroAction = options.onHeroAction || null;

    // Keyboard God-Mode
    if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
    this.keydownHandler = (e) => {
      if (!this.dialog.open) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'Enter' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        document.getElementById('modal-dock-hero-action')?.click();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        document.getElementById('modal-dock-delete')?.click();
      }
    };
    window.addEventListener('keydown', this.keydownHandler);

    this.dialog.showModal();
    this.playTick();
  }

  close() {
    if (!this.dialog) return;
    this.resetDeleteArm();
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    this.dialog.close();
  }
}
```

---

## 6. AUDIT CHECKLIST FOR ANY AGENT (THE 10 COLD-REALITY QUESTIONS)

Before delivering any modal built with this skill, answer:
- [ ] **1. 92vw Canvas**: Does the modal expand to `clamp(720px, 92vw, 1200px)` on desktop so content breathes?
- [ ] **2. Frozen Header (`top: 0`)**: Does the header stay pinned while scrolling through long content?
- [ ] **3. Frozen Sticky Dock (`bottom: 0`)**: Does the action dock stay pinned with frosted glass at the bottom?
- [ ] **4. 48px Trucker Targets**: Are all buttons at least 44–48px tall and thumb-friendly?
- [ ] **5. Armed 2-Step Deletion**: Does tapping delete arm for 5 seconds (`¿Borrar?`) instead of destroying data on 1 tap?
- [ ] **6. Stage-Aware Execution**: If an action transmutas or changes the content, does the primary action use the updated state?
- [ ] **7. Zero False Zeros**: Does the header display true bytes/metrics rather than `$0.00` or empty placeholders?
- [ ] **8. Keyboard God-Mode**: Does `Esc` close, `Enter/C` trigger hero action, and `Del` trigger delete?
- [ ] **9. Mobile Bottom-Sheet**: On screens `≤ 980px`, does it morph into a bottom sheet with safe-area padding?
- [ ] **10. Ley Tola Feedback**: Does every button provide auditory/visual feedback in `<100ms`?

---

## 7. INSTALLATION ACROSS ANY PROJECT

Run the bundled universal installer script to copy this skill into any repository on this machine:

```bash
bash /lamp/www/uremoteclipboard/.agents/skills/filemon-modal-uix/install.sh /lamp/www/<tu-proyecto>
```
